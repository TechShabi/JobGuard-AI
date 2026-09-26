import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  Briefcase,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ShieldCheck,
  Info,
  ArrowRight,
  RotateCcw,
  WifiOff,
  Target,
  Upload,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import RoleSearch from "../components/common/RoleSearch";
import SkillsAutocomplete from "../components/common/SkillsAutocomplete";
import { EXPERIENCE_LEVELS } from "../data/roles";
import { useAuth } from "../context/AuthContext";
import { useContextEngine } from "../context/ContextEngineContext";
import {
  findOpportunitiesService,
  recommendNextService,
  upsertSavedOpportunityService,
  removeSavedOpportunityService,
  getSavedOpportunitiesService,
  getRecentSearchesService,
} from "../services/opportunity.service";
import { analyzeResumeService } from "../services/resume.service";
import {
  saveLastSearch,
  getLastSearch,
  getRecentSearchesLocal,
  markViewedLocal,
  upsertSavedLocal,
  removeSavedLocal,
  getLocalMark,
  getSavedLocal,
} from "../utils/opportunityStorage";

const REMOTE_OPTS = [
  { id: "any", label: "Any" },
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "On-site" },
];

function statusBadge(verification) {
  if (!verification) return null;
  const { status } = verification;
  if (status === "trusted") {
    return <span className="opp-badge opp-badge-ok"><ShieldCheck size={12} /> JobGuard Verified</span>;
  }
  // Caution/rejected/error opportunities are filtered out server-side
  // before they ever reach this page (see opportunityController.js's
  // verified-only gate) — these branches are just defensive fallbacks,
  // never expected to render in the normal Find results.
  if (status === "caution") {
    return <span className="opp-badge opp-badge-warn"><AlertTriangle size={12} /> Caution</span>;
  }
  return <span className="opp-badge opp-badge-bad">Not recommended</span>;
}

function freshnessLabel(f) {
  if (f === "fresh") return "Fresh";
  if (f === "aging") return "Aging";
  if (f === "stale") return "Possibly closed";
  return "Date unknown";
}

export default function OpportunityFind() {
  const navigate = useNavigate();
  const { requestScan, incrementScan, isLoggedIn } = useAuth();
  const { context, hasContext, setActiveContext, needsReplaceConfirmation } = useContextEngine();

  const [role, setRole] = useState(
    hasContext && context.role ? { id: "context", label: context.role } : null
  );
  const [skills, setSkills] = useState([]);
  const [location, setLocation] = useState("");
  const [remotePreference, setRemotePreference] = useState("any");
  const [experience, setExperience] = useState(
    hasContext ? context.experience || "" : ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [summary, setSummary] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [recent, setRecent] = useState([]);
  const [marks, setMarks] = useState({}); // id -> status
  const [pendingContext, setPendingContext] = useState(null); // context payload awaiting user confirmation
  const [pendingHref, setPendingHref] = useState(null); // where to navigate after context is set

  // Quick inline resume-fit check against the selected opportunity —
  // reuses the exact same /resume/analyze AI call and gating as Resume
  // Review, just without leaving the Opportunity page.
  const [matchFile, setMatchFile] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [matchResult, setMatchResult] = useState(null);
  const [showMatchUpload, setShowMatchUpload] = useState(false);

  // Prefill from context / last search once
  useEffect(() => {
    const last = getLastSearch();
    if (last?.query) {
      if (last.query.role) setRole({ id: "recent", label: last.query.role });
      setSkills(last.query.skills || []);
      setLocation(last.query.location || "");
      setRemotePreference(last.query.remote_preference || "any");
      setExperience(last.query.experience || experience);
      if (Array.isArray(last.opportunities) && last.opportunities.length) {
        setOpportunities(last.opportunities);
        setMeta(last.meta || null);
        setRejectedCount(last.rejected_count || 0);
        setSummary(last.summary || null);
        setSelectedId(last.opportunities[0]?.id || null);
      }
    }
    // Local recent + server recent
    setRecent(getRecentSearchesLocal());
    if (isLoggedIn) {
      getRecentSearchesService()
        .then((res) => {
          if (res.data?.data?.length) setRecent(res.data.data);
        })
        .catch(() => {});
    }
    // Saved marks: server for auth users, localStorage for guests
    const loadMarks = async () => {
      if (isLoggedIn) {
        try {
          const res = await getSavedOpportunitiesService();
          const rows = res.data?.data || [];
          const map = {};
          rows.forEach((s) => {
            if (s.external_id) map[s.external_id] = s.status;
          });
          setMarks(map);
          return;
        } catch (_) {
          // Fall through to local if server unavailable
        }
      }
      const saved = getSavedLocal();
      const map = {};
      saved.forEach((s) => {
        map[s.external_id] = s.status;
      });
      setMarks(map);
    };
    loadMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const selected = useMemo(
    () => opportunities.find((o) => o.id === selectedId) || null,
    [opportunities, selectedId]
  );

  // Load recommendation when selection changes
  useEffect(() => {
    if (!selected) {
      setRecommendation(null);
      setReadiness(null);
      return;
    }
    // A new opportunity is selected — any previous quick-match result was
    // for a different role/description and must not be shown as if it
    // applies here.
    setMatchResult(null);
    setMatchError("");
    setShowMatchUpload(false);
    markViewedLocal(selected);
    const userMark = marks[selected.id] || getLocalMark(selected.id);
    recommendNextService({
      opportunity: {
        id: selected.id,
        role: selected.role,
        company: selected.company,
        source_url: selected.source_url,
        verification: selected.verification,
      },
      user_mark: userMark,
    })
      .then((res) => {
        setRecommendation(res.data?.data?.recommendation || null);
        setReadiness({
          resume: res.data?.data?.resume || null,
          interview: res.data?.data?.interview || null,
        });
      })
      .catch(() => {
        setRecommendation(null);
        setReadiness(null);
      });
  }, [selected, marks]);

  const roleLabel = (typeof role === "string" ? role : role?.label || "").trim();
  const canSearch = roleLabel.length >= 2 && !loading;

  const handleSearch = async () => {
    if (!canSearch) return;
    // const allowed = requestScan("opportunity_find");
    // if (!allowed) return;

    setLoading(true);
    setError("");
    try {
      const payload = {
        role: roleLabel,
        skills,
        location: location.trim(),
        remote_preference: remotePreference,
        experience,
      };
      const res = await findOpportunitiesService(payload);
      const data = res.data?.data || {};
      const list = data.opportunities || [];
      setOpportunities(list);
      setMeta(data.meta || null);
      setRejectedCount(data.rejected_count || 0);
      setSummary(data.summary || null);
      setSelectedId(list[0]?.id || null);
      incrementScan("opportunity_find");

      saveLastSearch({
        query: data.query || payload,
        opportunities: list,
        meta: data.meta,
        rejected_count: data.rejected_count || 0,
        summary: data.summary || null,
      });

      // Context for guests (logged-in already updated server-side)
      if (!isLoggedIn) {
        try {
          await setActiveContext({
            source_module: "opportunity_find",
            source_label: "Find",
            role: payload.role,
            company: "Opportunity Search",
            experience: payload.experience || "Not Specified",
            description: [
              payload.location && `Location: ${payload.location}`,
              payload.remote_preference !== "any"
                ? `Remote: ${payload.remote_preference}`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
          });
        } catch (_) {
          /* non-blocking */
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Search failed. Please try again in a moment."
      );
      setOpportunities([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMark = async (status) => {
    if (!selected) return;
    const id = selected.id;
    const prev = marks[id];

    // Optimistic UI
    setMarks((m) => ({ ...m, [id]: status }));

    if (isLoggedIn) {
      try {
        await upsertSavedOpportunityService({
          external_id: id,
          status,
          role: selected.role,
          company: selected.company,
          location: selected.location,
          source_url: selected.source_url,
          source_platform: selected.source_platform,
          payload: selected,
          verification: selected.verification,
        });
        // Mirror to local as offline cache (does not replace server source of truth)
        upsertSavedLocal(selected, status);
      } catch (err) {
        // Rollback UI — never claim success if backend failed
        setMarks((m) => {
          const n = { ...m };
          if (prev) n[id] = prev;
          else delete n[id];
          return n;
        });
        setError(
          err.response?.data?.message ||
            "Could not save this opportunity. Please try again."
        );
      }
    } else {
      upsertSavedLocal(selected, status);
    }
  };

  const handleUnsave = async () => {
    if (!selected) return;
    const id = selected.id;
    const prev = marks[id];

    // Optimistic UI
    setMarks((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });

    if (isLoggedIn) {
      try {
        await removeSavedOpportunityService(id);
        removeSavedLocal(id);
      } catch (err) {
        // Rollback UI
        setMarks((m) => ({ ...m, [id]: prev || "saved" }));
        setError(
          err.response?.data?.message ||
            "Could not remove saved opportunity. Please try again."
        );
      }
    } else {
      removeSavedLocal(id);
    }
  };

  const applyRecent = (r) => {
    if (r.role) setRole({ id: "recent", label: r.role });
    if (r.location) setLocation(r.location || "");
    if (r.remote_preference) setRemotePreference(r.remote_preference);
    if (r.experience) setExperience(r.experience || "");
    if (Array.isArray(r.skills)) setSkills(r.skills);
  };

  const MAX_RESUME_MB = 5;
  const ALLOWED_RESUME_EXT = [".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt", ".html", ".htm"];

  const validateResumeFile = (f) => {
    if (!f) return "Please choose a resume file first.";
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_RESUME_EXT.includes(ext)) {
      return "Supported formats: PDF, DOCX, DOC, TXT, RTF, ODT, HTML.";
    }
    if (f.size > MAX_RESUME_MB * 1024 * 1024) {
      return `File is too large. Max size is ${MAX_RESUME_MB}MB.`;
    }
    return "";
  };

  const handleQuickMatch = async () => {
    if (!selected) return;
    const fileErr = validateResumeFile(matchFile);
    if (fileErr) {
      setMatchError(fileErr);
      return;
    }
    const allowed = requestScan("resume_review");
    if (!allowed) return;

    setMatching(true);
    setMatchError("");
    try {
      const jobDescription = opportunityContextPayload(selected).description;
      const { data } = await analyzeResumeService(matchFile, {
        role: selected.role,
        experience: experience || "",
        description: jobDescription,
      });
      incrementScan("resume_review");
      setMatchResult(data.data);
    } catch (err) {
      setMatchError(
        err.response?.data?.message || "Could not analyze this resume right now. Please try again."
      );
    } finally {
      setMatching(false);
    }
  };

  // Build a real job-description text from the selected opportunity so
  // Resume Review / Resume Builder / Interview can genuinely match against
  // THIS role — not just a bare title. Never invented data: only fields
  // already present on the opportunity itself.
  const opportunityContextPayload = (opp) => {
    const descParts = [
      opp.description || "",
      opp.requirements?.length ? `Key requirements: ${opp.requirements.join(", ")}` : "",
      opp.employment_type ? `Employment type: ${opp.employment_type}` : "",
    ].filter(Boolean);

    return {
      source_module: "opportunity_match",
      source_label: "Opportunity",
      role: opp.role,
      company: opp.company || "Selected opportunity",
      experience: experience || "Not Specified",
      location: opp.location || "",
      employment_type: opp.employment_type || "",
      description: descParts.join("\n\n"),
    };
  };

  // Sets the selected opportunity as the active career context, then routes
  // to an internal JobGuard tool. Context replace is never silent — if a
  // different context is already active, the user is asked first.
  const goToToolWithOpportunity = (href) => {
    if (!selected || !href) return;
    const payload = opportunityContextPayload(selected);
    if (needsReplaceConfirmation(payload.role)) {
      setPendingContext(payload);
      setPendingHref(href);
      return;
    }
    setActiveContext(payload).then(() => navigate(href));
  };

  const confirmContextReplace = async () => {
    if (!pendingContext || !pendingHref) return;
    await setActiveContext(pendingContext);
    const href = pendingHref;
    setPendingContext(null);
    setPendingHref(null);
    navigate(href);
  };

  const cancelContextReplace = () => {
    setPendingContext(null);
    setPendingHref(null);
  };

  return (
    <div className="tool-page page-reveal">
      <div className="tool-container">
        <div className="tool-page-header">
          <div
            className="input-panel-label"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}
          >
            <Search size={14} />
            <span>Opportunity Find</span>
          </div>
          <h1 className="tool-page-title">
            Find opportunities,
            <br />
            then verify before you apply.
          </h1>
          <p className="tool-page-sub">
            Tell JobGuard what you’re looking for. Results pass through a validation
            layer before they’re recommended — no blind listings.
          </p>
        </div>

        {/* Search form */}
        <div className="tool-card" style={{ marginBottom: 24 }}>
          <div className="tool-step-fields" style={{ gap: 14 }}>
            <div>
              <label className="form-label">Target role</label>
              <RoleSearch value={role} onSelect={setRole} placeholder="e.g. Frontend Developer" />
            </div>

            <div>
              <label className="form-label">Skills / keywords (optional)</label>
              <SkillsAutocomplete value={skills} onChange={setSkills} />
            </div>

            <div className="opp-form-row">
              <div style={{ flex: 1 }}>
                <label className="form-label">Location (optional)</label>
                <input
                  className="centered-input"
                  placeholder="City, country, or leave blank"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Work style</label>
                <select
                  className="centered-input"
                  value={remotePreference}
                  onChange={(e) => setRemotePreference(e.target.value)}
                >
                  {REMOTE_OPTS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Experience</label>
                <select
                  className="centered-input"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                >
                  <option value="">Any level</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l.id} value={l.label}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="field-error-msg" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            <div className="analyze-btn-wrapper" style={{ marginTop: 8 }}>
              <div className="analyze-btn-glow bg-gradient-to-br from-cyan-500 to-indigo-600" />
              <button
                type="button"
                className="analyze-btn"
                disabled={!canSearch}
                onClick={handleSearch}
                style={{ opacity: canSearch ? 1 : 0.6, cursor: canSearch ? "pointer" : "not-allowed" }}
              >
                <Sparkles size={18} />
                {loading ? "Searching…" : "Find Opportunities"}
              </button>
            </div>
          </div>

          {recent.length > 0 && !opportunities.length && (
            <div style={{ marginTop: 20 }}>
              <div className="result-section-title" style={{ marginBottom: 8 }}>Recent searches</div>
              <div className="opp-recent-chips">
                {recent.slice(0, 5).map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn-ghost opp-recent-chip"
                    onClick={() => applyRecent(r)}
                  >
                    <RotateCcw size={12} />
                    {r.role}
                    {r.location ? ` · ${r.location}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search summary / report header — reuses existing result-section
            styling, not a new design language. Only renders fields the
            user actually specified; result count is explicitly framed as
            "verified" to reinforce the product's verified-only promise. */}
        {summary && opportunities.length > 0 && (
          <div className="tool-card opp-summary-card" style={{ marginBottom: 16 }}>
            <div className="result-section-title">Opportunity Search</div>
            <div className="opp-badge-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <span className="opp-badge">{roleLabel}</span>
              {skills.map((s) => (
                <span key={s} className="opp-badge">{s}</span>
              ))}
              {remotePreference !== "any" && (
                <span className="opp-badge">
                  {REMOTE_OPTS.find((o) => o.id === remotePreference)?.label || remotePreference}
                </span>
              )}
              {location && <span className="opp-badge">{location}</span>}
            </div>
            <p style={{ fontSize: 15, marginTop: 10, marginBottom: 0 }}>
              <strong>{summary.verified}</strong> verified opportunit{summary.verified === 1 ? "y" : "ies"} found
              {summary.discovered > summary.verified ? (
                <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                  {" "}
                  — {summary.discovered} discovered, {summary.matched} matched your filters, only fully verified
                  results are shown.
                </span>
              ) : null}
            </p>
          </div>
        )}

        {/* Provider honesty banner — development/sample results only.
            "unavailable"/"error" have no rows to show a banner above, so
            those render as a dedicated empty state below instead. */}
        {meta && meta.discovery_status === "sample" && (
          <div className="opp-dev-banner">
            <WifiOff size={16} />
            <div>
              <strong>Development samples</strong>
              <span>
                {meta.note ||
                  "No live job-board provider is configured. Results are labeled samples for testing — not live openings."}
              </span>
            </div>
          </div>
        )}

        {/* Results: two-panel */}
        {opportunities.length > 0 && (
          <div className="opp-results-layout">
            {/* List */}
            <div className="opp-list-panel" role="list" aria-label="Opportunity results">
              {opportunities.map((opp) => {
                const active = opp.id === selectedId;
                return (
                  <button
                    key={opp.id}
                    type="button"
                    role="listitem"
                    className={`opp-list-card ${active ? "active" : ""}`}
                    onClick={() => setSelectedId(opp.id)}
                    aria-current={active ? "true" : undefined}
                  >
                    <div className="opp-list-card-top">
                      <span className="opp-list-role">{opp.role}</span>
                      {statusBadge(opp.verification)}
                    </div>
                    <div className="opp-list-meta">
                      <span><Briefcase size={12} /> {opp.company}</span>
                      <span><MapPin size={12} /> {opp.location || "—"}</span>
                    </div>
                    {opp.is_development_sample && (
                      <span className="opp-sample-tag">Sample</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Detail */}
            <div className="opp-detail-panel">
              {selected ? (
                <>
                  <div className="opp-detail-header">
                    <h2 className="opp-detail-title">{selected.role}</h2>
                    <div className="opp-detail-sub">
                      {selected.company}
                      {selected.location ? ` · ${selected.location}` : ""}
                      {selected.employment_type ? ` · ${selected.employment_type}` : ""}
                    </div>
                    <div className="opp-detail-badges">
                      {statusBadge(selected.verification)}
                      <span className="opp-badge">
                        {freshnessLabel(selected.verification?.freshness)}
                      </span>
                      {selected.source_platform && (
                        <span className="opp-badge">Source: {selected.source_platform}</span>
                      )}
                      {selected.is_development_sample && (
                        <span className="opp-badge opp-badge-sample">Development sample</span>
                      )}
                    </div>
                  </div>

                  {/* JobGuard analysis */}
                  <div className="result-section">
                    <div className="result-section-title">JobGuard Analysis</div>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      {selected.verification?.summary}
                    </p>
                    {selected.verification?.concerns?.length > 0 && (
                      <ul className="result-section-list" style={{ marginTop: 10 }}>
                        {selected.verification.concerns.map((c, i) => (
                          <li key={i} className="result-section-item">
                            <AlertTriangle size={14} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Relevance — deterministic, explainable signals; Gemini only
                      phrases them (see backend opportunityRelevanceService.js).
                      Never a bare "AI score". */}
                  {selected.relevance && (
                    <div className="result-section">
                      <div className="result-section-title">Why this matches your search</div>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {selected.relevance.explanation ||
                          (selected.relevance.reasons?.length
                            ? selected.relevance.reasons.join(" ")
                            : "Not enough overlap with your search to explain a strong match.")}
                      </p>
                      {selected.relevance.missing_skills?.length > 0 && (
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                          Doesn't clearly mention: {selected.relevance.missing_skills.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {selected.description && (
                    <div className="result-section">
                      <div className="result-section-title">About this role</div>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65 }}>
                        {selected.description}
                      </p>
                    </div>
                  )}

                  {selected.requirements?.length > 0 && (
                    <div className="result-section">
                      <div className="result-section-title">Requirements</div>
                      <ul className="result-section-list">
                        {selected.requirements.map((r, i) => (
                          <li key={i} className="result-section-item">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Readiness — real data only */}
                  <div className="result-section">
                    <div className="result-section-title">Your readiness</div>
                    <div className="opp-readiness-grid">
                      <div className="opp-readiness-item">
                        <strong>Resume</strong>
                        {!readiness?.resume?.exists ? (
                          <span>No JobGuard resume is connected yet</span>
                        ) : (
                          <span>
                            Connected
                            {typeof readiness.resume.ats_score === "number"
                              ? ` · ATS ${readiness.resume.ats_score}/100`
                              : ""}
                            {readiness.resume.role ? ` · ${readiness.resume.role}` : ""}
                            <br />
                            <span style={{ fontSize: 12, opacity: 0.75 }}>
                              That score is from your most recent resume — not yet matched to this specific role.
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="opp-readiness-item">
                        <strong>Interview</strong>
                        {!readiness?.interview?.exists ? (
                          <span>Interview readiness hasn't been assessed yet</span>
                        ) : (
                          <span>
                            Practiced
                            {typeof readiness.interview.overall_score === "number"
                              ? ` · Score ${readiness.interview.overall_score}/100`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="opp-detail-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setShowMatchUpload((v) => !v)}
                      >
                        <Target size={16} />
                        Quick check: how does my resume fit this role?
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => goToToolWithOpportunity("/resume-builder-review?mode=review")}
                      >
                        {readiness?.resume?.exists ? "Open full Resume Review" : "Build a resume for this opportunity"}
                      </button>
                    </div>

                    {showMatchUpload && (
                      <div className="result-section" style={{ marginTop: 12, background: "var(--surface-2, transparent)" }}>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
                          Upload your resume to see a real fit score for <strong>{selected.role}</strong> at{" "}
                          {selected.company}. This runs the same analysis engine as Resume Review, so it counts
                          toward your resume-review usage{isLoggedIn ? " and is saved to your resume history." : "."}
                        </p>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <label className="btn-secondary" style={{ cursor: "pointer", margin: 0 }}>
                            <Upload size={16} />
                            {matchFile ? matchFile.name : "Choose resume file"}
                            <input
                              type="file"
                              accept={ALLOWED_RESUME_EXT.join(",")}
                              style={{ display: "none" }}
                              onChange={(e) => {
                                setMatchFile(e.target.files?.[0] || null);
                                setMatchError("");
                                setMatchResult(null);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="analyze-btn"
                            disabled={!matchFile || matching}
                            onClick={handleQuickMatch}
                            style={{ opacity: !matchFile || matching ? 0.6 : 1 }}
                          >
                            <Sparkles size={16} />
                            {matching ? "Checking fit…" : "Check fit"}
                          </button>
                        </div>

                        {matchError && (
                          <div className="field-error-msg" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                            <AlertTriangle size={16} /> {matchError}
                          </div>
                        )}

                        {matchResult && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              {(matchResult.ats_score ?? matchResult.overall_score ?? 0) >= 65 ? (
                                <CheckCircle2 size={18} color="var(--green, #22c55e)" />
                              ) : (
                                <XCircle size={18} color="var(--amber)" />
                              )}
                              <strong>
                                Fit score: {matchResult.ats_score ?? matchResult.overall_score ?? "—"}/100
                              </strong>
                              {matchResult.hiring_readiness?.label && (
                                <span className="opp-badge">{matchResult.hiring_readiness.label}</span>
                              )}
                            </div>
                            {matchResult.isFallback && (
                              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                This analysis couldn't be fully generated — try again for a complete result.
                              </p>
                            )}
                            {matchResult.missing_skills?.length > 0 && (
                              <>
                                <div className="result-section-title" style={{ marginTop: 10, marginBottom: 6 }}>
                                  Missing / weak areas for this role
                                </div>
                                <ul className="result-section-list">
                                  {matchResult.missing_skills.slice(0, 6).map((s, i) => (
                                    <li key={i} className="result-section-item">{s}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ marginTop: 10 }}
                              onClick={() => goToToolWithOpportunity("/resume-builder-review?mode=review")}
                            >
                              See full review &amp; optimize for this opportunity
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Next action */}
                  {recommendation && (
                    <div className="opp-next-action">
                      <div className="opp-next-action-label">
                        <Info size={14} /> Recommended next step
                      </div>
                      <p className="opp-next-action-reason">{recommendation.reason}</p>
                      <div className="opp-next-action-btns">
                        {recommendation.external && recommendation.href ? (
                          <a
                            className="analyze-btn"
                            href={recommendation.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <ExternalLink size={16} />
                            {recommendation.label}
                          </a>
                        ) : recommendation.href ? (
                          <button
                            type="button"
                            className="analyze-btn"
                            onClick={() => goToToolWithOpportunity(recommendation.href)}
                          >
                            <ArrowRight size={16} />
                            {recommendation.label}
                          </button>
                        ) : (
                          <span className="btn-secondary" style={{ cursor: "default" }}>
                            {recommendation.label}
                          </span>
                        )}
                        {recommendation.secondary?.href && (
                          recommendation.secondary.external ? (
                            <a
                              className="btn-secondary"
                              href={recommendation.secondary.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: "none" }}
                            >
                              {recommendation.secondary.label}
                            </a>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => goToToolWithOpportunity(recommendation.secondary.href)}
                            >
                              {recommendation.secondary.label}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions: save / applied / external apply */}
                  <div className="opp-detail-actions">
                    {marks[selected.id] === "saved" ? (
                      <button type="button" className="btn-secondary" onClick={handleUnsave}>
                        <BookmarkCheck size={16} /> Saved
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary" onClick={() => handleMark("saved")}>
                        <Bookmark size={16} /> Save
                      </button>
                    )}
                    {marks[selected.id] !== "applied" && (
                      <button type="button" className="btn-ghost" onClick={() => handleMark("applied")}>
                        Mark as applied
                      </button>
                    )}
                    {selected.source_url && selected.verification?.status !== "rejected" && (
                      <a
                        className="btn-primary"
                        href={selected.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none", marginLeft: "auto" }}
                      >
                        <ExternalLink size={16} /> Apply on source
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="opp-detail-empty">Select an opportunity to review JobGuard’s analysis.</div>
              )}
            </div>
          </div>
        )}

        {/* Context replace confirmation — never silent, per Context Engine rule */}
        {pendingContext && (
          <>
            <div className="screen-overlay" onClick={cancelContextReplace} />
            <div className="popup-modal" style={{ textAlign: "left", maxWidth: 420 }}>
              <div className="result-section-title" style={{ marginBottom: 8 }}>
                Switch career context?
              </div>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 4 }}>
                You currently have <strong>{context?.role}</strong> as your active context.
              </p>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                Switching to <strong>{pendingContext.role}</strong> at {pendingContext.company} will update what
                Resume Review, Resume Builder, and Interview use for this session.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={cancelContextReplace}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={confirmContextReplace}>
                  Switch context
                </button>
              </div>
            </div>
          </>
        )}

        {/* No results */}
        {!loading && meta && opportunities.length === 0 && (
          <div className="tool-card opp-empty-state">
            {meta.discovery_status === "unavailable" || meta.discovery_status === "error" ? (
              <>
                <WifiOff size={28} color="var(--amber)" />
                <h3>Live job discovery is currently unavailable</h3>
                <p>
                  {meta.note || "Please try again later."}
                </p>
              </>
            ) : rejectedCount > 0 ? (
              <>
                <ShieldCheck size={28} color="var(--amber)" />
                <h3>Found potential opportunities, but none passed verification</h3>
                <p>
                  JobGuard discovered {rejectedCount} listing{rejectedCount === 1 ? "" : "s"} for this search, but
                  none had enough evidence (source, freshness, risk signals) to pass JobGuard verification.
                </p>
                <ul>
                  <li>Try a broader or related role title</li>
                  <li>Check again later — listings refresh over time</li>
                </ul>
              </>
            ) : (
              <>
                <AlertTriangle size={28} color="var(--amber)" />
                <h3>No verified opportunities matched your current criteria</h3>
                <p>
                  JobGuard only surfaces listings that pass validation. Try adjusting your search:
                </p>
                <ul>
                  <li>Broaden or clear the location</li>
                  <li>Switch work style to “Any”</li>
                  <li>Remove one skill filter</li>
                  <li>Search a related role title</li>
                  <li>Check again later</li>
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
