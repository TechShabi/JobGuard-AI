/**
 * Gemini Grounded Search Provider
 * ────────────────────────────────
 * The AI/search-orchestration layer for Opportunity Find. It asks Gemini
 * to research real, current job openings using Google Search grounding,
 * then only reports a listing as live if it can be matched back to an
 * actual grounded search result (see geminiService.discoverOpportunitiesGrounded
 * for the honesty checks).
 *
 * `isLive: true` here means "this provider attempts live discovery when it
 * has a configured API key" — a capability flag, not a guarantee every call
 * succeeds. The actual, per-call truth (whether THIS search produced
 * verified live results) comes back as `isLive` on the object returned by
 * search(), which is what opportunityDiscoveryService.discover() trusts.
 *
 * This is the provider-agnostic seam the product direction calls for: if a
 * dedicated job-search API/provider becomes available later, it registers
 * here the same way, and Gemini can stay purely the reasoning/orchestration
 * layer instead of the only discovery mechanism.
 */

const geminiService = require("../geminiService");
const { emptyOpportunity, stableId } = require("./opportunityShape");

const GeminiGroundedProvider = {
  id: "gemini_grounded_search",
  isLive: true, // capability flag: this provider attempts live discovery

  async search(query) {
    const { rows, isLive, note, grounding } = await geminiService.discoverOpportunitiesGrounded(query);

    const opportunities = (rows || []).map((r, i) =>
      emptyOpportunity({
        role: r.role || query.role || "",
        company: r.company || "",
        location: r.location || "",
        employment_type: r.employment_type || "",
        remote: !!r.remote,
        description: r.description || "",
        requirements: Array.isArray(r.requirements) ? r.requirements : [],
        source_url: r.source_url || "",
        source_url_via: r.source_url_via || "direct_match", // "direct_match" | "grounding_title_match" — see geminiService.matchRowsToGrounding
        source_platform: r.source_platform || "Web search",
        posted_at: r.posted_at || null,
        salary_range: r.salary_range || null,
        id: stableId([GeminiGroundedProvider.id, r.source_url || r.role || "", i]),
        is_live: true,
        is_development_sample: false,
        provider_id: GeminiGroundedProvider.id,
      })
    );

    // Dynamic per-call contract: opportunityDiscoveryService.discover()
    // checks for this shape (as opposed to a bare array) to know whether
    // this specific search was genuinely grounded.
    return {
      rows: opportunities,
      isLive: !!isLive && opportunities.length > 0,
      note,
      grounding,
    };
  },
};

module.exports = GeminiGroundedProvider;
