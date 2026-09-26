const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const membershipController = require("../controllers/membershipController");

// Public — Pricing page reads plan/feature config from here, never hardcoded.
router.get("/plans", membershipController.getPlans);

// Auth required — Career Growth Profile.
router.get("/me", auth, membershipController.getMe);
router.post("/upgrade", auth, membershipController.upgrade);
router.get("/activity", auth, membershipController.getActivity);

// Paid-interest validation (Zero-cost MVP) — own records only.
router.post("/interest", auth, membershipController.requestInterest);
router.get("/interest", auth, membershipController.getMyInterests);

module.exports = router;
