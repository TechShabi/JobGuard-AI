const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");

router.get("/stats", auth, dashboardController.getStats);
router.get("/history", auth, dashboardController.getHistory);
router.get("/history/:id", auth, dashboardController.getSingleScan);
router.delete("/history/:id", auth, dashboardController.deleteScan);

module.exports = router;