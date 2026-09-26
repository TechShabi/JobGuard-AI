import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Flag,
  CheckCircle2,
  MessagesSquare,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Lightbulb,
  Home,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { jsPDF } from "jspdf";
import { useAuth } from "../context/AuthContext";
import { useContextEngine } from "../context/ContextEngineContext";
import { ScoreChip, ListSection } from "../components/common/ResultPrimitives";
import { finishInterviewService, getInterviewService, nextInterviewStepService, startInterviewService } from "../services/interview.service";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  createRecognizer,
  speak,
  cancelSpeaking,
} from "../services/voice/webSpeechProvider";
import StepProgress from "../components/common/StepProgress";
import OpportunitySourceTabs from "../components/common/OpportunitySourceTabs";
import CurrentContextCard from "../components/context/CurrentContextCard";

// Same score-chip language Resume Review uses — same Result UI everywhere.

// ── Dynamic answer control — the UI adapts to whatever answer_type the AI
//    picked for this question. `value` shape: string for mcq/yes_no/short_text/
//    long_text/code, string[] for multi_select.
function AnswerControl({ q, value, onChange }) {
  switch (q.answer_type) {
    case "mcq":
      return (
        <div role="radiogroup" aria-label="Answer options" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(q.options || []).map((opt, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === opt}
              className={`source-tab${value === opt ? " active" : ""}`}
              style={{ textAlign: "left", width: "100%" }}
              onClick={() => onChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case "yes_no":
      return (
        <div className="interview-yesno-group" role="radiogroup" aria-label="Yes or no">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={value === opt}
              className={`interview-yesno-btn${value === opt ? " active" : ""}`}
              onClick={() => onChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case "multi_select": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (opt) => {
        onChange(
          selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]
        );
      };
      return (
        <div>
          {(q.options || []).map((opt, i) => (
            <label key={i} className="interview-checkbox-row">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    case "code":
      return (
        <textarea
          className="interview-answer-box"
          style={{ fontFamily: "var(--font-mono, monospace)" }}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your code / approach here..."
          rows={10}
        />
      );

    case "long_text":
      return (
        <textarea
          className="interview-answer-box"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Take your time — a thorough answer helps the evaluation."
          rows={7}
        />
      );

    case "short_text":
    default:
      return (
        <textarea
          className="interview-answer-box"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here..."
          rows={3}
        />
      );
  }
}

function isAnswerEmpty(answer_type, value) {
  if (answer_type === "multi_select") return !Array.isArray(value) || value.length === 0;
  return !value || !String(value).trim();
}

const STEPS = ["Career Focus", "Configuration", "Interview Session"];
const STEP = { CAREER_FOCUS: 1, CONFIG: 2, SESSION: 3 };

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const INTERVIEW_TYPES = ["HR Interview", "Technical Interview", "Mixed Interview"];
const QUESTION_COUNTS = [5, 10, 15, 20];
const TIMED_DURATIONS = [30, 60, 90, 120, "Unlimited"];

// Loading 1 (question generation) and Loading 2 (evaluation) are deliberately
// separate message sets — only TWO AI loading moments total, never one per answer.
const START_LOADING_MESSAGES = ["Analyzing Role...", "Selecting Question Types...", "Generating Questions...", "Preparing Interview..."];
const FINISH_LOADING_MESSAGES = ["Evaluating Technical Answers...", "Scoring Communication...", "Comparing Against Hiring Standards...", "Preparing Final Report..."];

// ── Question category → colored badge. AI picks a free-form `type`, this maps
// it onto a small fixed set of recognizable badge colors.
const TYPE_BADGE_META = {
  technical: { label: "Technical", cls: "badge-technical" },
  mcq: { label: "Technical", cls: "badge-technical" },
  coding: { label: "Coding", cls: "badge-coding" },
  behavioral: { label: "Behavioral", cls: "badge-behavioral" },
  communication: { label: "HR", cls: "badge-hr" },
  leadership: { label: "HR", cls: "badge-hr" },
  scenario: { label: "Scenario", cls: "badge-scenario" },
  problem_solving: { label: "Scenario", cls: "badge-scenario" },
  system_design: { label: "System Design", cls: "badge-system-design" },
};
function getTypeBadge(type) {
  if (!type) return null;
  const key = String(type).toLowerCase();
  return TYPE_BADGE_META[key] || { label: String(type).replace(/_/g, " "), cls: "badge-technical" };
}

// ── Session difficulty → per-question difficulty badge (Easy/Medium/Hard).
const DIFFICULTY_BADGE = { Beginner: "Easy", Intermediate: "Medium", Advanced: "Hard" };

// ── Configuration page — rough time estimate so users know what they're signing up for.
function estimateMinutes(count) {
  if (!count) return null;
  return Math.round(Number(count) * 1.5);
}

// ── Hiring readiness → friendlier headline + sub-label.
const READINESS_LABEL = {
  Low: "Needs More Prep",
  Medium: "Good Chance",
  High: "Strong Fit",
  Unknown: "Unavailable",
};

// Same score-color language as ScoreChip (ResultPrimitives) — green/yellow/red.
function scoreBand(score) {
  if (score == null) return "score-band-neutral";
  return score >= 70 ? "score-band-good" : score >= 40 ? "score-band-mid" : "score-band-low";
}

function priorityText(it) {
  if (typeof it === "string") return it;
  if (it == null) return "";
  if (typeof it === "object") return it.text || it.point || it.note || it.title || it.summary || JSON.stringify(it);
  return String(it);
}

// ── PDF export — pulled out as a standalone function (same convention as
// ResumeBuilder's downloadPdf) so it's easy to share/reuse once other tools
// add PDF export too. Takes the report plus session meta, no component state.
function downloadInterviewReportPdf(report, meta) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginBottom = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  let y = 56;
  const LINE = 13;
  const SECTION_GAP = 10;

  const ensureSpace = (extra = LINE) => {
    if (y + extra > pageHeight - marginBottom) {
      doc.addPage();
      y = 52;
    }
  };
  const addHeading = (text) => {
    ensureSpace(LINE + 10);
    y += SECTION_GAP;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(text.toUpperCase(), marginX, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
  };
  const addParagraph = (text, opts = {}) => {
    if (!text) return;
    const fontSize = opts.fontSize || 10;
    const lineH = opts.lineH || LINE;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text), contentWidth - (opts.indent || 0));
    lines.forEach((ln) => {
      ensureSpace(lineH);
      doc.text(ln, marginX + (opts.indent || 0), y);
      y += lineH;
    });
  };
  const addList = (label, items) => {
    const flat = (items || []).map(priorityText).filter(Boolean);
    if (flat.length === 0) return;
    addHeading(label);
    flat.forEach((it) => addParagraph(`•  ${it}`, { indent: 4 }));
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 15, 15);
  doc.text(`Interview Report — ${meta.role || "Role"}`, marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const metaBits = [meta.company, meta.experience, meta.difficulty, meta.interviewType].filter(Boolean).join("  ·  ");
  if (metaBits) addParagraph(metaBits, { fontSize: 9, lineH: 12 });
  y += 4;

  addHeading("Interview Summary");
  doc.setTextColor(20, 20, 20);
  addParagraph(`Questions: ${meta.totalQuestions}   |   Answered: ${meta.answeredCount}   |   Skipped: ${meta.skippedCount}`);
  if (meta.durationMin) addParagraph(`Duration: ~${meta.durationMin} min`);

  addHeading("Overall Score (AI-estimated) & Hiring Readiness");
  if (report.isFallback) {
    addParagraph("Report generation was incomplete — scores are unavailable.", { bold: true });
    addParagraph(`Overall Score: Unavailable`, { bold: true });
    addParagraph(`Hiring Readiness: ${READINESS_LABEL[report.hiring_readiness] || report.hiring_readiness || "Unavailable"}`);
  } else {
    const overallLabel = report.overall_score == null ? "Unavailable" : `${report.overall_score}/100`;
    addParagraph(`Overall Score: ${overallLabel}`, { bold: true });
    addParagraph(`Hiring Readiness: ${READINESS_LABEL[report.hiring_readiness] || report.hiring_readiness}`);
  }

  addHeading("Performance Scores");
  const scoreLine = (label, value) => {
    if (report.isFallback || value == null) return `${label}: Unavailable`;
    return `${label}: ${value}/100`;
  };
  addParagraph(scoreLine("Technical", report.technical_score));
  addParagraph(scoreLine("Communication", report.communication_score));
  addParagraph(scoreLine("Problem Solving", report.problem_solving_score));
  addParagraph(scoreLine("Confidence", report.confidence_score));
  addParagraph(scoreLine("Behavior", report.behavior_score));
  addParagraph(scoreLine("Time Management", report.time_management_score));

  addList("Strengths", report.strengths);
  const priorityItems = [...(report.weaknesses || []).slice(0, 2), ...(report.missing_skills || []).slice(0, 1)];
  addList("Immediate Priority", priorityItems);
  addList("Weaknesses", report.weaknesses);
  addList("Missing Skills", report.missing_skills);
  addList("Interview Tips", report.interview_tips);
  addList("Recommended Learning", report.recommended_learning);
  addList("Suggested Improvements", report.suggested_improvements);

  if (report.question_reviews?.length) {
    addHeading("Question Review");
    report.question_reviews.forEach((qr, i) => {
      addParagraph(`${i + 1}. ${qr.question}`, { bold: true });
      addParagraph(`Your Answer: ${qr.your_answer || "(skipped)"}`, { indent: 8 });
      addParagraph(`Ideal Answer: ${qr.ideal_answer}`, { indent: 8 });
      addParagraph(`Feedback: ${qr.feedback}`, { indent: 8 });
      addParagraph(`Score: ${report.isFallback || qr.score == null ? "Unavailable" : `${qr.score}/100`}`, { indent: 8, bold: true });
      y += 4;
    });
  }

  doc.save("interview-report.pdf");
}

// ── Question Progress Sidebar — at-a-glance answered/skipped/current state,
// with free navigation back over anything already visited.
function QuestionNavigator({ questions, answers, current, onJump }) {
  return (
    <div className="q-nav-strip" role="tablist" aria-label="Question progress">
      {questions.map((q, i) => {
        const a = answers[i];
        const isCurrent = i === current;
        const isSkipped = !!a?.skipped;
        const isAnswered = !!a && !a.skipped && !isAnswerEmpty(q?.answer_type, a.value);
        const reachable = i <= current;

        let stateCls = "q-nav-dot-pending";
        let content = "–";
        if (isCurrent) {
          stateCls = "q-nav-dot-current";
          content = i + 1;
        } else if (isAnswered) {
          stateCls = "q-nav-dot-answered";
          content = "✓";
        } else if (isSkipped) {
          stateCls = "q-nav-dot-skipped";
          content = "–";
        } else if (reachable) {
          content = i + 1;
        }

        const statusLabel = isCurrent ? "Current" : isAnswered ? "Answered" : isSkipped ? "Skipped" : "Not reached yet";

        return (
          <button
            key={i}
            type="button"
            className={`q-nav-dot ${stateCls}`}
            disabled={!reachable}
            aria-current={isCurrent ? "step" : undefined}
            title={`Question ${i + 1} — ${statusLabel}`}
            onClick={() => reachable && onJump(i)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

export default function InterviewPreparation() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { requestScan, incrementScan, isLoggedIn, user } = useAuth();
  const { context, hasContext, setActiveContext } = useContextEngine();

  const [step, setStep] = useState(STEP.CAREER_FOCUS);

  // Step 2 — session-only preferences, never stored in Career Focus.
  const [difficulty, setDifficulty] = useState("");
  const [interviewType, setInterviewType] = useState("");
  const [questionCount, setQuestionCount] = useState("");
  const [responseMode, setResponseMode] = useState(""); // "practice" | "timed"
  const [timedDuration, setTimedDuration] = useState(""); // 30 | 60 | 90 | 120 | "Unlimited"

  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  // answers keyed by question index: { value, skipped }
  const [answers, setAnswers] = useState({});
  const [showHint, setShowHint] = useState(false);
  const [report, setReport] = useState(null);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved"
  const [openReviewIndices, setOpenReviewIndices] = useState(() => new Set());
  const [sessionDurationMin, setSessionDurationMin] = useState(null);
  const sessionStartRef = useRef(null);
  const leaveIntentRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("starting"); // "starting" | "finishing"
  const [error, setError] = useState("");

  const [timeLeft, setTimeLeft] = useState(0);

  // ── Live (adaptive) mode state — voice + turn-by-turn conversation.
  // Kept separate from the batch practice/timed state above rather than
  // overloading it, since the two flows behave quite differently (no
  // free navigation, one question fetched at a time, etc.).
  const isLive = responseMode === "live";
  const [liveMaxTurns, setLiveMaxTurns] = useState(null);
  const [liveDone, setLiveDone] = useState(false);
  const [liveSubmitting, setLiveSubmitting] = useState(false);
  // "idle" | "speaking" | "listening" | "thinking"
  const [aiVoiceState, setAiVoiceState] = useState("idle");
  const [micError, setMicError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true); // user can mute the AI voice
  const recognizerRef = useRef(null);

  const stopListening = () => {
    try {
      recognizerRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recognizerRef.current = null;
    if (aiVoiceState === "listening") setAiVoiceState("idle");
  };

  const startListening = () => {
    if (!isSpeechRecognitionSupported()) {
      setMicError("Voice input isn't available in this browser — please type your answer instead.");
      return;
    }
    setMicError("");
    const recognizer = createRecognizer({
      onResult: ({ final, interim }) => {
        if (final) {
          setAnswers((prev) => ({
            ...prev,
            [current]: { value: `${(prev[current]?.value || "").trim()} ${final}`.trim(), skipped: false },
          }));
        }
        // interim text is deliberately not written into the answer box —
        // only confirmed (final) speech becomes the actual answer, so a
        // misheard interim guess never silently sticks if the user stops.
      },
      onError: (code) => {
        setMicError(
          code === "not-allowed" || code === "permission-denied"
            ? "Microphone permission was denied — you can still type your answer below."
            : "Voice input had a problem — you can still type your answer below."
        );
        setAiVoiceState("idle");
        recognizerRef.current = null;
      },
      onEnd: () => {
        recognizerRef.current = null;
        setAiVoiceState((s) => (s === "listening" ? "idle" : s));
      },
    });
    if (!recognizer) {
      setMicError("Voice input isn't available in this browser — please type your answer instead.");
      return;
    }
    recognizerRef.current = recognizer;
    setAiVoiceState("listening");
    try {
      recognizer.start();
    } catch {
      setAiVoiceState("idle");
    }
  };

  // Speak a freshly-arrived AI question aloud (live mode only, and only if
  // the user hasn't muted it). Always safe to call even when TTS is
  // unsupported — speak() no-ops gracefully in that case.
  const speakQuestion = (text) => {
    if (!isLive || !voiceEnabled) return;
    setAiVoiceState("speaking");
    speak(text, {
      onEnd: () => setAiVoiceState((s) => (s === "speaking" ? "idle" : s)),
      onError: () => setAiVoiceState((s) => (s === "speaking" ? "idle" : s)),
    });
  };

  // Stop any in-flight voice activity on unmount or when leaving live mode.
  useEffect(() => {
    return () => {
      cancelSpeaking();
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const effectiveRole = hasContext ? context.role : "";
  const effectiveExperience = hasContext ? context.experience : "";
  const effectiveCompany = hasContext ? context.company : "";
  const effectiveDescription = hasContext ? context.description : "";

  const isTimed = responseMode === "timed" && timedDuration !== "Unlimited" && timedDuration !== "";
  const numericDuration = isTimed ? Number(timedDuration) : null;

  const setCurrentAnswer = (value) =>
    setAnswers((prev) => ({ ...prev, [current]: { value, skipped: false } }));

  const currentValue = answers[current]?.value ?? (questions[current]?.answer_type === "multi_select" ? [] : "");

  // ── Auto Save Indicator — purely visual reassurance that answers are held
  // in session state; shows "Saving..." while typing, settles to "✓ Saved".
  useEffect(() => {
    const val = answers[current]?.value;
    const empty = Array.isArray(val) ? val.length === 0 : !val || !String(val).trim();
    if (empty) {
      setSaveStatus("");
      return;
    }
    setSaveStatus("saving");
    const t = setTimeout(() => setSaveStatus("saved"), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, current]);

  const handleChangeContext = () => {
    setError("");
    setQuestions([]);
    setReport(null);
    setFeedbackExpanded(false);
    setStep(STEP.CAREER_FOCUS);
  };

  const handleOpportunitySubmit = async (payload) => {
    // source_module set LAST and explicitly — this tool always owns it.
    await setActiveContext({ ...payload, source_module: "interview" });
    setStep(STEP.CONFIG);
  };


  // Sprint 8 — reopen completed report from History without consuming usage
  useEffect(() => {
    const reportId = searchParams.get("report");
    if (!reportId || !(isLoggedIn || user)) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadingPhase("finishing");
        const { data } = await getInterviewService(reportId);
        if (cancelled) return;
        const session = data.session;
        if (!session || session.status !== "completed" || !session.report) {
          setError("This interview report is not available.");
          return;
        }
        setSessionId(session.id);
        setQuestions(session.questions || []);
        setReport(session.report);
        setStep(STEP.SESSION);
        // Clear query so refresh does not loop oddly
        setSearchParams({}, { replace: true });
      } catch (err) {
        if (!cancelled) setError("Could not open interview report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user]);

  // Career Focus already exists → skip straight to Interview Configuration,
  // never re-ask for the job.
  useEffect(() => {
    if (hasContext && step === STEP.CAREER_FOCUS) {
      setStep(STEP.CONFIG);
    }
  }, [hasContext, step]);

  // Loading text rotates through START_LOADING_MESSAGES / FINISH_LOADING_MESSAGES
  // depending on phase — the effect owns the message list entirely, so there's
  // no separate "initial" messages value to keep in sync.
  const [loadingText, setLoadingText] = useState("");

  useEffect(() => {
    if (!loading) return;
    const msgs = loadingPhase === "starting" ? START_LOADING_MESSAGES : FINISH_LOADING_MESSAGES;
    let i = 0;
    setLoadingText(msgs[0]);
    const interval = setInterval(() => {
      i = (i + 1) % msgs.length;
      setLoadingText(msgs[i]);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading, loadingPhase]);

  const handleStart = async () => {
    if (!hasContext) {
      setError("Career Focus missing. Please set the role you're interviewing for first.");
      setStep(STEP.CAREER_FOCUS);
      return;
    }

    setError("");
    // Career Sessions architecture — same requestScan/incrementScan gate every
    // other tool uses; guests get a limited number, logged-in users consume
    // their Career Sessions. No limits hardcoded here.
    const allowed = requestScan("interview");
    if (!allowed) return;

    setLoadingPhase("starting");
    setLoading(true);
    setStep(STEP.SESSION);
    setLiveDone(false);
    setMicError("");
    try {
      const { data } = await startInterviewService({
        role: effectiveRole,
        experience: effectiveExperience,
        company: effectiveCompany,
        description: effectiveDescription,
        difficulty,
        interviewType,
        questionCount: Number(questionCount) || 10,
        mode: isLive ? "live" : responseMode === "timed" ? "timed" : "practice",
        timedDuration: responseMode === "timed" ? timedDuration : undefined,
        use_resume: true,
        opportunity:
          effectiveCompany || effectiveDescription
            ? {
                role: effectiveRole,
                company: effectiveCompany || undefined,
                description: effectiveDescription || undefined,
              }
            : undefined,
      });

      if (isLive) {
        if (!data?.question) throw new Error("Could not start the live interview.");
        setSessionId(data.session_id);
        setQuestions([data.question]);
        setLiveMaxTurns(data.max_turns || null);
        setCurrent(0);
        setAnswers({});
        setShowHint(false);
        sessionStartRef.current = Date.now();
        incrementScan("interview");
        speakQuestion(data.question.question);
        return;
      }

      if (!data?.questions || data.questions.length === 0) {
        throw new Error("No questions were generated for this role.");
      }

      setSessionId(data.session_id);
      setQuestions(data.questions);
      setCurrent(0);
      setAnswers({});
      setShowHint(false);
      setTimeLeft(numericDuration || 0);
      sessionStartRef.current = Date.now();
      incrementScan("interview");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not start interview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Live mode only — submit the answer to the CURRENT (last) question and
  // either receive the next one or a completion signal. Unlike handleNext
  // (batch mode), there is no local "advance to index" — the next question
  // literally doesn't exist client-side until the server sends it.
  const handleLiveSubmit = async (skip = false) => {
    stopListening();
    cancelSpeaking();
    setMicError("");
    const answerEntry = answers[current];
    if (!skip && isAnswerEmpty(questions[current]?.answer_type, answerEntry?.value)) return;

    setLiveSubmitting(true);
    setAiVoiceState("thinking");
    setError("");
    try {
      const { data } = await nextInterviewStepService({
        session_id: sessionId,
        answer: skip ? null : answerEntry?.value,
        skipped: skip,
      });

      if (data.done) {
        setLiveDone(true);
        const finalQuestions = questions.map((q, i) =>
          i === current ? { ...q, answer: skip ? null : answerEntry?.value, skipped: skip } : q
        );
        await handleFinish(
          finalQuestions.reduce((acc, q, i) => {
            acc[i] = { value: q.answer, skipped: q.skipped };
            return acc;
          }, {})
        );
        return;
      }

      setQuestions((prev) => [...prev, data.question]);
      setCurrent((prev) => prev + 1);
      setShowHint(false);
      setAiVoiceState("idle");
      speakQuestion(data.question.question);
    } catch (err) {
      setError(err.response?.data?.message || "Could not continue the interview. Please try again.");
      setAiVoiceState("idle");
    } finally {
      setLiveSubmitting(false);
    }
  };

  const handleFinish = async (finalAnswersMap) => {
    setLoadingPhase("finishing");
    setLoading(true);
    setError("");
    try {
      const finalQuestions = questions.map((q, i) => {
        const a = finalAnswersMap[i];
        return { ...q, answer: a && !a.skipped ? a.value : null, skipped: !a || a.skipped };
      });

      const { data } = await finishInterviewService({
        session_id: sessionId,
        role: effectiveRole,
        company: effectiveCompany,
        experience: effectiveExperience,
        questions: finalQuestions,
        mode: responseMode,
        timedDuration: isTimed ? numericDuration : null,
      });
      setReport(data.report);
      // already_completed means stored report reused — no extra usage;
      setFeedbackExpanded(false);
      setOpenReviewIndices(new Set());
      setSessionDurationMin(
        sessionStartRef.current ? Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60000)) : null
      );
    } catch (err) {
      setError(err.response?.data?.message || "Could not generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goToIndex = (idx) => {
    setCurrent(idx);
    setShowHint(false);
    setTimeLeft(numericDuration || 0);
  };

  const handlePrevious = () => {
    if (current === 0) return;
    goToIndex(current - 1);
  };

  const handleSkip = () => {
    setAnswers((prev) => ({ ...prev, [current]: { value: null, skipped: true } }));
    if (current + 1 < questions.length) {
      goToIndex(current + 1);
    } else {
      handleFinish({ ...answers, [current]: { value: null, skipped: true } });
    }
  };

  const handleNext = () => {
    // current answer is already live-bound via setCurrentAnswer, just advance
    if (current + 1 < questions.length) {
      goToIndex(current + 1);
    } else {
      handleFinish(answers);
    }
  };

  // Finish Interview now confirms first — accidental clicks used to jump
  // straight into report generation with no way back.
  const handleFinishInterview = () => {
    setShowFinishConfirm(true);
  };

  const confirmFinishInterview = () => {
    setShowFinishConfirm(false);
    handleFinish(answers);
  };

  // Timed Mode — a per-question countdown, purely a session preference.
  // Auto-advances when time runs out (submits whatever was entered, or skips).
  useEffect(() => {
    if (!isTimed || step !== STEP.SESSION || loading || report || questions.length === 0) return;
    if (timeLeft <= 0) {
      const q = questions[current];
      if (q && !isAnswerEmpty(q.answer_type, currentValue)) {
        handleNext();
      } else {
        handleSkip();
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isTimed, step, loading, report, questions.length]);

  // Exit Interview Warning — warns on browser refresh/tab-close (beforeunload)
  // and on the browser Back button (a trapped history entry lets us intercept
  // it and show our own modal instead of silently losing progress). Only
  // active while a session is genuinely in progress (started, not finished).
  useEffect(() => {
    const guarded = step === STEP.SESSION && !report && questions.length > 0;
    if (!guarded) return;

    window.history.pushState({ __interviewGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (leaveIntentRef.current) {
        leaveIntentRef.current = false;
        return;
      }
      window.history.pushState({ __interviewGuard: true }, "", window.location.href);
      setShowLeaveWarning(true);
    };
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [step, report, questions.length]);

  const confirmLeaveInterview = () => {
    setShowLeaveWarning(false);
    leaveIntentRef.current = true;
    window.history.go(-2);
  };

  // Practice Again now confirms first — the current report would otherwise
  // be silently discarded with no way back.
  const handlePracticeAgain = () => {
    setShowRestartConfirm(true);
  };

  const confirmRestart = () => {
    setShowRestartConfirm(false);
    setStep(STEP.CONFIG);
    setQuestions([]);
    setCurrent(0);
    setAnswers({});
    setReport(null);
    setFeedbackExpanded(false);
    setOpenReviewIndices(new Set());
    setSessionDurationMin(null);
    sessionStartRef.current = null;
  };

  // Tallies for the Finish/Restart confirmation modals and PDF export — counts
  // every question the user has actually reached, not the full question set.
  const answeredCount = Object.keys(answers).filter((k) => {
    const a = answers[k];
    return a && !a.skipped && !isAnswerEmpty(questions[k]?.answer_type, a.value);
  }).length;
  const skippedCount = Object.values(answers).filter((a) => a?.skipped).length;

  const handleDownloadReport = () => {
    if (!report) return;
    downloadInterviewReportPdf(report, {
      role: effectiveRole,
      company: effectiveCompany,
      experience: effectiveExperience,
      difficulty,
      interviewType,
      totalQuestions: questions.length,
      answeredCount,
      skippedCount,
      durationMin: sessionDurationMin,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <div className="tool-page">
        <div className="tool-container">
          <div className="tool-page-header">
            <div className="input-panel-label mb-2" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
              <MessagesSquare size={14} />
              <span>AI Interview Coach</span>
            </div>
            <h1 className="tool-page-title">Practice real questions before the call.</h1>
            <p className="tool-page-sub">
              Interactive role-based mock interviews with instant scoring on your answers and delivery. Total prep coverage.
            </p>
          </div>

          {hasContext && <CurrentContextCard onChange={handleChangeContext} />}

          <StepProgress steps={STEPS} currentStep={step} />

          <div className={`tool-page-body ${loading || report ? "modal-active" : ""}`}>

            {/* STEP 1: CAREER FOCUS */}
            {step === STEP.CAREER_FOCUS && !hasContext && (
              <div className="tool-card">
                <h2 className="input-panel-title">What role are you interviewing for?</h2>
                <p className="tool-step-sub">
                  Select an opportunity context to start practicing — we'll generate realistic questions tailored to the role and experience level.
                </p>

                <OpportunitySourceTabs onSubmit={handleOpportunitySubmit} continueLabel="Continue" />

                {error && <div className="field-error-msg pt-2">{error}</div>}
              </div>
            )}

            {step === STEP.CONFIG && (
              <div className="tool-card">
                {/* STEP 2: INTERVIEW CONFIGURATION — job is already known, only preferences */}
                <div className="tool-step-body">
                  <h2 className="tool-step-heading">
                    Configure your interview for <strong>{effectiveRole}</strong>
                  </h2>
                  <p className="tool-step-sub">These preferences apply to this session only. Question types (behavioral, technical, coding, scenario-based, etc.) are chosen automatically by the AI based on your role.</p>

                  <div className="tool-step-fields">

                    <div className="interview-config-group">
                      <div className="form-label">Difficulty</div>
                      <div className="exp-level-group">
                        {DIFFICULTIES.map((d) => (
                          <button key={d} type="button" className={`${difficulty === d ? "exp-btn active" : "exp-btn"}`} onClick={() => setDifficulty(difficulty === d ? "" : d)}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="interview-config-group">
                      <div className="form-label">Interview Type</div>
                      <div className="exp-level-group">
                        {INTERVIEW_TYPES.map((s) => (
                          <button key={s} type="button" className={`${interviewType === s ? "exp-btn active" : "exp-btn"}`} onClick={() => setInterviewType(interviewType === s ? "" : s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="interview-config-group">
                      <div className="form-label">Question Count</div>
                      <div className="exp-level-group">
                        {QUESTION_COUNTS.map((c) => (
                          <button key={c} type="button" className={`${questionCount === c ? "exp-btn active" : "exp-btn"}`} onClick={() => setQuestionCount(questionCount === c ? "" : c)}>
                            {c}
                          </button>
                        ))}
                      </div>
                      {questionCount ? (
                        <p className="tool-step-sub interview-time-estimate">
                          {questionCount} Questions · Approx {estimateMinutes(questionCount)} mins
                        </p>
                      ) : null}
                    </div>

                    <div className="interview-config-group">
                      <div className="form-label">Interview Style</div>
                      <div className="exp-level-group">
                        <button
                          type="button"
                          className={`${responseMode === "practice" ? "exp-btn active" : "exp-btn"}`}
                          onClick={() => { setResponseMode(responseMode === "practice" ? "" : "practice"); setTimedDuration(""); }}
                        >
                          Practice Mode
                        </button>
                        <button type="button" className={`${responseMode === "timed" ? "exp-btn active" : "exp-btn"}`} onClick={() => setResponseMode(responseMode === "timed" ? "" : "timed")}>
                          Timed Mode
                        </button>
                        <button
                          type="button"
                          className={`${responseMode === "live" ? "exp-btn active" : "exp-btn"}`}
                          onClick={() => { setResponseMode(responseMode === "live" ? "" : "live"); setTimedDuration(""); }}
                          disabled={!isLoggedIn}
                          title={!isLoggedIn ? "Sign in to use Live Interview" : undefined}
                        >
                          Live Interview
                        </button>
                      </div>
                      {responseMode === "timed" && (
                        <div className="interview-duration-group pt-2">
                          {TIMED_DURATIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`${timedDuration === d ? "exp-btn active" : "exp-btn"}`}
                              onClick={() => setTimedDuration(timedDuration === d ? "" : d)}
                            >
                              {d === "Unlimited" ? "Unlimited" : `${d}s`}
                            </button>
                          ))}
                        </div>
                      )}
                      {responseMode === "practice" && (
                        <p className="tool-step-sub pt-2" style={{ marginTop: "8px", marginBottom: 0 }}>
                          No timer — answer at your own pace.
                        </p>
                      )}
                      {responseMode === "live" && (
                        <p className="tool-step-sub pt-2" style={{ marginTop: "8px", marginBottom: 0 }}>
                          A conversational session — the AI asks one question at a time and adapts based on
                          your answers, like a real interview. No jumping back and forth between questions.
                          {isSpeechRecognitionSupported() || isSpeechSynthesisSupported()
                            ? " Voice is available in this browser (you can always type instead)."
                            : " Voice isn't available in this browser — you'll type your answers."}
                        </p>
                      )}
                    </div>

                    <div className="interview-tips-card">
                      <div className="interview-tips-title">
                        <Lightbulb size={14} /> Quick Tips Before You Start
                      </div>
                      <ul className="interview-tips-list">
                        <li>Answer naturally, like a real conversation</li>
                        <li>Think aloud — explain your reasoning as you go</li>
                        <li>Give specific examples wherever you can</li>
                        <li>Don't panic on a tough question — take a breath</li>
                        <li>Use the STAR method for behavioral / HR questions</li>
                      </ul>
                    </div>

                    {error && (
                      <div className="field-error-msg pt-2" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <AlertTriangle size={16} /> {error}
                      </div>
                    )}

                    <div className="tool-step-nav">
                      <button
                        type="button"
                        className="analyze-btn"
                        style={{ marginLeft: "auto",
                          opacity: loading || !difficulty || !interviewType || !questionCount || !responseMode || (responseMode === "timed" && !timedDuration) ? 0.5 : 1,
                          cursor: loading || !difficulty || !interviewType || !questionCount || !responseMode || (responseMode === "timed" && !timedDuration) ? "not-allowed" : "pointer" 
                        }}
                        disabled={
                          loading ||
                          !difficulty ||
                          !interviewType ||
                          !questionCount ||
                          !responseMode ||
                          (responseMode === "timed" && !timedDuration)
                        }
                        onClick={handleStart}
                      >
                        {loading ? "Starting..." : "Start Interview"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* STEP 3: AI INTERVIEW SESSION (live Q&A + error fallback) */}
            {/* STEP 3 (Live/adaptive mode): conversational, one question at a
                time, no jump-back navigation — closer to a real interview
                than the batch quiz-style flow below. */}
            {step === STEP.SESSION && !loading && !report && isLive && (
              <div className="tool-card">
                {error || questions.length === 0 ? (
                  <div className="tool-step-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 10px" }}>
                    <div className="flex gap-5 items-center">
                      <div style={{ display: "inline-flex" }}>
                        <AlertTriangle size={32} color="var(--red)" />
                      </div>
                      <div style={{ display: "flex-start", flexDirection: "column" }}>
                        <h3 style={{ color: "var(--text-primary)" }}>Failed to Load Question</h3>
                        <p className="tool-step-sub" style={{ maxWidth: "420px", margin: "0" }}>
                          {error || "We couldn't generate an interview question for this role right now."}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                      <button
                        type="button"
                        className="flex-1 md:flex-none inline-flex items-center justify-center text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors cursor-pointer hover:opacity-80"
                        style={{ borderColor: "var(--logout-border)", color: "var(--logout-color)", backgroundColor: "var(--logout-bg)" }}
                        onClick={handleStart}
                      >
                        <RotateCcw size={16} style={{ marginRight: "6px" }} /> Try Again
                      </button>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const q = questions[current];
                    if (!q) return null;
                    const typeBadge = getTypeBadge(q.type);
                    const diffBadge = DIFFICULTY_BADGE[difficulty];
                    const canUseVoiceInput =
                      isSpeechRecognitionSupported() && ["short_text", "long_text"].includes(q.answer_type);
                    const isListening = aiVoiceState === "listening";
                    const isSpeaking = aiVoiceState === "speaking";
                    const isThinking = aiVoiceState === "thinking" || liveSubmitting;

                    return (
                      <div className="tool-step-body">
                        <div className="session-meta-bar">
                          <div className="session-meta-item">
                            <span>Role</span>
                            <strong>{effectiveRole}</strong>
                          </div>
                          {effectiveCompany && (
                            <div className="session-meta-item">
                              <span>Company</span>
                              <strong>{effectiveCompany}</strong>
                            </div>
                          )}
                          <div className="session-meta-item">
                            <span>Difficulty</span>
                            <strong>{difficulty}</strong>
                          </div>
                          <div className="session-meta-item">
                            <span>Interview</span>
                            <strong>{interviewType}</strong>
                          </div>
                          <div className="session-meta-item">
                            <span>Question</span>
                            <strong>{current + 1}{liveMaxTurns ? ` / up to ${liveMaxTurns}` : ""}</strong>
                          </div>
                        </div>

                        {/* AI state indicator — calm, textual, no cartoon avatar */}
                        <div
                          className="interview-badge-row"
                          style={{ marginBottom: 10 }}
                          aria-live="polite"
                        >
                          <span className={`interview-q-type-badge ${isThinking ? "badge-scenario" : isSpeaking ? "badge-hr" : isListening ? "badge-technical" : "badge-behavioral"}`}>
                            {isThinking ? "AI is thinking…" : isSpeaking ? "AI is speaking…" : isListening ? "Listening…" : "Your turn"}
                          </span>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ fontSize: 12 }}
                            onClick={() => {
                              if (voiceEnabled) cancelSpeaking();
                              setVoiceEnabled((v) => !v);
                            }}
                            title={voiceEnabled ? "Mute AI voice" : "Unmute AI voice"}
                          >
                            {voiceEnabled ? "🔊 Voice on" : "🔇 Voice off"}
                          </button>
                        </div>

                        <div className="interview-question-card">
                          <p className="interview-question-text">{q.question}</p>
                          <div className="interview-badge-row">
                            {typeBadge && <span className={`interview-q-type-badge ${typeBadge.cls}`}>{typeBadge.label}</span>}
                            {diffBadge && <span className={`diff-badge diff-badge-${diffBadge.toLowerCase()}`}>{diffBadge}</span>}
                            {q.answer_type === "code" && (
                              <span className="interview-q-type-badge badge-coding">Coding question</span>
                            )}
                          </div>
                        </div>

                        {q.answer_type === "code" && (
                          <p className="tool-step-sub" style={{ marginTop: -4, marginBottom: 8 }}>
                            Write your code or approach below — this is not an executable sandbox, so nothing is
                            run or tested automatically; your written answer is what gets evaluated.
                          </p>
                        )}

                        {canUseVoiceInput && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <button
                              type="button"
                              className={isListening ? "analyze-btn" : "btn-secondary"}
                              onClick={() => (isListening ? stopListening() : startListening())}
                              disabled={isThinking}
                            >
                              {isListening ? "⏹ Stop Listening" : "🎙 Speak Your Answer"}
                            </button>
                            <span className="tool-step-sub" style={{ margin: 0 }}>
                              {isListening ? "Listening — speak naturally, then stop when done." : "Or just type below."}
                            </span>
                          </div>
                        )}
                        {micError && (
                          <div className="field-error-msg" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <AlertTriangle size={14} /> {micError}
                          </div>
                        )}

                        <AnswerControl q={q} value={currentValue} onChange={setCurrentAnswer} />

                        {q.hints?.length > 0 && (
                          <div style={{ marginTop: "10px" }}>
                            <button type="button" className="btn-ghost" style={{ color: "var(--cyan)" }} onClick={() => setShowHint((v) => !v)}>
                              <Lightbulb size={14} style={{ marginRight: "4px" }} />
                              {showHint ? "Hide Hint" + (q.hints.length > 1 ? "s" : "") : `Show ${q.hints.length} Hint${q.hints.length > 1 ? "s" : ""}`}
                            </button>
                            {showHint && (
                              <ul className="result-section-list">
                                {q.hints.map((h, i) => <li key={i}>{h}</li>)}
                              </ul>
                            )}
                          </div>
                        )}

                        {error && (
                          <div className="field-error-msg pt-2" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <AlertTriangle size={16} /> {error}
                          </div>
                        )}

                        <div className="tool-step-nav" style={{ justifyContent: "space-between", marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isThinking}
                            onClick={handleFinishInterview}
                          >
                            <Flag size={16} style={{ marginRight: "6px" }} /> End Interview Now
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isThinking}
                            onClick={() => handleLiveSubmit(true)}
                          >
                            <SkipForward size={16} style={{ marginRight: "6px" }} /> Skip
                          </button>

                          <button
                            type="button"
                            className="analyze-btn"
                            disabled={isAnswerEmpty(q.answer_type, currentValue) || isThinking}
                            onClick={() => handleLiveSubmit(false)}
                          >
                            {isThinking ? "Thinking…" : "Submit Answer"} <ArrowRight size={16} style={{ marginLeft: "6px" }} />
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {step === STEP.SESSION && !loading && !report && !isLive && (
              <div className="tool-card">
                {error || questions.length === 0 ? (
                  <div className="tool-step-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 10px" }}>
                    <div className="flex gap-5 items-center">
                      <div style={{ display: "inline-flex" }}>
                        <AlertTriangle size={32} color="var(--red)" />
                      </div>
                      <div style={{ display: "flex-start", flexDirection: "column" }}>
                        <h3 style={{ color: "var(--text-primary)" }}>Failed to Load Questions</h3>
                        <p className="tool-step-sub" style={{ maxWidth: "420px", margin: "0" }}>
                          {error || "We couldn't generate interview questions for this role right now."}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                      <button
                        type="button"
                        className="flex-1 md:flex-none inline-flex items-center justify-center text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors cursor-pointer hover:opacity-80"
                        style={{ borderColor: "var(--logout-border)", color: "var(--logout-color)", backgroundColor: "var(--logout-bg)" }}
                        onClick={handleStart}
                      >
                        <RotateCcw size={16} style={{ marginRight: "6px" }} /> Try Again
                      </button>
                    </div>
                  </div>
                ) : isLive ? (
                  (() => {
                    const q = questions[current];
                    if (!q) return null;
                    const typeBadge = getTypeBadge(q.type);
                    const diffBadge = DIFFICULTY_BADGE[difficulty];
                    const isListening = aiVoiceState === "listening";
                    const isSpeaking = aiVoiceState === "speaking";
                    const isThinking = aiVoiceState === "thinking" || liveSubmitting;
                    const canSubmit = !isAnswerEmpty(q.answer_type, currentValue) && !isThinking;
                    const voiceCapableAnswer = q.answer_type === "short_text" || q.answer_type === "long_text";
                    const micSupported = isSpeechRecognitionSupported();
                    const stateLabel = isSpeaking
                      ? "AI is speaking…"
                      : isListening
                        ? "Listening…"
                        : isThinking
                          ? "AI is thinking…"
                          : "Your turn";
                    const stateCls = isSpeaking
                      ? "badge-hr"
                      : isListening
                        ? "badge-technical"
                        : isThinking
                          ? "badge-scenario"
                          : "badge-behavioral";

                    return (
                      <div className="tool-step-body">
                        <div className="session-meta-bar">
                          <div className="session-meta-item">
                            <span>Role</span>
                            <strong>{effectiveRole}</strong>
                          </div>
                          {effectiveCompany && (
                            <div className="session-meta-item">
                              <span>Company</span>
                              <strong>{effectiveCompany}</strong>
                            </div>
                          )}
                          <div className="session-meta-item">
                            <span>Difficulty</span>
                            <strong>{difficulty}</strong>
                          </div>
                          <div className="session-meta-item">
                            <span>Interview</span>
                            <strong>{interviewType}</strong>
                          </div>
                          <div className="session-meta-item">
                            <span>Style</span>
                            <strong>Live Interview</strong>
                          </div>
                        </div>

                        <div className="interview-badge-row" style={{ marginBottom: "10px", justifyContent: "space-between", display: "flex", alignItems: "center" }}>
                          <span className={`interview-q-type-badge ${stateCls}`} aria-live="polite">
                            {stateLabel}
                          </span>
                          {isSpeechSynthesisSupported() && (
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => {
                                if (voiceEnabled) cancelSpeaking();
                                setVoiceEnabled((v) => !v);
                              }}
                            >
                              {voiceEnabled ? "Mute AI voice" : "Unmute AI voice"}
                            </button>
                          )}
                        </div>

                        <div className="interview-q-meta" style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Question {current + 1}{liveMaxTurns ? ` (up to ${liveMaxTurns})` : ""}</span>
                        </div>

                        <div className="interview-question-card">
                          <p className="interview-question-text">{q.question}</p>
                          <div className="interview-badge-row">
                            {typeBadge && <span className={`interview-q-type-badge ${typeBadge.cls}`}>{typeBadge.label}</span>}
                            {diffBadge && <span className={`diff-badge diff-badge-${diffBadge.toLowerCase()}`}>{diffBadge}</span>}
                            {q.answer_type === "code" && (
                              <span className="interview-q-type-badge badge-coding">
                                Coding question — written answer only, not executed
                              </span>
                            )}
                          </div>
                        </div>

                        {voiceCapableAnswer && micSupported && (
                          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className={isListening ? "analyze-btn" : "btn-secondary"}
                              onClick={() => (isListening ? stopListening() : startListening())}
                              disabled={isThinking || isSpeaking}
                            >
                              {isListening ? "Stop Listening" : "Answer by Voice"}
                            </button>
                            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>or type your answer below</span>
                          </div>
                        )}
                        {micError && (
                          <div className="field-error-msg" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                            <AlertTriangle size={14} /> {micError}
                          </div>
                        )}

                        <AnswerControl q={q} value={currentValue} onChange={setCurrentAnswer} />

                        {q.hints?.length > 0 && (
                          <div style={{ marginTop: "10px" }}>
                            <button type="button" className="btn-ghost" style={{ color: "var(--cyan)" }} onClick={() => setShowHint((v) => !v)}>
                              <Lightbulb size={14} style={{ marginRight: "4px" }} />
                              {showHint ? "Hide Hint" + (q.hints.length > 1 ? "s" : "") : `Show ${q.hints.length} Hint${q.hints.length > 1 ? "s" : ""}`}
                            </button>
                            {showHint && (
                              <ul className="result-section-list">
                                {q.hints.map((h, i) => <li key={i}>{h}</li>)}
                              </ul>
                            )}
                          </div>
                        )}

                        {error && (
                          <div className="field-error-msg pt-2" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <AlertTriangle size={16} /> {error}
                          </div>
                        )}

                        <div className="tool-step-nav" style={{ justifyContent: "space-between", marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isThinking}
                            onClick={() => handleLiveSubmit(true)}
                          >
                            <SkipForward size={16} style={{ marginRight: "6px" }} /> Skip
                          </button>

                          <button
                            type="button"
                            className="analyze-btn"
                            disabled={!canSubmit}
                            onClick={() => handleLiveSubmit(false)}
                          >
                            {isThinking ? "Thinking…" : "Submit Answer"} <ArrowRight size={16} style={{ marginLeft: "6px" }} />
                          </button>

                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ marginLeft: "auto" }}
                            disabled={isThinking}
                            onClick={handleFinishInterview}
                          >
                            <Flag size={16} style={{ marginRight: "6px" }} /> End Interview Now
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    const q = questions[current];
                    if (!q) return null;
                    const progress = `${current + 1} / ${questions.length}`;
                    const isLast = current + 1 === questions.length;

                    const typeBadge = getTypeBadge(q.type);
                    const diffBadge = DIFFICULTY_BADGE[difficulty];
                    const timerPulseCls = !isTimed ? "" : timeLeft <= 3 ? "interview-timer-pulse-critical" : timeLeft <= 10 ? "interview-timer-pulse-warn" : "";

                    return (
                      <div className="tool-step-body">
                        {/* Resume Context Reminder — role/company/experience + this
                            session's chosen settings, kept visible throughout */}
                        <div className="session-meta-bar">
                          <div className="session-meta-item">
                            <span>Role</span>
                            <strong>{effectiveRole}</strong>
                          </div>
                          {effectiveCompany && (
                            <div className="session-meta-item">
                              <span>Company</span>
                              <strong>{effectiveCompany}</strong>
                            </div>
                          )}
                          {effectiveExperience && (
                            <div className="session-meta-item">
                              <span>Experience</span>
                              <strong>{effectiveExperience}</strong>
                            </div>
                          )}
                          <div className="session-meta-item">
                            <span>Difficulty</span>
                            <strong>{difficulty}</strong>
                          </div>
                          <div className="session-meta-item">
                            <span>Interview</span>
                            <strong>{interviewType}</strong>
                          </div>
                          <div className="session-meta-item">
                            <span>Questions</span>
                            <strong>{questions.length}</strong>
                          </div>
                        </div>

                        <QuestionNavigator questions={questions} answers={answers} current={current} onJump={goToIndex} />
                        <div className="q-nav-summary">
                          <span className="q-nav-summary-answered">✓ {answeredCount} Answered</span>
                          <span className="q-nav-summary-skipped">– {skippedCount} Skipped</span>
                          <span className="q-nav-summary-remaining">{questions.length - current - 1} Remaining</span>
                        </div>

                        <div className="interview-progress-bar-wrap">
                          <div
                            className="interview-progress-bar"
                            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
                          />
                        </div>

                        <div className="interview-q-meta" style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Question {progress}</span>
                          {isTimed && (
                            <span className={timerPulseCls} style={{ color: timeLeft <= 15 ? "var(--red)" : "inherit" }}><span aria-live="polite">{timeLeft}</span>s</span>
                          )}
                        </div>

                        <div className="interview-question-card">
                          <p className="interview-question-text">{q.question}</p>
                          <div className="interview-badge-row">
                            {typeBadge && <span className={`interview-q-type-badge ${typeBadge.cls}`}>{typeBadge.label}</span>}
                            {diffBadge && <span className={`diff-badge diff-badge-${diffBadge.toLowerCase()}`}>{diffBadge}</span>}
                          </div>
                        </div>

                        <AnswerControl q={q} value={currentValue} onChange={setCurrentAnswer} />

                        {saveStatus && (
                          <div className={`autosave-indicator ${saveStatus === "saved" ? "is-saved" : "is-saving"}`}>
                            {saveStatus === "saved" ? "✓ Saved" : "Saving..."}
                          </div>
                        )}

                        {q.hints?.length > 0 && (
                          <div style={{ marginTop: "10px" }}>
                            <button type="button" className="btn-ghost" style={{ color: "var(--cyan)" }} onClick={() => setShowHint((v) => !v)}>
                              <Lightbulb size={14} style={{ marginRight: "4px" }} />
                              {showHint ? "Hide Hint" + (q.hints.length > 1 ? "s" : "") : `Show ${q.hints.length} Hint${q.hints.length > 1 ? "s" : ""}`}
                            </button>
                            {showHint && (
                              <ul className="result-section-list">
                                {q.hints.map((h, i) => <li key={i}>{h}</li>)}
                              </ul>
                            )}
                          </div>
                        )}

                        <div className="tool-step-nav" style={{ justifyContent: "space-between", marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={current === 0 || loading}
                            onClick={handlePrevious}
                          >
                            <ArrowLeft size={16} style={{ marginRight: "6px" }} /> Previous
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading}
                            onClick={handleSkip}
                          >
                            <SkipForward size={16} style={{ marginRight: "6px" }} /> Skip
                          </button>

                          {!isLast && (
                            <button
                              type="button"
                              className="analyze-btn"
                              disabled={isAnswerEmpty(q.answer_type, currentValue) || loading}
                              onClick={handleNext}
                            >
                              Next Question <ArrowRight size={16} style={{ marginLeft: "6px" }} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="analyze-btn"
                            style={{ marginLeft: isLast ? "auto" : 0 }}
                            disabled={loading}
                            onClick={handleFinishInterview}
                          >
                            <Flag size={16} style={{ marginRight: "6px" }} /> Finish Interview
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* FINISH CONFIRMATION — stops an accidental Finish click from
                jumping straight into report generation */}
            {showFinishConfirm && !loading && (
              <>
                <div className="screen-overlay" onClick={() => setShowFinishConfirm(false)} />
                <div className="popup-modal finish-confirm-modal">
                  <h3 className="finish-confirm-title">Finish Interview?</h3>
                  <div className="finish-confirm-stats">
                    <div className="finish-confirm-stat">
                      <span>Answered</span>
                      <strong>{answeredCount}</strong>
                    </div>
                    <div className="finish-confirm-stat">
                      <span>Skipped</span>
                      <strong>{skippedCount}</strong>
                    </div>
                  </div>
                  <p className="tool-step-sub" style={{ marginTop: "4px" }}>
                    Are you sure? You won't be able to change your answers after this.
                  </p>
                  <div className="finish-confirm-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowFinishConfirm(false)}>
                      Cancel
                    </button>
                    <button type="button" className="analyze-btn" onClick={confirmFinishInterview}>
                      Finish
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* RESTART / PRACTICE AGAIN CONFIRMATION — current report would
                otherwise vanish silently */}
            {showRestartConfirm && !loading && (
              <>
                <div className="screen-overlay" onClick={() => setShowRestartConfirm(false)} />
                <div className="popup-modal finish-confirm-modal">
                  <h3 className="finish-confirm-title">Start a New Practice Session?</h3>
                  <p className="tool-step-sub" style={{ marginTop: "4px" }}>
                    Your current report will be lost. Continue?
                  </p>
                  <div className="finish-confirm-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowRestartConfirm(false)}>
                      Cancel
                    </button>
                    <button type="button" className="analyze-btn" onClick={confirmRestart}>
                      Restart
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* EXIT INTERVIEW WARNING — refresh/close is caught by beforeunload
                (native browser prompt); Back button is caught here */}
            {showLeaveWarning && (
              <>
                <div className="screen-overlay" onClick={() => setShowLeaveWarning(false)} />
                <div className="popup-modal finish-confirm-modal">
                  <h3 className="finish-confirm-title">Interview in Progress</h3>
                  <p className="tool-step-sub" style={{ marginTop: "4px" }}>
                    You'll lose your answers if you leave now. Leave anyway?
                  </p>
                  <div className="finish-confirm-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowLeaveWarning(false)}>
                      Stay
                    </button>
                    <button type="button" className="reset-btn" onClick={confirmLeaveInterview}>
                      Leave Anyway
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* LOADING POPUP — exactly two AI-loading moments, never per-answer */}
            {loading && (
              <>
                <div className="screen-overlay" />
                <div className="popup-modal">
                  <div className="popup-spinner">
                    <Sparkles size={40} />
                  </div>
                  <h3 style={{ color: "white" }}>{loadingText}</h3>
                </div>
              </>
            )}

            {/* STEP 3 (continued): FINAL REPORT — pure renderer of backend report,
                same Result UI/UX language as Opportunity Verification / Resume Review.
                Section order: Interview Summary → Overall Score → Hiring Readiness →
                Performance Scores → Strengths → Priority Improvements → Weaknesses →
                Missing Skills → Interview Tips → Recommended Learning → Question
                Reviews → Actions. */}
            {!loading && report && (
              <div className="tool-card">
                <div className="tool-step-body">
                  {report.isFallback && (
                    <div className="field-error-msg" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
                      <AlertTriangle size={16} />
                      This report couldn't be fully generated. Try Practice Again for a complete evaluation.
                    </div>
                  )}

                  {/* Interview Summary — quick at-a-glance recap before the score/feedback */}
                  <div className="interview-summary-card">
                    <div className="interview-summary-title">
                      <Clock size={14} /> Interview Summary
                    </div>
                    <div className="interview-summary-grid">
                      <div className="interview-summary-stat">
                        <span>Role</span>
                        <strong>{effectiveRole}</strong>
                      </div>
                      <div className="interview-summary-stat">
                        <span>Questions</span>
                        <strong>{questions.length}</strong>
                      </div>
                      <div className="interview-summary-stat">
                        <span>Answered</span>
                        <strong>{answeredCount}</strong>
                      </div>
                      <div className="interview-summary-stat">
                        <span>Skipped</span>
                        <strong>{skippedCount}</strong>
                      </div>
                      {sessionDurationMin ? (
                        <div className="interview-summary-stat">
                          <span>Duration</span>
                          <strong>{sessionDurationMin} mins</strong>
                        </div>
                      ) : null}
                      <div className="interview-summary-stat">
                        <span>Difficulty</span>
                        <strong>{difficulty}</strong>
                      </div>
                      <div className="interview-summary-stat">
                        <span>Interview Type</span>
                        <strong>{interviewType}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="report-readiness-badge">
                    <CheckCircle2 size={20} color="var(--green)" />
                    <div>
                      <div className="readiness-headline">
                        Interview Ready <strong>{report.overall_score}%</strong>
                      </div>
                      <div className="readiness-sub">
                        {READINESS_LABEL[report.hiring_readiness] || report.hiring_readiness}
                      </div>
                    </div>
                  </div>

                  {!feedbackExpanded ? (
                    <p className="tool-step-sub" style={{ marginTop: "12px" }}>
                      Interview complete. Click "View Feedback" below for your full breakdown — scores, strengths, weaknesses, question-by-question review, and next steps.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: "12px", margin: "20px 0", flexWrap: "wrap" }}>
                        <ScoreChip label="Overall" score={report.overall_score} />
                        <ScoreChip label="Technical" score={report.technical_score} />
                        <ScoreChip label="Communication" score={report.communication_score} />
                        <ScoreChip label="Problem Solving" score={report.problem_solving_score} />
                        <ScoreChip label="Confidence" score={report.confidence_score} />
                        <ScoreChip label="Behavior" score={report.behavior_score} />
                        <ScoreChip label="Time Management" score={report.time_management_score} />
                      </div>

                      <ListSection title="Strengths" items={report.strengths} />

                      {(() => {
                        const priorityItems = [
                          ...(report.weaknesses || []).slice(0, 2),
                          ...(report.missing_skills || []).slice(0, 1),
                        ]
                          .map(priorityText)
                          .filter(Boolean);
                        if (priorityItems.length === 0) return null;
                        return (
                          <div className="priority-card">
                            <div className="priority-card-title">
                              <AlertTriangle size={14} /> Priority Improvements
                            </div>
                            <ul className="priority-card-list">
                              {priorityItems.map((it, i) => (
                                <li key={i}>{it}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}

                      <ListSection title="Weaknesses" items={report.weaknesses} />
                      <ListSection title="Missing Skills" items={report.missing_skills} />
                      <ListSection title="Interview Tips" items={report.interview_tips} />
                      <ListSection title="Recommended Learning" items={report.recommended_learning} />
                      <ListSection title="Suggested Improvements" items={report.suggested_improvements} />

                      {/* Question Review — accordion so a 20-question report doesn't
                          turn into one giant unreadable wall of text */}
                      {report.question_reviews?.length > 0 && (
                        <div className="result-section" style={{ marginTop: "8px" }}>
                          <div className="result-section-title">Question Review</div>
                          {report.question_reviews.map((qr, i) => {
                            const isOpen = openReviewIndices.has(i);
                            const toggle = () =>
                              setOpenReviewIndices((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              });
                            return (
                              <div key={i} className="question-review-card accordion-section">
                                <div className="accordion-header question-review-header">
                                  <button type="button" className="accordion-btn question-review-toggle" onClick={toggle} aria-expanded={isOpen}>
                                    <span className="accordion-header-left">
                                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                      <span className="question-review-q">Question {i + 1}</span>
                                    </span>
                                    {!isOpen && <span className="accordion-summary">{qr.question}</span>}
                                  </button>
                                  <span className={`question-review-score-badge ${scoreBand(qr.score)}`}>{qr.score}/100</span>
                                </div>
                                {isOpen && (
                                  <div className="question-review-body">
                                    <div className="question-review-q-text">{qr.question}</div>
                                    <div className="question-review-row">
                                      <span className="qr-label">Your Answer</span>
                                      {qr.your_answer || "(skipped)"}
                                    </div>
                                    <div className="question-review-row">
                                      <span className="qr-label">Ideal Answer</span>
                                      {qr.ideal_answer}
                                    </div>
                                    <div className="question-review-row">
                                      <span className="qr-label">AI Feedback</span>
                                      {qr.feedback}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Nav — View Feedback, Practice Again, Download Report, Change Career Focus, Back to Dashboard */}
                  <div className="tool-step-nav" style={{ marginTop: "24px", gap: "12px", flexWrap: "wrap", display: "flex" }}>
                    <button type="button" className="exp-btn" onClick={() => setFeedbackExpanded((v) => !v)}>
                      {feedbackExpanded ? "Hide Feedback" : "View Feedback"}
                    </button>
                    <button type="button" className="analyze-btn" style={{ width: "auto" }} onClick={handlePracticeAgain}>
                      Practice Again
                    </button>
                    <button type="button" className="btn-secondary" onClick={handleDownloadReport}>
                      <Download size={14} style={{ marginRight: "6px" }} /> Download PDF
                    </button>
                    <button type="button" className="btn-secondary" onClick={handleChangeContext}>
                      Change Career Focus
                    </button>
                    <button type="button" className="reset-btn" style={{ marginLeft: "auto" }} onClick={() => navigate("/profile")}>
                      <Home size={14} style={{ marginRight: "6px" }} /> Back to Profile
                    </button>
                  </div>

                  {/* Final CTA — connects this tool back into the rest of the
                      ecosystem instead of being a dead end */}
                  <div className="final-cta-card">
                    <div className="final-cta-title">Ready to Apply?</div>
                    <p className="final-cta-sub">Put this practice to work — polish your resume and double-check the opportunity before you apply.</p>
                    <div className="final-cta-links">
                      <button type="button" className="final-cta-link" onClick={() => navigate("/resume-builder-review")}>
                        <FileText size={16} />
                        <span>Resume Builder &amp; Review</span>
                      </button>
                      <button type="button" className="final-cta-link" onClick={() => navigate("/opportunity")}>
                        <Search size={16} />
                        <span>Verify This Opportunity</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </motion.div>
  );
}
