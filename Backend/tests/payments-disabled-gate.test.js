/**
 * Membership + Payments Evolution — zero-cost MVP payment-gate tests.
 *
 * Verifies that with PAYMENTS_ENABLED unset/false (the MVP default):
 *   - no checkout can be created
 *   - no mock/dev payment can be confirmed
 *   - no provider webhook event is accepted
 * i.e. there is no way for a public user to activate a paid membership
 * without a real, enabled payment provider.
 *
 * Uses the same require.cache injection technique as the other tests in
 * this directory — the real subscriptionService.js runs unmodified.
 *
 * Run with: node tests/payments-disabled-gate.test.js
 */
const assert = require("assert");
const path = require("path");
const Module = require("module");

const SRC = path.join(__dirname, "..", "src");
const servicePath = path.join(SRC, "services", "subscriptionService.js");

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

const NEVER_CALLED = (label) => ({
  findOne: async () => { throw new Error(`${label}.findOne should not be reached while payments are disabled`); },
  findByPk: async () => { throw new Error(`${label}.findByPk should not be reached while payments are disabled`); },
  findOrCreate: async () => { throw new Error(`${label}.findOrCreate should not be reached while payments are disabled`); },
  create: async () => { throw new Error(`${label}.create should not be reached while payments are disabled`); },
  update: async () => { throw new Error(`${label}.update should not be reached while payments are disabled`); },
  count: async () => { throw new Error(`${label}.count should not be reached while payments are disabled`); },
});

function freshService() {
  injectFakeModule(servicePath, "../models/User", NEVER_CALLED("User"));
  injectFakeModule(servicePath, "../models/Subscription", NEVER_CALLED("Subscription"));
  injectFakeModule(servicePath, "../models/PaymentTransaction", NEVER_CALLED("PaymentTransaction"));
  injectFakeModule(servicePath, "../models/ProviderEvent", NEVER_CALLED("ProviderEvent"));
  injectFakeModule(servicePath, "../models/CareerActivity", NEVER_CALLED("CareerActivity"));
  injectFakeModule(servicePath, "./careerSessionService", {
    getStatus: () => { throw new Error("should not be reached"); },
  });
  injectFakeModule(servicePath, "./paymentProviders", {
    getProvider: () => { throw new Error("getProvider should not be reached while payments are disabled"); },
    mockAllowed: () => true,
    isProduction: () => false,
  });
  injectFakeModule(servicePath, "./auditLogService", { record: async () => ({}) });
  delete require.cache[require.resolve(servicePath)];
  return require(servicePath);
}

function clearAll() {
  clearModuleCache(servicePath, "../models/User");
  clearModuleCache(servicePath, "../models/Subscription");
  clearModuleCache(servicePath, "../models/PaymentTransaction");
  clearModuleCache(servicePath, "../models/ProviderEvent");
  clearModuleCache(servicePath, "../models/CareerActivity");
  clearModuleCache(servicePath, "./careerSessionService");
  clearModuleCache(servicePath, "./paymentProviders");
  clearModuleCache(servicePath, "./auditLogService");
  delete require.cache[require.resolve(servicePath)];
}

async function run() {
  console.log("services/subscriptionService.js — PAYMENTS_ENABLED gate");

  const originalFlag = process.env.PAYMENTS_ENABLED;

  await test("PAYMENTS_ENABLED unset (MVP default) → createCheckout refuses, never touches PaymentTransaction", async () => {
    delete process.env.PAYMENTS_ENABLED;
    const svc = freshService();
    await assert.rejects(
      () => svc.createCheckout({ userId: 1, planId: "plus" }),
      (err) => err.status === 404 && err.code === "PAYMENTS_DISABLED"
    );
  });

  await test('PAYMENTS_ENABLED="false" → createCheckout refuses', async () => {
    process.env.PAYMENTS_ENABLED = "false";
    const svc = freshService();
    await assert.rejects(
      () => svc.createCheckout({ userId: 1, planId: "pro" }),
      (err) => err.code === "PAYMENTS_DISABLED"
    );
  });

  await test("payments disabled → confirmMockCheckout refuses without checking any signature/DB row", async () => {
    process.env.PAYMENTS_ENABLED = "false";
    const svc = freshService();
    await assert.rejects(
      () => svc.confirmMockCheckout({ userId: 1, paymentId: "p1", checkoutId: "c1", signature: "sig", planId: "plus" }),
      (err) => err.code === "PAYMENTS_DISABLED"
    );
  });

  await test("payments disabled → processProviderEvent (webhook) refuses before verifying signature", async () => {
    process.env.PAYMENTS_ENABLED = "false";
    const svc = freshService();
    await assert.rejects(
      () => svc.processProviderEvent({ provider: "mock", headers: {}, body: {} }),
      (err) => err.code === "PAYMENTS_DISABLED"
    );
  });

  await test('PAYMENTS_ENABLED="true" → createCheckout proceeds past the gate (fails later for an invalid plan, not PAYMENTS_DISABLED)', async () => {
    process.env.PAYMENTS_ENABLED = "true";
    const svc = freshService();
    await assert.rejects(
      () => svc.createCheckout({ userId: 1, planId: "not_a_real_plan" }),
      (err) => err.code !== "PAYMENTS_DISABLED"
    );
  });

  if (originalFlag === undefined) delete process.env.PAYMENTS_ENABLED;
  else process.env.PAYMENTS_ENABLED = originalFlag;

  clearAll();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
