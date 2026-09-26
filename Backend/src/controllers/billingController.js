const subscriptionService = require("../services/subscriptionService");
const { getMembership } = require("../config/careerConfig");

// POST /api/billing/checkout
exports.createCheckout = async (req, res) => {
  try {
    const planId = req.body.plan_id || req.body.membership || req.body.planId;
    const interval = req.body.interval || "monthly";
    const result = await subscriptionService.createCheckout({
      userId: req.user.id,
      planId,
      interval,
      successUrl: req.body.success_url,
      cancelUrl: req.body.cancel_url,
    });
    return res.status(201).json({
      success: true,
      data: result,
      message: result.is_development
        ? "Development checkout created. No real payment will be processed."
        : "Checkout created",
    });
  } catch (error) {
    console.error("billing.createCheckout:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to create checkout",
      code: error.code,
    });
  }
};

// POST /api/billing/mock/confirm — development only, authenticated
exports.confirmMock = async (req, res) => {
  try {
    const { payment_id, checkout_id, signature, plan_id, amount, currency, interval } =
      req.body || {};
    if (!payment_id || !signature) {
      return res.status(400).json({
        success: false,
        message: "payment_id and signature are required",
      });
    }
    const result = await subscriptionService.confirmMockCheckout({
      userId: req.user.id,
      paymentId: payment_id,
      checkoutId: checkout_id,
      signature,
      planId: plan_id,
      amount,
      currency,
      interval,
    });
    return res.json({
      success: true,
      data: result,
      message: result.duplicate
        ? "Already processed"
        : "Development payment confirmed — membership activated",
    });
  } catch (error) {
    console.error("billing.confirmMock:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Confirmation failed",
      code: error.code,
    });
  }
};

// GET /api/billing/subscription
exports.getSubscription = async (req, res) => {
  try {
    await subscriptionService.applyPeriodEndIfNeeded(req.user.id);
    const sub = await subscriptionService.getActiveSubscription(req.user.id);
    return res.json({
      success: true,
      data: {
        subscription: subscriptionService.serializeSubscription(sub),
      },
    });
  } catch (error) {
    console.error("billing.getSubscription:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load subscription" });
  }
};

// POST /api/billing/subscription/cancel
exports.cancelSubscription = async (req, res) => {
  try {
    const result = await subscriptionService.cancelAtPeriodEnd(req.user.id);
    return res.json({
      success: true,
      data: {
        subscription: subscriptionService.serializeSubscription(result.subscription),
      },
      message: result.already
        ? "Cancellation already scheduled"
        : "Your plan stays active until the end of the current period",
    });
  } catch (error) {
    console.error("billing.cancelSubscription:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Cancellation failed",
    });
  }
};

// POST /api/billing/webhook/:provider
exports.webhook = async (req, res) => {
  try {
    const provider = String(req.params.provider || "").toLowerCase();
    if (!provider) {
      return res.status(400).json({ success: false, message: "Provider required" });
    }
    const result = await subscriptionService.processProviderEvent({
      provider,
      headers: req.headers,
      body: req.body,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("billing.webhook:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Webhook processing failed",
      code: error.code,
    });
  }
};
