const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const billingController = require("../controllers/billingController");

// Authenticated billing
router.post("/checkout", auth, billingController.createCheckout);
router.post("/mock/confirm", auth, billingController.confirmMock);
router.get("/subscription", auth, billingController.getSubscription);
router.post("/subscription/cancel", auth, billingController.cancelSubscription);

// Provider webhooks — no user JWT; signature verified inside controller
router.post("/webhook/:provider", billingController.webhook);

module.exports = router;
