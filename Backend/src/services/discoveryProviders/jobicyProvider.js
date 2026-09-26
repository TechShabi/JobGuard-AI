/**
 * Jobicy — free, public, no-key remote-jobs API.
 * Docs: https://github.com/Jobicy/remote-jobs-api
 *
 * Capability declared honestly: Jobicy is a REMOTE-ONLY board. It has no
 * concept of "Karachi" or most specific cities — only broad geo-eligibility
 * slugs (usa, europe, apac, anywhere, ...). We never invent a match to a
 * specific city; the normalized `location` field is whatever Jobicy itself
 * reports (usually "Anywhere" or a broad region), and it's the relevance
 * step downstream — not this provider — that judges whether that's
 * actually useful for the user's stated location.
 *
 * Rate-limit compliance: Jobicy's own guidance is "do not poll more
 * frequently than once per hour" — enforced here via httpCache (1h TTL),
 * keyed by the search tag actually used, not per raw user query.
 */

const axios = require("axios");
const { emptyOpportunity, stableId, stripAndSanitize } = require("./opportunityShape");
const cache = require("./httpCache");

const BASE_URL = "https://jobicy.com/api/v2/remote-jobs";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — matches Jobicy's own polling guidance

// A few broad geo slugs Jobicy documents. Deliberately small and explicit —
// we only map when we're actually confident, per the "never invent a
// Karachi match" rule. Anything not recognized here is left unfiltered
// (broader, honest results) rather than guessed at.
const GEO_SLUGS = {
  usa: "usa", "united states": "usa", america: "usa",
  europe: "europe", eu: "europe",
  apac: "apac", asia: "apac",
  canada: "canada",
  uk: "uk", "united kingdom": "uk",
  anywhere: "anywhere", remote: "anywhere", worldwide: "anywhere",
};

function guessGeoSlug(locationText) {
  const key = String(locationText || "").trim().toLowerCase();
  return GEO_SLUGS[key] || null;
}

const JobicyProvider = {
  id: "jobicy",
  isLive: true,
  capabilities: {
    remote_only: true,
    supports_keyword: true,
    supports_country_filter: "broad_regions_only", // not city-level
    supports_employment_type: false,
    supports_seniority: false,
  },

  async search(query) {
    // Jobicy is remote-only — an explicitly onsite-only search gets no
    // useful results from it, so skip the network call entirely rather
    // than return remote jobs mislabeled as satisfying an onsite need.
    if (query.remote_preference === "onsite") {
      return { rows: [], isLive: true, note: null };
    }

    const tag = (query.role || query.skills?.[0] || "").trim().slice(0, 50);
    const geo = guessGeoSlug(query.location) || (query.remote_preference === "remote" ? "anywhere" : null);
    const cacheKey = `jobicy:${tag}:${geo || ""}`;

    try {
      const data = await cache.getOrSet(cacheKey, CACHE_TTL_MS, async () => {
        const params = { count: 20 };
        if (tag && tag.length >= 3) params.tag = tag;
        if (geo) params.geo = geo;
        const res = await axios.get(BASE_URL, { params, timeout: 10000 });
        return res.data;
      });

      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const rows = jobs.map((j, i) =>
        emptyOpportunity({
          id: stableId(["jobicy", String(j.id || j.jobSlug || i)]),
          role: stripAndSanitize(j.jobTitle, 200),
          company: stripAndSanitize(j.companyName, 150),
          location: j.jobGeo || "Anywhere",
          remote: true,
          employment_type: Array.isArray(j.jobType) ? j.jobType[0] || "" : "",
          seniority: j.jobLevel && j.jobLevel !== "Any" ? j.jobLevel : null,
          description: stripAndSanitize(j.jobDescription || j.jobExcerpt || ""),
          requirements: [], // Jobicy gives no discrete skill list — never invented
          source_url: j.url || "",
          application_url: j.url || "",
          source_platform: "Jobicy",
          provider_id: "jobicy",
          provider_job_id: String(j.id || j.jobSlug || ""),
          posted_at: j.pubDate || null,
          salary_range:
            j.salaryMin && j.salaryMax
              ? `${j.salaryCurrency || ""} ${j.salaryMin}-${j.salaryMax}${j.salaryPeriod ? "/" + j.salaryPeriod : ""}`.trim()
              : null,
          raw_source_metadata: { jobIndustry: j.jobIndustry || [] },
          is_live: true,
          is_development_sample: false,
        })
      );

      return { rows, isLive: true, note: null };
    } catch (err) {
      console.error("JobicyProvider error:", err.message);
      return { rows: [], isLive: false, note: `Jobicy is temporarily unavailable (${err.message.slice(0, 100)}).` };
    }
  },
};

module.exports = JobicyProvider;
