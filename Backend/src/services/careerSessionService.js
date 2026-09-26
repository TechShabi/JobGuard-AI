const {
  MEMBERSHIP_IDS,
  getMembership,
  getFeature,
  isMembershipAtLeast,
  buildUpgradeMessage,
  buildSessionsExhaustedMessage,
} = require("../config/careerConfig");
const CareerActivity = require("../models/CareerActivity");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Reset a member's Career Session pool if their monthly cycle has rolled
// over. This is the ONLY place cycle math happens — every route reuses it
// instead of re-implementing usage tracking.
async function ensureCycle(user) {
  const membership = getMembership(user.membership);
  const cycleStart = user.sessions_cycle_start
    ? new Date(user.sessions_cycle_start)
    : new Date();
  const cycleMs = membership.cycleDays * MS_PER_DAY;
  const elapsed = Date.now() - cycleStart.getTime();

  if (elapsed >= cycleMs) {
    user.sessions_used = 0;
    user.sessions_cycle_start = new Date();
    await user.save();
  }
  return user;
}

function getStatus(user) {
  const membership = getMembership(user.membership);
  const unlimited = membership.sessionsPerCycle === null;
  const sessionsLimit = unlimited ? null : membership.sessionsPerCycle;
  const sessionsRemaining = unlimited
    ? null
    : Math.max(0, membership.sessionsPerCycle - user.sessions_used);
  const cycleResetAt = new Date(
    new Date(user.sessions_cycle_start).getTime() +
      membership.cycleDays * MS_PER_DAY
  );

  return {
    membership: membership.id,
    membershipName: membership.name,
    sessionsUsed: user.sessions_used,
    sessionsLimit, // null => unlimited
    sessionsRemaining, // null => unlimited
    unlimited,
    cycleResetAt,
  };
}

// Core permission check for a logged-in member. Every AI route asks this
// shared function before executing — no feature re-implements its own
// usage/permission logic.
function checkAccess(user, featureKey) {
  const feature = getFeature(featureKey);
  if (!feature) {
    return { allowed: false, reason: "unknown_feature" };
  }

  if (!isMembershipAtLeast(user.membership, feature.minMembership)) {
    return {
      allowed: false,
      reason: "membership_required",
      feature,
      requiredMembership: feature.minMembership,
      message: buildUpgradeMessage(featureKey, feature.minMembership),
      status: getStatus(user),
    };
  }

  const status = getStatus(user);
  if (!status.unlimited && status.sessionsRemaining < feature.sessionCost) {
    return {
      allowed: false,
      reason: "sessions_exhausted",
      feature,
      requiredMembership: feature.minMembership,
      message: buildSessionsExhaustedMessage(user.membership),
      status,
    };
  }

  return { allowed: true, reason: "ok", feature, status };
}

// Guests never have a persisted session pool — they get the product's
// existing one-time free trial (tracked client-side) or nothing at all,
// governed purely by the feature's guestAccess rule.
function checkGuestAccess(featureKey) {
  const feature = getFeature(featureKey);
  if (!feature) return { allowed: false, reason: "unknown_feature" };

  if (feature.guestAccess === "none") {
    return {
      allowed: false,
      reason: "membership_required",
      feature,
      requiredMembership: feature.minMembership,
      message: {
        title: `Unlock ${feature.label}`,
        body: `Create a free Career Starter account to access ${feature.label}.`,
        cta: "Create Free Account",
      },
    };
  }

  return { allowed: true, reason: "ok", feature };
}

// Called once a feature has actually completed successfully. Deducts the
// session cost and writes a single activity-log entry. Never called on
// failed AI calls, so users are never charged for errors.
async function consumeSession(user, featureKey, { status = "completed" } = {}) {
  const feature = getFeature(featureKey);
  if (!feature) return getStatus(user);

  const membership = getMembership(user.membership);
  const unlimited = membership.sessionsPerCycle === null;

  if (status === "completed" && !unlimited) {
    user.sessions_used += feature.sessionCost;
    await user.save();
  }

  await CareerActivity.create({
    user_id: user.id,
    feature_key: feature.key,
    feature_label: feature.label,
    session_cost: status === "completed" ? feature.sessionCost : 0,
    status,
  });

  return getStatus(user);
}

// Full permissions map for every feature — used by the Career Growth
// Profile and the Pricing page so the UI never hardcodes what's allowed.
function getPermissionsMap(user) {
  const { FEATURES } = require("../config/careerConfig");
  const map = {};
  Object.values(FEATURES).forEach((feature) => {
    if (!user) {
      const guest = checkGuestAccess(feature.key);
      map[feature.key] = {
        label: feature.label,
        allowed: guest.allowed,
        requiredMembership: feature.minMembership,
        sessionCost: feature.sessionCost,
        comingSoon: !!feature.comingSoon,
      };
      return;
    }
    const access = checkAccess(user, feature.key);
    map[feature.key] = {
      label: feature.label,
      allowed: access.allowed,
      requiredMembership: feature.minMembership,
      sessionCost: feature.sessionCost,
      comingSoon: !!feature.comingSoon,
    };
  });
  return map;
}

module.exports = {
  ensureCycle,
  getStatus,
  checkAccess,
  checkGuestAccess,
  consumeSession,
  getPermissionsMap,
  MEMBERSHIP_IDS,
};
