/**
 * Membership + Payments Evolution — paid-interest validation tests.
 *
 * Same technique as tests/admin-authorization.test.js: inject lightweight
 * fake models/services into require.cache for the exact dependencies
 * membershipInterestService.js imports, and run the real source file
 * unmodified against them. No DB required.
 *
 * Run with: node tests/membership-interest.test.js
 */
const assert = require("assert");
const path = require("path");
const Module = require("module");

const SRC = path.join(__dirname, "..", "src");

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.stack || err.message}`);
    failed++;
  }
}

function injectFakeModule(fromFile, relativePath, fakeExports) {
  const resolved = require.resolve(relativePath, { paths: [path.dirname(fromFile)] });
  require.cache[resolved] = new Module(resolved, null);
  require.cache[resolved].exports = fakeExports;
  require.cache[resolved].loaded = true;
  return resolved;
}

function clearModuleCache(fromFile, relativePath) {
  const resolved = require.resolve(relativePath, { paths: [path.dirname(fromFile)] });
  delete require.cache[resolved];
}

async function run() {
  console.log("services/membershipInterestService.js");

  const servicePath = path.join(SRC, "services", "membershipInterestService.js");

  function freshService({ interestModel, careerActivityModel, subscriptionSvc, auditSvc }) {
    injectFakeModule(servicePath, "../models/MembershipInterest", interestModel);
    injectFakeModule(servicePath, "../models/CareerActivity", careerActivityModel || {
      create: async () => ({}),
    });
    injectFakeModule(servicePath, "../services/subscriptionService", subscriptionSvc || {
      normalizePlanId: (id) => (String(id || "").toLowerCase() === "go" ? "plus" : String(id || "").toLowerCase()),
      isPaidPlan: (id) => ["plus", "pro"].includes(id),
    });
    injectFakeModule(servicePath, "./auditLogService", auditSvc || { record: async () => ({}) });
    delete require.cache[require.resolve(servicePath)];
    return require(servicePath);
  }

  function clearAll() {
    clearModuleCache(servicePath, "../models/MembershipInterest");
    clearModuleCache(servicePath, "../models/CareerActivity");
    clearModuleCache(servicePath, "../services/subscriptionService");
    clearModuleCache(servicePath, "./auditLogService");
    delete require.cache[require.resolve(servicePath)];
  }

  // ── requestInterest ──────────────────────────────────────────────────
  await test("rejects an unknown plan id", async () => {
    const svc = freshService({
      interestModel: { findOne: async () => { throw new Error("should not query DB"); } },
    });
    await assert.rejects(
      () => svc.requestInterest({ userId: 1, planId: "not_a_plan" }),
      (err) => err.status === 400
    );
  });

  await test("rejects requesting interest in the free Starter plan", async () => {
    const svc = freshService({
      interestModel: { findOne: async () => { throw new Error("should not query DB"); } },
    });
    await assert.rejects(
      () => svc.requestInterest({ userId: 1, planId: "starter" }),
      (err) => err.status === 400
    );
  });

  await test("creates a new interest record for a first-time paid-plan request", async () => {
    let created = null;
    let activityLogged = null;
    const svc = freshService({
      interestModel: {
        findOne: async () => null,
        create: async (data) => {
          created = data;
          return { ...data, id: 1, toJSON: () => ({ ...data, id: 1, updatedAt: new Date() }) };
        },
      },
      careerActivityModel: { create: async (data) => { activityLogged = data; return {}; } },
    });

    const result = await svc.requestInterest({ userId: 42, planId: "plus", source: "pricing_page" });

    assert.strictEqual(result.created, true);
    assert.strictEqual(result.duplicate, false);
    assert.strictEqual(created.user_id, 42);
    assert.strictEqual(created.plan_id, "plus");
    assert.strictEqual(created.status, "requested");
    assert.ok(activityLogged, "must log a CareerActivity entry for the user's own activity feed");
    assert.strictEqual(activityLogged.session_cost, 0, "an interest request must never cost a Career Session");
  });

  await test('normalizes the "go" alias to "plus" before storing', async () => {
    let created = null;
    const svc = freshService({
      interestModel: {
        findOne: async () => null,
        create: async (data) => { created = data; return { ...data, id: 2, toJSON: () => ({ ...data, id: 2 }) }; },
      },
    });
    await svc.requestInterest({ userId: 1, planId: "go" });
    assert.strictEqual(created.plan_id, "plus");
  });

  await test("does NOT create a duplicate row when a request is already pending — returns a clear message instead", async () => {
    let createCalled = false;
    const existing = {
      status: "requested",
      toJSON: () => ({ id: 5, user_id: 1, plan_id: "plus", status: "requested", updatedAt: new Date() }),
    };
    const svc = freshService({
      interestModel: {
        findOne: async () => existing,
        create: async () => { createCalled = true; return {}; },
      },
    });

    const result = await svc.requestInterest({ userId: 1, planId: "plus" });
    assert.strictEqual(result.duplicate, true);
    assert.strictEqual(createCalled, false);
    assert.match(result.message, /already/i);
  });

  await test('treats "contacted" the same as "requested" for duplicate prevention', async () => {
    let createCalled = false;
    const existing = {
      status: "contacted",
      toJSON: () => ({ id: 6, user_id: 1, plan_id: "pro", status: "contacted" }),
    };
    const svc = freshService({
      interestModel: {
        findOne: async () => existing,
        create: async () => { createCalled = true; return {}; },
      },
    });
    const result = await svc.requestInterest({ userId: 1, planId: "pro" });
    assert.strictEqual(result.duplicate, true);
    assert.strictEqual(createCalled, false);
  });

  await test("reactivates a previously cancelled request instead of inserting a second row", async () => {
    let createCalled = false;
    let saved = false;
    const existing = {
      status: "cancelled",
      source: "old_source",
      metadata: null,
      save: async function () { saved = true; },
      toJSON: () => ({ id: 7, user_id: 1, plan_id: "plus", status: "requested" }),
    };
    const svc = freshService({
      interestModel: {
        findOne: async () => existing,
        create: async () => { createCalled = true; return {}; },
      },
    });
    const result = await svc.requestInterest({ userId: 1, planId: "plus", source: "upgrade_modal" });
    assert.strictEqual(createCalled, false, "must not create a second row for the same user+plan");
    assert.strictEqual(saved, true);
    assert.strictEqual(existing.status, "requested");
    assert.strictEqual(result.duplicate, false);
  });

  await test("never touches subscription/payment state — result contains no subscription/payment fields", async () => {
    const svc = freshService({
      interestModel: {
        findOne: async () => null,
        create: async (data) => ({ ...data, id: 9, toJSON: () => ({ ...data, id: 9 }) }),
      },
    });
    const result = await svc.requestInterest({ userId: 1, planId: "pro" });
    assert.ok(!("subscription" in result));
    assert.ok(!("membership" in result));
    assert.ok(!("payment" in result));
  });

  // ── listMine — ownership ─────────────────────────────────────────────
  await test("listMine only ever queries by the given user_id — cannot leak another user's requests", async () => {
    let queriedWhere = null;
    const svc = freshService({
      interestModel: {
        findAll: async ({ where }) => {
          queriedWhere = where;
          return [];
        },
      },
    });
    await svc.listMine(77);
    assert.deepStrictEqual(queriedWhere, { user_id: 77 });
  });

  // ── updateStatus — admin transitions ─────────────────────────────────
  await test("updateStatus rejects an invalid status value without touching the DB", async () => {
    const svc = freshService({
      interestModel: { findByPk: async () => { throw new Error("should not be reached"); } },
    });
    await assert.rejects(
      () => svc.updateStatus({ id: 1, status: "paid", adminId: 1 }),
      (err) => err.status === 400
    );
  });

  await test("updateStatus 404s for a missing request", async () => {
    const svc = freshService({
      interestModel: { findByPk: async () => null },
    });
    await assert.rejects(
      () => svc.updateStatus({ id: 999, status: "contacted", adminId: 1 }),
      (err) => err.status === 404
    );
  });

  await test("updateStatus writes an admin audit log entry with before/after status", async () => {
    let audited = null;
    const row = {
      id: 3,
      status: "requested",
      save: async function () {},
      toJSON: () => ({ id: 3, status: row.status }),
    };
    const svc = freshService({
      interestModel: { findByPk: async () => row },
      auditSvc: { record: async (payload) => { audited = payload; return {}; } },
    });
    const result = await svc.updateStatus({ id: 3, status: "contacted", adminId: 5, ip: "1.2.3.4" });
    assert.strictEqual(result.status, "contacted");
    assert.ok(audited, "must record an audit log entry");
    assert.strictEqual(audited.adminId, 5);
    assert.strictEqual(audited.before.status, "requested");
    assert.strictEqual(audited.after.status, "contacted");
  });

  clearAll();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
