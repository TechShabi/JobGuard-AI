const fs = require("fs");
const Resume = require("../models/Resume");
const ResumeProfile = require("../models/ResumeProfile");
const { extractResumeText } = require("../services/resumeParserService");
const {
  analyzeResume,
  generateResumeContent,
  generateOptimizedResume,
} = require("../services/aiService");
const { consumeCareerSession } = require("../middleware/careerSession");
const { getStatus } = require("../services/careerSessionService");
const careerFocusService = require("../services/careerFocusService");

// ── RESUME REVIEW ────────────────────────────────────────────
// POST /api/resume/analyze  (multipart: resume file, + role, experience, description)
// Guest allowed (optionalAuth) — sirf logged-in user ka result DB mein save hoga.
exports.analyze = async (req, res) => {
  let filePath;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Resume file required" });
    }
    filePath = req.file.path;

    const { role: bodyRole, experience: bodyExperience, description } = req.body;
    const focus = req.user?.id
      ? await careerFocusService.resolveFocusForRequest(req.user.id, req.body.career_focus_id)
      : null;
    const focusContext = careerFocusService.toPromptContext(focus);
    const role = bodyRole || focusContext?.target_role;
    const experience = bodyExperience || focusContext?.experience_level;
    if (!role) {
      return res.status(400).json({ success: false, message: "Role required" });
    }

    const resumeText = await extractResumeText(filePath);
    if (!resumeText || resumeText.length < 30) {
      return res.status(400).json({
        success: false,
        message: "Could not read enough text from this resume. Try a different file.",
      });
    }

    const analysis = await analyzeResume(resumeText, { role, experience, description });

    let saved = null;
    if (req.user?.id) {
      saved = await Resume.create({
        user_id: req.user.id,
        source: "review",
        role,
        original_filename: req.file.originalname,
        analysis,
        ats_score: analysis.ats_score ?? null,
      });
    }

    await consumeCareerSession(req);
    if (focus) await careerFocusService.touchLastUsed(focus);

    return res.json({
      success: true,
      data: analysis,
      resume_id: saved?.id || null,
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });
  } catch (error) {
    console.error("resume analyze error:", error);
    return res.status(500).json({ success: false, message: error.message || "Resume analysis failed" });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
  }
};

// ── OPTIMIZE (post-review, OPTIONAL, separate AI call) ───────
// POST /api/resume/optimize  (multipart: resume file, + role, experience,
// description, weaknesses[], priority_fixes[], missing_skills[])
// Only called when the user explicitly clicks "Generate Optimized Resume"
// AFTER seeing the review — never combined with /analyze.
exports.optimize = async (req, res) => {
  let filePath;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Resume file required" });
    }
    filePath = req.file.path;

    const { role, experience, description } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: "Role required" });
    }

    // Review findings (already computed during /analyze) are passed back in,
    // so the rewrite directly targets them — no need to re-run analysis.
    const parseJsonArr = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          const p = JSON.parse(v);
          return Array.isArray(p) ? p : [];
        } catch (_) {
          return [];
        }
      }
      return [];
    };
    const parseJsonObj = (v) => {
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          const p = JSON.parse(v);
          return p && typeof p === "object" && !Array.isArray(p) ? p : {};
        } catch (_) {
          return {};
        }
      }
      return {};
    };
    const reviewSummary = {
      weaknesses: parseJsonArr(req.body.weaknesses),
      priority_fixes: parseJsonArr(req.body.priority_fixes),
      missing_skills: parseJsonArr(req.body.missing_skills),
      user_edits: parseJsonObj(req.body.user_edits),
    };

    const resumeText = await extractResumeText(filePath);
    if (!resumeText || resumeText.length < 30) {
      return res.status(400).json({
        success: false,
        message: "Could not read enough text from this resume. Try a different file.",
      });
    }

    const optimized = await generateOptimizedResume(
      resumeText,
      { role, experience, description },
      reviewSummary
    );

    await consumeCareerSession(req);

    return res.json({
      success: true,
      data: { ...optimized, original_resume_text: resumeText },
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });
  } catch (error) {
    console.error("resume optimize error:", error);
    return res.status(500).json({ success: false, message: error.message || "Resume optimization failed" });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
  }
};

// ── RESUME BUILDER ───────────────────────────────────────────
// POST /api/resume/generate  (auth required — result profile se link hota hai)
exports.generate = async (req, res) => {
  try {
    const { role, profileData } = req.body;
    if (!role || !profileData) {
      return res.status(400).json({ success: false, message: "role and profileData required" });
    }

    const aiContent = await generateResumeContent(profileData, role);

    const resumeData = {
      ...profileData,
      ai_summary: aiContent.summary || "",
      ai_experience_bullets: aiContent.experience_bullets || {},
      ai_project_bullets: aiContent.project_bullets || {},
      ai_skills_suggestions: aiContent.skills_suggestions || [],
    };

    const saved = await Resume.create({
      user_id: req.user.id,
      source: "builder",
      role,
      resume_data: resumeData,
    });

    // Profile ko bhi upsert karo taake agli baar autofill ho
    await ResumeProfile.upsert({
      user_id: req.user.id,
      preferred_role: role,
      phone: profileData.phone,
      github: profileData.github,
      linkedin: profileData.linkedin,
      portfolio: profileData.portfolio,
      education: profileData.education,
      experience: profileData.experience,
      projects: profileData.projects,
      skills: profileData.skills,
      role_specific: profileData.role_specific,
    });

    await consumeCareerSession(req);

    return res.status(201).json({
      success: true,
      resume_id: saved.id,
      resume: resumeData,
      careerSessions: req.careerUser ? getStatus(req.careerUser) : null,
    });
  } catch (error) {
    console.error("resume generate error:", error);
    return res.status(500).json({ success: false, message: error.message || "Resume generation failed" });
  }
};

// GET /api/resume/profile — autofill data
exports.getProfile = async (req, res) => {
  try {
    const profile = await ResumeProfile.findOne({ where: { user_id: req.user.id } });
    return res.json({ success: true, profile: profile || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/resume/profile
exports.updateProfile = async (req, res) => {
  try {
    const [profile] = await ResumeProfile.upsert(
      { user_id: req.user.id, ...req.body },
      { returning: true }
    );
    return res.json({ success: true, profile });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/resume?source=review|builder — history list
exports.list = async (req, res) => {
  try {
    const where = { user_id: req.user.id };
    if (req.query.source) where.source = req.query.source;
    // Sprint 9 — list returns metadata only; full analysis/resume_data via GET /:id
    const resumes = await Resume.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: 50,
      attributes: ["id", "user_id", "source", "role", "original_filename", "ats_score", "createdAt", "updatedAt"],
    });
    return res.json({ success: true, resumes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/resume/:id
exports.getOne = async (req, res) => {
  try {
    const resume = await Resume.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!resume) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, resume });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/resume/:id
exports.remove = async (req, res) => {
  try {
    const resume = await Resume.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!resume) return res.status(404).json({ success: false, message: "Not found" });
    await resume.destroy();
    return res.json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
