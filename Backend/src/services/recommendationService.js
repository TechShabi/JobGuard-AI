/**
 * Small, focused recommendation layer for Opportunity → Resume → Interview.
 * Uses only real signals available in the request (no invented scores).
 *
 * Sprint 7 can expand this into a fuller cross-tool engine.
 */

/**
 * @param {object} input
 * @param {object|null} input.resume - latest resume summary { exists, ats_score?, role?, source? }
 * @param {object|null} input.interview - latest interview { exists, overall_score?, status? }
 * @param {object|null} input.opportunity - selected opportunity + verification
 * @param {string|null} input.userMark - saved | viewed | applied | null
 */
function nextBestAction({ resume, interview, opportunity, userMark } = {}) {
  // Already applied (user explicitly marked)
  if (userMark === "applied") {
    return {
      action: "prepare_interview",
      label: "Prepare for Interview",
      reason: "You’ve marked this opportunity as applied. Practice interview questions next.",
      href: "/interview",
      priority: 1,
    };
  }

  const hasResume = !!(resume && resume.exists);
  const ats = typeof resume?.ats_score === "number" ? resume.ats_score : null;
  const resumeWeak = hasResume && ats != null && ats < 55;
  const resumeStrong = hasResume && (ats == null || ats >= 70);

  const hasInterview = !!(interview && interview.exists);
  const interviewScore =
    typeof interview?.overall_score === "number" ? interview.overall_score : null;
  const interviewReady =
    hasInterview && (interviewScore == null || interviewScore >= 65);

  if (!hasResume) {
    return {
      action: "build_resume",
      label: "Build an ATS Resume",
      reason:
        "No JobGuard resume is connected yet. Building or reviewing one here improves fit signals for this role.",
      href: "/resume-builder-review?mode=build",
      secondary: {
        label: "Already have a resume? Review it",
        href: "/resume-builder-review?mode=review",
      },
      priority: 1,
    };
  }

  if (resumeWeak) {
    return {
      action: "improve_resume",
      label: "Review / Improve Resume",
      reason:
        ats != null
          ? `Your JobGuard resume ATS score is ${ats}/100. Strengthening it before applying is recommended.`
          : "Your JobGuard resume may need improvement before applying.",
      href: "/resume-builder-review?mode=review",
      priority: 1,
    };
  }

  if (resumeStrong && !hasInterview) {
    return {
      action: "practice_interview",
      label: "Practice Interview",
      reason:
        "Resume signals look solid. A mock interview helps confirm readiness before you apply.",
      href: "/interview",
      secondary: {
        label: "Apply externally",
        href: opportunity?.source_url || null,
        external: true,
      },
      priority: 2,
    };
  }

  if (resumeStrong && hasInterview && !interviewReady) {
    return {
      action: "practice_interview",
      label: "Practice Interview Again",
      reason:
        interviewScore != null
          ? `Last interview score was ${interviewScore}/100. Another practice round can raise confidence.`
          : "Interview practice is incomplete — finish a mock session before applying.",
      href: "/interview",
      priority: 2,
    };
  }

  // Resume + interview look good → apply
  if (opportunity?.source_url) {
    return {
      action: "apply",
      label: "Apply Externally",
      reason: "Resume and interview signals look ready. Apply on the source platform.",
      href: opportunity.source_url,
      external: true,
      priority: 1,
    };
  }

  return {
    action: "review_opportunity",
    label: "Review Opportunity Details",
    reason: "Review JobGuard’s analysis, then decide your next step.",
    href: null,
    priority: 3,
  };
}

module.exports = { nextBestAction };
