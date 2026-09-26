const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const reportController = require("../controllers/reportController");

router.post("/", auth, reportController.createReport);

// Reads — require authentication (Sprint 6 security remediation)
router.get("/", auth, reportController.getReports);
router.get("/search", auth, reportController.searchReports);
router.get("/trending", auth, reportController.trendingReports);
router.get("/:id", auth, reportController.getReport);

router.delete("/:id", auth, admin, reportController.deleteReport);

module.exports = router;
