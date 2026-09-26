const AdminAuditLog = require("../models/AdminAuditLog");

/**
 * Central write path for Admin audit events.
 * Controllers must NOT call AdminAuditLog.create() directly.
 *
 * Returns the created row on success, or null if recording failed.
 * Callers of sensitive mutations should decide how to surface audit failure;
 * this service never throws to the client path — it logs and returns null.
 */
async function record({
  adminId,
  action,
  targetType = null,
  targetId = null,
  before = null,
  after = null,
  reason = null,
  ip = null,
}) {
  if (!adminId || !action) {
    console.error("auditLogService.record: adminId and action are required");
    return null;
  }

  try {
    const row = await AdminAuditLog.create({
      admin_id: adminId,
      action: String(action).slice(0, 191),
      target_type: targetType ? String(targetType).slice(0, 191) : null,
      target_id: targetId != null ? String(targetId).slice(0, 191) : null,
      before: sanitizePayload(before),
      after: sanitizePayload(after),
      reason: reason ? String(reason).slice(0, 2000) : null,
      ip: ip ? String(ip).slice(0, 64) : null,
    });
    return row;
  } catch (error) {
    console.error("auditLogService.record failed:", error.message);
    return null;
  }
}

/** Strip secrets from before/after snapshots before persistence. */
function sanitizePayload(payload) {
  if (payload == null) return null;
  if (typeof payload !== "object") return payload;

  const SENSITIVE = [
    "password",
    "token",
    "jwt",
    "secret",
    "api_key",
    "apikey",
    "authorization",
    "refresh_token",
  ];

  try {
    const clone = JSON.parse(JSON.stringify(payload));
    stripSensitive(clone, SENSITIVE);
    return clone;
  } catch {
    return null;
  }
}

function stripSensitive(obj, keys) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => stripSensitive(item, keys));
    return;
  }
  for (const k of Object.keys(obj)) {
    if (keys.some((s) => k.toLowerCase().includes(s))) {
      obj[k] = "[redacted]";
    } else if (typeof obj[k] === "object") {
      stripSensitive(obj[k], keys);
    }
  }
}

function clientIp(req) {
  if (!req) return null;
  const xf = req.headers?.["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

module.exports = {
  record,
  clientIp,
  sanitizePayload,
};
