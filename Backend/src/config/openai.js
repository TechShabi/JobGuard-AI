// ═══════════════════════════════════════════════════════════════════════
// OPENAI PROVIDER CONFIG
// ═══════════════════════════════════════════════════════════════════════
// Single source of truth for OpenAI connectivity. Nothing else in the
// codebase should read process.env.OPENAI_* directly — go through this
// file so model/tool selection stays in one place (mirrors the existing
// config/gemini.js + config/paymentsConfig.js pattern).
//
// OpenAI is the PRIMARY / DEFAULT AI provider (see services/aiService.js).
// Gemini (config/gemini.js, services/geminiService.js) is retained only as
// an isolated, explicitly opt-in legacy path — see aiService.js header.
// ═══════════════════════════════════════════════════════════════════════

require("dotenv").config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

// Text/JSON generation model (resume review, interview questions, scam
// verification, relevance explanation, etc.) — normal completions, no
// web browsing involved.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Separate, independently-configurable model for Opportunity web-search
// discovery. Web-search-capable models are a distinct, narrower set from
// general chat models, so this is never assumed to equal OPENAI_MODEL.
const OPENAI_WEB_SEARCH_MODEL = process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-4o-mini";

// Master switch for Opportunity web discovery. When false (or no API key
// configured), the openaiWebSearchProvider reports itself as not live —
// discover() then honestly falls through to "unavailable" rather than
// pretending a search happened.
const OPENAI_WEB_SEARCH_ENABLED =
  process.env.OPENAI_WEB_SEARCH_ENABLED !== "false"; // default: on

// The actual tool name OpenAI's Responses API expects for hosted web
// search changes across API versions. Kept configurable rather than
// hardcoded so an operator can adjust it without a code change if OpenAI
// renames/versions the tool.
const OPENAI_WEB_SEARCH_TOOL_TYPE =
  process.env.OPENAI_WEB_SEARCH_TOOL_TYPE || "web_search_preview";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

const OPENAI_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.OPENAI_TIMEOUT_MS, 10) || 30000
);
const OPENAI_WEB_SEARCH_TIMEOUT_MS = Math.max(
  10000,
  parseInt(process.env.OPENAI_WEB_SEARCH_TIMEOUT_MS, 10) || 45000
);

function isConfigured() {
  return !!OPENAI_API_KEY;
}

function isWebSearchEnabled() {
  return isConfigured() && OPENAI_WEB_SEARCH_ENABLED;
}

module.exports = {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_WEB_SEARCH_MODEL,
  OPENAI_WEB_SEARCH_ENABLED,
  OPENAI_WEB_SEARCH_TOOL_TYPE,
  OPENAI_BASE_URL,
  OPENAI_TIMEOUT_MS,
  OPENAI_WEB_SEARCH_TIMEOUT_MS,
  isConfigured,
  isWebSearchEnabled,
};
