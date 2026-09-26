/**
 * Opportunity relevance scoring — deterministic and explainable.
 *
 * This is the actual source of truth for "how well does this job match
 * what the user asked for". Gemini is NOT used to produce this score (see
 * geminiService.explainOpportunityRelevance, which only writes a short
 * natural-language sentence describing signals THIS file already computed
 * — it never invents a number or a fact). That keeps the product promise
 * honest: "Matches React and JavaScript requirements and allows remote
 * applicants" rather than "AI thinks this is 94% perfect."
 *
 * Signals (each independently explainable, matching the product-spec
 * filter-order requirement):
 *   - role/title token overlap
 *   - skill overlap (query skills vs. the opportunity's own requirements)
 *   - remote/location compatibility
 *   - employment type match, when both sides specify one
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with",
  "developer", "engineer", "role", "job", "position", "junior", "senior",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9+.#]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function overlap(aTokens, bTokens) {
  const bSet = new Set(bTokens);
  return aTokens.filter((t) => bSet.has(t));
}

/**
 * @returns {{ score: number, reasons: string[], matched_skills: string[],
 *   missing_skills: string[], location_compatible: boolean|null }}
 */
function scoreOpportunity(query, opp) {
  const reasons = [];
  let score = 0;

  // Role/title overlap (up to 40 points)
  const queryRoleTokens = tokenize(query.role);
  const oppRoleTokens = tokenize(opp.role);
  const roleOverlap = overlap(queryRoleTokens, oppRoleTokens);
  if (queryRoleTokens.length) {
    const roleRatio = roleOverlap.length / queryRoleTokens.length;
    score += Math.round(roleRatio * 40);
    if (roleRatio >= 0.5) {
      reasons.push(`Title matches your target role ("${opp.role}").`);
    }
  }

  // Skill overlap (up to 35 points) — only counts skills the user actually
  // asked about against words appearing in the opportunity's own
  // requirements/description; never invents a skill list for either side.
  const querySkills = (query.skills || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  const oppText = [
    ...(opp.requirements || []),
    opp.description || "",
  ]
    .join(" ")
    .toLowerCase();
  const matched_skills = querySkills.filter((s) => oppText.includes(s));
  const missing_skills = querySkills.filter((s) => !oppText.includes(s));
  if (querySkills.length) {
    score += Math.round((matched_skills.length / querySkills.length) * 35);
    if (matched_skills.length) {
      reasons.push(`Mentions ${matched_skills.slice(0, 4).join(", ")}.`);
    }
  } else {
    // No skills stated in the query — don't penalize for something not asked.
    score += 15;
  }

  // Remote/location compatibility (up to 15 points)
  let location_compatible = null;
  if (query.remote_preference === "onsite") {
    location_compatible = !opp.remote;
    if (location_compatible) {
      score += 15;
      reasons.push("Available for on-site work in your target location.");
    }
    // If the opportunity IS remote-only and the user wants onsite, this is
    // a real mismatch — no points, and we don't pretend otherwise.
  } else if (opp.remote) {
    location_compatible = true;
    score += 15;
    reasons.push("Open to remote applicants.");
  } else if (query.location && opp.location) {
    const locMatch = String(opp.location).toLowerCase().includes(String(query.location).toLowerCase());
    location_compatible = locMatch;
    if (locMatch) {
      score += 15;
      reasons.push(`Located in ${opp.location}, matching your search.`);
    }
  } else {
    location_compatible = null; // genuinely unknown — never guessed
  }

  // Employment type (up to 10 points) — only scored when the user actually
  // specified a preference in query.preferences.employment_type
  const wantedType = query.preferences?.employment_type;
  if (wantedType && opp.employment_type) {
    const match = String(opp.employment_type).toLowerCase().includes(String(wantedType).toLowerCase());
    if (match) {
      score += 10;
      reasons.push(`Employment type matches (${opp.employment_type}).`);
    }
  } else if (!wantedType) {
    score += 5; // no preference stated — small neutral credit, not a penalty
  }

  score = Math.max(0, Math.min(100, score));

  return { score, reasons, matched_skills, missing_skills, location_compatible };
}

/**
 * Attaches `.relevance` to each opportunity and returns them sorted by
 * score descending. Pure/deterministic — safe to call on every verified
 * opportunity with no cost, no network call, no AI involved.
 */
function rankByRelevance(query, opportunities) {
  return opportunities
    .map((opp) => ({ ...opp, relevance: scoreOpportunity(query, opp) }))
    .sort((a, b) => b.relevance.score - a.relevance.score);
}

module.exports = { scoreOpportunity, rankByRelevance };
