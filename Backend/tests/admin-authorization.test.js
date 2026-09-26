/**
 * Admin Panel Evolution — authorization + audit tests.
 *
 * Uses Node's require.cache to inject lightweight fake models for the
 * specific model files these modules import — no real DB, no Sequelize
 * needed, and no behavior-approximating stub library either: the real
 * middleware/admin.js and services/auditLogService.js source files run
 * unmodified, only their data layer is swapped.
 *
 * Run with: node admin-authorization.test.js
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
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

/** Injects `fakeExports` as the require.cache entry for `relativePath`
 *  resolved from `fromFile`, so any later require() of it returns the fake
 *  without ever loading (or needing) the real file/its dependencies. */
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
  // ── middleware/admin.js — authorization ────────────────────────────
  console.log("middleware/admin.js — authorization");
  {
    const middlewarePath = path.join(SRC, "middleware", "admin.js");
    const modelRelPath = "../models/User";

    function freshMiddleware(fakeUserModel) {
      injectFakeModule(middlewarePath, modelRelPath, fakeUserModel);
      delete require.cache[require.resolve(middlewarePath)];
      return require(middlewarePath);
    }

    await test("unauthenticated request (no req.user) → 401, next() never called", async () => {
      const adminMw = freshMiddleware({ findByPk: async () => { throw new Error("should not be called"); } });
      const req = {};
      let statusCode = null, body = null, nextCalled = false;
      const res = { status: (c) => { statusCode = c; return res; }, json: (b) => { body = b; } };
      await adminMw(req, res, () => { nextCalled = true; });
      assert.strictEqual(statusCode, 401);
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(body.success, false);
    });

    await test("normal (non-admin) user → 403, next() never called", async () => {
      const adminMw = freshMiddleware({
        findByPk: async (id) => ({ id, role: "user", email: "u@x.com", username: "u" }),
      });
      const req = { user: { id: 42 } };
      let statusCode = null, nextCalled = false;
      const res = { status: (c) => { statusCode = c; return res; }, json: () => {} };
      await adminMw(req, res, () => { nextCalled = true; });
      assert.strictEqual(statusCode, 403);
      assert.strictEqual(nextCalled, false);
    });

    await test("admin user → next() called, req.adminUser populated from DB (not JWT)", async () => {
      const adminMw = freshMiddleware({
        findByPk: async (id) => ({ id, role: "admin", email: "a@x.com", username: "admin1" }),
      });
      const req = { user: { id: 7, role: "user" } }; // stale JWT claims "user" — DB says admin
      let nextCalled = false;
      const res = { status: () => res, json: () => {} };
      await adminMw(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.adminUser.role, "admin");
      assert.strictEqual(req.adminUser.id, 7);
    });

    await test("demoted admin (JWT says admin, DB says user) is correctly rejected — proves DB is source of truth", async () => {
      const adminMw = freshMiddleware({
        findByPk: async (id) => ({ id, role: "user", email: "demoted@x.com", username: "demoted" }),
      });
      const req = { user: { id: 9, role: "admin" } }; // stale JWT still claims admin
      let statusCode = null, nextCalled = false;
      const res = { status: (c) => { statusCode = c; return res; }, json: () => {} };
      await adminMw(req, res, () => { nextCalled = true; });
      assert.strictEqual(statusCode, 403, "must re-check DB role, not trust JWT claim");
      assert.strictEqual(nextCalled, false);
    });

    await test("user not found in DB → 401, not a crash", async () => {
      const adminMw = freshMiddleware({ findByPk: async () => null });
      const req = { user: { id: 999 } };
      let statusCode = null;
      const res = { status: (c) => { statusCode = c; return res; }, json: () => {} };
      await adminMw(req, res, () => {});
      assert.strictEqual(statusCode, 401);
    });

    await test("DB error during role check → 500, never silently lets the request through", async () => {
      const adminMw = freshMiddleware({ findByPk: async () => { throw new Error("connection lost"); } });
      const req = { user: { id: 1 } };
      let statusCode = null, nextCalled = false;
      const res = { status: (c) => { statusCode = c; return res; }, json: () => {} };
      await adminMw(req, res, () => { nextCalled = true; });
      assert.strictEqual(statusCode, 500);
      assert.strictEqual(nextCalled, false, "a failed authorization check must never fail open");
    });

    clearModuleCache(middlewarePath, modelRelPath);
  }

  // ── services/auditLogService.js — redaction + write path ────────────
  console.log("services/auditLogService.js");
  {
    const servicePath = path.join(SRC, "services", "auditLogService.js");
    const modelRelPath = "../models/AdminAuditLog";

    function freshService(fakeAdminAuditLog) {
      injectFakeModule(servicePath, modelRelPath, fakeAdminAuditLog);
      delete require.cache[require.resolve(servicePath)];
      return require(servicePath);
    }

    await test("redacts common secret-shaped keys from before/after payloads before persisting", async () => {
      let created = null;
      const svc = freshService({ create: async (data) => { created = data; return { id: 1, ...data }; } });
      await svc.record({
        adminId: 1,
        action: "test.action",
        before: { password: "hunter2", api_key: "sk-abc", nested: { token: "xyz" }, safe: "ok" },
      });
      assert.strictEqual(created.before.password, "[redacted]");
      assert.strictEqual(created.before.api_key, "[redacted]");
      assert.strictEqual(created.before.nested.token, "[redacted]");
      assert.strictEqual(created.before.safe, "ok", "non-sensitive fields must survive untouched");
    });

    await test("refuses to write without adminId/action, never silently no-ops as success", async () => {
      let createCalled = false;
      const svc = freshService({ create: async () => { createCalled = true; return {}; } });
      const result = await svc.record({ action: "x" }); // missing adminId
      assert.strictEqual(result, null);
      assert.strictEqual(createCalled, false);
    });

    await test("a DB failure while writing the audit row returns null, not a throw (caller decides how to react)", async () => {
      const svc = freshService({ create: async () => { throw new Error("db down"); } });
      const result = await svc.record({ adminId: 1, action: "x" });
      assert.strictEqual(result, null);
    });

    clearModuleCache(servicePath, modelRelPath);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
