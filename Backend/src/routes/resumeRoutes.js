const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");
const uploadResume = require("../middleware/uploadResume");
const resumeController = require("../controllers/resumeController");
const { gateFeature } = require("../middleware/careerSession");

// Resume Review — guest allowed (1 free use tracked on frontend), members
// spend Career Sessions through the shared permission layer.
router.post(
  "/analyze",
  optionalAuth,
  gateFeature("resume_review"),
  uploadResume.single("resume"),
  resumeController.analyze
);

// Optimize — OPTIONAL, only called after the user has seen the review.
// Completely separate AI call, never combined with /analyze.
// Login required + Career Plus or above, per Career Growth Membership rules.
router.post(
  "/optimize",
  auth,
  gateFeature("resume_optimize"),
  uploadResume.single("resume"),
  resumeController.optimize
);

// Resume Builder — login required (autofill/save needs an owner)
router.post("/generate", auth, gateFeature("resume_builder"), resumeController.generate);
router.get("/profile", auth, resumeController.getProfile);
router.put("/profile", auth, resumeController.updateProfile);

// History
router.get("/", auth, resumeController.list);
router.get("/:id", auth, resumeController.getOne);
router.delete("/:id", auth, resumeController.remove);

module.exports = router;
