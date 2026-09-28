// ═══════════════════════════════════════════════════════════════════════
// CAREER GROWTH BUSINESS CONFIG
// ═══════════════════════════════════════════════════════════════════════
// Single source of truth for JobGuard AI's monetization model.
//
// Nothing in the rest of the codebase should hardcode membership names,
// session limits, session costs, or feature-access rules. Everything reads
// from here, so pricing / limits / feature gates can change in one place.
//
// Vocabulary rule: internally we still count integers ("sessions"), but
// nothing user-facing ever mentions tokens, credits, requests, or API
// calls. A "Career Session" is the only unit a user ever sees.
// ═══════════════════════════════════════════════════════════════════════

const MEMBERSHIP_IDS = Object.freeze({
  STARTER: "starter",
  PLUS: "plus",
  PRO: "pro",
});

// Lower rank = lower tier. Used to answer "does membership A satisfy the
// minimum required membership B" without string-comparing plan names.
const MEMBERSHIP_RANK = Object.freeze({
  [MEMBERSHIP_IDS.STARTER]: 0,
  [MEMBERSHIP_IDS.PLUS]: 1,
  [MEMBERSHIP_IDS.PRO]: 2,
});

// `sessionsPerCycle: null` means unlimited.
// `careerFocusLimit: null` means unlimited (Pro only) — see CareerFocus
// model + careerFocusService.js. Starter and Go both cap at 1 active
// Career Focus (product-spec sections 27/28); the tier difference between
// them is capacity/AI depth, never the Career Focus count.
//
// Highlights use INHERITANCE wording (product-spec section 32) — Go/Pro
// never repeat "Opportunity / Resume / Interview" (every plan already has
// all three, per section 34: no arbitrary per-tool paywalls) and never
// lead with a raw internal session number as the primary pitch (section
// 33) — sessionsPerCycle stays available internally/in the UI's own
// qualitative badge (see SESSION_TIER_LABEL in PricingPage.jsx) for
// members who want the exact number, but it isn't the headline bullet.
const MEMBERSHIPS = Object.freeze({
  [MEMBERSHIP_IDS.STARTER]: {
    id: MEMBERSHIP_IDS.STARTER,
    name: "Career Starter",
    tagline: "For casual job seekers exploring what's out there.",
    badge: null,
    monthlyPrice: 0,
    annualPrice: 0,
    priceNote: "No credit card required",
    sessionsPerCycle: 20,
    cycleDays: 30,
    careerFocusLimit: 1,
    highlights: [
      "Opportunity — AI-verified job discovery",
      "Resume — review & builder",
      "Interview — AI mock practice",
      "1 Career Focus",
      "Core AI assistance",
    ],
    guarantee: "No signup required for basic use",
  },
  [MEMBERSHIP_IDS.PLUS]: {
    id: MEMBERSHIP_IDS.PLUS, // legacy id "plus" — product name Career Go
    name: "Career Go",
    tagline: "For active job seekers who want JobGuard-assisted discovery.",
    badge: "⭐ Most Popular",
    monthlyPrice: 9,
    annualPrice: null, // annual not billable in Sprint 7
    priceNote: "Billed monthly • Cancel anytime",
    sessionsPerCycle: 150,
    cycleDays: 30,
    careerFocusLimit: 1,
    highlights: [
      "Everything in Career Starter",
      "More AI assistance",
      "Higher usage",
      "More recommendations & automation",
      "Saved history across every tool",
    ],
    guarantee: "Cancel anytime — access until period end",
    productAlias: "go",
  },
  [MEMBERSHIP_IDS.PRO]: {
    id: MEMBERSHIP_IDS.PRO,
    name: "Career Pro",
    tagline: "For professionals who want maximum usage.",
    badge: null,
    monthlyPrice: 29,
    annualPrice: null, // annual not billable in Sprint 7
    priceNote: "Billed monthly • Cancel anytime",
    sessionsPerCycle: null, // unlimited
    cycleDays: 30,
    careerFocusLimit: null, // unlimited — Pro-only differentiator
    highlights: [
      "Everything in Career Go",
      "Maximum AI assistance",
      "Highest usage",
      "Multiple Career Focuses",
      "Advanced recommendations & automation",
    ],
    guarantee: "Cancel anytime — access until period end",
  },
});

// guestAccess:
//   "full"    → guest can use it exactly like a Starter member (still capped
//               by the one-time free trial the client already tracks)
//   "limited" → guest gets a reduced/one-time experience (same trial gate)
//   "none"    → guest is blocked outright, must create an account
//
// minMembership is the lowest membership tier that unlocks the feature for
// a logged-in user. sessionCost is how many Career Sessions one successful
// use consumes from the member's monthly pool.
const FEATURES = Object.freeze({
  opportunity_verification: {
    key: "opportunity_verification",
    label: "Opportunity Verification",
    description: "Verify a job posting, message, or recruiter for scam risk.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.STARTER,
    guestAccess: "limited",
  },
  opportunity_find: {
    key: "opportunity_find",
    label: "Opportunity Find",
    description: "Search and evaluate career opportunities with JobGuard checks.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.STARTER,
    guestAccess: "limited",
  },
  resume_review: {
    key: "resume_review",
    label: "Resume Review",
    description: "AI-scored feedback on an existing resume.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.STARTER,
    guestAccess: "limited",
  },
  resume_optimize: {
    key: "resume_optimize",
    label: "Resume Optimization",
    description: "AI rewrite of your resume targeted at a specific role.",
    sessionCost: 2,
    minMembership: MEMBERSHIP_IDS.PLUS,
    guestAccess: "none",
  },
  resume_builder: {
    key: "resume_builder",
    label: "Resume Generation",
    description: "Build a new resume from your career profile.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.STARTER,
    guestAccess: "none",
  },
  interview_practice: {
    key: "interview_practice",
    label: "Interview Practice",
    description: "Generate a mock interview for a role.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.STARTER,
    guestAccess: "limited",
  },
  interview_report: {
    key: "interview_report",
    label: "Interview Report",
    description: "AI performance report at the end of a mock interview.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.STARTER,
    guestAccess: "limited",
  },
  // ── Future modules — wired into the permission system now so they can
  // ship later without touching membership/permission logic again. ──
  cover_letter: {
    key: "cover_letter",
    label: "Cover Letter Generator",
    description: "Generate a tailored cover letter for a role.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.PLUS,
    guestAccess: "none",
    comingSoon: true,
  },
  career_coach: {
    key: "career_coach",
    label: "Career Coach",
    description: "Ongoing AI guidance on your career trajectory.",
    sessionCost: 2,
    minMembership: MEMBERSHIP_IDS.PRO,
    guestAccess: "none",
    comingSoon: true,
  },
  salary_negotiation: {
    key: "salary_negotiation",
    label: "Salary Negotiation Assistant",
    description: "AI-prepared negotiation talking points.",
    sessionCost: 2,
    minMembership: MEMBERSHIP_IDS.PLUS,
    guestAccess: "none",
    comingSoon: true,
  },
  linkedin_optimizer: {
    key: "linkedin_optimizer",
    label: "LinkedIn Optimizer",
    description: "AI review of your LinkedIn profile.",
    sessionCost: 1,
    minMembership: MEMBERSHIP_IDS.PLUS,
    guestAccess: "none",
    comingSoon: true,
  },
  career_roadmap: {
    key: "career_roadmap",
    label: "Career Roadmap",
    description: "A personalized long-term career growth plan.",
    sessionCost: 2,
    minMembership: MEMBERSHIP_IDS.PRO,
    guestAccess: "none",
    comingSoon: true,
  },
});

function isMembershipAtLeast(membershipId, requiredMembershipId) {
  const have = MEMBERSHIP_RANK[membershipId] ?? 0;
  const need = MEMBERSHIP_RANK[requiredMembershipId] ?? 0;
  return have >= need;
}

function getMembership(membershipId) {
  return MEMBERSHIPS[membershipId] || MEMBERSHIPS[MEMBERSHIP_IDS.STARTER];
}

function getFeature(featureKey) {
  return FEATURES[featureKey] || null;
}

// null => unlimited (Pro). Falls back to Starter's limit (1) for an
// unrecognized membership id rather than accidentally granting unlimited.
function getCareerFocusLimit(membershipId) {
  const membership = MEMBERSHIPS[membershipId];
  if (!membership) return MEMBERSHIPS[MEMBERSHIP_IDS.STARTER].careerFocusLimit;
  return membership.careerFocusLimit;
}

// Friendly, career-growth-flavored upgrade copy. Never mentions tokens,
// credits, requests, or API calls.
function buildUpgradeMessage(featureKey, requiredMembershipId) {
  const feature = getFeature(featureKey);
  const membership = getMembership(requiredMembershipId);
  const featureLabel = feature?.label || "This feature";
  return {
    title: `Unlock ${featureLabel}`,
    body: `${featureLabel} is part of ${membership.name}. Upgrade to continue your career growth.`,
    cta: "Upgrade to Continue",
  };
}

function buildSessionsExhaustedMessage(membershipId) {
  const membership = getMembership(membershipId);
  return {
    title: "Continue Your Career Growth",
    body: `You've used all of your Career Sessions for this cycle on ${membership.name}. Upgrade for a higher usage limit, or wait until your cycle resets.`,
    cta: "Upgrade to Continue",
  };
}

module.exports = {
  MEMBERSHIP_IDS,
  MEMBERSHIP_RANK,
  MEMBERSHIPS,
  FEATURES,
  isMembershipAtLeast,
  getMembership,
  getFeature,
  getCareerFocusLimit,
  buildUpgradeMessage,
  buildSessionsExhaustedMessage,
};
