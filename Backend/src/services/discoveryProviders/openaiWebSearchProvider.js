/**
 * OpenAI Web Search Discovery Provider — PRIMARY discovery adapter
 * (product-spec sections 2, 4, 5, 7).
 *
 * Dynamic-liveness provider, same contract as the old geminiGroundedProvider
 * it replaces as the default: search(query) returns { rows, isLive, note }
 * rather than a bare array, because whether a given call is genuinely live
 * depends on whether OpenAI's web_search tool actually ran and produced
 * verifiable evidence THIS call — see aiService.discoverOpportunitiesWebSearch
 * / services/openaiService.js for the honesty guarantees.
 *
 * Maps the AI's normalized rows into the ONE canonical internal opportunity
 * shape (opportunityShape.js) — the same shape every other provider (and
 * the deterministic filter/verification layers downstream) already uses.
 * Never fabricates a field the AI didn't return; missing values stay null.
 */

const { emptyOpportunity, stableId, stripAndSanitize } = require("./opportunityShape");
const { discoverOpportunitiesWebSearch } = require("../aiService");

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

module.exports = {
  id: "openai_web_search",
  isLive: true,

  async search(query) {
    const { rows, isLive, note } = await discoverOpportunitiesWebSearch(query);

    const mapped = (rows || [])
      .map((r, i) =>
        emptyOpportunity({
          id: stableId(["openai_web_search", query.role || "", r.company, r.source_url || String(i)]),
          role: r.role || "",
          company: r.company || "",
          location: r.location || r.city || r.country || "",
          country: r.country || null,
          city: r.city || null,
          employment_type: r.employment_type || "",
          remote: r.remote_type === "remote",
          remote_type: r.remote_type || "unknown",
          remote_eligibility: r.remote_eligibility ?? null,
          seniority: r.experience_level || null, // canonical field name — see opportunityShape.js
          description: stripAndSanitize(r.description || ""),
          requirements: Array.isArray(r.skills) ? r.skills : [],
          source_url: r.source_url || "",
          application_url: r.source_url || "",
          source_platform: r.source_platform || hostFromUrl(r.source_url) || "Web",
          provider_id: "openai_web_search",
          posted_at: r.posted_at || null,
          salary_range: r.salary_range || null,
          discovered_at: new Date().toISOString(),
          is_live: true,
          is_ai_discovered: true,
          discovery_method: "openai_web_search",
          // Evidence is stamped by the backend, not trusted from the AI's own
          // narration (product-spec section 9) — this is what actually
          // distinguishes "AI-generated" from "source-backed" for this row.
          evidence: r.source_url
            ? [{ type: "ai_web_search", source_url: r.source_url, retrieved_at: new Date().toISOString() }]
            : [],
        })
      )
      // Required-field schema gate (product-spec section 7): a row without
      // a role, company, and usable source URL never reaches the caller.
      .filter((o) => o.role && o.company && o.source_url);

    return { rows: mapped, isLive: isLive && mapped.length > 0, note };
  },
};
