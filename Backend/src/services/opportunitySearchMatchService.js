/**
 * Deterministic search-constraint matching — authoritative, not advisory.
 *
 * This is the fix for "loose" search behavior: a job only survives if it
 * satisfies EVERY constraint the user actually specified (AND semantics),
 * checked here BEFORE verification/relevance ever run. Gemini's relevance
 * explanation (opportunityRelevanceService + geminiService) never gets a
 * vote on whether a role/skill/remote/location constraint was satisfied —
 * it only explains WHY an already-admitted job is relevant.
 *
 * matchesSearchCriteria(opportunity, query) returns:
 *   { pass: boolean, reasons: { role, skills, remote, location },
 *     rejection_code: "ROLE_MISMATCH" | "SKILL_MISMATCH" | "REMOTE_MISMATCH" |
 *                      "LOCATION_MISMATCH" | "LOCATION_INSUFFICIENT" | null }
 *
 * `reasons` is always populated (even on a pass) for admin/debug
 * observability (product-spec section 24) — never shown to end users
 * directly, only persisted for operators.
 */

// ── Role family detection ──────────────────────────────────────────────
// Deliberately NOT an exhaustive title list. A small set of mutually
// exclusive "families" is enough to catch the actual bug (Frontend/Backend
// crossover via an incidental skill mention) without hardcoding every
// possible title variation — token overlap (below) handles the rest.
const ROLE_FAMILIES = {
  backend: ["backend", "back-end", "back end", "server-side", "server side", "api engineer"],
  frontend: ["frontend", "front-end", "front end", "ui developer", "ui engineer"],
  fullstack: ["full stack", "full-stack", "fullstack"],
  mobile: ["mobile", "ios developer", "android developer", "react native", "flutter"],
  devops: ["devops", "site reliability", " sre", "platform engineer", "infrastructure engineer", "cloud engineer"],
  data: ["data scientist", "data analyst", "data engineer", "machine learning", "ml engineer"],
  qa: [" qa ", "qa engineer", "quality assurance", "test engineer", "sdet"],
  design: ["designer", "ux ", "ui/ux", "product design"],
  product: ["product manager", "product owner"],
  marketing: ["marketing", "growth", "seo "],
  sales: ["sales", "account executive", "business development"],
};

function detectFamilies(text) {
  const t = ` ${String(text || "").toLowerCase()} `;
  return Object.entries(ROLE_FAMILIES)
    .filter(([, keywords]) => keywords.some((k) => t.includes(k)))
    .map(([family]) => family);
}

// A fullstack listing genuinely does backend AND frontend work, so it's
// compatible with either search — every other family must share an exact
// family to be considered compatible.
function familiesCompatible(queryFamilies, oppFamilies) {
  if (!queryFamilies.length || !oppFamilies.length) return null; // undetermined — caller falls back to token overlap
  if (oppFamilies.includes("fullstack") && (queryFamilies.includes("backend") || queryFamilies.includes("frontend"))) {
    return true;
  }
  return queryFamilies.some((f) => oppFamilies.includes(f));
}

const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with"]);
function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9+.#]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
function overlapRatio(queryTokens, targetTokens) {
  if (!queryTokens.length) return 1;
  const targetSet = new Set(targetTokens);
  const hits = queryTokens.filter((t) => targetSet.has(t));
  return hits.length / queryTokens.length;
}

function matchesRole(query, opp) {
  if (!query.role) return { pass: true, reason: null };

  const queryFamilies = detectFamilies(query.role);
  const oppFamilies = detectFamilies(opp.role);
  const familyVerdict = familiesCompatible(queryFamilies, oppFamilies);

  // A clear, opposing family (Frontend title vs. Backend search) is a hard
  // reject — this is the exact bug the product spec calls out. The job
  // DESCRIPTION is never allowed to override this; only the title is
  // considered here, on purpose.
  if (familyVerdict === false) {
    return { pass: false, reason: "ROLE_MISMATCH" };
  }
  if (familyVerdict === true) {
    return { pass: true, reason: null };
  }

  // Neither side maps to a known family (e.g. generic "Software Engineer")
  // — fall back to a meaningful token-overlap threshold on the TITLE only.
  const queryTokens = tokenize(query.role);
  const oppTokens = tokenize(opp.role);
  const ratio = overlapRatio(queryTokens, oppTokens);
  if (ratio >= 0.5) return { pass: true, reason: null };

  return { pass: false, reason: "ROLE_MISMATCH" };
}

// ── Skill matching ───────────────────────────────────────────────────────
// Generic variant folding (not a giant hardcoded synonym table): strip
// spaces/dots/hyphens and lowercase, then also compare with a trailing
// "js" stripped, so "Node", "Node.js", "Node JS", "NodeJS" all line up,
// same for React/ReactJS, Express/ExpressJS, Vue/VueJS, etc.
function canonicalizeSkill(s) {
  return String(s || "").toLowerCase().replace(/[.\-\s]/g, "");
}
function skillRoot(s) {
  const c = canonicalizeSkill(s);
  return c.endsWith("js") ? c.slice(0, -2) : c;
}
function skillsEquivalent(a, b) {
  const ca = canonicalizeSkill(a);
  const cb = canonicalizeSkill(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const ra = skillRoot(ca);
  const rb = skillRoot(cb);
  return ra.length > 1 && ra === rb;
}

// Evidence for one requested skill: prefer structured requirements, then
// look for the skill as a real word (not a substring of an unrelated word)
// in the description. A single incidental mention buried in prose still
// counts here IF it's a genuine word-boundary match — the spec's "weak
// incidental mention" concern is really about fuzzy/substring matching,
// which this avoids by using word boundaries and variant-equivalence only
// (never partial-string matching).
function hasSkillEvidence(opp, requestedSkill) {
  const requirements = Array.isArray(opp.requirements) ? opp.requirements : [];
  if (requirements.some((r) => skillsEquivalent(r, requestedSkill))) return true;

  const text = String(opp.description || "");
  const words = text
    .split(/[^a-zA-Z0-9+.#]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  // also check bigrams so "React Native" / "Node JS" style two-word skills
  // in free text still register
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(`${words[i]} ${words[i + 1]}`);

  return [...words, ...bigrams].some((w) => skillsEquivalent(w, requestedSkill));
}

function matchesSkills(query, opp) {
  const skills = Array.isArray(query.skills) ? query.skills.filter(Boolean) : [];
  if (!skills.length) return { pass: true, reason: null };

  // AND semantics, per the product spec: every requested skill needs its
  // own evidence — never silently OR'd together.
  const missing = skills.filter((s) => !hasSkillEvidence(opp, s));
  if (missing.length) return { pass: false, reason: "SKILL_MISMATCH", missing };
  return { pass: true, reason: null };
}

// ── Remote + location ────────────────────────────────────────────────────
function textIncludesLocation(haystack, needle) {
  const h = String(haystack || "").toLowerCase();
  const n = String(needle || "").toLowerCase().trim();
  if (!h || !n) return false;
  return h.includes(n) || n.includes(h);
}

function isLocationEligible(opp, queryLocation) {
  if (!queryLocation) return { pass: true, reason: null };

  // Himalayas gives a real, structured per-job restriction list — the
  // strongest signal when available (see himalayasProvider.js).
  const restrictions = opp.raw_source_metadata?.location_restrictions;
  if (Array.isArray(restrictions) && restrictions.length) {
    const match = restrictions.some((r) => textIncludesLocation(r, queryLocation));
    return { pass: match, reason: match ? null : "LOCATION_MISMATCH" };
  }

  const loc = String(opp.location || "").trim().toLowerCase();
  if (!loc) return { pass: false, reason: "LOCATION_INSUFFICIENT" };
  if (loc.includes("worldwide") || loc.includes("anywhere")) return { pass: true, reason: null };

  const match = textIncludesLocation(loc, queryLocation);
  return { pass: match, reason: match ? null : "LOCATION_MISMATCH" };
}

function matchesRemoteAndLocation(query, opp) {
  const pref = query.remote_preference || "any";

  if (pref === "remote") {
    if (!opp.remote) return { remote: { pass: false, reason: "REMOTE_MISMATCH" }, location: { pass: true, reason: null } };
    const location = isLocationEligible(opp, query.location);
    return { remote: { pass: true, reason: null }, location };
  }

  if (pref === "onsite") {
    if (opp.remote) return { remote: { pass: false, reason: "REMOTE_MISMATCH" }, location: { pass: true, reason: null } };
    if (query.location) {
      const match = textIncludesLocation(opp.location, query.location);
      return {
        remote: { pass: true, reason: null },
        location: { pass: match, reason: match ? null : "LOCATION_MISMATCH" },
      };
    }
    return { remote: { pass: true, reason: null }, location: { pass: true, reason: null } };
  }

  // "any" — no remote constraint. If a location was requested and the job
  // is NOT remote, still check it loosely; a remote job with "any" pref
  // always satisfies location (it's available anywhere by definition).
  if (query.location && !opp.remote) {
    const match = textIncludesLocation(opp.location, query.location);
    return {
      remote: { pass: true, reason: null },
      location: { pass: match, reason: match ? null : "LOCATION_MISMATCH" },
    };
  }
  return { remote: { pass: true, reason: null }, location: { pass: true, reason: null } };
}

// ── Experience level ─────────────────────────────────────────────────────
// Only ever a HARD reject on a genuinely OPPOSING bucket (e.g. query wants
// Senior, listing is clearly Internship). A listing whose level can't be
// determined is UNKNOWN, never a mismatch (product-spec section 15/13):
// omission is not evidence of disqualification.
const EXPERIENCE_BUCKETS = {
  internship: ["internship", "intern", "trainee"],
  entry: ["entry level", "entry-level", "entrylevel", "fresher", "graduate", "0-1"],
  junior: ["junior", "jr", "associate"],
  mid: ["mid level", "mid-level", "midlevel", "intermediate", "2-4"],
  senior: ["senior", "sr", "5+", "experienced"],
  lead: ["lead", "principal", "staff", "manager", "head of"],
};
function normalizeExperience(value) {
  const v = ` ${String(value || "").toLowerCase().trim()} `;
  if (!v.trim() || v.includes("any")) return null;
  for (const [bucket, keywords] of Object.entries(EXPERIENCE_BUCKETS)) {
    if (keywords.some((k) => v.includes(k))) return bucket;
  }
  return null; // unrecognized text — treated as unknown, not a mismatch
}
function matchesExperience(query, opp) {
  const qLevel = normalizeExperience(query.experience);
  if (!qLevel) return { pass: true, reason: null }; // no (interpretable) constraint requested
  const oppLevel = normalizeExperience(opp.seniority);
  if (!oppLevel) return { pass: true, reason: null }; // source didn't say — unknown, never auto-rejected
  if (oppLevel === qLevel) return { pass: true, reason: null };
  return { pass: false, reason: "EXPERIENCE_MISMATCH" };
}

// ── Employment type ──────────────────────────────────────────────────────
// Same "unknown is not a mismatch" principle: never fabricated on either
// side, so a source that didn't state one can't be confidently rejected.
function normalizeEmploymentType(value) {
  const v = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!v || v === "any") return null;
  if (v.includes("fulltime")) return "fulltime";
  if (v.includes("parttime")) return "parttime";
  if (v.includes("contract") || v.includes("freelance")) return "contract";
  if (v.includes("intern")) return "internship";
  if (v.includes("temp")) return "temporary";
  return "other";
}
function matchesEmploymentType(query, opp) {
  const q = normalizeEmploymentType(query.employment_type);
  if (!q) return { pass: true, reason: null };
  const o = normalizeEmploymentType(opp.employment_type);
  if (!o) return { pass: true, reason: null }; // source didn't say — unknown, never auto-rejected
  if (q === o) return { pass: true, reason: null };
  return { pass: false, reason: "EMPLOYMENT_TYPE_MISMATCH" };
}

// ── Freshness ─────────────────────────────────────────────────────────────
// The one filter where "unknown" IS treated as a rejection when the user
// explicitly asked for a freshness window (product-spec section 17: "an
// unknown posting date must not be treated as a confirmed match" for
// strict freshness searches) — deliberately the opposite default from
// experience/employment type above, per the product spec's own distinction.
const FRESHNESS_WINDOWS_DAYS = {
  "24h": 1, last24h: 1, last_24_hours: 1, "1d": 1,
  "3d": 3, last3d: 3, last_3_days: 3,
  "7d": 7, last7d: 7, last_7_days: 7,
};
function matchesFreshness(query, opp) {
  const key = String(query.freshness || "").toLowerCase().replace(/\s+/g, "_");
  if (!key || key === "any") return { pass: true, reason: null };
  const windowDays = FRESHNESS_WINDOWS_DAYS[key];
  if (!windowDays) return { pass: true, reason: null }; // unrecognized value — don't punish on a value we can't interpret

  if (!opp.posted_at) return { pass: false, reason: "FRESHNESS_UNKNOWN" };
  const posted = new Date(opp.posted_at);
  if (Number.isNaN(posted.getTime())) return { pass: false, reason: "FRESHNESS_UNKNOWN" };

  const ageMs = Date.now() - posted.getTime();
  const ok = ageMs >= 0 && ageMs <= windowDays * 24 * 60 * 60 * 1000;
  return { pass: ok, reason: ok ? null : "FRESHNESS_MISMATCH" };
}

/**
 * Authoritative AND-gate. Every specified constraint must pass. Only
 * constraints the user actually specified participate (product-spec
 * section 18) — matchesExperience/matchesEmploymentType/matchesFreshness
 * all pass through as { pass: true } when the corresponding query field is
 * absent/"any", exactly like matchesRole/matchesSkills already do.
 */
function matchesSearchCriteria(opp, query = {}) {
  const role = matchesRole(query, opp);
  const skills = matchesSkills(query, opp);
  const { remote, location } = matchesRemoteAndLocation(query, opp);
  const experience = matchesExperience(query, opp);
  const employment_type = matchesEmploymentType(query, opp);
  const freshness = matchesFreshness(query, opp);

  const reasons = { role, skills, remote, location, experience, employment_type, freshness };
  const failed = [role, skills, remote, location, experience, employment_type, freshness].find(
    (r) => !r.pass
  );

  return {
    pass: !failed,
    reasons,
    rejection_code: failed ? failed.reason : null,
  };
}

module.exports = {
  matchesSearchCriteria,
  // exported for tests / potential reuse — not part of the "public" contract
  detectFamilies,
  skillsEquivalent,
  hasSkillEvidence,
  isLocationEligible,
  normalizeExperience,
  matchesExperience,
  normalizeEmploymentType,
  matchesEmploymentType,
  matchesFreshness,
};
