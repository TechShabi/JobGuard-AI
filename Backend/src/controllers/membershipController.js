const User = require("../models/User");
const CareerActivity = require("../models/CareerActivity");
const { MEMBERSHIPS, MEMBERSHIP_IDS, FEATURES } = require("../config/careerConfig");
const careerSessionService = require("../services/careerSessionService");
const subscriptionService = require("../services/subscriptionService");
const membershipInterestService = require("../services/membershipInterestService");
const { isPaymentsEnabled } = require("../config/paymentsConfig");

// GET /api/membership/plans — public
exports.getPlans = async (req, res) => {
  try {
    const plans = Object.values(MEMBERSHIPS).map((m) => ({
      ...m,
      isUnlimited: m.sessionsPerCycle === null,
      // Annual not billable in Sprint 7 — frontend must not present as checkout-ready
      annualBillingAvailable: false,
      monthlyBillingAvailable: m.monthlyPrice > 0 || m.id === MEMBERSHIP_IDS.STARTER,
      requiresCheckout: m.monthlyPrice > 0,
      // Compatibility: expose "go" alias for product-facing code
      productId: m.productAlias || m.id,
    }));

    const features = Object.values(FEATURES)
      .filter((f) => !f.comingSoon)
      .map((f) => ({
        key: f.key,
        label: f.label,
        description: f.description,
        sessionCost: f.sessionCost,
        minMembership: f.minMembership,
      }));

    return res.json({
      success: true,
      data: {
        plans,
        features,
        billing: {
          intervals: ["monthly"],
          annual_supported: false,
          currency: process.env.BILLING_CURRENCY || "usd",
          // Zero-cost MVP: checkout is closed until a real payment provider
          // is wired up. Paid-plan CTAs must use /membership/interest, not
          // /billing/checkout, while this is false.
          payments_enabled: isPaymentsEnabled(),
          development_payments:
            process.env.NODE_ENV !== "production" ||
            process.env.ALLOW_MOCK_PAYMENTS === "true",
        },
      },
    });
  } catch (error) {
    console.error("membership.getPlans:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load plans" });
  }
};

// GET /api/membership/me — auth required
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await subscriptionService.applyPeriodEndIfNeeded(user.id);
    await user.reload();

    await careerSessionService.ensureCycle(user);
    const status = careerSessionService.getStatus(user);
    const permissions = careerSessionService.getPermissionsMap(user);
    const membership =
      MEMBERSHIPS[user.membership] || MEMBERSHIPS[MEMBERSHIP_IDS.STARTER];

    const sub = await subscriptionService.getActiveSubscription(user.id);
    const subscription = subscriptionService.serializeSubscription(sub);

    const activity = await CareerActivity.findAll({
      where: { user_id: user.id },
      order: [["createdAt", "DESC"]],
      limit: 8,
    });

    return res.json({
      success: true,
      data: {
        careerSessions: {
          ...status,
          // Explicit fields for UX
          cycleResetAt: status.cycleResetAt,
          membershipName: status.membershipName,
        },
        membership,
        permissions,
        recentActivity: activity,
        // Sprint 7 billing state (additive)
        subscription,
        subscriptionStatus: subscription?.status || null,
        currentPeriodStart: subscription?.current_period_start || null,
        currentPeriodEnd: subscription?.current_period_end || null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
      },
    });
  } catch (error) {
    console.error("membership.getMe:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load membership" });
  }
};

/**
 * POST /api/membership/upgrade
 *
 * SECURITY (Sprint 7):
 * - Paid plans (plus/pro) CANNOT be activated here.
 * - Only switch TO free starter is allowed (immediate), or rejected with checkout hint.
 * Instant paid upgrade is closed.
 */
exports.upgrade = async (req, res) => {
  try {
    const raw = req.body.membership || req.body.plan_id || req.body.planId;
    const membership = subscriptionService.normalizePlanId(raw);

    if (!membership || !MEMBERSHIPS[membership]) {
      return res.status(400).json({ success: false, message: "Invalid membership" });
    }

    // Paid plans must go through billing checkout + verified activation
    if (subscriptionService.isPaidPlan(membership)) {
      return res.status(403).json({
        success: false,
        code: "CHECKOUT_REQUIRED",
        message:
          "Paid plans require checkout. Use POST /api/billing/checkout — membership is activated only after verified payment.",
        plan_id: membership,
        plan_name: MEMBERSHIPS[membership].name,
      });
    }

    // Only free starter path remains (e.g. explicit opt into free after cancel messaging)
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // If they still have an active paid subscription, do not strip mid-period via this endpoint
    const sub = await subscriptionService.getActiveSubscription(user.id);
    if (sub && ["active", "canceling"].includes(sub.status) && subscriptionService.isPaidPlan(sub.plan_id)) {
      return res.status(400).json({
        success: false,
        message:
          "You still have an active paid period. Cancel the subscription and wait until the period ends, or keep your current plan.",
      });
    }

    const prev = user.membership;
    user.membership = MEMBERSHIP_IDS.STARTER;
    await user.save();

    await CareerActivity.create({
      user_id: user.id,
      feature_key: "membership_change",
      feature_label: `Set to ${MEMBERSHIPS[MEMBERSHIP_IDS.STARTER].name}`,
      session_cost: 0,
      status: "completed",
      reason: `from:${prev}`,
    });

    const status = careerSessionService.getStatus(user);
    return res.json({
      success: true,
      message: `You are on ${MEMBERSHIPS[MEMBERSHIP_IDS.STARTER].name}`,
      data: {
        careerSessions: status,
        membership: MEMBERSHIPS[MEMBERSHIP_IDS.STARTER],
      },
    });
  } catch (error) {
    console.error("membership.upgrade:", error.message);
    return res.status(500).json({ success: false, message: "Membership update failed" });
  }
};

// POST /api/membership/interest — auth required
// Records real paid-plan demand. Never activates a subscription, never
// creates a payment, never changes the caller's current membership.
exports.requestInterest = async (req, res) => {
  try {
    const raw = req.body.plan_id || req.body.planId || req.body.membership;
    const source = req.body.source ? String(req.body.source).slice(0, 100) : "pricing_page";

    const result = await membershipInterestService.requestInterest({
      userId: req.user.id,
      planId: raw,
      source,
    });

    return res.status(result.created ? 201 : 200).json({
      success: true,
      data: result.interest,
      duplicate: !!result.duplicate,
      message: result.message,
    });
  } catch (error) {
    console.error("membership.requestInterest:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to record early-access request",
    });
  }
};

// GET /api/membership/interest — auth required, own records only
exports.getMyInterests = async (req, res) => {
  try {
    const interests = await membershipInterestService.listMine(req.user.id);
    return res.json({ success: true, data: interests });
  } catch (error) {
    console.error("membership.getMyInterests:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load early-access requests" });
  }
};

exports.getActivity = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const activity = await CareerActivity.findAll({
      where: { user_id: req.user.id },
      order: [["createdAt", "DESC"]],
      limit,
    });
    return res.json({ success: true, data: activity });
  } catch (error) {
    console.error("membership.getActivity:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load activity" });
  }
};
