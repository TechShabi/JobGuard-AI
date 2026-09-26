const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { optionalAuth } = auth;
const { gateFeature } = require("../middleware/careerSession");
const { generalLimiter } = require("../middleware/rateLimiter");
const opportunityController = require("../controllers/opportunityController");

// Find — guests allowed (limited) via careerConfig guestAccess.
// generalLimiter (existing app-wide IP rate limiter, currently only wired
// to /api/admin) is reused here as burst protection ahead of the Career
// Session monthly-quota check: gateFeature stops someone from *exceeding
// their plan*, generalLimiter stops a single IP from hammering the
// endpoint (and the Gemini grounded-search call behind it) many times in
// a short window before quota logic even runs. No new limiter invented.
router.post(
  "/find",
  generalLimiter,
  optionalAuth,
  gateFeature("opportunity_find"),
  opportunityController.findOpportunities
);

// Recent searches / saved — logged-in only (empty arrays for guests handled in controller)
router.get("/recent", optionalAuth, opportunityController.recentSearches);
router.get("/saved", optionalAuth, opportunityController.listSaved);
router.post("/saved", optionalAuth, opportunityController.upsertSaved);
router.delete("/saved/:externalId", optionalAuth, opportunityController.removeSaved);

// Next-best-action recommendation (uses real resume/interview when available)
router.post("/recommend", optionalAuth, opportunityController.recommendNext);

module.exports = router;
