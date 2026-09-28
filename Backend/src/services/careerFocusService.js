/**
 * Career Focus service (product-spec sections 26-30, 36).
 *
 * Server-side authority for:
 *   - how many ACTIVE Career Focuses a user's membership allows
 *     (Starter/Go: 1, Pro: unlimited — see careerConfig.js#getCareerFocusLimit)
 *   - which focus is "current" when a request doesn't explicitly name one
 *   - fetching a focus's context for Opportunity/Resume/Interview to use
 *
 * This is enforced HERE, not just in the UI (product-spec section 30:
 * "not just a UI dropdown") — createFocus()/activateFocus() both re-check
 * the limit against the user's CURRENT membership every time, so a
 * downgraded Pro user can't keep creating new focuses past their new
 * tier's limit even if their client-side UI is stale/tampered with.
 */

const { Op } = require("sequelize");
const CareerFocus = require("../models/CareerFocus");
const { getCareerFocusLimit } = require("../config/careerConfig");

async function countActive(userId, excludeId = null) {
  const where = { user_id: userId, is_active: true };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return CareerFocus.count({ where });
}

function limitFor(user) {
  return getCareerFocusLimit(user?.membership);
}

async function listFocuses(userId) {
  return CareerFocus.findAll({
    where: { user_id: userId },
    order: [["is_active", "DESC"], ["last_used_at", "DESC"], ["createdAt", "DESC"]],
  });
}

// The focus that should be used when a request doesn't explicitly pass
// career_focus_id — the most-recently-used ACTIVE focus. Returns null if
// the user has none yet (callers must handle "no focus" gracefully —
// Career Focus is additive context, not a hard requirement to use
// Opportunity/Resume/Interview at all).
async function getActiveFocus(userId) {
  if (!userId) return null;
  return CareerFocus.findOne({
    where: { user_id: userId, is_active: true },
    order: [["last_used_at", "DESC"], ["createdAt", "DESC"]],
  });
}

// Resolves the focus a request should use: an explicitly-passed
// career_focus_id (validated to belong to this user) takes priority;
// otherwise falls back to getActiveFocus(). Never throws for a missing/
// invalid id — worst case, behaves as if no focus was specified, since a
// Career Focus is context that enriches a request, never a gate on it.
async function resolveFocusForRequest(userId, requestedFocusId) {
  if (!userId) return null;
  if (requestedFocusId) {
    const focus = await CareerFocus.findOne({ where: { id: requestedFocusId, user_id: userId } });
    if (focus) return focus;
  }
  return getActiveFocus(userId);
}

async function touchLastUsed(focus) {
  if (!focus) return;
  focus.last_used_at = new Date();
  await focus.save();
}

/**
 * Create a new Career Focus. Enforces the membership's active-focus limit
 * server-side — this is the actual gate, not just what the UI shows.
 */
async function createFocus(user, payload = {}) {
  const { name, target_role, skills, location, work_mode, experience_level } = payload;
  if (!name || !String(name).trim()) {
    return { ok: false, reason: "name_required" };
  }

  const limit = limitFor(user);
  if (limit !== null) {
    const activeCount = await countActive(user.id);
    if (activeCount >= limit) {
      return {
        ok: false,
        reason: "focus_limit_reached",
        limit,
        message:
          limit === 1
            ? "Your plan supports 1 active Career Focus. Upgrade to Career Pro for multiple Career Focuses, or archive your current focus first."
            : `Your plan supports up to ${limit} active Career Focuses. Upgrade to Career Pro for unlimited, or archive an existing one first.`,
      };
    }
  }

  const focus = await CareerFocus.create({
    user_id: user.id,
    name: String(name).trim(),
    target_role: target_role || null,
    skills: Array.isArray(skills) ? skills : [],
    location: location || null,
    work_mode: work_mode || "any",
    experience_level: experience_level || null,
    is_active: true,
    last_used_at: new Date(),
  });

  return { ok: true, focus };
}

/**
 * Re-activate an archived focus (or no-op if already active) — subject to
 * the SAME limit check as creating a new one, since re-activating one more
 * focus has the identical effect on the active count.
 */
async function activateFocus(user, focusId) {
  const focus = await CareerFocus.findOne({ where: { id: focusId, user_id: user.id } });
  if (!focus) return { ok: false, reason: "not_found" };
  if (focus.is_active) {
    await touchLastUsed(focus);
    return { ok: true, focus };
  }

  const limit = limitFor(user);
  if (limit !== null) {
    const activeCount = await countActive(user.id, focus.id);
    if (activeCount >= limit) {
      return {
        ok: false,
        reason: "focus_limit_reached",
        limit,
        message:
          limit === 1
            ? "Your plan supports 1 active Career Focus. Upgrade to Career Pro for multiple Career Focuses, or archive your current focus first."
            : `Your plan supports up to ${limit} active Career Focuses. Upgrade to Career Pro for unlimited, or archive an existing one first.`,
      };
    }
  }

  focus.is_active = true;
  focus.last_used_at = new Date();
  await focus.save();
  return { ok: true, focus };
}

async function archiveFocus(user, focusId) {
  const focus = await CareerFocus.findOne({ where: { id: focusId, user_id: user.id } });
  if (!focus) return { ok: false, reason: "not_found" };
  focus.is_active = false;
  await focus.save();
  return { ok: true, focus };
}

async function updateFocus(user, focusId, payload = {}) {
  const focus = await CareerFocus.findOne({ where: { id: focusId, user_id: user.id } });
  if (!focus) return { ok: false, reason: "not_found" };

  const { name, target_role, skills, location, work_mode, experience_level } = payload;
  if (name !== undefined) focus.name = String(name).trim() || focus.name;
  if (target_role !== undefined) focus.target_role = target_role || null;
  if (skills !== undefined) focus.skills = Array.isArray(skills) ? skills : focus.skills;
  if (location !== undefined) focus.location = location || null;
  if (work_mode !== undefined) focus.work_mode = work_mode || "any";
  if (experience_level !== undefined) focus.experience_level = experience_level || null;
  await focus.save();
  return { ok: true, focus };
}

async function deleteFocus(user, focusId) {
  const focus = await CareerFocus.findOne({ where: { id: focusId, user_id: user.id } });
  if (!focus) return { ok: false, reason: "not_found" };
  await focus.destroy();
  return { ok: true };
}

// Small, explainable context object safe to fold into an AI prompt
// (product-spec section 37: "OpenAI should receive the normalized
// relevant context... do not send unrelated career-focus data").
function toPromptContext(focus) {
  if (!focus) return null;
  return {
    name: focus.name,
    target_role: focus.target_role || null,
    skills: Array.isArray(focus.skills) ? focus.skills : [],
    location: focus.location || null,
    work_mode: focus.work_mode || "any",
    experience_level: focus.experience_level || null,
  };
}

module.exports = {
  listFocuses,
  getActiveFocus,
  resolveFocusForRequest,
  touchLastUsed,
  createFocus,
  activateFocus,
  archiveFocus,
  updateFocus,
  deleteFocus,
  toPromptContext,
  limitFor,
  countActive,
};
