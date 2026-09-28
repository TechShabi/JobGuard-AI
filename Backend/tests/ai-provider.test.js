/**
 * AI Service / OpenAI Opportunity Discovery — provider-selection and
 * web-search-honesty tests (product-spec sections 3, 4, 38, 41).
 *
 * Uses the same offline axios stand-in as tests/opportunity-discovery.test.js
 * (testharness/node_modules/axios) since services/openaiService.js's own
 * HTTP calls go through axios — real network access to api.openai.com is
 * not available in this environment (see the final delivery report).
 *
 * Run with:
 *   mv node_modules/axios node_modules/axios.real
 *   NODE_PATH=testharness/node_modules node tests/ai-provider.test.js
 *   mv node_modules/axios.real node_modules/axios
 */
const assert = require("assert");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Every module under test reads env vars / axios mock state at require
// time or module scope, so each scenario gets a clean require.cache and a
// freshly reset axios mock — otherwise scenarios would leak into each
// other (e.g. an API key set in one test "sticking" for the next).
function freshRequire(env = {}) {
  for (const key of [
    "OPENAI_API_KEY",
    "OPENAI_WEB_SEARCH_ENABLED",
    "AI_PROVIDER",
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, env);

  for (const mod of [
    path.join(SRC, "config/openai.js"),
    path.join(SRC, "services/openaiService.js"),
    path.join(SRC, "services/geminiService.js"),
    path.join(SRC, "services/aiService.js"),
    path.join(SRC, "services/discoveryProviders/openaiWebSearchProvider.js"),
  ]) {
    delete require.cache[require.resolve(mod)];
  }

  require("axios").__reset();

  return {
    aiService: require(path.join(SRC, "services/aiService.js")),
    openaiService: require(path.join(SRC, "services/openaiService.js")),
    openaiWebSearchProvider: require(path.join(SRC, "services/discoveryProviders/openaiWebSearchProvider.js")),
  };
}

async function main() {
console.log("Provider selection (product-spec section 3, 41)");

await test("defaults to OpenAI when AI_PROVIDER is unset", async () => {
  const { aiService } = freshRequire({});
  assert.strictEqual(aiService.activeProvider, "openai");
});

await test("defaults to OpenAI when AI_PROVIDER is an unrecognized value (never silently falls back to Gemini)", async () => {
  const { aiService } = freshRequire({ AI_PROVIDER: "anthropic" });
  assert.strictEqual(aiService.activeProvider, "openai");
});

await test("only selects Gemini when AI_PROVIDER=gemini is explicitly set", async () => {
  const { aiService } = freshRequire({ AI_PROVIDER: "gemini" });
  assert.strictEqual(aiService.activeProvider, "gemini");
});

await test("Opportunity web-search discovery always uses OpenAI, even under a Gemini rollback", async () => {
  const { aiService } = freshRequire({ AI_PROVIDER: "gemini", OPENAI_API_KEY: "" });
  const result = await aiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  // No key configured -> honestly not-live, but this proves the call
  // reached the OpenAI path (config-driven note) rather than throwing or
  // silently routing to Gemini's own (removed) grounded-discovery path.
  assert.strictEqual(result.isLive, false);
  assert.ok(/OPENAI_API_KEY/.test(result.note), `expected an OpenAI-specific note, got: ${result.note}`);
});

console.log("\nOpenAI web-search discovery — honesty guarantees (product-spec section 4, 9, 38, 41)");

await test("missing API key -> not live, with an honest note (never fabricates rows)", async () => {
  const { openaiService } = freshRequire({ OPENAI_API_KEY: "" });
  const result = await openaiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  assert.strictEqual(result.isLive, false);
  assert.deepStrictEqual(result.rows, []);
  assert.ok(result.note && result.note.length > 0);
});

await test("web-search disabled via config -> not live, with an honest note", async () => {
  const { openaiService } = freshRequire({ OPENAI_API_KEY: "sk-test", OPENAI_WEB_SEARCH_ENABLED: "false" });
  const result = await openaiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  assert.strictEqual(result.isLive, false);
  assert.ok(/disabled/i.test(result.note));
});

await test("model response with NO web_search_call item -> never treated as live (no evidence a search happened)", async () => {
  const { openaiService } = freshRequire({ OPENAI_API_KEY: "sk-test" });
  require("axios").__mock(
    "https://api.openai.com/v1/responses",
    async () => ({
      data: {
        output: [
          {
            type: "message",
            content: [{ text: JSON.stringify([{ role: "Backend Developer", company: "Acme", source_url: "https://acme.com/careers/1" }]) }],
          },
        ],
      },
    }),
    "post"
  );
  const result = await openaiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  assert.strictEqual(result.isLive, false);
  assert.strictEqual(result.rows.length, 0);
  assert.ok(/did not perform a web search/i.test(result.note));
});

await test("a real web_search_call + valid structured rows -> live, rows populated", async () => {
  const { openaiService } = freshRequire({ OPENAI_API_KEY: "sk-test" });
  require("axios").__mock(
    "https://api.openai.com/v1/responses",
    async () => ({
      data: {
        output: [
          { type: "web_search_call" },
          {
            type: "message",
            content: [
              {
                text: JSON.stringify([
                  {
                    role: "Backend Developer",
                    company: "Acme Corp",
                    location: "Remote",
                    remote_type: "remote",
                    employment_type: "Full-time",
                    description: "Build APIs",
                    skills: ["Node.js", "Express"],
                    source_platform: "Acme Careers",
                    source_url: "https://acme.com/careers/backend-developer-42",
                    posted_at: null,
                    salary_range: null,
                  },
                ]),
                annotations: [{ type: "url_citation", url: "https://acme.com/careers/backend-developer-42", title: "Backend Developer - Acme" }],
              },
            ],
          },
        ],
      },
    }),
    "post"
  );
  const result = await openaiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  assert.strictEqual(result.isLive, true);
  assert.strictEqual(result.rows.length, 1);
  assert.strictEqual(result.rows[0].company, "Acme Corp");
  assert.strictEqual(result.rows[0].salary_range, null, "never fabricates a missing field");
});

await test("a generic homepage source_url (no specific path) is rejected, not returned as a listing", async () => {
  const { openaiService } = freshRequire({ OPENAI_API_KEY: "sk-test" });
  require("axios").__mock(
    "https://api.openai.com/v1/responses",
    async () => ({
      data: {
        output: [
          { type: "web_search_call" },
          {
            type: "message",
            content: [
              {
                text: JSON.stringify([
                  { role: "Backend Developer", company: "Acme Corp", source_url: "https://acme.com" },
                ]),
                annotations: [{ type: "url_citation", url: "https://acme.com", title: "Acme" }],
              },
            ],
          },
        ],
      },
    }),
    "post"
  );
  const result = await openaiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  assert.strictEqual(result.rows.length, 0, "a bare domain root is not a specific job listing");
  assert.strictEqual(result.isLive, false);
});

await test("malformed (non-JSON) structured output after a real search -> honest failure, not a thrown error", async () => {
  const { openaiService } = freshRequire({ OPENAI_API_KEY: "sk-test" });
  require("axios").__mock(
    "https://api.openai.com/v1/responses",
    async () => ({
      data: {
        output: [
          { type: "web_search_call" },
          { type: "message", content: [{ text: "Sure, here are some jobs I found: <not json>" }] },
        ],
      },
    }),
    "post"
  );
  const result = await openaiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  assert.strictEqual(result.isLive, false);
  assert.strictEqual(result.rows.length, 0);
  assert.ok(result.note);
});

await test("API/network failure -> honest 'unavailable', never throws up to the caller", async () => {
  const { openaiService } = freshRequire({ OPENAI_API_KEY: "sk-test" });
  require("axios").__mock(
    "https://api.openai.com/v1/responses",
    async () => {
      throw new Error("socket hang up");
    },
    "post"
  );
  const result = await openaiService.discoverOpportunitiesWebSearch({ role: "Backend Developer" });
  assert.strictEqual(result.isLive, false);
  assert.ok(/failed/i.test(result.note));
});

console.log("\nopenaiWebSearchProvider — maps into the canonical opportunity shape (product-spec section 8)");

await test("mapped rows are flagged is_ai_discovered with discovery_method openai_web_search, and carry stamped evidence", async () => {
  const { openaiWebSearchProvider } = freshRequire({ OPENAI_API_KEY: "sk-test" });
  require("axios").__mock(
    "https://api.openai.com/v1/responses",
    async () => ({
      data: {
        output: [
          { type: "web_search_call" },
          {
            type: "message",
            content: [
              {
                text: JSON.stringify([
                  { role: "Backend Developer", company: "Acme Corp", source_url: "https://acme.com/careers/be-42", remote_type: "remote" },
                ]),
                annotations: [{ type: "url_citation", url: "https://acme.com/careers/be-42", title: "Backend Developer" }],
              },
            ],
          },
        ],
      },
    }),
    "post"
  );
  const { rows, isLive } = await openaiWebSearchProvider.search({ role: "Backend Developer" });
  assert.strictEqual(isLive, true);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].is_ai_discovered, true);
  assert.strictEqual(rows[0].discovery_method, "openai_web_search");
  assert.strictEqual(rows[0].is_live, true);
  assert.ok(Array.isArray(rows[0].evidence) && rows[0].evidence.length === 1);
  assert.strictEqual(rows[0].evidence[0].source_url, "https://acme.com/careers/be-42");
});


  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
