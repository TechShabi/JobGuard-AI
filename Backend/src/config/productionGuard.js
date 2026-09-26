/**
 * Sprint 10 — production config validation (fail-fast).
 * Never logs secret values.
 */

const WEAK_JWT = new Set([
  "",
  "secret",
  "jwt_secret",
  "changeme",
  "change-me",
  "your-secret",
  "your_jwt_secret",
  "jobguard",
  "jobguard-secret",
  "dev",
  "development",
  "test",
]);

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Parse CORS_ORIGINS: comma-separated list.
 * Dev defaults to localhost Vite/CRA ports when unset.
 * Production requires explicit list.
 */
function getCorsOrigins() {
  const raw = (process.env.CORS_ORIGINS || "").trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!isProduction()) {
    return ["http://localhost:5173", "http://localhost:3000"];
  }
  return [];
}

function assertProductionConfig() {
  if (!isProduction()) return;

  const missing = [];
  const weak = [];

  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  else if (
    WEAK_JWT.has(String(process.env.JWT_SECRET).trim().toLowerCase()) ||
    String(process.env.JWT_SECRET).length < 16
  ) {
    weak.push("JWT_SECRET");
  }

  if (!process.env.DB_HOST) missing.push("DB_HOST");
  if (!process.env.DB_NAME) missing.push("DB_NAME");
  if (!process.env.DB_USER) missing.push("DB_USER");
  // DB_PASSWORD may be empty for some managed sockets — require presence of key only if needed;
  // still require the variable to be set (even empty string is explicit).
  if (process.env.DB_PASSWORD === undefined) missing.push("DB_PASSWORD");

  if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");

  const origins = getCorsOrigins();
  if (!origins.length) missing.push("CORS_ORIGINS");

  if (missing.length || weak.length) {
    const parts = [];
    if (missing.length) parts.push(`Missing required production config: ${missing.join(", ")}`);
    if (weak.length) parts.push(`Weak or placeholder production secrets: ${weak.join(", ")}`);
    const err = new Error(parts.join(" | "));
    err.code = "PRODUCTION_CONFIG";
    throw err;
  }
}

module.exports = {
  isProduction,
  getCorsOrigins,
  assertProductionConfig,
};
