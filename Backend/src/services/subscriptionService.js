const { Op } = require("sequelize");
const sequelize = require("../config/db");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const PaymentTransaction = require("../models/PaymentTransaction");
const ProviderEvent = require("../models/ProviderEvent");
const CareerActivity = require("../models/CareerActivity");
const {
  MEMBERSHIPS,
  MEMBERSHIP_IDS,
  getMembership,
} = require("../config/careerConfig");
const careerSessionService = require("./careerSessionService");
const { getProvider, mockAllowed, isProduction } = require("./paymentProviders");
const { isPaymentsEnabled } = require("../config/paymentsConfig");
const auditLogService = require("./auditLogService");

const PAID_PLANS = new Set([MEMBERSHIP_IDS.PLUS, MEMBERSHIP_IDS.PRO]);

/** Normalize plan id: accept "go" as alias for legacy "plus". */
function normalizePlanId(planId) {
  const id = String(planId || "").toLowerCase().trim();
  if (id === "go") return MEMBERSHIP_IDS.PLUS;
  return id;
}

function isPaidPlan(planId) {
  return PAID_PLANS.has(normalizePlanId(planId));
}

function expectedAmountCents(planId, interval = "monthly") {
  const plan = getMembership(normalizePlanId(planId));
  if (!plan) return null;
  // Sprint 7: monthly only. annualPrice in config is display legacy — not billable.
  if (interval !== "monthly") return null;
  return Math.round(Number(plan.monthlyPrice || 0) * 100);
}

function expectedCurrency() {
  return (process.env.BILLING_CURRENCY || "usd").toLowerCase();
}

/**
 * Create a checkout for a paid plan. Free starter does not need checkout.
 */
async function createCheckout({ userId, planId, interval = "monthly", successUrl, cancelUrl }) {
  if (!isPaymentsEnabled()) {
    const err = new Error(
      "Paid checkout is not available yet. Request early access instead — no payment is required for the current plan."
    );
    err.status = 404;
    err.code = "PAYMENTS_DISABLED";
    throw err;
  }

  const plan = normalizePlanId(planId);
  if (!MEMBERSHIPS[plan]) {
    const err = new Error("Invalid plan");
    err.status = 400;
    throw err;
  }
  if (interval !== "monthly") {
    const err = new Error(
      "Only monthly billing is supported. Annual checkout is not available yet."
    );
    err.status = 400;
    throw err;
  }
  if (!isPaidPlan(plan)) {
    const err = new Error("Free plan does not require checkout. You already have Career Starter.");
    err.status = 400;
    throw err;
  }

  const amount = expectedAmountCents(plan, interval);
  const currency = expectedCurrency();
  if (amount == null || amount <= 0) {
    const err = new Error("Plan is not billable");
    err.status = 400;
    throw err;
  }

  const providerName = process.env.PAYMENT_PROVIDER || "mock";
  if (providerName === "mock" && !mockAllowed()) {
    const err = new Error("Mock payments are not allowed in this environment");
    err.status = 403;
    throw err;
  }

  const provider = getProvider(providerName);
  const checkout = provider.createCheckout({
    userId,
    planId: plan,
    interval,
    amountCents: amount,
    currency,
    successUrl,
    cancelUrl,
    metadata: { user_id: userId, plan_id: plan, interval },
  });

  const tx = await PaymentTransaction.create({
    user_id: userId,
    plan_id: plan,
    provider: checkout.provider,
    provider_payment_id: checkout.payment_id,
    amount,
    currency,
    status: "pending",
    interval,
    is_development: !!checkout.is_development,
    metadata: {
      checkout_id: checkout.checkout_id,
      is_development: !!checkout.is_development,
    },
  });

  return {
    transaction_id: tx.id,
    provider: checkout.provider,
    is_development: !!checkout.is_development,
    checkout_id: checkout.checkout_id,
    payment_id: checkout.payment_id,
    amount,
    currency,
    interval,
    plan_id: plan,
    plan_name: getMembership(plan).name,
    confirm_required: !!checkout.confirm_required,
    checkout_url: checkout.checkout_url,
    message: checkout.message,
    // Dev-only: signature needed to confirm (not a secret of a real PSP)
    development_confirm:
      checkout.is_development
        ? {
            payment_id: checkout.payment_id,
            checkout_id: checkout.checkout_id,
            signature: checkout.metadata?.signature,
            plan_id: plan,
            interval,
            amount,
            currency,
          }
        : null,
  };
}

/**
 * Apply verified successful payment → subscription active + User.membership.
 * Idempotent on provider payment id / event id.
 */
async function activateFromVerifiedPayment({
  userId,
  planId,
  interval = "monthly",
  provider,
  paymentId,
  eventId,
  amount,
  currency,
  isDevelopment = false,
  adminId = null,
  ip = null,
}) {
  const plan = normalizePlanId(planId);
  if (!MEMBERSHIPS[plan] || !isPaidPlan(plan)) {
    const err = new Error("Invalid paid plan for activation");
    err.status = 400;
    throw err;
  }

  const expected = expectedAmountCents(plan, interval);
  const expectedCur = expectedCurrency();
  if (expected == null || Number(amount) !== Number(expected)) {
    await PaymentTransaction.update(
      { status: "mismatched" },
      {
        where: {
          provider,
          provider_payment_id: paymentId,
        },
      }
    );
    const err = new Error("Payment amount does not match plan configuration");
    err.status = 400;
    err.code = "AMOUNT_MISMATCH";
    throw err;
  }
  if (String(currency || "").toLowerCase() !== expectedCur) {
    const err = new Error("Payment currency does not match configuration");
    err.status = 400;
    err.code = "CURRENCY_MISMATCH";
    throw err;
  }

  return sequelize.transaction(async (t) => {
    // Idempotency: if payment already succeeded, return current state
    const existingTx = await PaymentTransaction.findOne({
      where: { provider, provider_payment_id: paymentId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (existingTx && existingTx.status === "succeeded") {
      const user = await User.findByPk(userId, { transaction: t });
      const sub = await Subscription.findOne({
        where: { user_id: userId, status: { [Op.in]: ["active", "canceling"] } },
        order: [["id", "DESC"]],
        transaction: t,
      });
      return {
        already_processed: true,
        membership: user?.membership,
        subscription: sub,
      };
    }

    const user = await User.findByPk(userId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (existingTx) {
      existingTx.status = "succeeded";
      existingTx.provider_event_id = eventId || existingTx.provider_event_id;
      existingTx.is_development = isDevelopment;
      await existingTx.save({ transaction: t });
    } else {
      await PaymentTransaction.create(
        {
          user_id: userId,
          plan_id: plan,
          provider,
          provider_payment_id: paymentId,
          provider_event_id: eventId,
          amount: expected,
          currency: expectedCur,
          status: "succeeded",
          interval,
          is_development: isDevelopment,
          metadata: { activated_via: "verified_payment" },
        },
        { transaction: t }
      );
    }

    // Cancel other active subs for this user (single active subscription policy)
    await Subscription.update(
      { status: "canceled", cancel_at_period_end: false },
      {
        where: {
          user_id: userId,
          status: { [Op.in]: ["active", "canceling", "past_due", "incomplete"] },
        },
        transaction: t,
      }
    );

    const providerSubId = `sub_${provider}_${paymentId}`;
    const [subscription] = await Subscription.findOrCreate({
      where: { provider, provider_subscription_id: providerSubId },
      defaults: {
        user_id: userId,
        plan_id: plan,
        status: "active",
        interval,
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        provider,
        provider_subscription_id: providerSubId,
      },
      transaction: t,
    });

    if (subscription.status !== "active" || subscription.plan_id !== plan) {
      subscription.user_id = userId;
      subscription.plan_id = plan;
      subscription.status = "active";
      subscription.interval = interval;
      subscription.current_period_start = now;
      subscription.current_period_end = periodEnd;
      subscription.cancel_at_period_end = false;
      subscription.pending_plan_id = null;
      await subscription.save({ transaction: t });
    }

    const previousMembership = user.membership;
    user.membership = plan;
    user.sessions_used = 0;
    user.sessions_cycle_start = now;
    await user.save({ transaction: t });

    await CareerActivity.create(
      {
        user_id: userId,
        feature_key: "membership_change",
        feature_label: `Activated ${getMembership(plan).name}${
          isDevelopment ? " (development payment)" : ""
        }`,
        session_cost: 0,
        status: "completed",
        reason: `from:${previousMembership}`,
      },
      { transaction: t }
    );

    if (adminId) {
      await auditLogService.record({
        adminId,
        action: "subscription.activated",
        targetType: "User",
        targetId: userId,
        before: { membership: previousMembership },
        after: { membership: plan, subscription_id: subscription.id },
        reason: "verified_payment",
        ip,
      });
    }

    return {
      already_processed: false,
      membership: plan,
      membershipName: getMembership(plan).name,
      subscription,
      careerSessions: careerSessionService.getStatus(user),
      is_development: isDevelopment,
    };
  });
}

/**
 * Process a verified provider event with idempotency.
 */
async function processProviderEvent({ provider, headers, body }) {
  if (!isPaymentsEnabled()) {
    const err = new Error("Payments are disabled — provider events are not accepted.");
    err.status = 404;
    err.code = "PAYMENTS_DISABLED";
    throw err;
  }

  const adapter = getProvider(provider);
  if (provider === "mock" && !mockAllowed()) {
    const err = new Error("Mock webhooks are not allowed in this environment");
    err.status = 403;
    throw err;
  }

  const verification = adapter.verifyWebhook({
    headers,
    rawBody: body,
    parsedBody: body,
  });
  if (!verification.valid) {
    const err = new Error("Webhook signature verification failed");
    err.status = 401;
    err.code = "WEBHOOK_INVALID";
    throw err;
  }

  const parsed = adapter.parseWebhook(body);
  const eventId = parsed.provider_event_id;

  // Record event for idempotency
  let eventRow;
  try {
    eventRow = await ProviderEvent.create({
      provider,
      provider_event_id: eventId,
      event_type: parsed.event_type,
      processed: false,
      payload_summary: {
        plan_id: parsed.plan_id,
        payment_id: parsed.payment_id,
        user_id: parsed.user_id,
        amount: parsed.amount,
      },
    });
  } catch (e) {
    // Unique constraint → already seen
    if (e.name === "SequelizeUniqueConstraintError" || e.parent?.code === "ER_DUP_ENTRY") {
      return {
        ok: true,
        duplicate: true,
        message: "Event already processed",
      };
    }
    throw e;
  }

  try {
    if (
      parsed.event_type === "payment.succeeded" ||
      parsed.event_type === "invoice.paid"
    ) {
      const result = await activateFromVerifiedPayment({
        userId: parsed.user_id,
        planId: parsed.plan_id,
        interval: parsed.interval || "monthly",
        provider,
        paymentId: parsed.payment_id,
        eventId,
        amount: parsed.amount,
        currency: parsed.currency,
        isDevelopment: !!parsed.is_development,
      });
      eventRow.processed = true;
      eventRow.result = result.already_processed ? "duplicate_activation" : "activated";
      await eventRow.save();
      return { ok: true, duplicate: false, result };
    }

    if (parsed.event_type === "payment.failed") {
      await PaymentTransaction.update(
        { status: "failed" },
        { where: { provider, provider_payment_id: parsed.payment_id } }
      );
      eventRow.processed = true;
      eventRow.result = "payment_failed";
      await eventRow.save();
      return { ok: true, result: { status: "failed" } };
    }

    eventRow.processed = true;
    eventRow.result = "ignored";
    await eventRow.save();
    return { ok: true, result: { ignored: true, event_type: parsed.event_type } };
  } catch (err) {
    eventRow.result = `error:${err.code || err.message}`;
    await eventRow.save().catch(() => {});
    throw err;
  }
}

/**
 * Development confirm path: authenticated user confirms their own mock checkout.
 * Still requires valid mock signature and amount/plan checks.
 */
async function confirmMockCheckout({ userId, paymentId, checkoutId, signature, planId, amount, currency, interval }) {
  if (!isPaymentsEnabled()) {
    const err = new Error("Payments are disabled — there is no checkout to confirm.");
    err.status = 404;
    err.code = "PAYMENTS_DISABLED";
    throw err;
  }
  if (!mockAllowed()) {
    const err = new Error("Mock payments are not allowed in this environment");
    err.status = 403;
    throw err;
  }

  const body = {
    checkout_id: checkoutId,
    payment_id: paymentId,
    user_id: userId,
    plan_id: normalizePlanId(planId),
    interval: interval || "monthly",
    amount: Number(amount),
    currency: (currency || "usd").toLowerCase(),
    event_type: "payment.succeeded",
    signature,
  };

  // Ensure the pending transaction belongs to this user
  const tx = await PaymentTransaction.findOne({
    where: {
      provider: "mock",
      provider_payment_id: paymentId,
      user_id: userId,
    },
  });
  if (!tx) {
    const err = new Error("Checkout not found for this user");
    err.status = 404;
    throw err;
  }

  return processProviderEvent({
    provider: "mock",
    headers: { "x-jobguard-mock-signature": signature },
    body,
  });
}

async function getActiveSubscription(userId) {
  return Subscription.findOne({
    where: {
      user_id: userId,
      status: { [Op.in]: ["active", "canceling", "past_due"] },
    },
    order: [["id", "DESC"]],
  });
}

/**
 * Cancel at period end — user keeps entitlement until current_period_end.
 */
async function cancelAtPeriodEnd(userId) {
  const sub = await getActiveSubscription(userId);
  if (!sub) {
    const err = new Error("No active subscription");
    err.status = 404;
    throw err;
  }
  if (sub.status === "canceling") {
    return { subscription: sub, already: true };
  }
  sub.cancel_at_period_end = true;
  sub.status = "canceling";
  await sub.save();

  await CareerActivity.create({
    user_id: userId,
    feature_key: "membership_change",
    feature_label: "Cancellation scheduled at period end",
    session_cost: 0,
    status: "completed",
    reason: `sub:${sub.id}`,
  });

  return { subscription: sub, already: false };
}

/**
 * Apply period end: if canceling or past end, expire and set membership to starter.
 * Called opportunistically from getMe / subscription reads.
 */
async function applyPeriodEndIfNeeded(userId) {
  const sub = await getActiveSubscription(userId);
  if (!sub) return null;

  const now = new Date();
  if (
    sub.current_period_end &&
    new Date(sub.current_period_end) <= now &&
    (sub.cancel_at_period_end || sub.status === "canceling" || sub.status === "past_due")
  ) {
    return sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
      sub.status = "expired";
      sub.cancel_at_period_end = false;
      await sub.save({ transaction: t });

      if (user && user.membership !== MEMBERSHIP_IDS.STARTER) {
        const prev = user.membership;
        user.membership = MEMBERSHIP_IDS.STARTER;
        await user.save({ transaction: t });
        await CareerActivity.create(
          {
            user_id: userId,
            feature_key: "membership_change",
            feature_label: "Subscription expired — returned to Career Starter",
            session_cost: 0,
            status: "completed",
            reason: `from:${prev}`,
          },
          { transaction: t }
        );
      }
      return sub;
    });
  }

  // Pending downgrade at period end
  if (
    sub.pending_plan_id &&
    sub.current_period_end &&
    new Date(sub.current_period_end) <= now
  ) {
    return sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
      const next = normalizePlanId(sub.pending_plan_id);
      sub.plan_id = next;
      sub.pending_plan_id = null;
      sub.current_period_start = now;
      sub.current_period_end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      sub.status = "active";
      await sub.save({ transaction: t });
      if (user) {
        user.membership = next;
        user.sessions_used = 0;
        user.sessions_cycle_start = now;
        await user.save({ transaction: t });
      }
      return sub;
    });
  }

  return sub;
}

function serializeSubscription(sub) {
  if (!sub) return null;
  const j = sub.toJSON ? sub.toJSON() : sub;
  return {
    id: j.id,
    plan_id: j.plan_id,
    plan_name: getMembership(j.plan_id).name,
    status: j.status,
    interval: j.interval,
    current_period_start: j.current_period_start,
    current_period_end: j.current_period_end,
    cancel_at_period_end: j.cancel_at_period_end,
    provider: j.provider,
    pending_plan_id: j.pending_plan_id,
  };
}

module.exports = {
  normalizePlanId,
  isPaidPlan,
  expectedAmountCents,
  expectedCurrency,
  createCheckout,
  activateFromVerifiedPayment,
  processProviderEvent,
  confirmMockCheckout,
  getActiveSubscription,
  cancelAtPeriodEnd,
  applyPeriodEndIfNeeded,
  serializeSubscription,
  PAID_PLANS,
};
