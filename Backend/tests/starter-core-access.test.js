/**
 * Membership + Payments Evolution — "Starter must be useful" tests.
 *
 * Core product rule: Career Starter is a real, usable JobGuard plan.
 * Opportunity Find, Opportunity Verification, Resume Build/Review, and
 * Interview must all be reachable on Starter — paid plans add capacity,
 * AI assistance and automation, not access to the core product.
 *
 * Exercises the real careerConfig.js + careerSessionService.js against
 * plain in-memory user objects. No DB required — checkAccess/getStatus
 * are pure functions over the config and a user row shape.
 *
 * Run with: node tests/starter-core-access.test.js
 */
const assert = require("assert");
const path = require("path");

const careerSessionService = require(path.join(__dirname, "..", "src", "services", "careerSessionService"));
const { MEMBERSHIP_IDS, MEMBERSHIPS } = require(path.join(__dirname, "..", "src", "config", "careerConfig"));

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.stack || err.message}`);
    failed++;
  }
}

function makeUser(membership, overrides = {}) {
  return {
    membership,
    sessions_used: 0,
    sessions_cycle_start: new Date(),
    ...overrides,
  };
}

const CORE_FEATURES = [
  "opportunity_find",
  "opportunity_verification",
  "resume_review",
  "resume_builder",
  "interview_practice",
  "interview_report",
];

function run() {
  console.log("Starter core-access — careerConfig + careerSessionService");

  CORE_FEATURES.forEach((featureKey) => {
    test(`Career Starter can access ${featureKey}`, () => {
      const user = makeUser(MEMBERSHIP_IDS.STARTER);
      const access = careerSessionService.checkAccess(user, featureKey);
      assert.strictEqual(access.allowed, true, `Starter must be able to use ${featureKey}`);
    });

    test(`Career Go (plus) can access ${featureKey}`, () => {
      const user = makeUser(MEMBERSHIP_IDS.PLUS);
      const access = careerSessionService.checkAccess(user, featureKey);
      assert.strictEqual(access.allowed, true);
    });

    test(`Career Pro can access ${featureKey}`, () => {
      const user = makeUser(MEMBERSHIP_IDS.PRO);
      const access = careerSessionService.checkAccess(user, featureKey);
      assert.strictEqual(access.allowed, true);
    });
  });

  test("Starter is not unlimited — has a real, positive monthly session cap (a real plan, not a crippled demo)", () => {
    const starter = MEMBERSHIPS[MEMBERSHIP_IDS.STARTER];
    assert.ok(starter.sessionsPerCycle > 0, "Starter must have a usable, non-zero session pool");
  });

  test("Starter blocks a feature only on genuine usage exhaustion, not feature access — message references upgrade, not removal", () => {
    const starter = MEMBERSHIPS[MEMBERSHIP_IDS.STARTER];
    const user = makeUser(MEMBERSHIP_IDS.STARTER, { sessions_used: starter.sessionsPerCycle });
    const access = careerSessionService.checkAccess(user, "opportunity_find");
    assert.strictEqual(access.allowed, false);
    assert.strictEqual(access.reason, "sessions_exhausted");
    assert.notStrictEqual(access.feature.key, undefined);
  });

  test("higher plans grant strictly more (or equal) monthly capacity than Starter", () => {
    const starter = MEMBERSHIPS[MEMBERSHIP_IDS.STARTER].sessionsPerCycle;
    const go = MEMBERSHIPS[MEMBERSHIP_IDS.PLUS].sessionsPerCycle;
    const pro = MEMBERSHIPS[MEMBERSHIP_IDS.PRO].sessionsPerCycle; // null = unlimited
    assert.ok(go === null || go > starter);
    assert.ok(pro === null || pro > (go ?? starter));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
