/**
 * Search Quality pass — deterministic constraint matcher tests.
 * Pure logic, no mocking needed — runs the real opportunitySearchMatchService.js.
 *
 * Run with: node opportunity-search-match.test.js
 */
const assert = require("assert");
const path = require("path");
const { matchesSearchCriteria } = require(path.join(__dirname, "..", "src", "services", "opportunitySearchMatchService"));

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

function opp(overrides) {
  return {
    id: "x",
    role: "",
    company: "Acme",
    location: "",
    remote: false,
    requirements: [],
    description: "",
    raw_source_metadata: null,
    ...overrides,
  };
}

console.log("Role matching");
test("Backend Developer search matches a Backend Engineer title", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Engineer", remote: true }), { role: "Backend Developer", remote_preference: "any" });
  assert.strictEqual(r.reasons.role.pass, true);
});
test("Frontend Developer mentioning Node.js in description does NOT match a Backend search", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Frontend Developer", description: "Collaborate with backend engineers using Node.js and Express.", remote: true }),
    { role: "Backend Developer", skills: ["Node.js"], remote_preference: "any" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "ROLE_MISMATCH", "title must win over an incidental description mention");
});
test("Full Stack Engineer is treated as compatible with a Backend search", () => {
  const r = matchesSearchCriteria(opp({ role: "Full Stack Engineer", remote: true }), { role: "Backend Developer", remote_preference: "any" });
  assert.strictEqual(r.reasons.role.pass, true);
});
test("unrelated role (QA Engineer) does not match a Backend search even with matching skill text", () => {
  const r = matchesSearchCriteria(
    opp({ role: "QA Engineer", description: "Testing Node.js backend services", remote: true }),
    { role: "Backend Developer", remote_preference: "any" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "ROLE_MISMATCH");
});
test("generic title (Software Engineer) falls back to token overlap, not a hard family reject", () => {
  const r = matchesSearchCriteria(opp({ role: "Software Engineer", remote: true }), { role: "Software Engineer", remote_preference: "any" });
  assert.strictEqual(r.reasons.role.pass, true);
});

console.log("Skill matching");
test("Node.js matches when present in structured requirements", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", requirements: ["Node.js", "MongoDB"], remote: true }), { role: "Backend Developer", skills: ["Node.js"], remote_preference: "any" });
  assert.strictEqual(r.reasons.skills.pass, true);
});
test("skill variants (NodeJS / Node JS / Node) are treated as equivalent", () => {
  for (const variant of ["NodeJS", "Node JS", "Node"]) {
    const r = matchesSearchCriteria(
      opp({ role: "Backend Developer", requirements: [variant], remote: true }),
      { role: "Backend Developer", skills: ["Node.js"], remote_preference: "any" }
    );
    assert.strictEqual(r.reasons.skills.pass, true, `variant "${variant}" should match Node.js`);
  }
});
test("multiple requested skills use AND semantics — missing even one fails the gate", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", requirements: ["Node.js"], remote: true }),
    { role: "Backend Developer", skills: ["Node.js", "MySQL"], remote_preference: "any" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "SKILL_MISMATCH");
});
test("a genuine word-boundary mention in description counts as evidence", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", description: "You will build APIs using Node.js and Express.", remote: true }),
    { role: "Backend Developer", skills: ["Node.js"], remote_preference: "any" }
  );
  assert.strictEqual(r.reasons.skills.pass, true);
});
test("an unrelated skill with no evidence anywhere fails", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", requirements: ["Java", "Spring"], description: "Java backend role.", remote: true }),
    { role: "Backend Developer", skills: ["Node.js"], remote_preference: "any" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "SKILL_MISMATCH");
});

console.log("Remote / location matching");
test("remote:true required — onsite job rejected", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", remote: false, location: "London" }), { role: "Backend Developer", remote_preference: "remote" });
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "REMOTE_MISMATCH");
});
test("remote:false (onsite) required — a remote job is rejected", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", remote: true }), { role: "Backend Developer", remote_preference: "onsite" });
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "REMOTE_MISMATCH");
});
test("remote_preference 'any' imposes no remote constraint", () => {
  const r1 = matchesSearchCriteria(opp({ role: "Backend Developer", remote: true }), { role: "Backend Developer", remote_preference: "any" });
  const r2 = matchesSearchCriteria(opp({ role: "Backend Developer", remote: false, location: "" }), { role: "Backend Developer", remote_preference: "any" });
  assert.strictEqual(r1.reasons.remote.pass, true);
  assert.strictEqual(r2.reasons.remote.pass, true);
});
test("Himalayas-style explicit location_restrictions correctly excludes a non-matching country", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", remote: true, location: "United States", raw_source_metadata: { location_restrictions: ["United States"] } }),
    { role: "Backend Developer", remote_preference: "remote", location: "Pakistan" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "LOCATION_MISMATCH");
});
test("worldwide/anywhere remote jobs pass regardless of requested location (never invents Karachi eligibility, but doesn't wrongly exclude it either)", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", remote: true, location: "Anywhere" }),
    { role: "Backend Developer", remote_preference: "remote", location: "Karachi" }
  );
  assert.strictEqual(r.pass, true);
});
test("on-site search with a specified location rejects a differently-located job", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", remote: false, location: "London, UK" }),
    { role: "Backend Developer", remote_preference: "onsite", location: "Karachi" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "LOCATION_MISMATCH");
});

console.log("Combined AND-semantics (product spec section 25, scenarios A-F)");
test("Scenario A: Backend + Node.js + Remote — Frontend/Node.js job rejected on role alone", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Frontend Developer", description: "Node.js is a plus", remote: true }),
    { role: "Backend Developer", skills: ["Node.js"], remote_preference: "remote" }
  );
  assert.strictEqual(r.pass, false);
});
test("Scenario A: on-site backend job rejected on remote alone", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", requirements: ["Node.js"], remote: false }),
    { role: "Backend Developer", skills: ["Node.js"], remote_preference: "remote" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "REMOTE_MISMATCH");
});
test("Scenario A: a fully matching job passes ALL constraints together", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", requirements: ["Node.js"], remote: true }),
    { role: "Backend Developer", skills: ["Node.js"], remote_preference: "remote" }
  );
  assert.strictEqual(r.pass, true);
});
test("Scenario B: Backend + Remote + no skills — random remote marketing role rejected on role", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Marketing Manager", remote: true }),
    { role: "Backend Developer", skills: [], remote_preference: "remote" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "ROLE_MISMATCH");
});
test("Scenario C: Backend + Node.js, remote NOT selected — onsite backend/Node.js job is NOT forced to fail on remote", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", requirements: ["Node.js"], remote: false, location: "" }),
    { role: "Backend Developer", skills: ["Node.js"], remote_preference: "any" }
  );
  assert.strictEqual(r.pass, true);
});
test("Scenario D: Remote only, no role/skills — any verified remote role is a valid candidate", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Product Designer", remote: true }),
    { role: "", skills: [], remote_preference: "remote" }
  );
  assert.strictEqual(r.pass, true);
});
test("Scenario E: Backend + Python + Remote — a Node.js-only job (no Python evidence) is rejected", () => {
  const r = matchesSearchCriteria(
    opp({ role: "Backend Developer", requirements: ["Node.js"], description: "Node.js backend role.", remote: true }),
    { role: "Backend Developer", skills: ["Python"], remote_preference: "remote" }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "SKILL_MISMATCH");
});

console.log("\nExperience filtering");
test("Senior search rejects a clearly Internship-level listing", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", seniority: "Internship" }), {
    role: "Backend Developer",
    experience: "Senior",
  });
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "EXPERIENCE_MISMATCH");
});
test("Senior search matches a Senior-level listing", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", seniority: "Senior Backend Engineer" }), {
    role: "Backend Developer",
    experience: "Senior",
  });
  assert.strictEqual(r.pass, true);
});
test("Unknown (missing) experience on the listing is NOT treated as a mismatch", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", seniority: null }), {
    role: "Backend Developer",
    experience: "Mid-level",
  });
  assert.strictEqual(r.pass, true, "omission is not evidence of disqualification");
});

console.log("\nEmployment type filtering");
test("Full-time search rejects a listing explicitly marked Contract", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", employment_type: "Contract" }), {
    role: "Backend Developer",
    employment_type: "Full-time",
  });
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "EMPLOYMENT_TYPE_MISMATCH");
});
test("Full-time search matches a Full-time listing", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", employment_type: "Full Time" }), {
    role: "Backend Developer",
    employment_type: "Full-time",
  });
  assert.strictEqual(r.pass, true);
});
test("Unknown (missing) employment type on the listing is NOT treated as a mismatch", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", employment_type: "" }), {
    role: "Backend Developer",
    employment_type: "Full-time",
  });
  assert.strictEqual(r.pass, true);
});

console.log("\nFreshness filtering");
function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
test("Last 24 hours: a listing posted 5 days ago is rejected", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", posted_at: daysAgoIso(5) }), {
    role: "Backend Developer",
    freshness: "24h",
  });
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "FRESHNESS_MISMATCH");
});
test("Last 7 days: a listing posted 2 days ago passes", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", posted_at: daysAgoIso(2) }), {
    role: "Backend Developer",
    freshness: "7d",
  });
  assert.strictEqual(r.pass, true);
});
test("Strict freshness search rejects a listing with NO posted_at (unknown is not a confirmed match)", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", posted_at: null }), {
    role: "Backend Developer",
    freshness: "3d",
  });
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "FRESHNESS_UNKNOWN");
});
test("No freshness constraint ('any') never rejects on posting date", () => {
  const r = matchesSearchCriteria(opp({ role: "Backend Developer", posted_at: null }), {
    role: "Backend Developer",
    freshness: "any",
  });
  assert.strictEqual(r.pass, true);
});

console.log("\nCombined AND semantics with the new filters");
test("Role + skills + remote + experience + employment_type + freshness must ALL pass", () => {
  const r = matchesSearchCriteria(
    opp({
      role: "Backend Developer",
      requirements: ["Node.js"],
      remote: true,
      seniority: "Mid-level",
      employment_type: "Full-time",
      posted_at: daysAgoIso(1),
    }),
    {
      role: "Backend Developer",
      skills: ["Node.js"],
      remote_preference: "remote",
      experience: "Mid-level",
      employment_type: "Full-time",
      freshness: "3d",
    }
  );
  assert.strictEqual(r.pass, true);
});
test("Same candidate but wrong employment_type fails the whole gate (AND, not OR)", () => {
  const r = matchesSearchCriteria(
    opp({
      role: "Backend Developer",
      requirements: ["Node.js"],
      remote: true,
      seniority: "Mid-level",
      employment_type: "Contract",
      posted_at: daysAgoIso(1),
    }),
    {
      role: "Backend Developer",
      skills: ["Node.js"],
      remote_preference: "remote",
      experience: "Mid-level",
      employment_type: "Full-time",
      freshness: "3d",
    }
  );
  assert.strictEqual(r.pass, false);
  assert.strictEqual(r.rejection_code, "EMPLOYMENT_TYPE_MISMATCH");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
