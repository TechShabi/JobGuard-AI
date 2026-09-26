const OpportunitySearch = require("../models/OpportunitySearch");
const SavedOpportunity = require("../models/SavedOpportunity");
const Context = require("../models/Context");
const Resume = require("../models/Resume");
const InterviewSession = require("../models/InterviewSession");
const { discover } = require("../services/opportunityDiscoveryService");
const { processDiscovered } = require("../services/opportunityVerificationService");
const { matchesSearchCriteria } = require("../services/opportunitySearchMatchService");
const { rankByRelevance } = require("../services/opportunityRelevanceService");
const { explainOpportunityRelevance } = require("../services/geminiService");
const { nextBestAction } = require("../services/recommendationService");
const { consumeCareerSession } = require("../middleware/careerSession");

// Filter-order cost control (product-spec section 15): never send every
// discovered/verified candidate to Gemini. Only the top N, by deterministic
// relevance, get an AI-written explanation sentence; everyone else still
// has real, explainable `.relevance.reasons` with zero AI cost.
const MAX_RESULTS = 20;
const MAX_GEMINI_EXPLAIN = 8;

function parseSkills(skills) {
  if (Array.isArray(skills)) return skills.map((s) => String(s).trim()).filter(Boolean);
  if (typeof skills === "string") {
    return skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * POST /api/opportunity/find
 * Body: { role, skills?, location?, remote_preference?, experience?, preferences? }
 *
 * Pipeline (product-spec "Search Quality & Verified-Only UX" pass):
 *   discover → dedupe (inside discover) → DETERMINISTIC constraint filter
 *   (role AND skills AND remote AND location) → existing Opportunity
 *   Verification → keep ONLY "trusted" → relevance rank → Gemini explains
 *   top candidates → response.
 *
 * The constraint filter and the verified-only gate are both authoritative:
 * neither AI relevance nor verification "caution" can override them. Gemini
 * only ever explains an opportunity that already survived both gates.
 */
exports.findOpportunities = async (req, res) => {
  try {
    const role = (req.body.role || "").trim();
    if (!role) {
      return res.status(400).json({ success: false, message: "Target role is required." });
    }

    const query = {
      role,
      skills: parseSkills(req.body.skills),
      location: (req.body.location || "").trim(),
      remote_preference: req.body.remote_preference || "any",
      experience: req.body.experience || "",
      preferences: req.body.preferences || {},
    };

    const { opportunities, meta } = await discover(query);

    // ── Deterministic constraint filter — authoritative AND-gate ────────
    // Runs BEFORE verification so verification never has to evaluate (and
    // Gemini never has to pay for) a candidate that doesn't even satisfy
    // the user's actual search intent. Every opportunity keeps its match
    // reasons attached (admin/debug observability), even when rejected.
    const matchedCandidates = [];
    const constraintRejected = [];
    for (const opp of opportunities) {
      const match = matchesSearchCriteria(opp, query);
      if (match.pass) {
        matchedCandidates.push({ ...opp, match: match.reasons });
      } else {
        constraintRejected.push({ id: opp.id, role: opp.role, rejection_code: match.rejection_code });
      }
    }

    // ── Existing Opportunity Verification — the ONLY trust layer ────────
    const { verified, rejected } = processDiscovered(matchedCandidates);

    // Admin/debug observability (product-spec section 24) — tally rejection
    // reasons without storing full per-job blobs. Never shown to end users.
    const rejectionBreakdown = { ROLE_MISMATCH: 0, SKILL_MISMATCH: 0, REMOTE_MISMATCH: 0, LOCATION_MISMATCH: 0, LOCATION_INSUFFICIENT: 0 };
    for (const r of constraintRejected) {
      if (rejectionBreakdown[r.rejection_code] !== undefined) rejectionBreakdown[r.rejection_code] += 1;
    }

    // ── Verified-only gate ───────────────────────────────────────────────
    // "verified" from processDiscovered includes BOTH "trusted" and
    // "caution" (see opportunityVerificationService.js) — the product
    // promise is stricter than that: only "trusted" ever reaches the user.
    // Caution/rejected/error/insufficient are all treated the same way
    // here — hidden from the normal result set, never shown as a
    // half-verified card the user has to judge for themselves.
    const trustedOnly = verified.filter((o) => o.verification.status === "trusted");
    const notShown = verified.length - trustedOnly.length; // caution, held back
    const hiddenCount = notShown + rejected.length + constraintRejected.length;

    // Relevance ranking (deterministic, zero-cost, explainable — see
    // opportunityRelevanceService.js) over the trusted-only set.
    let ranked = rankByRelevance(query, trustedOnly);
    ranked = ranked.slice(0, MAX_RESULTS);

    // Gemini adds a short grounded-in-evidence explanation sentence for the
    // top candidates only — best-effort, never blocks the response, never
    // re-scores anything, and never runs on anything that didn't already
    // pass both the constraint filter and verification.
    try {
      const explanations = await explainOpportunityRelevance(query, ranked.slice(0, MAX_GEMINI_EXPLAIN));
      ranked = ranked.map((opp) =>
        explanations[opp.id]
          ? { ...opp, relevance: { ...opp.relevance, explanation: explanations[opp.id] } }
          : opp
      );
    } catch (err) {
      console.error("Relevance explanation step failed (non-fatal):", err.message);
    }

    // Persist search + update context for logged-in users
    let searchRecord = null;
    if (req.user?.id) {
      searchRecord = await OpportunitySearch.create({
        user_id: req.user.id,
        role: query.role,
        skills: query.skills,
        location: query.location || null,
        remote_preference: query.remote_preference,
        experience: query.experience || null,
        preferences: query.preferences,
        results_snapshot: ranked.slice(0, 20),
        provider: meta.providers_used?.find((p) => p.is_live && p.count > 0)?.id || null,
        is_live: !!meta.is_live,
        discovery_status: meta.discovery_status || null,
        providers_used: meta.providers_used || null,
        // verified_count now means "actually shown to the user" (trusted
        // only) — rejected_count covers everything hidden from them for
        // any reason (constraint mismatch, caution, or verification fail),
        // matching the stricter product promise this pass implements.
        verified_count: trustedOnly.length,
        rejected_count: hiddenCount,
        rejection_breakdown: rejectionBreakdown,
      });

      // Context Engine: opportunity_find becomes active context
      await Context.update(
        { is_active: false },
        { where: { user_id: req.user.id, is_active: true } }
      );
      await Context.create({
        user_id: req.user.id,
        source_module: "opportunity_find",
        company: "Opportunity Search",
        role: query.role,
        experience: query.experience || "Not Specified",
        description: [
          query.location && `Location: ${query.location}`,
          query.remote_preference && query.remote_preference !== "any"
            ? `Remote: ${query.remote_preference}`
            : null,
          query.skills.length ? `Skills: ${query.skills.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        source_label: "Find",
        is_active: true,
      });

      await consumeCareerSession(req);
    }

    return res.json({
      success: true,
      data: {
        query,
        opportunities: ranked,
        // Kept for frontend backward-compat (existing empty-state logic
        // already checks `rejected_count > 0` to show the "found potential
        // matches, but none passed verification" state) — now correctly
        // reflects everything hidden from the user for ANY reason.
        rejected_count: hiddenCount,
        summary: {
          discovered: opportunities.length,
          matched: matchedCandidates.length,
          verified: trustedOnly.length,
          returned: ranked.length,
        },
        meta: {
          ...meta,
          verified_count: trustedOnly.length,
          search_id: searchRecord?.id || null,
        },
      },
    });
  } catch (error) {
    console.error("findOpportunities error:", error);
    return res.status(500).json({ success: false, message: error.message || "Search failed" });
  }
};

/**
 * GET /api/opportunity/recent
 */
exports.recentSearches = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.json({ success: true, data: [] });
    }
    const rows = await OpportunitySearch.findAll({
      where: { user_id: req.user.id },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });
    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        role: r.role,
        skills: r.skills,
        location: r.location,
        remote_preference: r.remote_preference,
        experience: r.experience,
        is_live: r.is_live,
        provider: r.provider,
        createdAt: r.createdAt,
        result_count: Array.isArray(r.results_snapshot) ? r.results_snapshot.length : 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/opportunity/saved?status=saved|viewed|applied
 */
exports.listSaved = async (req, res) => {
  try {
    if (!req.user?.id) return res.json({ success: true, data: [] });
    const where = { user_id: req.user.id };
    if (req.query.status) where.status = req.query.status;
    const rows = await SavedOpportunity.findAll({
      where,
      order: [["updatedAt", "DESC"]],
      limit: 50,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/opportunity/saved
 * Body: { external_id, status, role, company, location, source_url, source_platform, payload, verification }
 */
exports.upsertSaved = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Login required to save opportunities." });
    }
    const {
      external_id,
      status = "saved",
      role,
      company,
      location,
      source_url,
      source_platform,
      payload,
      verification,
    } = req.body;

    if (!external_id) {
      return res.status(400).json({ success: false, message: "external_id is required." });
    }
    if (!["saved", "viewed", "applied"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const [row] = await SavedOpportunity.upsert({
      user_id: req.user.id,
      external_id: String(external_id),
      status,
      role: role || null,
      company: company || null,
      location: location || null,
      source_url: source_url || null,
      source_platform: source_platform || null,
      payload: payload || null,
      verification: verification || null,
    });

    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/opportunity/saved/:externalId
 */
exports.removeSaved = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Login required." });
    }
    await SavedOpportunity.destroy({
      where: { user_id: req.user.id, external_id: req.params.externalId },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/opportunity/recommend
 * Body: { opportunity, user_mark? }
 * Uses real Resume + Interview rows for this user when available.
 */
exports.recommendNext = async (req, res) => {
  try {
    let resumeState = { exists: false };
    let interviewState = { exists: false };

    if (req.user?.id) {
      const latestResume = await Resume.findOne({
        where: { user_id: req.user.id },
        order: [["createdAt", "DESC"]],
      });
      if (latestResume) {
        const analysis = latestResume.analysis || {};
        resumeState = {
          exists: true,
          role: latestResume.role || analysis.role || null,
          ats_score:
            typeof latestResume.ats_score === "number"
              ? latestResume.ats_score
              : typeof analysis.ats_score === "number"
                ? analysis.ats_score
                : typeof analysis.score === "number"
                  ? analysis.score
                  : null,
          source: latestResume.source || null,
        };
      }

      const latestInterview = await InterviewSession.findOne({
        where: { user_id: req.user.id },
        order: [["createdAt", "DESC"]],
      });
      if (latestInterview) {
        const report = latestInterview.report || {};
        interviewState = {
          exists: true,
          overall_score:
            typeof report.overall_score === "number"
              ? report.overall_score
              : typeof report.score === "number"
                ? report.score
                : null,
          status: latestInterview.status || null,
        };
      }
    }

    const recommendation = nextBestAction({
      resume: resumeState,
      interview: interviewState,
      opportunity: req.body.opportunity || null,
      userMark: req.body.user_mark || null,
    });

    return res.json({
      success: true,
      data: {
        recommendation,
        resume: resumeState,
        interview: interviewState,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
