/**
 * Shared normalized opportunity shape + id helper.
 *
 * Lives in its own file (rather than inside opportunityDiscoveryService.js)
 * so that individual provider adapters — e.g. geminiGroundedProvider.js —
 * can import it without creating a circular require with
 * opportunityDiscoveryService.js, which registers those same providers.
 */

const crypto = require("crypto");

function emptyOpportunity(overrides = {}) {
  return {
    id: "",
    role: "", // canonical "title" field — kept as `role` for backward compat with
              // verification/recommendation/frontend, all already built on this name
    company: "",
    location: "",
    employment_type: "",
    remote: false,
    seniority: null, // source-reported level only — never inferred/guessed
    description: "",
    requirements: [], // aka "skills" in the product-spec shape — same field
    source_url: "", // canonical listing URL (may be a source's own detail page)
    application_url: "", // where the user actually applies — usually equals
                          // source_url for these providers, but kept distinct
                          // per the canonical shape in case a future provider
                          // (e.g. a partner feed) separates the two
    source_platform: "",
    provider_id: "",
    provider_job_id: "", // the provider's own job identifier, for dedup/traceability
    posted_at: null, // source-reported post date, if known ("sourcePostedAt")
    discovered_at: new Date().toISOString(), // when JobGuard found this listing
    salary_range: null,
    raw_source_metadata: null, // small, provider-specific extras (see each provider) — never large raw payload dumps
    // Honest provenance flags — UI must surface these
    is_live: false,
    is_development_sample: false,
    ...overrides,
  };
}

function stableId(parts) {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

const cheerio = require("cheerio");
const sanitize = require("../../utils/sanitize");

// Providers sometimes return full HTML descriptions (Jobicy, Himalayas).
// Strip tags to plain text first (cheerio, same library already used by
// scraperService.js), then run the result through the app's existing xss
// sanitizer as a second, defense-in-depth pass — descriptions are
// untrusted third-party content and are never rendered as raw HTML.
function stripAndSanitize(html, maxLen = 4000) {
  if (!html) return "";
  let text = html;
  try {
    text = cheerio.load(`<div>${html}</div>`)("div").text();
  } catch {
    // fall through with the raw string if cheerio somehow chokes on it
  }
  text = text.replace(/\s+/g, " ").trim().slice(0, maxLen);
  return sanitize(text);
}

module.exports = { emptyOpportunity, stableId, stripAndSanitize };
