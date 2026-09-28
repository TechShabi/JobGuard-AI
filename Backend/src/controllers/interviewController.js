const InterviewSession = require("../models/InterviewSession");
const ResumeProfile = require("../models/ResumeProfile");
const Resume = require("../models/Resume");
const {
  generateInterviewQuestions,
  generateAdaptiveInterviewStep,
  generateInterviewReport,
} = require("../services/aiService");
const { consumeCareerSession } = require("../middleware/careerSession");
const { getStatus } = require("../services/careerSessionService");
const { normalizeInterviewReport } = require("../utils/interviewReportNormalize");
const careerFocusService = require("../services/careerFocusService");

const ALLOWED_DIFFICULTY = new Set(["Beginner", "Intermediate", "Advanced"]);
const ALLOWED_TYPE = new Set(["HR Interview", "Technical Interview", "Mixed Interview"]);
const ALLOWED_COUNTS = new Set([5, 10, 15, 20]);
const ALLOWED_MODE = new Set(["practice", "timed", "live"]);
const ALLOWED_DURATIONS = new Set([30, 60, 90, 120]);

// Adaptive ("live") interview guardrails — the model's own judgment about
// when it has covered enough ground is honored only inside this range.
// Below minTurns, "interview_complete" from the model is overridden with a
// generic follow-up instead (no extra AI call — see fallbackFollowUp).
// At/above maxTurns, the interview ends WITHOUT even calling the model —
// this is the hard cost/length ceiling referenced in the Interview
// Evolution AI-usage-protection requirement.
function liveTurnBounds(questionCount) {
  const maxTurns = Math.min(ALLOWED_COUNTS.has(Number(questionCount)) ? Number(questionCount) : 10, 20);
  const minTurns = Math.min(4, maxTurns);
  return { minTurns, maxTurns };
}

const FALLBACK_FOLLOWUPS = [
  { question: "Can you walk me through a specific project where this came up in practice?", type: "behavioral", answer_type: "long_text" },
  { question: "What would you say is the most challenging part of this kind of work, and how do you approach it?", type: "scenario", answer_type: "long_text" },
  { question: "Tell me about a time you had to learn something quickly to get a task done.", type: "behavioral", answer_type: "long_text" },
];
function fallbackFollowUp(turnIndex) {
  const base = FALLBACK_FOLLOWUPS[turnIndex % FALLBACK_FOLLOWUPS.length];
  return {
    id: `q${turnIndex + 1}`,
    ...base,
    options: [],
    hints: [],
    answer: null,
    skipped: false,
  };
}

function safeError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function buildResumeSummary(profile, latestResume) {
  if (!profile && !latestResume) return null;
  const parts = [];
  if (profile) {
    if (profile.preferred_role) parts.push(`Preferred role: ${profile.preferred_role}`);
    if (profile.experience_level) parts.push(`Experience level: ${profile.experience_level}`);
    if (profile.industry) parts.push(`Industry: ${profile.industry}`);
    const skills = Array.isArray(profile.skills) ? profile.skills.slice(0, 20) : [];
    if (skills.length) parts.push(`Skills: ${skills.join(", ")}`);
    const exp = Array.isArray(profile.experience) ? profile.experience.slice(0, 4) : [];
    exp.forEach((e) => {
      if (!e) return;
      parts.push(
        `Experience: ${[e.title, e.company, e.description].filter(Boolean).join(" @ ").slice(0, 200)}`
      );
    });
    const projects = Array.isArray(profile.projects) ? profile.projects.slice(0, 3) : [];
    projects.forEach((p) => {
      if (!p) return;
      parts.push(`Project: ${[p.name, p.description].filter(Boolean).join(" — ").slice(0, 160)}`);
    });
  }
  if (latestResume) {
    if (latestResume.role) parts.push(`Recent resume role: ${latestResume.role}`);
    if (latestResume.ats_score != null) parts.push(`Recent ATS score: ${latestResume.ats_score}`);
    const analysis = latestResume.analysis || {};
    const missing = analysis.missing_skills || analysis?.keyword_match?.missing_keywords;
    if (Array.isArray(missing) && missing.length) {
      parts.push(`Noted gaps: ${missing.slice(0, 8).join(", ")}`);
    }
  }
  const text = parts.join("\n").trim();
  return text ? text.slice(0, 1200) : null;
}

function buildOpportunitySummary(opp) {
  if (!opp || typeof opp !== "object") return null;
  const bits = [];
  if (opp.role || opp.title) bits.push(`Title: ${opp.role || opp.title}`);
  if (opp.company) bits.push(`Company: ${opp.company}`);
  if (opp.location) bits.push(`Location: ${opp.location}`);
  if (opp.employment_type) bits.push(`Type: ${opp.employment_type}`);
  if (Array.isArray(opp.requirements) && opp.requirements.length) {
    bits.push(`Requirements: ${opp.requirements.slice(0, 6).join("; ")}`);
  }
  if (opp.description) bits.push(`Description: ${String(opp.description).slice(0, 500)}`);
  const text = bits.join("\n").trim();
  return text ? text.slice(0, 1000) : null;
}

function parseStartInput(body) {
  const role = String(body.role || "").trim();
  if (!role || role.length > 120) {
    return { error: "A valid role is required (max 120 characters)." };
  }
  const difficulty = ALLOWED_DIFFICULTY.has(body.difficulty)
    ? body.difficulty
    : "Intermediate";
  const interviewType = ALLOWED_TYPE.has(body.interviewType)
    ? body.interviewType
    : "Mixed Interview";
  const questionCount = ALLOWED_COUNTS.has(Number(body.questionCount))
    ? Number(body.questionCount)
    : 10;
  const mode = ALLOWED_MODE.has(body.mode) ? body.mode : "practice";
  let duration_seconds = null;
  if (mode === "timed") {
    const d = Number(body.timedDuration || body.duration_seconds);
    duration_seconds = ALLOWED_DURATIONS.has(d) ? d : 60;
  }
  return {
    role,
    company: body.company ? String(body.company).trim().slice(0, 120) : null,
    experience: body.experience ? String(body.experience).trim().slice(0, 80) : null,
    description: body.description ? String(body.description).slice(0, 4000) : null,
    difficulty,
    interviewType,
    questionCount,
    mode,
    duration_seconds,
    use_resume: body.use_resume !== false,
    opportunity: body.opportunity && typeof body.opportunity === "object" ? body.opportunity : null,
  };
}

// POST /api/interview/start
exports.start = async (req, res) => {
  try {
    // Career Focus context (product-spec sections 26-30, 37) — fills in
    // role/experience only when the request itself left them blank.
    let focus = null;
    if (req.user?.id) {
      focus = await careerFocusService.resolveFocusForRequest(req.user.id, req.body.career_focus_id);
      const focusContext = careerFocusService.toPromptContext(focus);
      if (focusContext) {
        if (!req.body.role && focusContext.target_role) req.body.role = focusContext.target_role;
        if (!req.body.experience && focusContext.experience_level) {
          req.body.experience = focusContext.experience_level;
        }
      }
    }

    const parsed = parseStartInput(req.body || {});
    if (parsed.error) return safeError(res, 400, parsed.error);

    let resumeSummary = null;
    let used_resume = false;
    let used_opportunity = false;

    if (req.user?.id && parsed.use_resume) {
      try {
        const profile = await ResumeProfile.findOne({ where: { user_id: req.user.id } });
        const latestResume = await Resume.findOne({
          where: { user_id: req.user.id },
          order: [["createdAt", "DESC"]],
          attributes: ["id", "role", "ats_score", "analysis", "source"],
        });
        resumeSummary = buildResumeSummary(profile, latestResume);
        used_resume = !!resumeSummary;
      } catch (e) {
        console.error("interview start resume load:", e.message);
      }
    }

    const opportunitySummary = buildOpportunitySummary(parsed.opportunity);
    used_opportunity = !!opportunitySummary;

    // ── Live (adaptive) mode: requires an account — the conversation has
    // to persist server-side between turns, and InterviewSession.user_id
    // is not nullable. Practice/timed remain guest-accessible as before.
    if (parsed.mode === "live") {
      if (!req.user?.id) {
        return safeError(
          res,
          401,
          "Live Interview needs an account so JobGuard can track the conversation. Sign in, or try Practice Mode as a guest."
        );
      }

      const step = await generateAdaptiveInterviewStep({
        role: parsed.role,
        experience: parsed.experience,
        company: parsed.company,
        description: parsed.description,
        difficulty: parsed.difficulty,
        interviewType: parsed.interviewType,
        resumeSummary,
        opportunitySummary,
        transcript: [],
      });

      const firstQuestion = step.question || fallbackFollowUp(0);
      const { maxTurns } = liveTurnBounds(parsed.questionCount);

      const session = await InterviewSession.create({
        user_id: req.user.id,
        career_focus_id: focus?.id || null,
        role: parsed.role,
        company: parsed.company,
        experience: parsed.experience,
        status: "in_progress",
        questions: [firstQuestion],
        difficulty: parsed.difficulty,
        interview_type: parsed.interviewType,
        question_count: parsed.questionCount,
        mode: parsed.mode,
        duration_seconds: parsed.duration_seconds,
        used_resume,
        used_opportunity,
        live_complete: false,
      });

      await consumeCareerSession(req);
      if (focus) await careerFocusService.touchLastUsed(focus);

      return res.status(201).json({
        success: true,
        session_id: session.id,
        mode: "live",
        question: firstQuestion,
        turn: 1,
        max_turns: maxTurns,
        personalization: { used_resume, used_opportunity },
        careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
      });
    }

    const questions = await generateInterviewQuestions({
      role: parsed.role,
      experience: parsed.experience,
      company: parsed.company,
      description: parsed.description,
      difficulty: parsed.difficulty,
      interviewType: parsed.interviewType,
      questionCount: parsed.questionCount,
      resumeSummary,
      opportunitySummary,
    });

    if (!questions.length) {
      return safeError(res, 502, "Could not generate questions. Please try again.");
    }

    let session_id = null;
    if (req.user?.id) {
      const session = await InterviewSession.create({
        user_id: req.user.id,
        career_focus_id: focus?.id || null,
        role: parsed.role,
        company: parsed.company,
        experience: parsed.experience,
        status: "in_progress",
        questions,
        difficulty: parsed.difficulty,
        interview_type: parsed.interviewType,
        question_count: parsed.questionCount,
        mode: parsed.mode,
        duration_seconds: parsed.duration_seconds,
        used_resume,
        used_opportunity,
      });
      session_id = session.id;
    }

    await consumeCareerSession(req);
    if (focus) await careerFocusService.touchLastUsed(focus);

    return res.status(201).json({
      success: true,
      session_id,
      questions,
      personalization: {
        used_resume,
        used_opportunity,
      },
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });
  } catch (error) {
    console.error("interview start error:", error);
    return safeError(res, 500, "Failed to start interview");
  }
};

// POST /api/interview/next — adaptive ("live") mode only: submit the answer
// to the current question, get either the next question or a completion
// signal back. Server-authoritative: the client sends only the answer, not
// the question itself — the pending question already lives on the session.
exports.next = async (req, res) => {
  try {
    const { session_id, answer, skipped } = req.body || {};
    if (!req.user?.id) return safeError(res, 401, "Sign in required for Live Interview.");
    if (!session_id) return safeError(res, 400, "session_id is required.");

    const session = await InterviewSession.findOne({
      where: { id: session_id, user_id: req.user.id },
    });
    if (!session) return safeError(res, 404, "Interview session not found.");
    if (session.mode !== "live") return safeError(res, 400, "This session isn't a Live Interview session.");
    if (session.status !== "in_progress" || session.live_complete) {
      return safeError(res, 400, "This interview has already ended.");
    }

    const questions = Array.isArray(session.questions) ? [...session.questions] : [];
    if (!questions.length) return safeError(res, 400, "No pending question on this session.");

    // Fill in the answer to the pending (last) question.
    const current = { ...questions[questions.length - 1] };
    current.skipped = !!skipped;
    current.answer = skipped ? null : String(answer ?? "").slice(0, 6000);
    questions[questions.length - 1] = current;

    const { minTurns, maxTurns } = liveTurnBounds(session.question_count);

    // Hard cap — end without even calling the model once the ceiling is hit.
    if (questions.length >= maxTurns) {
      session.questions = questions;
      session.live_complete = true;
      await session.save();
      return res.json({ success: true, done: true, turn: questions.length, max_turns: maxTurns });
    }

    let resumeSummary = null;
    if (session.used_resume) {
      try {
        const profile = await ResumeProfile.findOne({ where: { user_id: req.user.id } });
        const latestResume = await Resume.findOne({
          where: { user_id: req.user.id },
          order: [["createdAt", "DESC"]],
          attributes: ["id", "role", "ats_score", "analysis", "source"],
        });
        resumeSummary = buildResumeSummary(profile, latestResume);
      } catch (e) {
        console.error("interview next resume load:", e.message);
      }
    }

    const step = await generateAdaptiveInterviewStep({
      role: session.role,
      experience: session.experience,
      company: session.company,
      difficulty: session.difficulty,
      interviewType: session.interview_type,
      resumeSummary,
      transcript: questions,
    });

    const haveMinCoverage = questions.length >= minTurns;

    if (step.interview_complete === true && haveMinCoverage) {
      session.questions = questions;
      session.live_complete = true;
      await session.save();
      return res.json({ success: true, done: true, turn: questions.length, max_turns: maxTurns });
    }

    // Model said done too early, or the call failed/was unparseable — keep
    // the interview going with a safe generic follow-up rather than either
    // ending short of minTurns or leaving the user stuck.
    const nextQuestion = step.question || fallbackFollowUp(questions.length);
    questions.push(nextQuestion);
    session.questions = questions;
    await session.save();

    return res.json({
      success: true,
      done: false,
      question: nextQuestion,
      turn: questions.length,
      max_turns: maxTurns,
    });
  } catch (error) {
    console.error("interview next error:", error);
    return safeError(res, 500, "Failed to continue the interview.");
  }
};

// POST /api/interview/finish
exports.finish = async (req, res) => {
  try {
    const { session_id, role, mode, timedDuration } = req.body || {};
    let questions = req.body?.questions;
    if (!role || !Array.isArray(questions)) {
      return safeError(res, 400, "role and questions are required");
    }
    if (String(role).length > 120) {
      return safeError(res, 400, "Invalid role");
    }
    if (questions.length > 25) {
      return safeError(res, 400, "Too many questions in payload");
    }

    let existing = null;
    // Idempotent finish for owned completed sessions — no extra AI / no extra usage
    if (req.user?.id && session_id) {
      existing = await InterviewSession.findOne({
        where: { id: session_id, user_id: req.user.id },
      });
      if (existing && existing.status === "completed" && existing.report) {
        return res.json({
          success: true,
          report: normalizeInterviewReport(existing.report),
          already_completed: true,
          careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
        });
      }
      // Live mode is server-authoritative: score what was actually asked
      // and answered turn-by-turn, not whatever the client sends — the
      // client only ever saw one question at a time for this mode anyway.
      if (existing && existing.mode === "live" && Array.isArray(existing.questions) && existing.questions.length) {
        questions = existing.questions;
      }
    }

    const report = await generateInterviewReport(role, questions, {
      isTimed: mode === "timed",
      timedDuration: timedDuration || null,
    });
    const normalized = normalizeInterviewReport(report, {
      isFallback: !!report?.isFallback,
    });

    if (req.user?.id && session_id) {
      const session = await InterviewSession.findOne({
        where: { id: session_id, user_id: req.user.id },
      });
      if (session) {
        if (session.status === "completed" && session.report) {
          // Race: completed between checks
          return res.json({
            success: true,
            report: normalizeInterviewReport(session.report),
            already_completed: true,
            careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
          });
        }
        session.questions = questions;
        session.report = normalized;
        session.status = "completed";
        await session.save();
      }
    }

    await consumeCareerSession(req);

    return res.json({
      success: true,
      report: normalized,
      already_completed: false,
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });
  } catch (error) {
    console.error("interview finish error:", error);
    return safeError(res, 500, "Failed to generate report");
  }
};

// GET /api/interview — lightweight history list
exports.list = async (req, res) => {
  try {
    const sessions = await InterviewSession.findAll({
      where: { user_id: req.user.id },
      order: [["createdAt", "DESC"]],
      limit: 50,
      attributes: [
        "id",
        "role",
        "company",
        "experience",
        "status",
        "difficulty",
        "interview_type",
        "question_count",
        "mode",
        "duration_seconds",
        "used_resume",
        "used_opportunity",
        "createdAt",
        "updatedAt",
      ],
    });
    return res.json({ success: true, sessions });
  } catch (error) {
    console.error("interview list error:", error);
    return safeError(res, 500, "Failed to load interview history");
  }
};

// GET /api/interview/:id — full session for owner (report reopen)
exports.getOne = async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!session) return safeError(res, 404, "Not found");
    const json = session.toJSON();
    if (json.report) {
      json.report = normalizeInterviewReport(json.report);
    }
    return res.json({ success: true, session: json });
  } catch (error) {
    console.error("interview getOne error:", error);
    return safeError(res, 500, "Failed to load interview");
  }
};

// DELETE /api/interview/:id
exports.remove = async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!session) return safeError(res, 404, "Not found");
    await session.destroy();
    return res.json({ success: true, message: "Deleted" });
  } catch (error) {
    console.error("interview remove error:", error);
    return safeError(res, 500, "Failed to delete interview");
  }
};
