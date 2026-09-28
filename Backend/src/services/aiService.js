/**
 * AI Service — provider-selection abstraction.
 *
 *   JobGuard business logic (controllers)
 *           ↓
 *        aiService            ← THIS FILE — the only thing controllers require
 *           ↓
 *    openaiService (default)  |  geminiService (legacy, opt-in only)
 *
 * Business logic (resumeController, interviewController, verifyController,
 * contextController, opportunityController) requires THIS file instead of
 * reaching for services/openaiService.js or services/geminiService.js
 * directly — that's what "no direct provider SDK calls scattered through
 * business logic" (product-spec section 3) means in practice here.
 *
 * OpenAI is the primary/default provider. Gemini is retained only as an
 * isolated legacy path: it is NEVER selected unless an operator explicitly
 * sets AI_PROVIDER=gemini (e.g. a temporary rollback). Any other value, or
 * no value at all, resolves to OpenAI — so a missing/misconfigured env var
 * can never silently fall back to Gemini.
 */

const RAW_PROVIDER = String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
const ACTIVE_PROVIDER = RAW_PROVIDER === "gemini" ? "gemini" : "openai";

if (ACTIVE_PROVIDER === "gemini") {
  // Loud, unmissable — this should only ever happen as a deliberate,
  // temporary operator decision, never by accident.
  console.warn(
    "⚠️  AI_PROVIDER=gemini — JobGuard is running on the LEGACY/DEPRECATED " +
      "Gemini AI path. OpenAI is the supported default; this should only be " +
      "used for a temporary rollback."
  );
}

const openaiService = require("./openaiService");
// Only required (and only ever able to run) when explicitly selected above —
// require()'d unconditionally here is fine (cheap, no network call at
// require-time) but its functions are never invoked unless ACTIVE_PROVIDER
// === "gemini".
const geminiService = require("./geminiService");

const active = ACTIVE_PROVIDER === "gemini" ? geminiService : openaiService;

// ── Business-logic functions — same names/signatures both providers share ──
exports.analyzeScam = (...args) => active.analyzeScam(...args);
exports.extractJobInfo = (...args) => active.extractJobInfo(...args);
exports.analyzeResume = (...args) => active.analyzeResume(...args);
exports.generateOptimizedResume = (...args) => active.generateOptimizedResume(...args);
exports.generateResumeContent = (...args) => active.generateResumeContent(...args);
exports.generateAdaptiveInterviewStep = (...args) => active.generateAdaptiveInterviewStep(...args);
exports.generateInterviewQuestions = (...args) => active.generateInterviewQuestions(...args);
exports.generateInterviewReport = (...args) => active.generateInterviewReport(...args);
exports.explainOpportunityRelevance = (...args) => active.explainOpportunityRelevance(...args);

// Opportunity web-search discovery only exists on the OpenAI path (Gemini's
// equivalent — Google Search grounding — is reached separately, directly by
// discoveryProviders/geminiGroundedProvider.js, only when an operator has
// explicitly re-enabled it via ENABLE_GEMINI_GROUNDED_DISCOVERY=true; see
// services/opportunityDiscoveryService.js). This export always points at
// the real OpenAI implementation regardless of AI_PROVIDER, because a
// AI_PROVIDER=gemini rollback affects the *generation* functions above,
// not which Opportunity discovery engine is registered.
exports.discoverOpportunitiesWebSearch = (...args) =>
  openaiService.discoverOpportunitiesWebSearch(...args);

exports.activeProvider = ACTIVE_PROVIDER;
