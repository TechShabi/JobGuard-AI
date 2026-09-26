// ============================================
// COMMON SCAN MANAGER
// Single source of truth — Backend connect
// karne pe yahi file modify karo
// ============================================

export const SCAN_STORAGE_KEY = "jobguard_scans";

export const PLAN_LIMITS = {
  guest: { url: 1, image: 1, description: 1, global: true },
  free:  { url: 6, image: 6, description: 6 },
  go:    { url: 25, image: 25, description: 25 },
  pro:   { url: Infinity, image: Infinity, description: Infinity },
};

export const PLAN_NAMES = {
  guest: "Guest",
  free: "Free",
  go: "Go Plus",
  pro: "Pro Plus",
};

// ── Storage ──

export function getScanData() {
  try {
    const raw = localStorage.getItem(SCAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveScanData(data) {
  localStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(data));
}

export function todayKey() {
  return new Date().toISOString().split("T")[0];
}

export function midnightTimestamp() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── User Info ──

export function getUserInfo() {
  const d = getScanData();
  return {
    plan: d?.plan || "guest",
    paymentConfirmed: d?.paymentConfirmed || false,
    firstScanDone: d?.firstScanDone || false,
  };
}

// ── Counting ──

export function todayCount(type) {
  const d = getScanData();
  return d?.history?.[todayKey()]?.[type] || 0;
}

function recordScan(type) {
  const d = getScanData() || { plan: "guest", paymentConfirmed: false, history: {} };
  const key = todayKey();
  if (!d.history[key]) d.history[key] = {};
  d.history[key][type] = (d.history[key][type] || 0) + 1;
  saveScanData(d);
}

function markFirstScan() {
  const d = getScanData() || { plan: "guest", history: {} };
  d.firstScanDone = true;
  d.firstScanTime = new Date().toISOString();
  saveScanData(d);
}

// ── Plan Management ──

export function setUserPlan(plan, paymentConfirmed = false) {
  const d = getScanData() || { history: {} };
  d.plan = plan;
  d.paymentConfirmed = paymentConfirmed;
  if (paymentConfirmed) d.paymentTime = new Date().toISOString();
  saveScanData(d);
}

export function clearScanData() {
  localStorage.removeItem(SCAN_STORAGE_KEY);
}

// ── Remaining (for UI) ──

export function getRemainingScans(type) {
  const { plan, paymentConfirmed, firstScanDone } = getUserInfo();
  if (plan === "guest") return firstScanDone ? 0 : 1;
  if ((plan === "go" || plan === "pro") && !paymentConfirmed) return 0;
  const limit = PLAN_LIMITS[plan]?.[type] ?? 0;
  return Math.max(0, limit - todayCount(type));
}

// ── Permission Check ──
// Returns: { allowed, reason, limit }

export function checkScanPermission(type) {
  const { plan, paymentConfirmed, firstScanDone } = getUserInfo();
  const limits = PLAN_LIMITS[plan];

  // Guest: 1 total
  if (plan === "guest") {
    if (firstScanDone) return { allowed: false, reason: "signup", limit: 1 };
    markFirstScan();
    return { allowed: true, reason: "ok", limit: 1 };
  }

  // Go/Pro without payment — shouldn't happen, but safety
  if ((plan === "go" || plan === "pro") && !paymentConfirmed) {
    return { allowed: false, reason: "signup", limit: 0 };
  }

  // Check daily limit
  const limit = limits?.[type] ?? 0;
  if (limit !== Infinity && todayCount(type) >= limit) {
    return { allowed: false, reason: "limit", limit };
  }

  recordScan(type);
  return { allowed: true, reason: "ok", limit };
}

// ── Clean old history ──

export function cleanOldHistory(daysToKeep = 7) {
  const d = getScanData();
  if (!d?.history) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const cutoffKey = cutoff.toISOString().split("T")[0];
  Object.keys(d.history).forEach((key) => {
    if (key < cutoffKey) delete d.history[key];
  });
  saveScanData(d);
}

// ══════════════════════════════════════════
// 🔒 PAYMENT — PLACEHOLDER
// Backend connect hone pe yahi use karo:
//
// export async function initiatePayment(planId) {
//   const res = await fetch("/api/payment/create", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ planId }),
//   });
//   return res.json(); // { sessionId, url }
// }
//
// export async function verifyPayment(sessionId) {
//   const res = await fetch("/api/payment/verify", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ sessionId }),
//   });
//   return res.json(); // { success, planId }
// }
// ══════════════════════════════════════════