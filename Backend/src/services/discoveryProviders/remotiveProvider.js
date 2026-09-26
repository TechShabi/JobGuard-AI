/**
 * Remotive — free, public, no-key remote-jobs API.
 * Docs: https://github.com/remotive-com/remote-jobs-api
 * Endpoint: https://remotive.com/api/remote-jobs
 *
 * IMPORTANT — do not trust server-side query filtering here: Remotive
 * documents `search`/`category`/`company_name` as server-side filters, but
 * independent, recent (2026-09) third-party testing found identical
 * payloads returned across differing filter combinations against the live
 * endpoint — i.e. the documented filters may not currently work reliably
 * server-side. This provider sends them anyway (harmless, and correct if
 * Remotive's filtering is in fact working for a given request), but ALWAYS
 * re-filters client-side against title/description/tags before returning
 * anything — so results are correct regardless of whether the server
 * actually filtered.
 *
 * Rate-limit / ToS compliance (Remotive's own README): "you only need to
 * GET Remotive job data ... max 4 times a day", ">2x/minute will be
 * blocked", and listings are delayed 24h by design specifically so
 * Remotive gets attribution — this fetches the WHOLE feed at most once
 * per cache window (6h) rather than once per user query, and always keeps
 * Remotive's own `url` as source_url/application_url per their attribution
 * requirement ("link back to the URL found on Remotive AND mention
 * Remotive as a source").
 */

const axios = require("axios");
const { emptyOpportunity, stableId, stripAndSanitize } = require("./opportunityShape");
const cache = require("./httpCache");

const BASE_URL = "https://remotive.com/api/remote-jobs";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — well under Remotive's "max 4x/day"
const CACHE_KEY = "remotive:full-feed"; // one shared cache entry for ALL queries, by design

function matchesQuery(job, terms) {
  if (!terms.length) return true;
  const blob = `${job.title || ""} ${job.description || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
  return terms.some((t) => blob.includes(t));
}

const RemotiveProvider = {
  id: "remotive",
  isLive: true,
  capabilities: {
    remote_only: true,
    supports_keyword: "client_side_only", // see file header — server filter not trusted
    supports_country_filter: false, // candidate_required_location is free text, not structured
    supports_employment_type: false,
    supports_seniority: false,
  },

  async search(query) {
    if (query.remote_preference === "onsite") {
      return { rows: [], isLive: true, note: null };
    }

    try {
      const data = await cache.getOrSet(CACHE_KEY, CACHE_TTL_MS, async () => {
        // Sent per Remotive's documented params — may or may not actually
        // filter server-side (see header); client-side filter below is
        // what we actually rely on either way.
        const params = { limit: 200 };
        if (query.role) params.search = query.role;
        const res = await axios.get(BASE_URL, { params, timeout: 12000 });
        return res.data;
      });

      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const terms = [query.role, ...(query.skills || [])]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());

      const matched = jobs.filter((j) => matchesQuery(j, terms)).slice(0, 20);

      const rows = matched.map((j, i) =>
        emptyOpportunity({
          id: stableId(["remotive", String(j.id || i)]),
          role: stripAndSanitize(j.title, 200),
          company: stripAndSanitize(j.company_name, 150),
          location: j.candidate_required_location || "Worldwide",
          remote: true,
          employment_type: j.job_type || "",
          seniority: null, // Remotive doesn't provide this — never guessed
          description: stripAndSanitize(j.description || ""),
          requirements: Array.isArray(j.tags) ? j.tags.slice(0, 15) : [],
          source_url: j.url || "",
          application_url: j.url || "",
          source_platform: "Remotive",
          provider_id: "remotive",
          provider_job_id: String(j.id || ""),
          posted_at: j.publication_date || null,
          salary_range: j.salary || null, // Remotive's salary is free text — passed through as-is, never parsed/guessed
          raw_source_metadata: { category: j.category || null },
          is_live: true,
          is_development_sample: false,
        })
      );

      return { rows, isLive: true, note: null };
    } catch (err) {
      console.error("RemotiveProvider error:", err.message);
      return { rows: [], isLive: false, note: `Remotive is temporarily unavailable (${err.message.slice(0, 100)}).` };
    }
  },
};

module.exports = RemotiveProvider;
