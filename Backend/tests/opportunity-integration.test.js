/**
 * Integration-level tests: opportunityDiscoveryService.discover() with all
 * three real providers mocked, plus the existing (untouched)
 * opportunityVerificationService — proving discovered→verified actually
 * flows through, and that samples never leak into production.
 *
 * Run with:
 *   NODE_PATH=/home/claude/work/testharness/node_modules node opportunity-integration.test.js
 */
const assert = require("assert");
const path = require("path");
const SRC = path.join(__dirname, "..", "src");

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    require("axios").__reset();
    require(path.join(SRC, "services/discoveryProviders/httpCache")).clear();
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

function mockAllProvidersSucceed(axios) {
  axios.__mock("https://jobicy.com", async () => ({
    data: { jobs: [{ id: 1, url: "https://jobicy.com/j/1", jobTitle: "React Developer", companyName: "A", jobGeo: "Anywhere", pubDate: new Date().toISOString() }] },
  }));
  axios.__mock("https://himalayas.app", async () => ({
    data: { jobs: [{ title: "React Developer", companyName: "B", guid: "h1", applicationLink: "https://himalayas.app/j/2", locationRestrictions: [], pubDate: Date.now() }] },
  }));
  axios.__mock("https://remotive.com", async () => ({
    data: { jobs: [{ id: 3, title: "React Developer", company_name: "C", url: "https://remotive.com/j/3", publication_date: new Date().toISOString() }] },
  }));
}

function mockAllProvidersFail(axios) {
  axios.__mock("https://jobicy.com", async () => { throw new Error("down"); });
  axios.__mock("https://himalayas.app", async () => { throw new Error("down"); });
  axios.__mock("https://remotive.com", async () => { throw new Error("down"); });
}

async function run() {
  console.log("discover() — end-to-end");
  {
    // These tests specifically exercise the Jobicy/Himalayas/Remotive
    // provider registration path, which is opt-in-only now that OpenAI web
    // search is the default primary discovery mechanism (product-spec
    // section 5). PROVIDERS is computed once at module load, so the env
    // var must be set BEFORE the fresh require below.
    process.env.ENABLE_JOB_API_PROVIDERS = "true";
    delete require.cache[require.resolve(path.join(SRC, "services/opportunityDiscoveryService"))];
    const axios = require("axios");
    const { discover } = require(path.join(SRC, "services/opportunityDiscoveryService"));

    await test("all providers succeed → discovery_status live_provider, deduped, provider_count set", async () => {
      mockAllProvidersSucceed(axios);
      const { opportunities, meta } = await discover({ role: "React Developer", skills: [], location: "", remote_preference: "any", experience: "" });
      assert.strictEqual(meta.discovery_status, "live_provider");
      assert.strictEqual(meta.is_live, true);
      assert.strictEqual(meta.provider_count, 3, "all 3 free providers contributed");
      assert.strictEqual(opportunities.length, 3, "3 distinct URLs from 3 distinct companies — no over-merging");
      assert.ok(opportunities.every((o) => o.is_live === true && o.is_development_sample === false));
    });

    await test("all providers fail + production + no explicit sample opt-in → unavailable, NO sample jobs", async () => {
      mockAllProvidersFail(axios);
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_DEV_SAMPLE_OPPORTUNITIES;
      try {
        const { opportunities, meta } = await discover({ role: "React Developer", skills: [], location: "", remote_preference: "any", experience: "" });
        assert.strictEqual(meta.discovery_status, "unavailable");
        assert.strictEqual(opportunities.length, 0, "CRITICAL: no fake/sample jobs may appear in production on live failure");
        assert.ok(meta.note && meta.note.toLowerCase().includes("unavailable"));
      } finally {
        delete process.env.NODE_ENV;
      }
    });

    await test("all providers fail + NOT production → still unavailable (development-sample fallback is fully disabled in this build, never partially — see opportunityDiscoveryService.js header)", async () => {
      mockAllProvidersFail(axios);
      delete process.env.NODE_ENV;
      const { opportunities, meta } = await discover({ role: "React Developer", skills: [], location: "", remote_preference: "any", experience: "" });
      assert.strictEqual(meta.discovery_status, "unavailable");
      assert.strictEqual(opportunities.length, 0, "no sample fallback exists to substitute here — that code path is commented out, not merely gated");
    });

    await test("partial failure (2 succeed, 1 fails) → still live_provider, with an honest partial-coverage note", async () => {
      axios.__mock("https://jobicy.com", async () => ({ data: { jobs: [{ id: 1, url: "https://jobicy.com/j/1", jobTitle: "X", companyName: "A" }] } }));
      axios.__mock("https://himalayas.app", async () => { throw new Error("down"); });
      axios.__mock("https://remotive.com", async () => ({ data: { jobs: [{ id: 3, title: "X", company_name: "C", url: "https://remotive.com/j/3" }] } }));
      const { opportunities, meta } = await discover({ role: "X", skills: [], location: "", remote_preference: "any", experience: "" });
      assert.strictEqual(meta.discovery_status, "live_provider", "partial failure must NOT kill the whole search");
      assert.strictEqual(opportunities.length, 2);
      assert.ok(meta.note && meta.note.includes("himalayas"), "note should name the failed source");
    });

    delete process.env.ENABLE_JOB_API_PROVIDERS;
  }

  console.log("opportunityVerificationService (existing, untouched — reused as-is)");
  {
    const { processDiscovered } = require(path.join(SRC, "services/opportunityVerificationService"));
    const { emptyOpportunity } = require(path.join(SRC, "services/discoveryProviders/opportunityShape"));

    await test("a clean, fresh, well-sourced opportunity passes as trusted", () => {
      const opp = emptyOpportunity({
        role: "React Developer", company: "Acme Inc", source_url: "https://x.com/1",
        posted_at: new Date().toISOString(), is_live: true,
      });
      const { verified } = processDiscovered([opp]);
      assert.strictEqual(verified.length, 1);
      assert.strictEqual(verified[0].verification.status, "trusted");
    });

    await test("suspicious-phrase listings are rejected, not shown as verified", () => {
      const opp = emptyOpportunity({
        role: "Easy Money", company: "QuickCash", source_url: "https://x.com/2",
        description: "Make money fast, no experience needed, pay a training fee",
        posted_at: new Date().toISOString(), is_live: true,
      });
      const { rejected } = processDiscovered([opp]);
      assert.strictEqual(rejected.length, 1);
      assert.strictEqual(rejected[0].verification.status, "rejected");
    });
  }

  console.log("Full pipeline: constraint filter → verification → verified-only gate (Search Quality pass)");
  {
    const { matchesSearchCriteria } = require(path.join(SRC, "services/opportunitySearchMatchService"));
    const { processDiscovered } = require(path.join(SRC, "services/opportunityVerificationService"));
    const { emptyOpportunity } = require(path.join(SRC, "services/discoveryProviders/opportunityShape"));

    function runFullPipeline(rows, query) {
      const matched = rows.filter((o) => matchesSearchCriteria(o, query).pass);
      const { verified } = processDiscovered(matched);
      return verified.filter((o) => o.verification.status === "trusted");
    }

    await test("Scenario F: constraint-matching jobs that all fail verification → zero results, not a crash", () => {
      const rows = [
        emptyOpportunity({
          role: "Backend Developer", requirements: ["Node.js"], remote: true,
          description: "Make $5000/week from home, pay a small training fee to get started",
          source_url: "https://x.com/scam1", posted_at: new Date().toISOString(), is_live: true,
        }),
      ];
      const trusted = runFullPipeline(rows, { role: "Backend Developer", skills: ["Node.js"], remote_preference: "remote" });
      assert.strictEqual(trusted.length, 0, "a role/skill/remote match that fails verification must still be hidden");
    });

    await test("mixed batch: only the role+skill+remote+verification match survives all gates", () => {
      const rows = [
        // Fails role
        emptyOpportunity({ role: "Frontend Developer", description: "Node.js is a plus", remote: true, source_url: "https://x.com/1", posted_at: new Date().toISOString(), is_live: true }),
        // Fails remote
        emptyOpportunity({ role: "Backend Developer", requirements: ["Node.js"], remote: false, source_url: "https://x.com/2", posted_at: new Date().toISOString(), is_live: true }),
        // Fails skill
        emptyOpportunity({ role: "Backend Developer", requirements: ["Java"], remote: true, source_url: "https://x.com/3", posted_at: new Date().toISOString(), is_live: true }),
        // Passes everything, including verification
        emptyOpportunity({ role: "Backend Developer", requirements: ["Node.js"], remote: true, company: "Acme", source_url: "https://x.com/4", posted_at: new Date().toISOString(), is_live: true }),
      ];
      const trusted = runFullPipeline(rows, { role: "Backend Developer", skills: ["Node.js"], remote_preference: "remote" });
      assert.strictEqual(trusted.length, 1);
      assert.strictEqual(trusted[0].source_url, "https://x.com/4");
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
