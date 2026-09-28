/**
 * Career Focus — membership-tier active-focus limit + switching tests.
 *
 * Uses the same require.cache fake-model injection technique as
 * tests/admin-authorization.test.js: no real DB/Sequelize needed. The
 * real careerFocusService.js and config/careerConfig.js run unmodified;
 * only models/CareerFocus.js is swapped for an in-memory fake that
 * implements just the Sequelize surface careerFocusService.js actually
 * calls (create/count/findOne/findAll, plus instance .save()/.destroy()).
 *
 * Run with: node tests/career-focus.test.js
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

// ── In-memory fake CareerFocus "model" ──────────────────────────────────
// Implements just enough of the Sequelize Model static/instance surface
// for careerFocusService.js: create, count({where}), findOne({where,
// order}), findAll({where, order}), and instance .save()/.destroy().
function makeFakeCareerFocusModel() {
  let rows = [];
  let nextId = 1;

  function matchesWhere(row, where = {}) {
    return Object.entries(where).every(([key, val]) => {
      if (val && typeof val === "object" && Object.getOwnPropertySymbols(val).length) {
        // Op.ne (or any other symbol-keyed operator) — careerFocusService
        // only ever uses Op.ne here, so treat any symbol key generically
        // as "not equal to this value" rather than binding to one exact
        // Symbol identity (our fake doesn't need to import the real
        // "sequelize" package's Op to recognize its own Op.ne usage).
        const sym = Object.getOwnPropertySymbols(val)[0];
        return row[key] !== val[sym];
      }
      return row[key] === val;
    });
  }

  function makeInstance(data) {
    const instance = { ...data };
    instance.save = async () => {
      const idx = rows.findIndex((r) => r.id === instance.id);
      if (idx !== -1) rows[idx] = { ...instance };
      return instance;
    };
    instance.destroy = async () => {
      rows = rows.filter((r) => r.id !== instance.id);
    };
    return instance;
  }

  function applyOrder(list, order = []) {
    if (!order.length) return list;
    return [...list].sort((a, b) => {
      for (const [field, dir] of order) {
        const av = a[field] instanceof Date ? a[field].getTime() : a[field] ?? 0;
        const bv = b[field] instanceof Date ? b[field].getTime() : b[field] ?? 0;
        if (av === bv) continue;
        const cmp = av > bv ? 1 : -1;
        return dir === "DESC" ? -cmp : cmp;
      }
      return 0;
    });
  }

  return {
    async count({ where = {} } = {}) {
      return rows.filter((r) => matchesWhere(r, where)).length;
    },
    async findOne({ where = {}, order = [] } = {}) {
      const matched = applyOrder(rows.filter((r) => matchesWhere(r, where)), order);
      return matched.length ? makeInstance(matched[0]) : null;
    },
    async findAll({ where = {}, order = [] } = {}) {
      return applyOrder(rows.filter((r) => matchesWhere(r, where)), order).map(makeInstance);
    },
    async create(data) {
      const row = { id: nextId++, ...data };
      rows.push(row);
      return makeInstance(row);
    },
    _dump: () => rows,
  };
}

// Fresh careerFocusService + fresh fake model store per test, so tests
// never leak state into each other.
function freshService() {
  const servicePath = path.join(SRC, "services", "careerFocusService.js");
  const fakeModel = makeFakeCareerFocusModel();
  injectFakeModule(servicePath, "../models/CareerFocus", fakeModel);
  // careerFocusService.js separately does `const { Op } = require("sequelize")`
  // — the real "sequelize" package (already installed) provides that, so
  // only models/CareerFocus.js itself needs faking here. The fake's
  // matchesWhere() recognizes Op.ne generically (any symbol-keyed value),
  // so it works with whatever the real Op.ne symbol actually is.
  delete require.cache[require.resolve(servicePath)];
  const service = require(servicePath);
  return { service, fakeModel };
}

function userWith(membership) {
  return { id: 1, membership };
}

async function run() {
  console.log("Starter — 1 active Career Focus limit (product-spec section 27, 39)");
  {
    const { service } = freshService();
    const user = userWith("starter");

    await test("first Career Focus creates successfully", async () => {
      const result = await service.createFocus(user, { name: "MERN Backend Developer", target_role: "Backend Developer" });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.focus.name, "MERN Backend Developer");
    });

    await test("a second active Career Focus is REJECTED server-side (not just a UI limit)", async () => {
      const result = await service.createFocus(user, { name: "React Frontend Developer" });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.reason, "focus_limit_reached");
      assert.strictEqual(result.limit, 1);
    });

    await test("archiving the current focus then creating a new one succeeds", async () => {
      const focuses = await service.listFocuses(user.id);
      await service.archiveFocus(user, focuses[0].id);
      const result = await service.createFocus(user, { name: "React Frontend Developer" });
      assert.strictEqual(result.ok, true);
    });
  }

  console.log("\nGo (plus) — same 1 active Career Focus limit as Starter (product-spec section 28)");
  {
    const { service } = freshService();
    const user = userWith("plus");
    await service.createFocus(user, { name: "MERN Backend Developer" });

    await test("Go also cannot hold 2 simultaneously-active Career Focuses", async () => {
      const result = await service.createFocus(user, { name: "Data Engineer" });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.reason, "focus_limit_reached");
    });
  }

  console.log("\nPro — multiple active Career Focuses (product-spec section 29, 39)");
  {
    const { service } = freshService();
    const user = userWith("pro");

    await test("Pro can create 3+ simultaneously-active Career Focuses", async () => {
      const r1 = await service.createFocus(user, { name: "MERN Backend Developer", target_role: "Backend Developer", skills: ["Node.js", "Express"] });
      const r2 = await service.createFocus(user, { name: "React Frontend Developer", target_role: "Frontend Developer", skills: ["React"] });
      const r3 = await service.createFocus(user, { name: "Full-Stack Developer", target_role: "Full Stack Developer" });
      assert.strictEqual(r1.ok, true);
      assert.strictEqual(r2.ok, true);
      assert.strictEqual(r3.ok, true);
      const all = await service.listFocuses(user.id);
      assert.strictEqual(all.filter((f) => f.is_active).length, 3);
    });

    await test("switching active focus: resolveFocusForRequest honors an explicitly-passed focus id over the most-recent one", async () => {
      const all = await service.listFocuses(user.id);
      const backend = all.find((f) => f.name === "MERN Backend Developer");
      const frontend = all.find((f) => f.name === "React Frontend Developer");

      // Most-recently-used is Full-Stack (created last) — but an explicit
      // request for the frontend focus must win.
      const resolved = await service.resolveFocusForRequest(user.id, frontend.id);
      assert.strictEqual(resolved.id, frontend.id);

      const context = service.toPromptContext(resolved);
      assert.strictEqual(context.target_role, "Frontend Developer");
      assert.deepStrictEqual(context.skills, ["React"]);
      // Data from one focus must never leak into another's context.
      assert.notStrictEqual(context.target_role, "Backend Developer");
      assert.ok(!context.skills.includes("Node.js"), "backend focus's skills must not contaminate the frontend focus's context");
    });

    await test("with no explicit focus id, resolveFocusForRequest falls back to the most-recently-used ACTIVE focus", async () => {
      const all = await service.listFocuses(user.id);
      const fullstack = all.find((f) => f.name === "Full-Stack Developer");
      await service.touchLastUsed(fullstack);

      const resolved = await service.resolveFocusForRequest(user.id, null);
      assert.strictEqual(resolved.name, "Full-Stack Developer");
    });
  }

  console.log("\nresolveFocusForRequest — safe fallback behavior");
  {
    const { service } = freshService();
    const user = userWith("starter");
    await service.createFocus(user, { name: "MERN Backend Developer" });

    await test("an invalid/unowned focus id never throws — falls back to the active focus", async () => {
      const resolved = await service.resolveFocusForRequest(user.id, 999999);
      assert.ok(resolved);
      assert.strictEqual(resolved.name, "MERN Backend Developer");
    });

    await test("no user id (guest) -> null, never throws", async () => {
      const resolved = await service.resolveFocusForRequest(null, null);
      assert.strictEqual(resolved, null);
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
