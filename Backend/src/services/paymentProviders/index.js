/**
 * Provider-agnostic payment port.
 * Controllers and subscriptionService must not import concrete SDKs.
 */
const mockAdapter = require("./mockAdapter");

const PROVIDERS = {
  mock: mockAdapter,
};

/**
 * Resolve active payment provider.
 * Production refuses mock activation unless ALLOW_MOCK_PAYMENTS=true (explicit).
 */
function getProvider(name) {
  const key = (name || process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const adapter = PROVIDERS[key];
  if (!adapter) {
    throw new Error(`Unknown payment provider: ${key}`);
  }
  return adapter;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function mockAllowed() {
  if (!isProduction()) return true;
  return process.env.ALLOW_MOCK_PAYMENTS === "true";
}

module.exports = {
  getProvider,
  isProduction,
  mockAllowed,
  PROVIDERS,
};
