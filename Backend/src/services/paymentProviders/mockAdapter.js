const crypto = require("crypto");

/**
 * DEVELOPMENT-ONLY payment adapter.
 * Simulates checkout + webhook confirmation. Never claims real money moved.
 * All artifacts are tagged is_development: true.
 */
const PROVIDER = "mock";

function createCheckout({
  userId,
  planId,
  interval,
  amountCents,
  currency,
  successUrl,
  cancelUrl,
  metadata = {},
}) {
  const checkoutId = `mock_chk_${crypto.randomBytes(12).toString("hex")}`;
  const paymentId = `mock_pay_${crypto.randomBytes(12).toString("hex")}`;

  // Dev confirm URL hits our webhook with a signed-style token (HMAC of payload).
  const payload = {
    checkout_id: checkoutId,
    payment_id: paymentId,
    user_id: userId,
    plan_id: planId,
    interval,
    amount: amountCents,
    currency,
    event_type: "payment.succeeded",
  };

  const secret = process.env.MOCK_WEBHOOK_SECRET || "jobguard-mock-dev-secret";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  const base =
    process.env.API_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:5000";

  // Frontend will call POST /billing/mock/confirm with checkout token in development.
  return {
    provider: PROVIDER,
    is_development: true,
    checkout_id: checkoutId,
    payment_id: paymentId,
    amount: amountCents,
    currency,
    // For mock: client completes via /billing/mock/confirm (authenticated)
    // rather than an external redirect host.
    checkout_url: null,
    confirm_required: true,
    success_url: successUrl || null,
    cancel_url: cancelUrl || null,
    metadata: {
      ...metadata,
      ...payload,
      signature,
      is_development: true,
    },
    message:
      "Development checkout created. No real payment will be processed. Confirm via the development confirm endpoint.",
  };
}

/**
 * Verify mock webhook / confirm signature.
 * body must be the same object shape used when signing.
 */
function verifyWebhook({ headers, rawBody, parsedBody }) {
  const secret = process.env.MOCK_WEBHOOK_SECRET || "jobguard-mock-dev-secret";
  const sig =
    headers?.["x-jobguard-mock-signature"] ||
    headers?.["X-JobGuard-Mock-Signature"] ||
    parsedBody?.signature;

  if (!sig || !parsedBody) {
    return { valid: false, reason: "missing_signature" };
  }

  const { signature: _omit, ...rest } = parsedBody;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(rest))
    .digest("hex");

  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "invalid_signature" };
  }

  return { valid: true };
}

function parseWebhook(parsedBody) {
  return {
    provider: PROVIDER,
    provider_event_id:
      parsedBody.event_id ||
      parsedBody.provider_event_id ||
      `mock_evt_${parsedBody.payment_id || crypto.randomBytes(8).toString("hex")}`,
    event_type: parsedBody.event_type || "payment.succeeded",
    payment_id: parsedBody.payment_id,
    checkout_id: parsedBody.checkout_id,
    user_id: parsedBody.user_id,
    plan_id: parsedBody.plan_id,
    interval: parsedBody.interval || "monthly",
    amount: parsedBody.amount,
    currency: (parsedBody.currency || "usd").toLowerCase(),
    is_development: true,
    raw: parsedBody,
  };
}

function mapPaymentStatus(providerStatus) {
  const s = String(providerStatus || "").toLowerCase();
  if (s === "succeeded" || s === "paid" || s === "payment.succeeded") return "succeeded";
  if (s === "failed" || s === "payment.failed") return "failed";
  if (s === "canceled" || s === "cancelled") return "canceled";
  return "pending";
}

function mapSubscriptionStatus(providerStatus) {
  const s = String(providerStatus || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "past_due") return "past_due";
  if (s === "canceled" || s === "cancelled") return "canceled";
  if (s === "expired") return "expired";
  return "incomplete";
}

module.exports = {
  id: PROVIDER,
  is_development: true,
  createCheckout,
  verifyWebhook,
  parseWebhook,
  mapPaymentStatus,
  mapSubscriptionStatus,
};
