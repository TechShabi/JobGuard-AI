/**
 * Minimal in-memory TTL cache — deliberately not a new framework/library.
 * Exists purely so free/public job-discovery providers (Jobicy, Himalayas,
 * Remotive) are never hit more often than their own published guidance
 * allows (e.g. Jobicy: "do not poll more frequently than once per hour";
 * Remotive: "max 4 times a day"; Himalayas: "refreshed every 24 hours, no
 * benefit polling more than once per day").
 *
 * Process-local only (resets on restart, not shared across instances) —
 * fine for this MVP's request-deduplication purpose. If the app later runs
 * multiple instances behind a load balancer, this should move to a shared
 * store (Redis etc.), but that's a real infra decision, not something to
 * silently introduce here.
 */

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Wraps an async producer so concurrent/near-in-time calls for the same
 * key share one cached result instead of each firing a fresh provider
 * request (request de-duplication, not just time-based caching).
 */
async function getOrSet(key, ttlMs, producer) {
  const cached = get(key);
  if (cached !== undefined) return cached;
  const value = await producer();
  set(key, value, ttlMs);
  return value;
}

module.exports = { get, set, getOrSet, clear: () => store.clear() };
