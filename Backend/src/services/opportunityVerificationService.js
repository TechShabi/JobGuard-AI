/**
 * Opportunity Verification Layer for discovered opportunities.
 *
 * Every discovered opportunity passes through validateOpportunity() before
 * being presented as a trusted recommendation. This is a heuristic layer —
 * it does NOT claim cryptographic proof of a real-world posting, and it
 * does not replace the full Opportunity Verification (URL/Image/Description)
 * pipeline. It filters closed/stale/suspicious/unverifiable listings.
 */

const SUSPICIOUS_PHRASES = [
  "no experience needed",
  "make money fast",
  "training fee",
  "registration fee",
  "whatsapp only",
  "wire transfer",
  "crypto payment",
  "urgent hiring!!!",
  "guaranteed income",
  "$5000/week",
  "work from home easy money",
];

const STALE_DAYS = 45;

function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function textBlob(opp) {
  return [
    opp.role,
    opp.company,
    opp.description,
    opp.location,
    ...(opp.requirements || []),
    opp.salary_range,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * @returns {{
 *   status: "trusted" | "caution" | "rejected",
 *   freshness: "fresh" | "aging" | "stale" | "unknown",
 *   score: number, // 0-100 confidence the listing is usable
 *   flags: string[],
 *   concerns: string[],
 *   summary: string,
 * }}
 */
function validateOpportunity(opp) {
  const flags = [];
  const concerns = [];
  let score = 70;

  // Source presence
  if (!opp.source_url) {
    score -= 25;
    flags.push("missing_source_url");
    concerns.push("No external application link is available.");
  }
  if (!opp.company || /unknown|n\/a|tbd/i.test(opp.company)) {
    score -= 15;
    flags.push("weak_company");
    concerns.push("Company identity is unclear.");
  }
  if (!opp.role) {
    score -= 30;
    flags.push("missing_role");
    concerns.push("Role title is missing.");
  }

  // Freshness
  const age = daysSince(opp.posted_at);
  let freshness = "unknown";
  if (age == null) {
    freshness = "unknown";
    score -= 5;
    flags.push("unknown_post_date");
  } else if (age <= 14) {
    freshness = "fresh";
  } else if (age <= STALE_DAYS) {
    freshness = "aging";
    score -= 8;
  } else {
    freshness = "stale";
    score -= 30;
    flags.push("stale");
    concerns.push(`Listing appears ${age}+ days old and may be closed.`);
  }

  // Suspicious content heuristics
  const blob = textBlob(opp);
  for (const phrase of SUSPICIOUS_PHRASES) {
    if (blob.includes(phrase)) {
      score -= 20;
      flags.push("suspicious_language");
      concerns.push(`Suspicious phrase detected: “${phrase}”.`);
      break;
    }
  }

  // Upfront fee patterns
  if (/fee|deposit|pay to apply/i.test(blob) && /train|register|apply/i.test(blob)) {
    score -= 25;
    flags.push("possible_upfront_fee");
    concerns.push("Possible upfront fee — a common scam signal.");
  }

  // Development samples are usable for UX but never claimed as live verified jobs
  if (opp.is_development_sample || !opp.is_live) {
    flags.push("development_sample");
  }

  score = Math.max(0, Math.min(100, score));

  let status = "trusted";
  if (score < 40 || flags.includes("stale") && score < 50) status = "rejected";
  else if (score < 60 || flags.includes("suspicious_language") || flags.includes("possible_upfront_fee")) {
    status = "caution";
  }

  let summary;
  if (status === "trusted") {
    summary = opp.is_live
      ? "Passed JobGuard checks for source, freshness, and risk signals."
      : "Passed JobGuard sample checks. This is a development sample — not a live verified opening.";
  } else if (status === "caution") {
    summary = "Some risk or quality signals need your attention before pursuing.";
  } else {
    summary = "Does not meet JobGuard trust thresholds for recommendation.";
  }

  return { status, freshness, score, flags, concerns, summary };
}

/**
 * Filter + attach verification. Rejected opportunities are excluded from
 * trusted recommendations (returned separately for transparency if needed).
 */
function processDiscovered(opportunities = []) {
  const verified = [];
  const rejected = [];

  for (const opp of opportunities) {
    const verification = validateOpportunity(opp);
    const row = { ...opp, verification };
    if (verification.status === "rejected") rejected.push(row);
    else verified.push(row);
  }

  // Rank: trusted first, then higher score, then fresher
  const rankFresh = { fresh: 0, aging: 1, unknown: 2, stale: 3 };
  verified.sort((a, b) => {
    const st = (a.verification.status === "trusted" ? 0 : 1) - (b.verification.status === "trusted" ? 0 : 1);
    if (st !== 0) return st;
    if (b.verification.score !== a.verification.score) return b.verification.score - a.verification.score;
    return (rankFresh[a.verification.freshness] ?? 9) - (rankFresh[b.verification.freshness] ?? 9);
  });

  return { verified, rejected };
}

module.exports = {
  validateOpportunity,
  processDiscovered,
};
