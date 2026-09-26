/**
 * Himalayas — free, public, no-key remote-jobs search API.
 * Docs: https://himalayas.app/docs/remote-jobs-api
 *
 * Unlike Jobicy, Himalayas returns real per-job `locationRestrictions`
 * (empty array = worldwide, otherwise a list of eligible countries) — so
 * this provider can honestly represent geographic eligibility rather than
 * always saying "Remote" with no further detail.
 *
 * Attribution requirement (Himalayas docs, "What are the attribution
 * requirements?"): a visible link back to himalayas.app and a mention that
 * data is sourced from Himalayas when displayed. `source_platform` is set
 * to "Himalayas" and `source_url`/`application_url` point at the original
 * Himalayas application link — the frontend already renders source_platform
 * and links to source_url for every opportunity card, which satisfies this.
 *
 * Rate-limit compliance: Himalayas' own guidance is that data refreshes
 * every 24h and there's "no benefit polling more than once per day" — this
 * uses a 6h cache TTL (comfortably under that, some safety margin for
 * multiple distinct queries during a day).
 */

const axios = require("axios");
const { emptyOpportunity, stableId, stripAndSanitize } = require("./opportunityShape");
const cache = require("./httpCache");

const SEARCH_URL = "https://himalayas.app/jobs/api/search";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const HimalayasProvider = {
  id: "himalayas",
  isLive: true,
  capabilities: {
    remote_only: true,
    supports_keyword: true,
    supports_country_filter: true, // real per-job locationRestrictions data
    supports_employment_type: true,
    supports_seniority: true,
  },

  async search(query) {
    if (query.remote_preference === "onsite") {
      return { rows: [], isLive: true, note: null };
    }

    const q = (query.role || "").trim().slice(0, 100);
    const cacheKey = `himalayas:${q}`;

    try {
      const data = await cache.getOrSet(cacheKey, CACHE_TTL_MS, async () => {
        const params = {};
        if (q) params.q = q;
        const res = await axios.get(SEARCH_URL, { params, timeout: 10000 });
        return res.data;
      });

      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const rows = jobs.map((j, i) => {
        const restrictions = Array.isArray(j.locationRestrictions) ? j.locationRestrictions : [];
        const location = restrictions.length
          ? restrictions.map((r) => r.name || r.alpha2).filter(Boolean).join(", ")
          : "Worldwide";

        return emptyOpportunity({
          id: stableId(["himalayas", String(j.guid || i)]),
          role: stripAndSanitize(j.title, 200),
          company: stripAndSanitize(j.companyName, 150),
          location,
          remote: true,
          employment_type: j.employmentType || "",
          seniority: Array.isArray(j.seniority) && j.seniority.length ? j.seniority[0] : null,
          description: stripAndSanitize(j.description || j.excerpt || ""),
          requirements: [], // Himalayas gives categories, not a discrete skill list — never invented
          source_url: j.applicationLink || "",
          application_url: j.applicationLink || "",
          source_platform: "Himalayas",
          provider_id: "himalayas",
          provider_job_id: String(j.guid || ""),
          posted_at: typeof j.pubDate === "number" ? new Date(j.pubDate).toISOString() : null,
          salary_range:
            j.minSalary && j.maxSalary
              ? `${j.currency || ""} ${j.minSalary}-${j.maxSalary}/${j.salaryPeriod || "annual"}`.trim()
              : null,
          raw_source_metadata: {
            categories: j.categories || [],
            timezoneRestrictions: j.timezoneRestrictions || [],
            location_restrictions: restrictions.map((r) => r.name || r.alpha2).filter(Boolean),
          },
          is_live: true,
          is_development_sample: false,
        });
      });

      return { rows, isLive: true, note: null };
    } catch (err) {
      console.error("HimalayasProvider error:", err.message);
      return { rows: [], isLive: false, note: `Himalayas is temporarily unavailable (${err.message.slice(0, 100)}).` };
    }
  },
};

module.exports = HimalayasProvider;
