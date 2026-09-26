// ═══════════════════════════════════════════════════════════════════════
// PAYMENTS CONFIG — Membership + Payments Evolution
// ═══════════════════════════════════════════════════════════════════════
// Single source of truth for "are real/simulated checkout payments allowed
// to run right now". Everything else (billing routes, membership/plans
// response, admin dashboards, frontend pricing page) reads this instead of
// re-deriving the answer from NODE_ENV or PAYMENT_PROVIDER themselves.
//
// Current MVP default: PAYMENTS_ENABLED is unset/false. No real payment
// gateway is required to run JobGuard. Paid plans are validated through
// MembershipInterest (see membershipInterestService) instead of checkout.
//
// When a real provider is wired up later, ops sets PAYMENTS_ENABLED=true
// (and PAYMENT_PROVIDER=<name>) and the existing checkout/webhook/
// subscription-activation pipeline in subscriptionService takes over with
// no code changes required here.
// ═══════════════════════════════════════════════════════════════════════

function isPaymentsEnabled() {
  return String(process.env.PAYMENTS_ENABLED || "false").toLowerCase() === "true";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Development/test-only payment simulation must NEVER be reachable from a
 * normal public flow. It requires PAYMENTS_ENABLED=true AND (non-production
 * OR an explicit ALLOW_MOCK_PAYMENTS=true escape hatch for staging QA).
 */
function isMockCheckoutAllowed() {
  if (!isPaymentsEnabled()) return false;
  if (!isProduction()) return true;
  return String(process.env.ALLOW_MOCK_PAYMENTS || "false").toLowerCase() === "true";
}

module.exports = {
  isPaymentsEnabled,
  isProduction,
  isMockCheckoutAllowed,
};
