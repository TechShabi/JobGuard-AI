const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { optionalAuth } = auth;
const upload = require("../middleware/upload");
const contextController = require("../controllers/contextController");

// Context Engine sirf logged-in users ke liye persist hota hai.
// Guests ke liye frontend ContextEngineContext state/localStorage mein hi rehta hai.
router.get("/", auth, contextController.getActiveContext);
router.post("/", auth, contextController.createOrReplaceContext);
router.delete("/", auth, contextController.clearContext);

// Auto-detect (Step 1 of Resume Review / Builder / Interview) — same
// Cheerio/OCR/Gemini pipeline as Opportunity Verification, ONE Gemini call.
// optionalAuth: guests can also auto-detect, exactly like Opportunity Verification.
router.post("/extract-url", optionalAuth, contextController.extractFromUrl);
router.post("/extract-description", optionalAuth, contextController.extractFromDescription);
router.post("/extract-image", optionalAuth, upload.single("image"), contextController.extractFromImage);

module.exports = router;
