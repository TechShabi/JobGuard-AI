/**
 * Opportunity Find MVP — discovery pipeline tests.
 *
 * Runs with plain Node + assert (no framework added — this project has no
 * test runner installed, and NODE_PATH-stubbed 3rd-party packages here
 * would only need to be reconfigured for a real one anyway). Exercises the
 * REAL source files in ../src, with axios/cheerio/xss swapped for minimal
 * sandbox stand-ins (see testharness/node_modules) since this environment
 * has no network access to install the real packages or call real APIs.
 *
 * Run with:
 *   NODE_PATH=/home/claude/work/testharness/node_modules node opportunity-discovery.test.js
 *
 * In a real environment with `npm install` run, these same fixtures and
 * assertions are valid against the real axios/cheerio/xss — only the
 * require resolution changes.
 */

const assert = require("assert");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");

function resetMocks() {
  const axios = require("axios");
  axios.__reset();
  require(path.join(SRC, "services/discoveryProviders/httpCache")).clear();
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    resetMocks();
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function run() {
  // ── Jobicy provider ────────────────────────────────────────────────
  console.log("JobicyProvider");
  {
    const axios = require("axios");
    const JobicyProvider = require(path.join(SRC, "services/discoveryProviders/jobicyProvider"));

    await test("parses a well-formed response and maps fields per official docs", async () => {
      axios.__mock("https://jobicy.com", async () => ({
        data: {
          jobs: [
            {
              id: 123456,
              url: "https://jobicy.com/jobs/example-role",
              jobSlug: "example-role",
              jobTitle: "Senior React Developer",
              companyName: "Example Company",
              jobIndustry: ["Engineering"],
              jobType: ["full-time"],
              jobGeo: "Anywhere",
              jobLevel: "Senior",
              jobExcerpt: "A short summary.",
              jobDescription: "<p>Full <b>HTML</b> description</p>",
              pubDate: "2026-07-30T12:00:00+00:00",
              salaryMin: 90000,
              salaryMax: 125000,
              salaryCurrency: "USD",
              salaryPeriod: "yearly",
            },
          ],
        },
      }));
      const result = await JobicyProvider.search({ role: "React Developer", remote_preference: "any", skills: [] });
      assert.strictEqual(result.isLive, true);
      assert.strictEqual(result.rows.length, 1);
      const row = result.rows[0];
      assert.strictEqual(row.role, "Senior React Developer");
      assert.strictEqual(row.company, "Example Company");
      assert.strictEqual(row.source_url, "https://jobicy.com/jobs/example-role");
      assert.strictEqual(row.provider_id, "jobicy");
      assert.strictEqual(row.provider_job_id, "123456");
      assert.strictEqual(row.is_live, true);
      assert.strictEqual(row.is_development_sample, false);
      assert.ok(row.description.length > 0 && !row.description.includes("<p>"), "HTML should be stripped");
      assert.strictEqual(row.salary_range, "USD 90000-125000/yearly");
    });

    await test("leaves salary/requirements null/empty when source omits them (never invented)", async () => {
      axios.__mock("https://jobicy.com", async () => ({
        data: {
          jobs: [
            {
              id: 1,
              url: "https://jobicy.com/jobs/x",
              jobTitle: "Backend Developer",
              companyName: "Acme",
              jobGeo: "Anywhere",
              jobType: [],
            },
          ],
        },
      }));
      const result = await JobicyProvider.search({ role: "Backend Developer", remote_preference: "any", skills: [] });
      const row = result.rows[0];
      assert.strictEqual(row.salary_range, null, "no salary in source → null, not guessed");
      assert.deepStrictEqual(row.requirements, [], "Jobicy has no skill list → never invented");
      assert.strictEqual(row.posted_at, null);
    });

    await test("skips the network call entirely for onsite-only searches (remote-only provider)", async () => {
      let called = false;
      axios.__mock("https://jobicy.com", async () => {
        called = true;
        return { data: { jobs: [] } };
      });
      const result = await JobicyProvider.search({ role: "X", remote_preference: "onsite", skills: [] });
      assert.strictEqual(called, false);
      assert.deepStrictEqual(result.rows, []);
      assert.strictEqual(result.isLive, true, "not an error — just correctly not applicable");
    });

    await test("handles empty jobs array as a valid (not error) response", async () => {
      axios.__mock("https://jobicy.com", async () => ({ data: { jobs: [] } }));
      const result = await JobicyProvider.search({ role: "Nonexistent Role XYZ", remote_preference: "any", skills: [] });
      assert.deepStrictEqual(result.rows, []);
      assert.strictEqual(result.isLive, true);
    });

    await test("handles provider timeout/error gracefully — isLive:false with a note, never throws", async () => {
      axios.__mock("https://jobicy.com", async () => {
        throw new Error("timeout of 10000ms exceeded");
      });
      const result = await JobicyProvider.search({ role: "React Developer", remote_preference: "any", skills: [] });
      assert.strictEqual(result.isLive, false);
      assert.deepStrictEqual(result.rows, []);
      assert.ok(result.note && result.note.includes("Jobicy"));
    });

    await test("handles a malformed (missing jobs key) response without throwing", async () => {
      axios.__mock("https://jobicy.com", async () => ({ data: { unexpected: "shape" } }));
      const result = await JobicyProvider.search({ role: "X", remote_preference: "any", skills: [] });
      assert.deepStrictEqual(result.rows, []);
    });
  }

  // ── Himalayas provider ─────────────────────────────────────────────
  console.log("HimalayasProvider");
  {
    const axios = require("axios");
    const HimalayasProvider = require(path.join(SRC, "services/discoveryProviders/himalayasProvider"));

    await test("parses a well-formed response, including real locationRestrictions", async () => {
      axios.__mock("https://himalayas.app", async () => ({
        data: {
          jobs: [
            {
              title: "Senior Software Engineer",
              excerpt: "short",
              companyName: "Stripe",
              companySlug: "stripe",
              employmentType: "Full Time",
              minSalary: 100000,
              maxSalary: 150000,
              salaryPeriod: "annual",
              seniority: ["Senior"],
              currency: "USD",
              locationRestrictions: [{ alpha2: "US", name: "United States", slug: "us" }],
              categories: ["Engineering"],
              description: "<p>Full HTML</p>",
              pubDate: 1753876800000,
              applicationLink: "https://himalayas.app/jobs/stripe/senior-software-engineer",
              guid: "abc-123",
            },
          ],
        },
      }));
      const result = await HimalayasProvider.search({ role: "Software Engineer", remote_preference: "any", skills: [] });
      const row = result.rows[0];
      assert.strictEqual(row.company, "Stripe");
      assert.strictEqual(row.location, "United States", "real per-job eligibility, not a fake 'Remote' label");
      assert.strictEqual(row.provider_job_id, "abc-123");
      assert.strictEqual(row.salary_range, "USD 100000-150000/annual");
      assert.ok(!row.description.includes("<p>"));
    });

    await test("reports 'Worldwide' honestly when locationRestrictions is empty — never a specific city", async () => {
      axios.__mock("https://himalayas.app", async () => ({
        data: { jobs: [{ title: "X", companyName: "Y", guid: "1", locationRestrictions: [] }] },
      }));
      const result = await HimalayasProvider.search({ role: "X", remote_preference: "any", skills: [] });
      assert.strictEqual(result.rows[0].location, "Worldwide");
    });

    await test("propagates provider failure as isLive:false without throwing", async () => {
      axios.__mock("https://himalayas.app", async () => {
        throw new Error("429 Too Many Requests");
      });
      const result = await HimalayasProvider.search({ role: "X", remote_preference: "any", skills: [] });
      assert.strictEqual(result.isLive, false);
      assert.ok(result.note.includes("Himalayas"));
    });
  }

  // ── Remotive provider ──────────────────────────────────────────────
  console.log("RemotiveProvider");
  {
    const axios = require("axios");
    const RemotiveProvider = require(path.join(SRC, "services/discoveryProviders/remotiveProvider"));

    await test("client-side filters even when the mocked server 'ignores' the search param (real documented risk)", async () => {
      // Simulates the documented finding that Remotive's server-side filter
      // parameters may not actually filter — returns the FULL unfiltered
      // feed regardless of the search param sent, same as the real bug.
      axios.__mock("https://remotive.com", async () => ({
        data: {
          "job-count": 2,
          jobs: [
            { id: 1, title: "Senior Python Engineer", company_name: "Acme", description: "python django", tags: ["python"], url: "https://remotive.com/remote-jobs/python-1" },
            { id: 2, title: "Marketing Manager", company_name: "Beta", description: "seo content", tags: ["seo"], url: "https://remotive.com/remote-jobs/marketing-2" },
          ],
        },
      }));
      const result = await RemotiveProvider.search({ role: "Python Engineer", remote_preference: "any", skills: [] });
      assert.strictEqual(result.rows.length, 1, "must filter client-side even though the mock 'server' returned both");
      assert.strictEqual(result.rows[0].company, "Acme");
    });

    await test("passes salary through as-is (free text) — never parsed/invented", async () => {
      axios.__mock("https://remotive.com", async () => ({
        data: { jobs: [{ id: 1, title: "Engineer", company_name: "X", salary: "$40,000 - $50,000", url: "https://remotive.com/1" }] },
      }));
      const result = await RemotiveProvider.search({ role: "Engineer", remote_preference: "any", skills: [] });
      assert.strictEqual(result.rows[0].salary_range, "$40,000 - $50,000");
    });

    await test("null salary stays null, not a guessed value", async () => {
      axios.__mock("https://remotive.com", async () => ({
        data: { jobs: [{ id: 1, title: "Engineer", company_name: "X", salary: null, url: "https://remotive.com/1" }] },
      }));
      const result = await RemotiveProvider.search({ role: "Engineer", remote_preference: "any", skills: [] });
      assert.strictEqual(result.rows[0].salary_range, null);
    });
  }

  // ── Deduplication (opportunityDiscoveryService) ────────────────────
  console.log("Deduplication");
  {
    const { dedupeOpportunities, emptyOpportunity } = requireDiscoveryServiceForTest();

    await test("collapses same canonical URL from two providers into one", () => {
      const a = emptyOpportunity({ id: "a", role: "Engineer", company: "Acme", source_url: "https://x.com/job/1?utm=abc" });
      const b = emptyOpportunity({ id: "b", role: "Engineer", company: "Acme", source_url: "https://x.com/job/1" });
      const out = dedupeOpportunities([a, b]);
      assert.strictEqual(out.length, 1, "same canonical path, different query string → same job");
    });

    await test("collapses same provider_job_id when URLs are missing/unusable", () => {
      const a = emptyOpportunity({ id: "a", role: "Engineer", company: "Acme", source_url: "", provider_id: "jobicy", provider_job_id: "999" });
      const b = emptyOpportunity({ id: "b", role: "Engineer", company: "Acme", source_url: "", provider_id: "jobicy", provider_job_id: "999" });
      const out = dedupeOpportunities([a, b]);
      assert.strictEqual(out.length, 1);
    });

    await test("does NOT merge two different jobs with similar titles at different companies", () => {
      const a = emptyOpportunity({ id: "a", role: "React Developer", company: "Acme", source_url: "https://x.com/a" });
      const b = emptyOpportunity({ id: "b", role: "React Developer", company: "Globex", source_url: "https://y.com/b" });
      const out = dedupeOpportunities([a, b]);
      assert.strictEqual(out.length, 2, "different companies/URLs → genuinely different jobs, must not merge");
    });
  }

  // ── Relevance scoring (pure, no mocks needed) ──────────────────────
  console.log("Relevance scoring");
  {
    const { scoreOpportunity, rankByRelevance } = require(path.join(SRC, "services/opportunityRelevanceService"));

    await test("scores a strong match higher than a weak one, with explainable reasons", () => {
      const query = { role: "React Developer", skills: ["react", "javascript"], remote_preference: "any" };
      const strong = { role: "Senior React Developer", requirements: ["React", "JavaScript", "Git"], description: "", remote: true, employment_type: "" };
      const weak = { role: "Data Analyst", requirements: ["SQL", "Excel"], description: "", remote: false, employment_type: "" };
      const strongScore = scoreOpportunity(query, strong);
      const weakScore = scoreOpportunity(query, weak);
      assert.ok(strongScore.score > weakScore.score);
      assert.ok(strongScore.reasons.length > 0);
      assert.deepStrictEqual(strongScore.matched_skills.sort(), ["javascript", "react"]);
    });

    await test("never claims a skill match that isn't actually present", () => {
      const query = { role: "Engineer", skills: ["rust"], remote_preference: "any" };
      const opp = { role: "Engineer", requirements: ["Python"], description: "python only", remote: true, employment_type: "" };
      const result = scoreOpportunity(query, opp);
      assert.deepStrictEqual(result.matched_skills, []);
      assert.deepStrictEqual(result.missing_skills, ["rust"]);
    });

    await test("location_compatible stays null (not guessed) when neither side gives enough info", () => {
      const query = { role: "Engineer", skills: [], remote_preference: "any" };
      const opp = { role: "Engineer", requirements: [], description: "", remote: false, employment_type: "", location: "" };
      const result = scoreOpportunity(query, opp);
      assert.strictEqual(result.location_compatible, null);
    });

    await test("rankByRelevance sorts descending by score", () => {
      const query = { role: "React Developer", skills: ["react"], remote_preference: "any" };
      const list = [
        { id: "1", role: "Data Analyst", requirements: [], description: "", remote: false, employment_type: "" },
        { id: "2", role: "React Developer", requirements: ["React"], description: "", remote: true, employment_type: "" },
      ];
      const ranked = rankByRelevance(query, list);
      assert.strictEqual(ranked[0].id, "2");
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

function requireDiscoveryServiceForTest() {
  return require(path.join(SRC, "services/opportunityDiscoveryService"));
}

run();
