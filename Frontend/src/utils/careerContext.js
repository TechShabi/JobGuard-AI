// Turns the `career_context` object that now comes back on the SAME verification
// response (verifyUrl / verifyDescription / verifyImage) into the payload shape
// the Context Engine (backend Context model + setActiveContext) expects.
//
// IMPORTANT: this does NOT call any API / AI. It only reshapes data that Gemini
// already extracted during the single verification call.
//
// Kept intentionally minimal: job_title (role), company, job_level (experience),
// source. Nothing else — employment_type/location are NOT collected yet.

const SOURCE_LABELS = {
  url: "URL",
  description: "Description",
  image: "Image",
};

/**
 * @param {object|null|undefined} careerContext - the `career_context` field from
 *   the verification response's `data` object.
 * @param {"url"|"description"|"image"} source - which verification input method
 *   produced it (URL / Image / Description — these are input methods, not
 *   separate modules; source_module always stays "verification").
 * @returns {object|null} payload ready for setActiveContext(), or null if there
 *   wasn't enough job information to build a context (verification itself never fails).
 */
export function buildCareerContextPayload(careerContext, source) {
  if (!careerContext) return null;

  const role = careerContext.job_title || careerContext.role || "";
  if (!role) return null; // nothing usable extracted — don't create a context

  return {
    source_module: "verification", // always "verification" — url/image/description are input methods, not modules
    source_label: SOURCE_LABELS[source] || "Manual",
    role,
    company: careerContext.company || "Unknown Company",
    experience: careerContext.job_level || careerContext.experience || "Not Specified",
  };
}
