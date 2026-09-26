const { Op } = require("sequelize");
const User = require("../models/User");
const Context = require("../models/Context");
const Resume = require("../models/Resume");
const ResumeProfile = require("../models/ResumeProfile");
const InterviewSession = require("../models/InterviewSession");
const OpportunitySearch = require("../models/OpportunitySearch");
const SavedOpportunity = require("../models/SavedOpportunity");
const ScanHistory = require("../models/ScanHistory");
const CareerActivity = require("../models/CareerActivity");
const ScamReport = require("../models/ScamReport");
const AdminAuditLog = require("../models/AdminAuditLog");
const Subscription = require("../models/Subscription");
const PaymentTransaction = require("../models/PaymentTransaction");
const FeatureFlag = require("../models/FeatureFlag");
const Announcement = require("../models/Announcement");
const adminMetricsService = require("../services/adminMetricsService");
const auditLogService = require("../services/auditLogService");
const membershipInterestService = require("../services/membershipInterestService");
const { isPaymentsEnabled } = require("../config/paymentsConfig");

const SAFE_USER_ATTRS = [
  "id",
  "username",
  "email",
  "role",
  "membership",
  "sessions_used",
  "sessions_cycle_start",
  "createdAt",
  "updatedAt",
];

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ── Dashboard ──────────────────────────────────────────────────────────
const ALLOWED_RANGES = new Set(["today", "7d", "30d"]);
exports.getStats = async (req, res) => {
  try {
    const range = ALLOWED_RANGES.has(req.query.range) ? req.query.range : "7d";
    const stats = await adminMetricsService.getDashboardStats({ range });
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error("admin.getStats:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load stats" });
  }
};

// ── Users list ─────────────────────────────────────────────────────────
exports.listUsers = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.q) {
      const q = String(req.query.q).trim();
      where[Op.or] = [
        { username: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }
    if (req.query.role && ["user", "admin"].includes(req.query.role)) {
      where.role = req.query.role;
    }
    if (req.query.membership) {
      where.membership = String(req.query.membership);
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: SAFE_USER_ATTRS,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit) || 1,
        },
      },
    });
  } catch (error) {
    console.error("admin.listUsers:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list users" });
  }
};

// ── User detail ────────────────────────────────────────────────────────
exports.getUserDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findByPk(id, { attributes: SAFE_USER_ATTRS });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [
      contexts,
      resumes,
      resumeProfiles,
      interviews,
      opportunitySearches,
      savedOpportunities,
      scans,
      activities,
      subscription,
      reports,
    ] = await Promise.all([
      Context.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 10,
      }),
      Resume.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: [
          "id",
          "source",
          "role",
          "ats_score",
          "original_filename",
          "createdAt",
        ],
      }),
      ResumeProfile.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 5,
      }),
      InterviewSession.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: ["id", "role", "company", "experience", "status", "createdAt"],
      }),
      OpportunitySearch.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: [
          "id",
          "role",
          "location",
          "remote_preference",
          "experience",
          "is_live",
          "provider",
          "createdAt",
        ],
      }),
      SavedOpportunity.findAll({
        where: { user_id: id },
        order: [["updatedAt", "DESC"]],
        limit: 20,
        attributes: [
          "id",
          "external_id",
          "status",
          "role",
          "company",
          "location",
          "source_platform",
          "createdAt",
          "updatedAt",
        ],
      }),
      ScanHistory.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 20,
        attributes: ["id", "type", "scam_score", "verdict", "createdAt"],
      }),
      CareerActivity.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 30,
        attributes: [
          "id",
          "feature_key",
          "feature_label",
          "session_cost",
          "status",
          "reason",
          "createdAt",
        ],
      }),
      Subscription.findOne({
        where: { user_id: id },
        order: [["updatedAt", "DESC"]],
      }),
      ScamReport.findAll({
        where: { user_id: id },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: ["id", "title", "status", "scam_score", "createdAt"],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        user,
        career_context: contexts,
        resumes,
        resume_profiles: resumeProfiles,
        interviews,
        opportunity_searches: opportunitySearches,
        saved_opportunities: savedOpportunities,
        verifications: scans,
        usage_activity: activities,
        subscription,
        reports,
      },
    });
  } catch (error) {
    console.error("admin.getUserDetail:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load user" });
  }
};

// ── Verifications (ScanHistory) ────────────────────────────────────────
exports.listVerifications = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.type && ["url", "image", "description"].includes(req.query.type)) {
      where.type = req.query.type;
    }
    if (req.query.user_id) {
      where.user_id = parseInt(req.query.user_id, 10);
    }
    if (req.query.min_score != null) {
      where.scam_score = { [Op.gte]: parseInt(req.query.min_score, 10) || 0 };
    }

    const { rows, count } = await ScanHistory.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      attributes: [
        "id",
        "user_id",
        "type",
        "content",
        "scam_score",
        "verdict",
        "createdAt",
      ],
    });

    // Truncate content for list safety
    const verifications = rows.map((r) => {
      const j = r.toJSON();
      if (j.content && j.content.length > 200) {
        j.content = j.content.slice(0, 200) + "…";
      }
      // Do not send full ai_response in list
      return j;
    });

    return res.json({
      success: true,
      data: {
        verifications,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit) || 1,
        },
      },
    });
  } catch (error) {
    console.error("admin.listVerifications:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list verifications" });
  }
};

// ── Reports ────────────────────────────────────────────────────────────
exports.listReports = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.status && ["pending", "verified", "rejected"].includes(req.query.status)) {
      where.status = req.query.status;
    }
    if (req.query.q) {
      where.title = { [Op.like]: `%${String(req.query.q).trim()}%` };
    }

    const { rows, count } = await ScamReport.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        reports: rows,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit) || 1,
        },
      },
    });
  } catch (error) {
    console.error("admin.listReports:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list reports" });
  }
};

// ── Report status transition ───────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  pending: ["verified", "rejected"],
  verified: ["pending", "rejected"],
  rejected: ["pending", "verified"],
};

exports.updateReportStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reason } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid report id" });
    }
    if (!["pending", "verified", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Use pending, verified, or rejected.",
      });
    }
    if ((status === "verified" || status === "rejected") && !String(reason || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "A reason is required when verifying or rejecting a report.",
      });
    }

    const report = await ScamReport.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const current = report.status;
    if (current === status) {
      return res.json({
        success: true,
        data: { report },
        message: "Status unchanged",
      });
    }

    const allowed = ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${current} to ${status}`,
      });
    }

    const before = {
      id: report.id,
      status: report.status,
      title: report.title,
    };

    report.status = status;
    await report.save();

    const after = {
      id: report.id,
      status: report.status,
      title: report.title,
    };

    const audit = await auditLogService.record({
      adminId: req.adminUser.id,
      action: "report.status_change",
      targetType: "ScamReport",
      targetId: report.id,
      before,
      after,
      reason: reason || null,
      ip: auditLogService.clientIp(req),
    });

    if (!audit) {
      console.error(
        "CRITICAL: report status updated but audit log failed",
        { reportId: report.id, adminId: req.adminUser.id, status }
      );
    }

    return res.json({
      success: true,
      data: { report },
      audit_recorded: !!audit,
    });
  } catch (error) {
    console.error("admin.updateReportStatus:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update report status" });
  }
};

// ── Audit log ──────────────────────────────────────────────────────────
exports.listAuditLog = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.action) {
      where.action = { [Op.like]: `%${String(req.query.action).trim()}%` };
    }
    if (req.query.admin_id) {
      where.admin_id = parseInt(req.query.admin_id, 10);
    }
    if (req.query.target_type) {
      where.target_type = String(req.query.target_type);
    }

    const { rows, count } = await AdminAuditLog.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit) || 1,
        },
      },
    });
  } catch (error) {
    console.error("admin.listAuditLog:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load audit log" });
  }
};

// ── AI / usage (CareerActivity) ────────────────────────────────────────
exports.getAiUsage = async (req, res) => {
  try {
    const sinceDays = parseInt(req.query.days, 10) || 30;
    const data = await adminMetricsService.getAiUsage({ sinceDays });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("admin.getAiUsage:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load AI usage" });
  }
};

// ── Career Sessions / Activity (CareerActivity ledger) ──────────────────
exports.listCareerSessions = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.user_id) where.user_id = parseInt(req.query.user_id, 10);
    if (req.query.status && ["completed", "blocked"].includes(req.query.status)) {
      where.status = req.query.status;
    }
    if (req.query.feature_key) where.feature_key = String(req.query.feature_key);

    const { rows, count } = await CareerActivity.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        activity: rows,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) || 1 },
      },
    });
  } catch (error) {
    console.error("admin.listCareerSessions:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list career sessions" });
  }
};

// ── Opportunity Operations ───────────────────────────────────────────────
exports.getOpportunityOperations = async (req, res) => {
  try {
    const sinceDays = parseInt(req.query.days, 10) || 30;
    const data = await adminMetricsService.getOpportunityOperations({ sinceDays });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("admin.getOpportunityOperations:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load opportunity operations" });
  }
};

exports.listOpportunitySearches = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.user_id) where.user_id = parseInt(req.query.user_id, 10);
    if (req.query.discovery_status) where.discovery_status = String(req.query.discovery_status);
    if (req.query.provider) where.provider = String(req.query.provider);

    const { rows, count } = await OpportunitySearch.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      attributes: [
        "id", "user_id", "role", "location", "remote_preference", "provider",
        "discovery_status", "is_live", "verified_count", "rejected_count", "createdAt",
      ],
    });

    return res.json({
      success: true,
      data: {
        searches: rows,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) || 1 },
      },
    });
  } catch (error) {
    console.error("admin.listOpportunitySearches:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list opportunity searches" });
  }
};

exports.getOpportunitySearchDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: "Invalid search id" });

    const search = await OpportunitySearch.findByPk(id);
    if (!search) return res.status(404).json({ success: false, message: "Search not found" });

    return res.json({ success: true, data: { search } });
  } catch (error) {
    console.error("admin.getOpportunitySearchDetail:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load search" });
  }
};

// ── Interview Operations ─────────────────────────────────────────────────
exports.getInterviewOperations = async (req, res) => {
  try {
    const sinceDays = parseInt(req.query.days, 10) || 30;
    const data = await adminMetricsService.getInterviewOperations({ sinceDays });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("admin.getInterviewOperations:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load interview operations" });
  }
};

exports.listInterviews = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.user_id) where.user_id = parseInt(req.query.user_id, 10);
    if (req.query.status && ["in_progress", "completed"].includes(req.query.status)) {
      where.status = req.query.status;
    }
    if (req.query.mode && ["practice", "timed", "live"].includes(req.query.mode)) {
      where.mode = req.query.mode;
    }

    const { rows, count } = await InterviewSession.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      attributes: [
        "id", "user_id", "role", "company", "difficulty", "interview_type",
        "mode", "status", "question_count", "used_resume", "used_opportunity", "createdAt",
      ],
    });

    return res.json({
      success: true,
      data: {
        interviews: rows,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) || 1 },
      },
    });
  } catch (error) {
    console.error("admin.listInterviews:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list interviews" });
  }
};

exports.getInterviewDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: "Invalid interview id" });

    const interview = await InterviewSession.findByPk(id);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });

    // Report already distinguishes observed vs. not-assessed (existing
    // generateInterviewReport contract) — passed through as-is, never
    // re-derived or supplemented here.
    return res.json({ success: true, data: { interview } });
  } catch (error) {
    console.error("admin.getInterviewDetail:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load interview" });
  }
};

// ── Resume Operations ────────────────────────────────────────────────────
exports.getResumeOperations = async (req, res) => {
  try {
    const sinceDays = parseInt(req.query.days, 10) || 30;
    const data = await adminMetricsService.getResumeOperations({ sinceDays });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("admin.getResumeOperations:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load resume operations" });
  }
};

exports.listResumes = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.user_id) where.user_id = parseInt(req.query.user_id, 10);
    if (req.query.source && ["builder", "review"].includes(req.query.source)) {
      where.source = req.query.source;
    }

    // List view deliberately excludes analysis/resume_data (full content) —
    // privacy guidance in the task spec, section 10.
    const { rows, count } = await Resume.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      attributes: ["id", "user_id", "source", "role", "ats_score", "original_filename", "createdAt"],
    });

    return res.json({
      success: true,
      data: {
        resumes: rows,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) || 1 },
      },
    });
  } catch (error) {
    console.error("admin.listResumes:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list resumes" });
  }
};

exports.getResumeDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: "Invalid resume id" });

    // Detail view is the only place full analysis is exposed — still
    // admin-only (route is behind auth+admin+adminLimiter) but list views
    // never carry this.
    const resume = await Resume.findByPk(id);
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });

    return res.json({ success: true, data: { resume } });
  } catch (error) {
    console.error("admin.getResumeDetail:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load resume" });
  }
};

// ── Subscriptions (visibility only — no mutations, no new payment logic) ──
exports.getSubscriptionOverview = async (req, res) => {
  try {
    const data = await adminMetricsService.getSubscriptionOverview();
    return res.json({
      success: true,
      data: {
        ...data,
        // Zero-cost MVP: surfaced so the admin UI can show a clear
        // "Payments disabled" state instead of implying real billing exists.
        payments_enabled: isPaymentsEnabled(),
      },
    });
  } catch (error) {
    console.error("admin.getSubscriptionOverview:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load subscriptions" });
  }
};

exports.listPaymentTransactions = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};
    if (req.query.user_id) where.user_id = parseInt(req.query.user_id, 10);
    if (req.query.status) where.status = String(req.query.status);

    const { rows, count } = await PaymentTransaction.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      attributes: [
        "id", "user_id", "plan_id", "provider", "amount", "currency",
        "status", "interval", "is_development", "createdAt",
      ],
    });

    return res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) || 1 },
        payments_enabled: isPaymentsEnabled(),
      },
    });
  } catch (error) {
    console.error("admin.listPaymentTransactions:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list transactions" });
  }
};

// ── Paid Interest (Zero-cost MVP demand signal) ─────────────────────────
exports.getMembershipInterestOverview = async (req, res) => {
  try {
    const data = await membershipInterestService.getOverview();
    return res.json({ success: true, data: { ...data, payments_enabled: isPaymentsEnabled() } });
  } catch (error) {
    console.error("admin.getMembershipInterestOverview:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load paid-interest overview" });
  }
};

exports.listMembershipInterests = async (req, res) => {
  try {
    const { page, limit, plan_id: planId, status } = req.query;
    const data = await membershipInterestService.listAll({ page, limit, planId, status });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("admin.listMembershipInterests:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to list paid-interest requests",
    });
  }
};

exports.updateMembershipInterestStatus = async (req, res) => {
  try {
    const { status, reason } = req.body || {};
    const updated = await membershipInterestService.updateStatus({
      id: req.params.id,
      status,
      adminId: req.adminUser.id,
      ip: auditLogService.clientIp(req),
      reason,
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("admin.updateMembershipInterestStatus:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to update paid-interest request",
    });
  }
};

// ── Feature Flags ─────────────────────────────────────────────────────────
exports.listFeatureFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.findAll({ order: [["key", "ASC"]] });
    return res.json({ success: true, data: { flags } });
  } catch (error) {
    console.error("admin.listFeatureFlags:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list feature flags" });
  }
};

exports.createFeatureFlag = async (req, res) => {
  try {
    const { key, description, enabled, scope } = req.body || {};
    const cleanKey = String(key || "").trim();
    if (!cleanKey || !/^[a-z0-9_.-]+$/i.test(cleanKey)) {
      return res.status(400).json({ success: false, message: "A valid flag key is required (letters, numbers, _ . -)." });
    }

    const existing = await FeatureFlag.findOne({ where: { key: cleanKey } });
    if (existing) return res.status(409).json({ success: false, message: "A flag with this key already exists." });

    const flag = await FeatureFlag.create({
      key: cleanKey,
      description: description ? String(description).slice(0, 500) : null,
      enabled: !!enabled,
      scope: scope ? String(scope).slice(0, 100) : null,
      updated_by: req.adminUser.id,
    });

    await auditLogService.record({
      adminId: req.adminUser.id,
      action: "feature_flag.created",
      targetType: "FeatureFlag",
      targetId: flag.id,
      after: flag.toJSON(),
      ip: auditLogService.clientIp(req),
    });

    return res.status(201).json({ success: true, data: { flag } });
  } catch (error) {
    console.error("admin.createFeatureFlag:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create feature flag" });
  }
};

exports.updateFeatureFlag = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { enabled, description, scope, reason } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "Invalid flag id" });

    const flag = await FeatureFlag.findByPk(id);
    if (!flag) return res.status(404).json({ success: false, message: "Feature flag not found" });

    const before = flag.toJSON();

    if (typeof enabled === "boolean") flag.enabled = enabled;
    if (description !== undefined) flag.description = description ? String(description).slice(0, 500) : null;
    if (scope !== undefined) flag.scope = scope ? String(scope).slice(0, 100) : null;
    flag.updated_by = req.adminUser.id;
    await flag.save();

    const audit = await auditLogService.record({
      adminId: req.adminUser.id,
      action: "feature_flag.updated",
      targetType: "FeatureFlag",
      targetId: flag.id,
      before,
      after: flag.toJSON(),
      reason: reason || null,
      ip: auditLogService.clientIp(req),
    });

    return res.json({ success: true, data: { flag }, audit_recorded: !!audit });
  } catch (error) {
    console.error("admin.updateFeatureFlag:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update feature flag" });
  }
};

// ── Announcements ──────────────────────────────────────────────────────────
exports.listAnnouncements = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};
    if (req.query.active === "true") where.active = true;
    if (req.query.active === "false") where.active = false;

    const { rows, count } = await Announcement.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        announcements: rows,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) || 1 },
      },
    });
  } catch (error) {
    console.error("admin.listAnnouncements:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list announcements" });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, active, starts_at, ends_at } = req.body || {};
    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();
    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({ success: false, message: "Title and message are required." });
    }

    const announcement = await Announcement.create({
      title: cleanTitle.slice(0, 191),
      message: cleanMessage.slice(0, 5000),
      active: !!active,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      created_by: req.adminUser.id,
      updated_by: req.adminUser.id,
    });

    await auditLogService.record({
      adminId: req.adminUser.id,
      action: "announcement.created",
      targetType: "Announcement",
      targetId: announcement.id,
      after: announcement.toJSON(),
      ip: auditLogService.clientIp(req),
    });

    return res.status(201).json({ success: true, data: { announcement } });
  } catch (error) {
    console.error("admin.createAnnouncement:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create announcement" });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, message, active, starts_at, ends_at, reason } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "Invalid announcement id" });

    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found" });

    const before = announcement.toJSON();

    if (title !== undefined) announcement.title = String(title).trim().slice(0, 191);
    if (message !== undefined) announcement.message = String(message).trim().slice(0, 5000);
    if (typeof active === "boolean") announcement.active = active;
    if (starts_at !== undefined) announcement.starts_at = starts_at || null;
    if (ends_at !== undefined) announcement.ends_at = ends_at || null;
    announcement.updated_by = req.adminUser.id;
    await announcement.save();

    const audit = await auditLogService.record({
      adminId: req.adminUser.id,
      action: "announcement.updated",
      targetType: "Announcement",
      targetId: announcement.id,
      before,
      after: announcement.toJSON(),
      reason: reason || null,
      ip: auditLogService.clientIp(req),
    });

    return res.json({ success: true, data: { announcement }, audit_recorded: !!audit });
  } catch (error) {
    console.error("admin.updateAnnouncement:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update announcement" });
  }
};
