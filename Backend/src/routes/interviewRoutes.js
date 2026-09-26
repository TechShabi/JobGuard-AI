const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");
const interviewController = require("../controllers/interviewController");
const { gateFeature } = require("../middleware/careerSession");
const { generalLimiter } = require("../middleware/rateLimiter");

router.post("/start", optionalAuth, gateFeature("interview_practice"), interviewController.start);
// /next does NOT consume an additional Career Session per turn (a live
// interview costs the same 1 session at start + 1 at finish as batch mode —
// see interviewController comments), so generalLimiter (reused, not a new
// limiter) is what stops a turn-by-turn conversation from being hammered.
router.post("/next", auth, generalLimiter, interviewController.next);
router.post("/finish", optionalAuth, gateFeature("interview_report"), interviewController.finish);

router.get("/", auth, interviewController.list);
router.get("/:id", auth, interviewController.getOne);
router.delete("/:id", auth, interviewController.remove);

module.exports = router;
