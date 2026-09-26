/**
 * Server-side normalization for Interview AI reports.
 * Scores are AI estimates — never treat missing scores as zero performance.
 */

const SCORE_KEYS = [
  "overall_score",
  "technical_score",
  "communication_score",
  "problem_solving_score",
  "confidence_score",
  "behavior_score",
  "time_management_score",
];

const ARRAY_KEYS = [
  "strengths",
  "weaknesses",
  "missing_skills",
  "recommended_learning",
  "interview_tips",
  "suggested_improvements",
  "question_reviews",
];

const READINESS = new Set(["Low", "Medium", "High", "Unknown"]);

function clampScore(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asString(v, fallback = "") {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    return v.text || v.point || v.note || v.title || v.summary || fallback;
  }
  return String(v);
}

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((item) => asString(item)).filter(Boolean);
}

function normalizeQuestionReview(qr) {
  if (!qr || typeof qr !== "object") {
    return {
      question: "",
      your_answer: "",
      ideal_answer: "",
      feedback: "",
      score: null,
    };
  }
  return {
    question: asString(qr.question),
    your_answer: asString(qr.your_answer),
    ideal_answer: asString(qr.ideal_answer),
    feedback: asString(qr.feedback),
    score: clampScore(qr.score),
  };
}

/**
 * @param {object} raw - parsed Gemini report
 * @param {{ isFallback?: boolean }} opts
 */
function normalizeInterviewReport(raw, opts = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {
    isFallback: !!(opts.isFallback || src.isFallback),
    assessment_type: "ai_estimated",
    overall_score: clampScore(src.overall_score),
    hiring_readiness: READINESS.has(src.hiring_readiness)
      ? src.hiring_readiness
      : "Unknown",
    technical_score: clampScore(src.technical_score),
    communication_score: clampScore(src.communication_score),
    problem_solving_score: clampScore(src.problem_solving_score),
    confidence_score: clampScore(src.confidence_score),
    behavior_score: clampScore(src.behavior_score),
    time_management_score:
      src.time_management_score === null || src.time_management_score === undefined
        ? null
        : clampScore(src.time_management_score),
    strengths: asStringArray(src.strengths),
    weaknesses: asStringArray(src.weaknesses),
    missing_skills: asStringArray(src.missing_skills),
    recommended_learning: asStringArray(src.recommended_learning),
    interview_tips: asStringArray(src.interview_tips),
    suggested_improvements: asStringArray(src.suggested_improvements),
    question_reviews: Array.isArray(src.question_reviews)
      ? src.question_reviews.map(normalizeQuestionReview)
      : [],
  };

  // Ensure array keys always exist even if somehow stripped
  for (const k of ARRAY_KEYS) {
    if (!Array.isArray(out[k])) out[k] = [];
  }

  return out;
}

module.exports = {
  normalizeInterviewReport,
  clampScore,
  SCORE_KEYS,
};
