/**
 * Opportunity Discovery Service — provider boundary.
 *
 * Architecture:
 *   Find request → discover() → provider adapters → normalize → dedupe → verify (controller) → filter → rank (controller)
 *
 * Providers come in two flavors:
 *   1. Static-liveness providers (e.g. DevelopmentSampleProvider) — always
 *      the same is_live value, search() returns a plain array.
 *   2. Dynamic-liveness providers (e.g. GeminiGroundedProvider) — whether a
 *      given search is genuinely live depends on that specific call (did
 *      Google Search grounding actually return matchable results this
 *      time?). search() returns { rows, isLive, note } instead of a bare
 *      array, and THAT per-call isLive is what counts — not the provider's
 *      static capability flag.
 *
 * discovery_status (meta-level, single unambiguous field):
 *   "live_provider" — confirmed-live rows from a real free/public provider
 *                      this call (Jobicy / Himalayas / Remotive)
 *   "sample"        — no live rows; development samples shown instead
 *                      (non-production only — see devSampleAllowed() below)
 *   "unavailable"   — no live rows, and samples are not being shown either
 *                      (production without ALLOW_DEV_SAMPLE_OPPORTUNITIES,
 *                      or samples themselves produced nothing)
 *   "error"         — a live-capable provider itself threw/failed and no
 *                      live rows or samples are being shown
 *
 * MVP discovery uses only free, public, no-key job APIs — Jobicy,
 * Himalayas, Remotive (see discoveryProviders/*Provider.js) — specifically
 * NOT Gemini Google Search grounding, which requires a billed/paid Gemini
 * tier this MVP does not depend on. geminiGroundedProvider.js still exists
 * and is still wired into this file's require list so it can be re-enabled
 * later with a one-line change (ENABLE_GEMINI_GROUNDED_DISCOVERY=true) —
 * see below — but it is NOT registered in PROVIDERS by default.
 *
 * Production honesty rule (mirrors the existing payment-provider pattern in
 * services/paymentProviders/index.js — same isProduction()/*Allowed() shape,
 * reusing the same shared config/productionGuard.js#isProduction()):
 * DevelopmentSampleProvider must never masquerade as real opportunities in
 * production. In production, if no live results are confirmed, discover()
 * returns an empty result with discovery_status "unavailable" instead of
 * silently substituting samples — unless an operator has explicitly set
 * ALLOW_DEV_SAMPLE_OPPORTUNITIES=true (e.g. a staging environment that is
 * NODE_ENV=production for other reasons).
 *
 * To add a real provider later:
 *   1. Implement { id, isLive, search(query) } adapter (either contract above)
 *   2. Register it in PROVIDERS
 */

const { emptyOpportunity, stableId } = require("./discoveryProviders/opportunityShape");
const JobicyProvider = require("./discoveryProviders/jobicyProvider");
const HimalayasProvider = require("./discoveryProviders/himalayasProvider");
const RemotiveProvider = require("./discoveryProviders/remotiveProvider");
// Kept importable (not registered by default) — see file header. Flip
// ENABLE_GEMINI_GROUNDED_DISCOVERY=true to bring it back into PROVIDERS
// once a billed Gemini tier with Search grounding is actually available.
const GeminiGroundedProvider = require("./discoveryProviders/geminiGroundedProvider");
const { isProduction } = require("../config/productionGuard");

// function devSampleAllowed() {
//   if (!isProduction()) return true;
//   return process.env.ALLOW_DEV_SAMPLE_OPPORTUNITIES === "true";
// }

// ── Development Sample Provider ───────────────────────────────────────
// Clearly NOT live. Only ever reached when devSampleAllowed() permits it —
// see discover() below. Must never be mistaken for a real production result.
// const DevelopmentSampleProvider = {
//   id: "development_sample",
//   isLive: false,

//   async search(query) {
//     const role = (query.role || "Software Engineer").trim();
//     const location = (query.location || "Remote").trim();
//     const skills = (query.skills || []).map((s) => String(s).trim()).filter(Boolean);
//     const remotePref = query.remote_preference || "any";

//     const samples = [
//       {
//         role: `${role}`,
//         company: "Northwind Labs",
//         location: remotePref === "onsite" ? location || "Austin, TX" : "Remote",
//         employment_type: "Full Time",
//         remote: remotePref !== "onsite",
//         description: `We're hiring a ${role} to join a product team shipping customer-facing tools. Strong collaboration and clear communication matter as much as technical depth.`,
//         requirements: [
//           skills[0] || "Relevant hands-on experience",
//           skills[1] || "Problem-solving with measurable outcomes",
//           "Comfortable working in a collaborative product environment",
//         ],
//         source_platform: "JobGuard Sample Board",
//         source_url: "https://example.com/jobs/northwind-sample",
//         posted_at: daysAgo(3),
//         salary_range: null,
//       },
//       {
//         role: `Junior ${role}`,
//         company: "Cedar Street Analytics",
//         location: location || "Chicago, IL",
//         employment_type: "Full Time",
//         remote: remotePref === "remote",
//         description: `Entry-to-mid level ${role} role focused on learning velocity. Mentorship available; expect ownership of small features early.`,
//         requirements: [
//           skills[0] || "Foundational skills in the role domain",
//           "Willingness to learn and document work",
//           "Basic portfolio or project examples",
//         ],
//         source_platform: "JobGuard Sample Board",
//         source_url: "https://example.com/jobs/cedar-sample",
//         posted_at: daysAgo(8),
//         salary_range: null,
//       },
//       {
//         role: `${role} (Contract)`,
//         company: "Harbor Collective",
//         location: "Remote",
//         employment_type: "Contract",
//         remote: true,
//         description: `3–6 month contract for a ${role}. Ideal if you want project-based work with a clear scope and deliverables.`,
//         requirements: [
//           skills[0] || "Proven delivery on similar projects",
//           "Clear written communication",
//           "Available 20–40 hrs/week",
//         ],
//         source_platform: "JobGuard Sample Board",
//         source_url: "https://example.com/jobs/harbor-sample",
//         posted_at: daysAgo(14),
//         salary_range: null,
//       },
//       {
//         role: `Senior ${role}`,
//         company: "Atlas Product Co.",
//         location: remotePref === "remote" ? "Remote" : location || "New York, NY",
//         employment_type: "Full Time",
//         remote: remotePref !== "onsite",
//         description: `Senior ${role} to lead initiatives and mentor peers. Expect ambiguity, stakeholder communication, and measurable impact targets.`,
//         requirements: [
//           "5+ years relevant experience",
//           skills[0] || "Deep expertise in core stack",
//           "Evidence of mentoring or technical leadership",
//         ],
//         source_platform: "JobGuard Sample Board",
//         source_url: "https://example.com/jobs/atlas-sample",
//         posted_at: daysAgo(2),
//         salary_range: null,
//       },
//       // Intentionally weak / stale sample so verification layer can demote it
//       {
//         role: `${role} — Urgent Hiring!!!`,
//         company: "QuickCash Opportunities LLC",
//         location: "Work from home",
//         employment_type: "Full Time",
//         remote: true,
//         description: `Make $5000/week from home. No experience needed. Pay a small training fee to get started. WhatsApp only contact.`,
//         requirements: ["Must pay training fee", "WhatsApp required"],
//         source_platform: "Unverified Listing",
//         source_url: "https://example.com/jobs/suspicious-sample",
//         posted_at: daysAgo(90),
//         salary_range: "$5000/week",
//       },
//     ];

//     return samples.map((s, i) =>
//       emptyOpportunity({
//         ...s,
//         id: stableId([this.id, role, s.company, i]),
//         is_live: false,
//         is_development_sample: true,
//         provider_id: this.id,
//       })
//     );
//   },
// };

// function daysAgo(n) {
//   const d = new Date();
//   d.setDate(d.getDate() - n);
//   return d.toISOString();
// }

// Free/public, zero-cost providers are tried first (isLive:true — they
// attempt live discovery whenever called). GeminiGroundedProvider is
// opt-in only (see file header) — never registered unless explicitly
// enabled, so MVP discovery never depends on paid Search grounding.
// DevelopmentSampleProvider is the guaranteed fallback (when
// devSampleAllowed() permits it — see file header).
const PROVIDERS = [
  JobicyProvider,
  HimalayasProvider,
  RemotiveProvider,
  ...(process.env.ENABLE_GEMINI_GROUNDED_DISCOVERY === "true" ? [GeminiGroundedProvider] : []),
];

function liveCapableProviders() {
  return PROVIDERS.filter((p) => p.isLive);
}
function sampleProviders() {
  return PROVIDERS.filter((p) => !p.isLive);
}

async function runProvider(provider, query) {
  const result = await provider.search(query);
  if (Array.isArray(result)) {
    return { rows: result, isLive: !!provider.isLive, note: null };
  }
  return {
    rows: result?.rows || [],
    isLive: !!result?.isLive,
    note: result?.note || null,
    grounding: result?.grounding || null,
  };
}

// ── Deduplication ────────────────────────────────────────────────────
// The same underlying job can surface more than once (multiple providers
// later, or a single provider describing it via slightly different text).
// Signal, in priority order:
//   1. Normalized source URL (protocol/www/query/hash/trailing-slash
//      stripped) — the strongest signal two rows are literally the same
//      posting.
//   2. A company+role+location composite, for rows without a comparable
//      URL (e.g. different redirect wrappers pointing at the same job).
// This never merges across genuinely different companies or roles — only
// an exact match on one of these keys collapses two rows, and the first
// occurrence (discovery order here) wins.
function normalizeUrlKey(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${path.toLowerCase()}`;
  } catch {
    return null;
  }
}
function compositeKey(opp) {
  return [opp.company, opp.role, opp.location]
    .map((s) => String(s || "").trim().toLowerCase())
    .join("|");
}
function providerJobKey(opp) {
  if (!opp.provider_id || !opp.provider_job_id) return null;
  return `pid:${opp.provider_id}:${opp.provider_job_id}`;
}
function dedupeOpportunities(list) {
  const seen = new Set();
  const out = [];
  for (const opp of list) {
    const key = normalizeUrlKey(opp.source_url) || providerJobKey(opp) || `composite:${compositeKey(opp)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(opp);
  }
  return out;
}

/**
 * Run discovery across active providers and return normalized raw results
 * (verification/ranking happens in the controller / verification service).
 *
 * Strategy: try live-capable providers first. If none of them produced
 * confirmed-live rows for THIS query AND dev samples are allowed in this
 * environment, run the sample providers so the UX isn't a dead end. In
 * production without that explicit opt-in, an empty, "unavailable" result
 * is returned instead — never samples dressed up as real jobs.
 */
async function discover(query) {
  const meta = {
    providers_used: [],
    is_live: false,
    discovery_status: "unavailable", // "live_provider" | "sample" | "unavailable" | "error"
    note: null,
    notes: [],
    had_provider_error: false,
    provider_count: 0,
    discovered_count: 0,
  };
  const opportunities = [];

  async function runBatch(providers) {
    const batches = await Promise.all(
      providers.map(async (p) => {
        try {
          return { provider: p, ...(await runProvider(p, query)) };
        } catch (err) {
          console.error(`Discovery provider ${p.id} failed:`, err.message);
          return { provider: p, rows: [], isLive: false, note: err.message, error: true };
        }
      })
    );
    for (const batch of batches) {
      meta.providers_used.push({
        id: batch.provider.id,
        is_live: !!batch.isLive,
        count: batch.rows.length,
        note: batch.note || null,
      });
      if (batch.note) meta.notes.push(batch.note);
      if (batch.error) meta.had_provider_error = true;
      if (batch.isLive && batch.rows.length) meta.is_live = true;
      opportunities.push(...batch.rows);
    }
  }

  await runBatch(liveCapableProviders());

  if (!meta.is_live) {
    await runBatch(sampleProviders());
  }

  const failedProviderNames = meta.providers_used
    .filter((p) => p.note && !p.is_live)
    .map((p) => p.id);

  if (meta.is_live) {
    meta.discovery_status = "live_provider";
    meta.note = failedProviderNames.length
      ? `Some opportunity sources were temporarily unavailable (${failedProviderNames.join(", ")}) — showing results from the sources that responded.`
      : null;
  } else {
    meta.discovery_status = meta.had_provider_error ? "error" : "unavailable";
    meta.note =
      meta.notes.find(Boolean) ||
      "Live opportunity discovery is currently unavailable. Please try again later.";
  }

  delete meta.notes; // internal accumulator only — meta.note already holds the surfaced message

  const deduped = dedupeOpportunities(opportunities);
  meta.provider_count = meta.providers_used.filter((p) => p.is_live && p.count > 0).length;
  meta.discovered_count = deduped.length;

  return { opportunities: deduped, meta };
}

module.exports = {
  discover,
  emptyOpportunity,
  GeminiGroundedProvider,
  dedupeOpportunities, // exported for direct unit testing — see tests/opportunity-discovery.test.js
};
