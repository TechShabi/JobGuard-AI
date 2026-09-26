const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Router is mounted in app.js behind: auth → admin → adminLimiter
// Do NOT add public routes here.

router.get("/stats", adminController.getStats);
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserDetail);
router.get("/verifications", adminController.listVerifications);
router.get("/reports", adminController.listReports);
router.patch("/reports/:id/status", adminController.updateReportStatus);
router.get("/audit-log", adminController.listAuditLog);
router.get("/ai-usage", adminController.getAiUsage);

// ── Admin Panel Evolution ──────────────────────────────────────────────
router.get("/career-sessions", adminController.listCareerSessions);

router.get("/opportunities/operations", adminController.getOpportunityOperations);
router.get("/opportunities", adminController.listOpportunitySearches);
router.get("/opportunities/:id", adminController.getOpportunitySearchDetail);

router.get("/interviews/operations", adminController.getInterviewOperations);
router.get("/interviews", adminController.listInterviews);
router.get("/interviews/:id", adminController.getInterviewDetail);

router.get("/resumes/operations", adminController.getResumeOperations);
router.get("/resumes", adminController.listResumes);
router.get("/resumes/:id", adminController.getResumeDetail);

router.get("/subscriptions", adminController.getSubscriptionOverview);
router.get("/transactions", adminController.listPaymentTransactions);

// Paid interest (Zero-cost MVP demand signal)
router.get("/membership-interest/overview", adminController.getMembershipInterestOverview);
router.get("/membership-interest", adminController.listMembershipInterests);
router.patch("/membership-interest/:id", adminController.updateMembershipInterestStatus);

router.get("/feature-flags", adminController.listFeatureFlags);
router.post("/feature-flags", adminController.createFeatureFlag);
router.patch("/feature-flags/:id", adminController.updateFeatureFlag);

router.get("/announcements", adminController.listAnnouncements);
router.post("/announcements", adminController.createAnnouncement);
router.patch("/announcements/:id", adminController.updateAnnouncement);

module.exports = router;
