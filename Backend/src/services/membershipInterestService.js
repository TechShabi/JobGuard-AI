const { fn, col } = require("sequelize");
const MembershipInterest = require("../models/MembershipInterest");
const CareerActivity = require("../models/CareerActivity");
const { MEMBERSHIPS, getMembership } = require("../config/careerConfig");
const subscriptionService = require("../services/subscriptionService");
const auditLogService = require("./auditLogService");

const VALID_STATUSES = new Set(["requested", "contacted", "converted", "cancelled"]);

function serialize(row) {
  if (!row) return null;
  const j = row.toJSON ? row.toJSON() : row;
  return {
    id: j.id,
    user_id: j.user_id,
    plan_id: j.plan_id,
    plan_name: getMembership(j.plan_id).name,
    status: j.status,
    source: j.source,
    requested_at: j.requested_at,
    updated_at: j.updatedAt,
    metadata: j.metadata || null,
  };
}

/**
 * Record (or reactivate) a user's interest in a paid plan.
 * NEVER touches Subscription / PaymentTransaction / User.membership.
 */
async function requestInterest({ userId, planId, source = "pricing_page", metadata = null }) {
  const plan = subscriptionService.normalizePlanId(planId);

  if (!MEMBERSHIPS[plan]) {
    const err = new Error("Invalid plan");
    err.status = 400;
    throw err;
  }
  if (!subscriptionService.isPaidPlan(plan)) {
    const err = new Error(
      "Career Starter is free — no early-access request is needed. Use the membership upgrade endpoint instead."
    );
    err.status = 400;
    throw err;
  }

  const existing = await MembershipInterest.findOne({
    where: { user_id: userId, plan_id: plan },
  });

  if (existing) {
    if (existing.status === "requested" || existing.status === "contacted") {
      return {
        created: false,
        duplicate: true,
        interest: serialize(existing),
        message: `You're already on the ${getMembership(plan).name} early-access list.`,
      };
    }

    // "converted" (they already got it some other way) or "cancelled" —
    // safe to reactivate as a fresh request rather than insert a 2nd row.
    existing.status = "requested";
    existing.source = String(source || "pricing_page").slice(0, 100);
    existing.requested_at = new Date();
    existing.metadata = metadata || existing.metadata;
    await existing.save();

    await CareerActivity.create({
      user_id: userId,
      feature_key: "membership_interest",
      feature_label: `Requested early access — ${getMembership(plan).name}`,
      session_cost: 0,
      status: "completed",
    });

    return {
      created: false,
      duplicate: false,
      reactivated: true,
      interest: serialize(existing),
      message: `You're on the early-access list for ${getMembership(plan).name}.`,
    };
  }

  const row = await MembershipInterest.create({
    user_id: userId,
    plan_id: plan,
    status: "requested",
    source: String(source || "pricing_page").slice(0, 100),
    requested_at: new Date(),
    metadata: metadata || null,
  });

  await CareerActivity.create({
    user_id: userId,
    feature_key: "membership_interest",
    feature_label: `Requested early access — ${getMembership(plan).name}`,
    session_cost: 0,
    status: "completed",
  });

  return {
    created: true,
    duplicate: false,
    interest: serialize(row),
    message: `You're on the early-access list for ${getMembership(plan).name}.`,
  };
}

/** Own-records only — never exposes another user's interest. */
async function listMine(userId) {
  const rows = await MembershipInterest.findAll({
    where: { user_id: userId },
    order: [["updatedAt", "DESC"]],
  });
  return rows.map(serialize);
}

async function listAll({ page = 1, limit = 20, planId, status } = {}) {
  const where = {};
  if (planId) where.plan_id = subscriptionService.normalizePlanId(planId);
  if (status) {
    if (!VALID_STATUSES.has(status)) {
      const err = new Error("Invalid status filter");
      err.status = 400;
      throw err;
    }
    where.status = status;
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const { rows, count } = await MembershipInterest.findAndCountAll({
    where,
    order: [["updatedAt", "DESC"]],
    limit: safeLimit,
    offset,
  });

  return {
    requests: rows.map(serialize),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count,
      pages: Math.ceil(count / safeLimit) || 1,
    },
  };
}

async function getOverview() {
  const [byStatus, byPlan, recent, total] = await Promise.all([
    MembershipInterest.findAll({
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
    MembershipInterest.findAll({
      attributes: ["plan_id", [fn("COUNT", col("id")), "count"]],
      group: ["plan_id"],
      raw: true,
    }),
    MembershipInterest.findAll({
      order: [["updatedAt", "DESC"]],
      limit: 20,
    }),
    MembershipInterest.count(),
  ]);

  return {
    total_requests: total,
    by_status: byStatus.map((r) => ({ status: r.status, count: Number(r.count) || 0 })),
    by_plan: byPlan.map((r) => ({
      plan_id: r.plan_id,
      plan_name: getMembership(r.plan_id).name,
      count: Number(r.count) || 0,
    })),
    recent: recent.map(serialize),
  };
}

/**
 * Admin-only status transition (requested → contacted → converted, or
 * cancelled at any point). Never activates membership/subscription —
 * conversion, if it happens, still goes through real checkout once a
 * payment provider is live.
 */
async function updateStatus({ id, status, adminId, ip, reason }) {
  if (!VALID_STATUSES.has(status)) {
    const err = new Error("Invalid status");
    err.status = 400;
    throw err;
  }

  const row = await MembershipInterest.findByPk(id);
  if (!row) {
    const err = new Error("Membership interest request not found");
    err.status = 404;
    throw err;
  }

  const before = { status: row.status };
  row.status = status;
  await row.save();

  await auditLogService.record({
    adminId,
    action: "membership_interest.status_updated",
    targetType: "MembershipInterest",
    targetId: row.id,
    before,
    after: { status: row.status },
    reason: reason || null,
    ip,
  });

  return serialize(row);
}

module.exports = {
  requestInterest,
  listMine,
  listAll,
  getOverview,
  updateStatus,
  serialize,
};
