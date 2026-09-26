const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth");
const verifyController = require("../controllers/verifyController");
const upload = require("../middleware/upload");
const { gateFeature } = require("../middleware/careerSession");


router.post("/description", optionalAuth, gateFeature("opportunity_verification"), verifyController.verifyDescription);
router.post("/url", optionalAuth, gateFeature("opportunity_verification"), verifyController.verifyUrl);
router.post("/image", optionalAuth, gateFeature("opportunity_verification"), upload.single("image"), verifyController.verifyImage);

module.exports = router;