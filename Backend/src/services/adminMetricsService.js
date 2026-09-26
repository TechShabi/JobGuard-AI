const { Op, fn, col, literal } = require("sequelize");
const User = require("../models/User");
const ScanHistory = require("../models/ScanHistory");
const ScamReport = require("../models/ScamReport");
const CareerActivity = require("../models/CareerActivity");
const OpportunitySearch = require("../models/OpportunitySearch");
const SavedOpportunity = require("../models/SavedOpportunity");
const Resume = require("../models/Resume");
const InterviewSession = require("../models/InterviewSession");
const Subscription = require("../models/Subscription");

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Dashboard date-range support (Admin Panel Evolution section 4). Accepts
// the same small set of ranges the frontend offers — never an arbitrary
// raw value, so this can't be used to build an unsafe query.
const RANGE_DAYS = { today: 1, "7d": 7, "30d": 30 };
function resolveRangeSince(range) {
  return daysAgo(RANGE_DAYS[range] || RANGE_DAYS["7d"]);
}

/**
 * Dashboard aggregates from real models only — no fabricated numbers.
 * `range` is one of "today" | "7d" | "30d" (default "7d").
 */
async function getDashboardStats({ range = "7d" } = {}) {
  const sinceRange = resolveRangeSince(range);
  const since30 = daysAgo(30);

  const [
    totalUsers,
    newUsersRange,
    newUsers30d,
    totalVerifications,
    verificationsRange,
    totalReports,
    pendingReports,
    verifiedReports,
    rejectedReports,
    opportunitySearches,
    opportunitySearchesRange,
    opportunitySearchesLiveRange,
    savedOpportunities,
    totalResumes,
    totalInterviews,
    interviewsCompletedRange,
    activityCompleted,
    activityBlocked,
    recentPendingReports,
    recentActivity,
    usageByFeature,
  ] = await Promise.all([
    User.count(),
    User.count({ where: { createdAt: { [Op.gte]: sinceRange } } }),
    User.count({ where: { createdAt: { [Op.gte]: since30 } } }),
    ScanHistory.count(),
    ScanHistory.count({ where: { createdAt: { [Op.gte]: sinceRange } } }),
    ScamReport.count(),
    ScamReport.count({ where: { status: "pending" } }),
    ScamReport.count({ where: { status: "verified" } }),
    ScamReport.count({ where: { status: "rejected" } }),
    OpportunitySearch.count(),
    OpportunitySearch.count({ where: { createdAt: { [Op.gte]: sinceRange } } }),
    OpportunitySearch.count({ where: { createdAt: { [Op.gte]: sinceRange }, is_live: true } }),
    SavedOpportunity.count(),
    Resume.count(),
    InterviewSession.count(),
    InterviewSession.count({ where: { createdAt: { [Op.gte]: sinceRange }, status: "completed" } }),
    CareerActivity.count({ where: { status: "completed" } }),
    CareerActivity.count({ where: { status: "blocked" } }),
    ScamReport.findAll({
      where: { status: "pending" },
      order: [["createdAt", "DESC"]],
      limit: 8,
      attributes: ["id", "title", "scam_score", "status", "user_id", "createdAt"],
    }),
    CareerActivity.findAll({
      order: [["createdAt", "DESC"]],
      limit: 12,
      attributes: [
        "id",
        "user_id",
        "feature_key",
        "feature_label",
        "status",
        "session_cost",
        "createdAt",
      ],
    }),
    CareerActivity.findAll({
      attributes: [
        "feature_key",
        "feature_label",
        [fn("COUNT", col("id")), "count"],
        [
          fn(
            "SUM",
            literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")
          ),
          "completed",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN status = 'blocked' THEN 1 ELSE 0 END")
          ),
          "blocked",
        ],
      ],
      group: ["feature_key", "feature_label"],
      order: [[literal("count"), "DESC"]],
      limit: 20,
      raw: true,
    }),
  ]);

  return {
    range,
    users: {
      total: totalUsers,
      new_in_range: newUsersRange,
      new_30d: newUsers30d,
    },
    verifications: {
      total: totalVerifications,
      in_range: verificationsRange,
    },
    reports: {
      total: totalReports,
      pending: pendingReports,
      verified: verifiedReports,
      rejected: rejectedReports,
    },
    opportunity: {
      searches: opportunitySearches,
      searches_in_range: opportunitySearchesRange,
      live_searches_in_range: opportunitySearchesLiveRange,
      saved: savedOpportunities,
    },
    resumes: { total: totalResumes },
    interviews: {
      total: totalInterviews,
      completed_in_range: interviewsCompletedRange,
    },
    usage: {
      completed: activityCompleted,
      blocked: activityBlocked,
      by_feature: usageByFeature.map((r) => ({
        feature_key: r.feature_key,
        feature_label: r.feature_label,
        count: Number(r.count) || 0,
        completed: Number(r.completed) || 0,
        blocked: Number(r.blocked) || 0,
      })),
    },
    attention: {
      pending_reports: recentPendingReports,
      recent_activity: recentActivity,
    },
  };
}

/**
 * AI / usage aggregates from CareerActivity ledger only.
 */
async function getAiUsage({ sinceDays = 30 } = {}) {  const since = daysAgo(Number(sinceDays) || 30);

  const [byFeature, byStatus, recent] = await Promise.all([
    CareerActivity.findAll({
      where: { createdAt: { [Op.gte]: since } },
      attributes: [
        "feature_key",
        "feature_label",
        [fn("COUNT", col("id")), "count"],
        [
          fn(
            "SUM",
            literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")
          ),
          "completed",
        ],
        [
          fn(
            "SUM",
            literal("CASE WHEN status = 'blocked' THEN 1 ELSE 0 END")
          ),
          "blocked",
        ],
        [fn("SUM", col("session_cost")), "sessions"],
      ],
      group: ["feature_key", "feature_label"],
      order: [[literal("count"), "DESC"]],
      raw: true,
    }),
    CareerActivity.findAll({
      where: { createdAt: { [Op.gte]: since } },
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
    CareerActivity.findAll({
      where: { createdAt: { [Op.gte]: since } },
      order: [["createdAt", "DESC"]],
      limit: 50,
      attributes: [
        "id",
        "user_id",
        "feature_key",
        "feature_label",
        "status",
        "session_cost",
        "reason",
        "createdAt",
      ],
    }),
  ]);

  return {
    since_days: Number(sinceDays) || 30,
    by_feature: byFeature.map((r) => ({
      feature_key: r.feature_key,
      feature_label: r.feature_label,
      count: Number(r.count) || 0,
      completed: Number(r.completed) || 0,
      blocked: Number(r.blocked) || 0,
      sessions: Number(r.sessions) || 0,
    })),
    by_status: byStatus.map((r) => ({
      status: r.status,
      count: Number(r.count) || 0,
    })),
    recent,
  };
}

/**
 * Opportunity Operations (Admin Panel Evolution, section 8). Derived
 * entirely from OpportunitySearch rows the controller already persists —
 * no second discovery/verification engine, just aggregation over real data.
 */
async function getOpportunityOperations({ sinceDays = 30 } = {}) {
  const since = daysAgo(Number(sinceDays) || 30);
  const whereRange = { createdAt: { [Op.gte]: since } };

  const [total, byStatus, liveCount, sampleCount, recent, avgCounts] = await Promise.all([
    OpportunitySearch.count({ where: whereRange }),
    OpportunitySearch.findAll({
      where: whereRange,
      attributes: ["discovery_status", [fn("COUNT", col("id")), "count"]],
      group: ["discovery_status"],
      raw: true,
    }),
    OpportunitySearch.count({ where: { ...whereRange, is_live: true } }),
    OpportunitySearch.count({ where: { ...whereRange, discovery_status: "sample" } }),
    OpportunitySearch.findAll({
      where: whereRange,
      order: [["createdAt", "DESC"]],
      limit: 20,
      attributes: [
        "id",
        "user_id",
        "role",
        "location",
        "remote_preference",
        "discovery_status",
        "provider",
        "verified_count",
        "rejected_count",
        "is_live",
        "createdAt",
      ],
    }),
    OpportunitySearch.findOne({
      where: whereRange,
      attributes: [
        [fn("AVG", col("verified_count")), "avg_verified"],
        [fn("AVG", col("rejected_count")), "avg_rejected"],
      ],
      raw: true,
    }),
  ]);

  // Provider-level health can only be derived from providers_used snapshots
  // (JSON column) — pull a bounded recent window and tally in JS rather
  // than a giant table scan. This is a deliberate, documented trade-off:
  // MySQL JSON aggregation across rows is not cheap/portable here, and the
  // dataset this pass needs to summarize is small (recent searches only).
  const recentWithProviders = await OpportunitySearch.findAll({
    where: whereRange,
    attributes: ["providers_used"],
    order: [["createdAt", "DESC"]],
    limit: 500,
    raw: true,
  });
  const providerHealth = {};
  for (const row of recentWithProviders) {
    const list = Array.isArray(row.providers_used) ? row.providers_used : [];
    for (const p of list) {
      if (!p?.id) continue;
      if (!providerHealth[p.id]) {
        providerHealth[p.id] = { provider_id: p.id, searches: 0, successes: 0, failures: 0, results_returned: 0 };
      }
      providerHealth[p.id].searches += 1;
      if (p.is_live) providerHealth[p.id].successes += 1;
      else if (p.note) providerHealth[p.id].failures += 1;
      providerHealth[p.id].results_returned += Number(p.count) || 0;
    }
  }

  return {
    since_days: Number(sinceDays) || 30,
    total_searches: total,
    live_searches: liveCount,
    sample_searches: sampleCount,
    by_discovery_status: byStatus.map((r) => ({
      discovery_status: r.discovery_status || "unknown",
      count: Number(r.count) || 0,
    })),
    avg_verified_per_search: avgCounts?.avg_verified != null ? Number(avgCounts.avg_verified).toFixed(1) : null,
    avg_rejected_per_search: avgCounts?.avg_rejected != null ? Number(avgCounts.avg_rejected).toFixed(1) : null,
    provider_health: Object.values(providerHealth),
    recent_searches: recent,
  };
}

/**
 * Interview Operations (Admin Panel Evolution, section 9). Reads only the
 * existing InterviewSession.report JSON already produced by
 * generateInterviewReport() — never a second scoring system.
 */
async function getInterviewOperations({ sinceDays = 30 } = {}) {
  const since = daysAgo(Number(sinceDays) || 30);
  const whereRange = { createdAt: { [Op.gte]: since } };

  const [total, byStatus, byMode, avgScore, recent] = await Promise.all([
    InterviewSession.count({ where: whereRange }),
    InterviewSession.findAll({
      where: whereRange,
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
    InterviewSession.findAll({
      where: whereRange,
      attributes: ["mode", [fn("COUNT", col("id")), "count"]],
      group: ["mode"],
      raw: true,
    }),
    // JSON_EXTRACT is MySQL syntax (this project uses mysql2) — guarded by
    // status='completed' so we only average sessions that actually have a
    // report. Never fabricates a score for sessions without one.
    InterviewSession.findOne({
      where: { ...whereRange, status: "completed" },
      attributes: [
        [fn("AVG", literal("JSON_EXTRACT(report, '$.overall_score')")), "avg_overall_score"],
      ],
      raw: true,
    }),
    InterviewSession.findAll({
      where: whereRange,
      order: [["createdAt", "DESC"]],
      limit: 20,
      attributes: [
        "id",
        "user_id",
        "role",
        "company",
        "difficulty",
        "interview_type",
        "mode",
        "status",
        "question_count",
        "used_resume",
        "used_opportunity",
        "createdAt",
      ],
    }),
  ]);

  return {
    since_days: Number(sinceDays) || 30,
    total_sessions: total,
    by_status: byStatus.map((r) => ({ status: r.status, count: Number(r.count) || 0 })),
    by_mode: byMode.map((r) => ({ mode: r.mode || "practice", count: Number(r.count) || 0 })),
    avg_overall_score:
      avgScore?.avg_overall_score != null ? Number(avgScore.avg_overall_score).toFixed(1) : null,
    recent_sessions: recent,
  };
}

/**
 * Resume Operations (Admin Panel Evolution, section 10). List-level query
 * excludes full analysis/resume_data content per the section's privacy
 * guidance — only metadata needed to understand processing health.
 */
async function getResumeOperations({ sinceDays = 30 } = {}) {
  const since = daysAgo(Number(sinceDays) || 30);
  const whereRange = { createdAt: { [Op.gte]: since } };

  const [total, bySource, avgAts, missingAnalysis, recent] = await Promise.all([
    Resume.count({ where: whereRange }),
    Resume.findAll({
      where: whereRange,
      attributes: ["source", [fn("COUNT", col("id")), "count"]],
      group: ["source"],
      raw: true,
    }),
    Resume.findOne({
      where: { ...whereRange, ats_score: { [Op.ne]: null } },
      attributes: [[fn("AVG", col("ats_score")), "avg_ats"]],
      raw: true,
    }),
    Resume.count({ where: { ...whereRange, analysis: null } }),
    Resume.findAll({
      where: whereRange,
      order: [["createdAt", "DESC"]],
      limit: 20,
      attributes: ["id", "user_id", "source", "role", "ats_score", "original_filename", "createdAt"],
    }),
  ]);

  return {
    since_days: Number(sinceDays) || 30,
    total_resumes: total,
    by_source: bySource.map((r) => ({ source: r.source, count: Number(r.count) || 0 })),
    avg_ats_score: avgAts?.avg_ats != null ? Number(avgAts.avg_ats).toFixed(1) : null,
    missing_analysis_count: missingAnalysis,
    recent_resumes: recent,
  };
}

/**
 * Subscription visibility only (Admin Panel Evolution, section 12) — no
 * mutations, no new payment providers, just real aggregate + recent rows
 * from the existing Subscription model.
 */
async function getSubscriptionOverview() {
  const [byStatus, byPlan, recent] = await Promise.all([
    Subscription.findAll({
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
    Subscription.findAll({
      attributes: ["plan_id", [fn("COUNT", col("id")), "count"]],
      group: ["plan_id"],
      raw: true,
    }),
    Subscription.findAll({
      order: [["updatedAt", "DESC"]],
      limit: 30,
      attributes: [
        "id",
        "user_id",
        "plan_id",
        "status",
        "interval",
        "current_period_start",
        "current_period_end",
        "cancel_at_period_end",
        "provider",
        "pending_plan_id",
        "updatedAt",
      ],
    }),
  ]);

  return {
    by_status: byStatus.map((r) => ({ status: r.status, count: Number(r.count) || 0 })),
    by_plan: byPlan.map((r) => ({ plan_id: r.plan_id, count: Number(r.count) || 0 })),
    recent,
  };
}

module.exports = {
  getDashboardStats,
  getAiUsage,
  getOpportunityOperations,
  getInterviewOperations,
  getResumeOperations,
  getSubscriptionOverview,
};
