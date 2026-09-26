import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2,
  AlertTriangle, 
  Download, 
  ArrowLeft, 
  ArrowRight,
  Wrench, 
  Sparkles,
  Wand2,
  RotateCcw,
  Info,
  Lock,
  Columns2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Document, Packer, Paragraph } from "docx";
import { useAuth } from "../context/AuthContext";
import { useContextEngine } from "../context/ContextEngineContext";
import StepProgress from "../components/common/StepProgress";
import OpportunitySourceTabs from "../components/common/OpportunitySourceTabs";
import CurrentContextCard from "../components/context/CurrentContextCard";
import { ChipMultiSelect, TextAreaField, TextListField, StructuredListEditor } from "../components/common/EditableReviewFields";
import { ScoreChip, ListSection } from "../components/common/ResultPrimitives";
import { analyzeResumeService, optimizeResumeService } from "../services/resume.service";

// ── Fix: renders one item the same way ListSection does, so the local
//    accordion wrapper below matches the shared primitive's output exactly
//    without having to export/change ResultPrimitives (used by other tools).
function renderReviewItemText(it) {
  if (typeof it === "string") return it;
  if (it == null) return "";
  if (typeof it === "object") {
    return it.text || it.point || it.note || it.title || it.summary || JSON.stringify(it);
  }
  return String(it);
}

// ── New fix: one-line plain-language explanation under technical headings
//    (Keyword Match, Formatting, Experience/Projects Analysis, etc.) so the
//    review page reads less like a raw report and more like guidance.
const SECTION_HINTS = {
  strengths: "What your resume already does well.",
  weaknesses: "Areas that could be holding your resume back with recruiters.",
  ats: "Skills this job wants that your resume doesn't clearly show.",
  formatting: "Structural issues that can trip up ATS systems.",
  experience: "How your work history reads against this role.",
  education: "How your academic background supports this role.",
  projects: "How your projects demonstrate relevant skills.",
  recommendations: "Suggested next steps to strengthen your resume.",
};

// ── New fix: color hierarchy so the review page doesn't read as one long
//    list of equal-weight cards — red for problems, green for strengths,
//    blue for what to do next, orange for formatting.
const SECTION_TONES = {
  weaknesses: "red",
  strengths: "green",
  recommendations: "blue",
  formatting: "orange",
};

// ── Fix #1/#2: collapsed-by-default section so the review doesn't render
//    as one long open wall — click a header to expand just that section.
function CollapsibleReviewSection({ id, title, items, positive, openIds, onToggle, isOptimized }) {
  if (!items || items.length === 0) return null;
  const isOpen = openIds.has(id);
  const hint = SECTION_HINTS[id];
  const tone = SECTION_TONES[id];
  return (
    <div
      className={`result-section accordion-section${tone ? ` tone-${tone}` : ""}`}
      style={{ marginBottom: "8px" }}
    >
      <button type="button" className="accordion-header" onClick={() => onToggle(id)}>
        <span className="accordion-header-left">
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          <span className="result-section-title" style={{ marginBottom: 0 }}>{title}</span>
        </span>
        <span className="accordion-summary">{items.length} item{items.length === 1 ? "" : "s"}</span>
      </button>
      {hint && <p className="accordion-hint">{hint}</p>}
      {isOptimized && (
        <p className="included-in-optimization-note">
          <CheckCircle2 size={12} /> Included in optimization ✓
        </p>
      )}
      {isOpen && (
        <ul className="result-section-list" style={{ marginTop: "8px" }}>
          {items.map((it, i) => (
            <li key={i} className="result-section-item">
              {positive && <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />}
              <span>{renderReviewItemText(it)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── New fix: plain-language summary of the review, shown first so the
//    user understands the headline result without scrolling. Purely
//    derived from fields already in `result` — no extra network call.
function buildResultSummary(result) {
  if (!result) return "";
  const missingKeywords = result?.keyword_match?.missing_keywords?.length || 0;
  const missingSkills = result?.missing_skills?.length || 0;
  const ats = result?.ats_score;
  const overall = result?.overall_score;

  let verdict = "workable, but needs improvement";
  if (overall != null) {
    if (overall >= 80) verdict = "strong";
    else if (overall >= 60) verdict = "competitive";
    else if (overall >= 40) verdict = "workable, but needs improvement";
    else verdict = "not ready yet for this role";
  }

  const gapBits = [];
  if (missingKeywords > 0) gapBits.push(`${missingKeywords} important keyword${missingKeywords === 1 ? "" : "s"}`);
  if (missingSkills > 0) gapBits.push(`${missingSkills} critical skill${missingSkills === 1 ? "" : "s"}`);

  let sentence = `Your resume is ${verdict}`;
  if (gapBits.length > 0) sentence += `, but it is missing ${gapBits.join(" and ")}`;
  sentence += ".";
  if (ats != null) sentence += ` Estimated ATS compatibility: ${Math.round(ats)}%.`;
  return sentence;
}

// ── Fix #5: satisfying before → after score readout once the optimized
//    resume comes back — the biggest "wow" moment of the whole flow.
function ScoreImprovementChip({ label, before, after }) {
  if (before == null || after == null) return null;
  const diff = Math.round(after) - Math.round(before);
  const improved = diff > 0;
  return (
    <div className="score-improve-chip">
      <span className="score-improve-label">{label}</span>
      <span className="score-improve-values">
        <span className="score-improve-before">{Math.round(before)}</span>
        <ArrowRight size={13} />
        <span className={`score-improve-after ${improved ? "up" : diff < 0 ? "down" : ""}`}>{Math.round(after)}</span>
      </span>
      {diff !== 0 && (
        <span className={`score-improve-delta ${improved ? "up" : "down"}`}>
          {improved ? "↑" : "↓"} {improved ? "+" : ""}{diff}
        </span>
      )}
    </div>
  );
}

export default function ResumeReview({ onSwitchToBuild } = {}) {
  const navigate = useNavigate();
  const { requestScan, incrementScan, isLoggedIn, permissions } = useAuth();
  const { context, hasContext, setActiveContext } = useContextEngine();

  const STEPS = ["Opportunity", "Upload Resume", "Review"];
  const STEP = {
    OPPORTUNITY: 1,
    UPLOAD: 2,
    REVIEW: 3,
  };

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // "Generate Optimized Resume" — completely separate, optional AI call,
  // only triggered after the review is already shown. Never combined with
  // the initial analyze loading state above.
  const [optimizing, setOptimizing] = useState(false);
  const [optimized, setOptimized] = useState(null);
  const [optimizeError, setOptimizeError] = useState("");

  // User-supplied fill-ins for whatever the AI flagged as missing/weak —
  // sent along with Optimize so the rewrite can actually use them.
  const [userEdits, setUserEdits] = useState({
    missing_skills: [],
    missing_certifications: [],
    missing_languages: [],
    summary: "",
    projects: "",
    achievements: "",
    missing_links: [""],
    experience: [],
    education: [],
  });
  const updateEdit = (key, val) => setUserEdits((prev) => ({ ...prev, [key]: val }));

  const [showCompare, setShowCompare] = useState(false);

  // Fix #2: which analysis sections are expanded — collapsed by default.
  const [openSections, setOpenSections] = useState(new Set());
  const toggleSection = (id) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Fix #3: "Improve Missing Information" — Quick Fixes shown, Advanced collapsed.
  const [showAdvancedInfo, setShowAdvancedInfo] = useState(false);

  // Fix #5: whole "Improve Missing Information" section collapsed by default —
  // only expands when the user explicitly asks to add something.
  const [showMissingInfo, setShowMissingInfo] = useState(false);

  // Fix #10: drag & drop onto the upload zone.
  const [isDragging, setIsDragging] = useState(false);

  const effectiveRole = hasContext ? context.role : "";
  const effectiveExperience = hasContext ? context.experience : "";

  const MAX_RESUME_MB = 5;
  const ALLOWED_RESUME_EXT = [".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt", ".html", ".htm"];

  const validateResumeFile = (f) => {
    if (!f) return "Please select a resume file first.";
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_RESUME_EXT.includes(ext)) {
      return "Supported formats: PDF, DOCX, DOC, TXT, RTF, ODT, HTML.";
    }
    if (f.size > MAX_RESUME_MB * 1024 * 1024) {
      return `File is too large. Max size is ${MAX_RESUME_MB}MB.`;
    }
    return "";
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // Fix #7: real Word document instead of a bare .txt download — the raw
  // rewritten text is split into paragraphs (blank lines become spacing),
  // same "docx" package already used by the Resume Builder's download.
  const handleDownloadOptimized = async () => {
    if (!optimized?.optimized_resume_text) return;
    const lines = optimized.optimized_resume_text.split("\n");
    const children = lines.map(
      (line) => new Paragraph({ text: line.trim() ? line : "" })
    );
    const doc = new Document({
      sections: [
        {
          properties: {
            page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
          },
          children,
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimized-resume.docx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleChangeContext = () => {
    setError("");
    setResult(null);
    setOptimized(null);
    setOptimizeError("");
    setStep(1);
  };

  const handleOpportunitySubmit = async (payload) => {
    // source_module set LAST and explicitly — this tool always owns it,
    // regardless of anything (e.g. input_method) coming back in payload.
    await setActiveContext({ ...payload, source_module: "resume_review" });
    setStep(STEP.UPLOAD);
  };

  // Fix #9: loading shown as a checklist that fills in step by step, instead
  // of a single message swapping out — feels like real progress, not a loop.
  const loadingSteps = [
    "Resume Uploaded",
    "Extracting Text",
    "ATS Analysis",
    "Analyzing Experience",
    "Matching Keywords",
    "Generating Suggestions",
  ];

  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      i = Math.min(i + 1, loadingSteps.length - 1);
      setLoadingStepIndex(i);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (hasContext && step === STEP.OPPORTUNITY) {
      setStep(STEP.UPLOAD);
    }
  }, [hasContext, step]);

  const handleAnalyze = async () => {
    const fileErr = validateResumeFile(file);
    if (fileErr) {
      setError(fileErr);
      return;
    }
    if (!hasContext) {
      setError("Career context missing. Please set the role you're applying for first.");
      setStep(STEP.OPPORTUNITY);
      return;
    }

    setError("");
    const allowed = requestScan("resume_review");
    if (!allowed) return;

    setLoading(true);
    try {
      const { data } = await analyzeResumeService(file, {
        role: effectiveRole,
        experience: effectiveExperience,
        description: hasContext ? context.description : "",
      });

      incrementScan("resume_review");
      const r = data.data;
      setResult(r);
      setOptimized(null);
      setOptimizeError("");
      setOpenSections(new Set());
      setShowAdvancedInfo(false);
      setShowMissingInfo(false);
      setShowCompare(false);
      setUserEdits({
        missing_skills: Array.isArray(r?.missing_skills) ? r.missing_skills : [],
        missing_certifications: Array.isArray(r?.missing_certifications) ? r.missing_certifications : [],
        missing_languages: Array.isArray(r?.missing_languages) ? r.missing_languages : [],
        summary: r?.weak_summary || "",
        projects: "",
        achievements: Array.isArray(r?.achievements) ? r.achievements.join("\n") : "",
        missing_links: Array.isArray(r?.missing_links) && r.missing_links.length ? r.missing_links : [""],
        experience: [],
        education: [],
      });
      setStep(STEP.REVIEW);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Resume analysis failed. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const canOptimize = !!permissions?.resume_optimize?.allowed;

  const handleGenerateOptimized = async () => {
    if (!file || !result) return;
    // Same shared permission layer every tool uses — correctly blocks guests
    // AND logged-in members below Career Plus (resume_optimize requires
    // Plus in careerConfig.js), and surfaces the standard upgrade popup.
    if (!requestScan("resume_optimize")) return;
    setOptimizeError("");
    setOptimizing(true);
    try {
      const { data } = await optimizeResumeService(
        file,
        {
          role: effectiveRole,
          experience: effectiveExperience,
          description: hasContext ? context.description : "",
        },
        {
          weaknesses: result.weaknesses,
          priority_fixes: result.priority_fixes,
          missing_skills: userEdits.missing_skills,
          user_edits: userEdits,
        },
      );
      setOptimized(data.data);
      setShowCompare(true);
      incrementScan("resume_optimize");
    } catch (err) {
      setOptimizeError(
        err.response?.data?.message ||
          "Couldn't generate the optimized resume. Please try again.",
      );
    } finally {
      setOptimizing(false);
    }
  };

  // Review and Build were two dead-end journeys under one landing page —
  // this lets an optimized resume flow straight into the Builder instead of
  // the user having to start over from scratch there.
  // Fix #10: send the full optimization output into the Builder, not just
  // the rewritten text as a "summary" — skills, certifications, languages,
  // achievements, and any extra experience/education the user added all
  // carry over too. Future-proofs the Review → Builder handoff as the
  // Builder grows to use more of this data.
  const handleContinueInBuilder = () => {
    const summary = optimized?.optimized_resume_text || "";
    const resumeData = {
      skills: userEdits.missing_skills,
      certifications: userEdits.missing_certifications,
      languages: userEdits.missing_languages,
      achievements: userEdits.achievements
        ? userEdits.achievements.split("\n").map((s) => s.trim()).filter(Boolean)
        : [],
    };
    if (onSwitchToBuild) {
      onSwitchToBuild(summary, resumeData);
      return;
    }
    navigate("/resume-builder-review?mode=build", {
      state: { prefillSummary: summary, prefillResumeData: resumeData },
    });
  };

  const handleReviewAnother = () => {
    setFile(null);
    setResult(null);
    setOptimized(null);
    setError("");
    setOptimizeError("");
    setShowCompare(false);
    setOpenSections(new Set());
    setShowAdvancedInfo(false);
    setShowMissingInfo(false);
    setStep(STEP.UPLOAD);
  };

  const handleBackToUpload = () => {
    setResult(null);
    setOptimized(null);
    setOptimizeError("");
    setShowCompare(false);
    setOpenSections(new Set());
    setShowAdvancedInfo(false);
    setShowMissingInfo(false);
    setStep(STEP.UPLOAD);
  };

  return (
    <div className="verify-page tool-page">
      <div className="verify-container">
        {/* Header */}
        <div className="verify-header">
          <div className="input-panel-label" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <Wrench size={14} className="text-cyan" />
            <span>Smart Resume Audit</span>
          </div>
          <h1 className="verify-title">Fix critical flaws before you apply.</h1>
          <p className="verify-desc">
            Instant scoring for ATS formatting gaps, weak keywords, and recruiter red flags. Maximum callback rate.
          </p>
          <button
            type="button"
            className="tool-mode-switch-link"
            onClick={() => (onSwitchToBuild())}
          >
            Need a fresh resume instead? Start Building →
          </button>
        </div>

        {hasContext && <CurrentContextCard onChange={handleChangeContext} />}

        <StepProgress steps={STEPS} currentStep={step} />

        {/* Main Body */}
        <div className={`verify-layout ${loading || result ? "modal-active" : ""}`}>
          
          {/* STEP 1: Opportunity */}
          {step === STEP.OPPORTUNITY && !hasContext && (
            <div className="tool-card">
              <h2 className="input-panel-title">What role are you applying for?</h2>
              <p className="tool-step-sub">
                This lets us tailor the review to the job — matching skills, keywords, and expectations.
              </p>
              <OpportunitySourceTabs onSubmit={handleOpportunitySubmit} />

              {error && <div className="field-error-msg pt-2">{error}</div>}
            </div>
          )}

          {/* STEP 2: Upload */}
          {step === STEP.UPLOAD && !result && (
            <div className="tool-card">
              <h2 className="input-panel-title">Upload your resume</h2>
              <p className="tool-step-sub">
                We'll analyze it against <strong>{effectiveRole || "your targeted role"}</strong>
                {effectiveExperience ? ` (${effectiveExperience})` : ""}. Supported: PDF, DOCX, DOC, TXT, RTF, ODT, HTML.
              </p>

              <div
                className={`upload-area${isDragging ? " dragging" : ""}`}
                onClick={() => document.getElementById("resume-upload").click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0] || null;
                  const validationError = f ? validateResumeFile(f) : "";
                  if (validationError) {
                    setError(validationError);
                    setFile(null);
                    return;
                  }
                  setError("");
                  setFile(f);
                }}
              >
                <div className="upload-icon">
                  <UploadCloud size={28} />
                </div>
                {file ? (
                  <div className="upload-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={18} /> <span>{file.name}</span>
                  </div>
                ) : (
                  <>
                    <div className="upload-title">Drag & Drop Resume</div>
                    <div className="upload-sub">or Browse Files · PDF, DOCX, DOC, TXT, RTF, ODT or HTML · Max {MAX_RESUME_MB}MB</div>
                  </>
                )}
                <input
                  id="resume-upload"
                  type="file"
                  className="upload-input"
                  accept=".pdf,.docx,.doc,.txt,.rtf,.odt,.html,.htm"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    const validationError = f ? validateResumeFile(f) : "";
                    if (validationError) {
                      setError(validationError);
                      setFile(null);
                      e.target.value = "";
                      return;
                    }
                    setError("");
                    setFile(f);
                  }}
                />
              </div>

              {error && (
                <div className="field-error-msg pt-2" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              <div className="tool-step-nav" style={{ justifyContent: "space-between", marginTop: "24px" }}>
                {!hasContext && (
                  <button type="button" className="btn-secondary" onClick={goBack}>
                    <ArrowLeft size={16} style={{ marginRight: "6px" }} /> Back
                  </button>
                )}

                <button
                  type="button"
                  className="analyze-btn"
                  style={{ marginLeft: "auto" }}
                  disabled={!file || loading}
                  onClick={handleAnalyze}
                >
                  {loading ? "Analyzing…" : "Analyze Resume"}
                </button>
              </div>
            </div>
          )}

          {/* LOADING POPUP — Fix #9: checklist that fills in as it goes */}
          {loading && (
            <>
              <div className="screen-overlay" />
              <div className="popup-modal">
                <div className="popup-spinner">
                  <Sparkles size={40} />
                </div>
                <ul className="loading-checklist">
                  {loadingSteps.slice(0, loadingStepIndex + 1).map((step, i) => (
                    <li
                      key={step}
                      className={`loading-checklist-item ${i < loadingStepIndex ? "done" : "active"}`}
                    >
                      {i < loadingStepIndex ? (
                        <CheckCircle2 size={16} className="loading-checklist-icon" />
                      ) : (
                        <span className="loading-checklist-spinner" />
                      )}
                      <span>
                        {step}
                        {i === loadingStepIndex ? "…" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* STEP 3: REVIEW / RESULTS — pure renderer, all values from backend */}
          {!loading && result && (
            <div className="tool-card">
              {result.isFallback && (
                <div
                  className="field-error-msg"
                  style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}
                >
                  <Info size={16} />
                  This review couldn't be fully generated. Scores below are placeholders — try again for a complete analysis.
                </div>
              )}

              {/* Fix #6: the headline takeaway, first — so the user understands
                  the result even without scrolling further. */}
              {!result.isFallback && (
                <div className="result-summary-callout">
                  <Info size={16} />
                  <p>{buildResultSummary(result)}</p>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
                <ScoreChip label="Overall Score" score={result?.overall_score} />
                <ScoreChip label="ATS Score" score={result?.ats_score} />
                <ScoreChip label="Keyword Match" score={result?.keyword_match?.score} />
              </div>

              {result?.hiring_readiness?.label && (
                <div className="result-section" style={{ marginBottom: "20px" }}>
                  <div className="result-section-title">Hiring Readiness: {result.hiring_readiness.label}</div>
                  {result.hiring_readiness.summary && (
                    <p className="tool-step-sub" style={{ margin: 0 }}>{result.hiring_readiness.summary}</p>
                  )}
                </div>
              )}

              {/* Fix #1: most important thing first — top 3 priority fixes,
                  right under Hiring Readiness, before anything else.
                  Fix #7: red — this is the "problem" card. */}
              {result?.priority_fixes?.length > 0 && (
                <div className="tone-wrap tone-red">
                  <ListSection title="Top 3 Priority Fixes" items={result?.priority_fixes?.slice(0, 3)} />
                  {optimized && (
                    <p className="included-in-optimization-note">
                      <CheckCircle2 size={12} /> Included in optimization ✓
                    </p>
                  )}
                </div>
              )}

              {/* Fix #1 + #2: everything below reordered by importance and
                  collapsed by default — click a header to expand it.
                  Fix #7: color hierarchy — Strengths green, Recommendations
                  blue, Formatting orange (set via SECTION_TONES above).
                  Fix #8: "Included in optimization ✓" once optimized exists.
                  Fix #9: one-line explanation under each heading. */}
              <CollapsibleReviewSection
                id="strengths" title="Strengths" items={result?.strengths} positive
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />
              <CollapsibleReviewSection
                id="weaknesses" title="Weaknesses" items={result?.weaknesses}
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />
              <CollapsibleReviewSection
                id="ats" title="ATS — Missing Skills" items={result?.missing_skills}
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />
              {(result?.keyword_match?.matched_keywords?.length > 0 || result?.keyword_match?.missing_keywords?.length > 0) && (
                <div className="result-section accordion-section" style={{ marginBottom: "8px" }}>
                  <button type="button" className="accordion-header" onClick={() => toggleSection("keywords")}>
                    <span className="accordion-header-left">
                      {openSections.has("keywords") ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      <span className="result-section-title" style={{ marginBottom: 0 }}>Keywords</span>
                    </span>
                    <span className="accordion-summary">
                      {(result?.keyword_match?.matched_keywords?.length || 0)} matched · {(result?.keyword_match?.missing_keywords?.length || 0)} missing
                    </span>
                  </button>
                  {/* Fix #9: plain-language explanation under a technical heading. */}
                  <p className="accordion-hint">How well your resume matches this job.</p>
                  {openSections.has("keywords") && (
                    <div style={{ marginTop: "8px" }}>
                      <ListSection title="Matched Keywords" items={result?.keyword_match?.matched_keywords} positive />
                      <ListSection title="Missing Keywords" items={result?.keyword_match?.missing_keywords} />
                    </div>
                  )}
                </div>
              )}
              <CollapsibleReviewSection
                id="formatting" title="Formatting Issues" items={result?.formatting_issues}
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />
              <CollapsibleReviewSection
                id="experience" title="Experience Analysis" items={result?.experience_analysis}
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />
              <CollapsibleReviewSection
                id="education" title="Education Analysis" items={result?.education_analysis}
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />
              <CollapsibleReviewSection
                id="projects" title="Projects Analysis" items={result?.projects_analysis}
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />
              <CollapsibleReviewSection
                id="recommendations" title="Recommendations" items={result?.recommendations}
                openIds={openSections} onToggle={toggleSection} isOptimized={!!optimized}
              />

              {/* Fix #1: lower-priority read-only extras tucked behind one
                  "Advanced Details" toggle instead of sitting inline. */}
              {(result?.achievements?.length > 0 || result?.priority_fixes?.length > 3) && (
                <div className="result-section accordion-section" style={{ marginBottom: "8px" }}>
                  <button
                    type="button"
                    className="accordion-header"
                    onClick={() => toggleSection("advanced-details")}
                  >
                    <span className="accordion-header-left">
                      {openSections.has("advanced-details") ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      <span className="result-section-title" style={{ marginBottom: 0 }}>Advanced Details</span>
                    </span>
                  </button>
                  {openSections.has("advanced-details") && (
                    <div style={{ marginTop: "8px" }}>
                      <ListSection title="Achievements" items={result?.achievements} positive />
                      <ListSection title="Additional Priority Fixes" items={result?.priority_fixes?.slice(3)} />
                    </div>
                  )}
                </div>
              )}

              {/* Fill in what the AI flagged as missing/weak — different data,
                  different control (chips / multi-select / textarea / text list /
                  structured editor), not a wall of textboxes. Only shown before
                  optimization; once optimized the edits have already been sent. */}
              {!optimized && (
                <div className="result-section" style={{ marginTop: "8px" }}>
                  {/* Fix #5: collapsed by default — the review page stays clean
                      until the user actively wants to add something. */}
                  <button
                    type="button"
                    className="missing-info-section-toggle"
                    onClick={() => setShowMissingInfo((s) => !s)}
                  >
                    <span>Need to add missing information?</span>
                    {showMissingInfo ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    {!showMissingInfo && <span className="missing-info-expand-label">Expand</span>}
                  </button>

                  {showMissingInfo && (
                    <>
                      <div className="result-section-title" style={{ marginTop: "16px" }}>Improve Missing Information</div>
                      <p className="tool-step-sub" style={{ marginTop: 0, marginBottom: "18px" }}>
                        Fill in anything the review flagged as missing or weak — this gets used when you optimize.
                      </p>

                      {/* Fix #3: "Quick Fixes" — short, fast fields shown up front. */}
                      <div className="missing-info-group-label">Quick Fixes</div>
                      <ChipMultiSelect
                        label="Missing Skills"
                        hint="Tap to include a skill you actually have, or add your own."
                        suggestions={result?.missing_skills}
                        value={userEdits.missing_skills}
                        onChange={(v) => updateEdit("missing_skills", v)}
                      />
                      <ChipMultiSelect
                        label="Languages"
                        hint="Languages you speak that aren't listed."
                        suggestions={result?.missing_languages}
                        value={userEdits.missing_languages}
                        onChange={(v) => updateEdit("missing_languages", v)}
                      />
                      <ChipMultiSelect
                        label="Certifications"
                        hint="Any certifications not currently reflected on your resume."
                        suggestions={result?.missing_certifications}
                        value={userEdits.missing_certifications}
                        onChange={(v) => updateEdit("missing_certifications", v)}
                      />
                      <TextListField
                        label="Missing Links"
                        hint="Portfolio, GitHub, LinkedIn, personal site — whatever's not already on there."
                        value={userEdits.missing_links}
                        onChange={(v) => updateEdit("missing_links", v)}
                        placeholder="https://…"
                      />

                      {/* Fix #3: "Advanced" — longer fields, collapsed by default. */}
                      <button
                        type="button"
                        className="missing-info-advanced-toggle"
                        onClick={() => setShowAdvancedInfo((s) => !s)}
                      >
                        {showAdvancedInfo ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        <span>Advanced{showAdvancedInfo ? "" : " — Summary, Projects, Experience, Education"}</span>
                      </button>

                      {showAdvancedInfo && (
                        <div className="missing-info-advanced-body">
                          <TextAreaField
                            label="Summary"
                            hint={result?.weak_summary ? "The current summary needs work — write a stronger one." : "Add a professional summary."}
                            value={userEdits.summary}
                            onChange={(v) => updateEdit("summary", v)}
                            placeholder="2-3 lines introducing your experience and target role…"
                          />
                          <TextAreaField
                            label="Projects"
                            hint="Any notable projects missing from your resume."
                            value={userEdits.projects}
                            onChange={(v) => updateEdit("projects", v)}
                            placeholder="Project name — what you built and the impact…"
                          />
                          <TextAreaField
                            label="Achievements"
                            hint="Awards, recognitions, measurable results."
                            value={userEdits.achievements}
                            onChange={(v) => updateEdit("achievements", v)}
                            placeholder="e.g. Increased conversion by 18% in Q3…"
                          />
                          <StructuredListEditor
                            label="Additional Experience"
                            hint="Roles not fully captured in the uploaded resume."
                            value={userEdits.experience}
                            onChange={(v) => updateEdit("experience", v)}
                            emptyEntry={{ title: "", company: "", dates: "", description: "" }}
                            fields={[
                              { key: "title", placeholder: "Job title" },
                              { key: "company", placeholder: "Company" },
                              { key: "dates", placeholder: "Dates (e.g. 2022 – 2024)" },
                              { key: "description", placeholder: "What you did / impact", type: "textarea", wide: true },
                            ]}
                          />
                          <StructuredListEditor
                            label="Additional Education"
                            hint="Degrees or coursework not fully captured."
                            value={userEdits.education}
                            onChange={(v) => updateEdit("education", v)}
                            emptyEntry={{ degree: "", school: "", dates: "" }}
                            fields={[
                              { key: "degree", placeholder: "Degree / field of study" },
                              { key: "school", placeholder: "School" },
                              { key: "dates", placeholder: "Dates" },
                            ]}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* OPTIONAL — completely separate AI call, only on explicit request.
                  Guests AND logged-in members below Career Plus see the upgrade
                  CTA — resume_optimize requires Plus, per careerConfig.js. */}
              {!optimized && canOptimize && (
                <div className="tool-step-nav" style={{ marginTop: "24px" }}>
                  <button
                    type="button"
                    className="analyze-btn"
                    style={{ width: "100%" }}
                    disabled={optimizing}
                    onClick={handleGenerateOptimized}
                  >
                    <Wand2 size={16} /> {optimizing ? "Generating Optimized Resume…" : "Generate Optimized Resume"}
                  </button>
                  {!optimizing && (
                    <p className="optimize-btn-subtext">AI rewrites your resume using this review.</p>
                  )}
                  {optimizeError && (
                    <div className="field-error-msg pt-2" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertTriangle size={16} /> {optimizeError}
                    </div>
                  )}
                </div>
              )}

              {!optimized && !canOptimize && (
                <div className="upgrade-cta-card">
                  <div className="upgrade-cta-text">
                    <Lock size={15} style={{ marginRight: "6px", verticalAlign: "-2px" }} />
                    <strong>Unlock Resume Optimization.</strong> Guests and Career Starter can review
                    for free — Career Plus unlocks AI rewriting, compare, and downloads.
                  </div>
                  {isLoggedIn ? (
                    <Link to="/pricing" className="analyze-btn" style={{ whiteSpace: "nowrap" }}>
                      Upgrade to Continue
                    </Link>
                  ) : (
                    <Link to="/login" className="analyze-btn" style={{ whiteSpace: "nowrap" }}>
                      Log in to Optimize
                    </Link>
                  )}
                </div>
              )}

              {optimized && (
                <div className="result-section" style={{ marginTop: "24px" }}>
                  {/* Fix #4: brief green-pulse success moment instead of a
                      static badge — no confetti, just a premium 2s pulse. */}
                  {!optimized.isFallback && (
                    <div className="report-readiness-badge success-pulse-badge" style={{ marginBottom: "16px" }}>
                      <CheckCircle2 size={18} color="var(--green)" />
                      <span>Resume Optimized Successfully</span>
                    </div>
                  )}
                  <div className="result-section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                    <span>Optimized Resume</span>
                    {optimized.original_resume_text && optimized.optimized_resume_text && (
                      <button type="button" className="reset-btn" onClick={() => setShowCompare((s) => !s)}>
                        <Columns2 size={14} style={{ marginRight: "5px" }} />
                        {showCompare ? "Hide Before & After" : "View Before & After"}
                      </button>
                    )}
                  </div>
                  {optimized.isFallback && (
                    <div className="field-error-msg" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Info size={16} /> Optimization is unavailable right now — please try again.
                    </div>
                  )}

                  {/* Fix #5: the satisfying before → after moment. */}
                  {!optimized.isFallback && (
                    <div className="score-improve-row">
                      <ScoreImprovementChip
                        label="ATS Score"
                        before={result?.ats_score}
                        after={optimized.optimized_ats_score}
                      />
                      <ScoreImprovementChip
                        label="Keyword Match"
                        before={result?.keyword_match?.score}
                        after={optimized.optimized_keyword_score}
                      />
                    </div>
                  )}

                  {optimized.optimized_summary && <p>{optimized.optimized_summary}</p>}
                  <ListSection title="Key Changes" items={optimized.key_changes} positive />

                  {showCompare && optimized.original_resume_text && optimized.optimized_resume_text && (
                    <div className="compare-grid" style={{ marginTop: "16px" }}>
                      <div className="compare-pane">
                        <div className="compare-pane-title">Original Resume</div>
                        <div className="compare-pane-text">{optimized.original_resume_text}</div>
                      </div>
                      <div className="compare-pane">
                        <div className="compare-pane-title">Optimized Resume</div>
                        <div className="compare-pane-text">{optimized.optimized_resume_text}</div>
                      </div>
                    </div>
                  )}

                  {optimized.optimized_resume_text && (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                      <button
                        type="button"
                        className="exp-btn"
                        onClick={handleDownloadOptimized}
                      >
                        <Download size={16} style={{ marginRight: "6px" }} /> Download Optimized Resume (.docx)
                      </button>
                      <button
                        type="button"
                        className="analyze-btn"
                        style={{ width: "auto" }}
                        onClick={handleContinueInBuilder}
                        title="Open the optimized resume in the Resume Builder to customize it further"
                      >
                        Customize in Resume Builder <ArrowRight size={16} style={{ marginLeft: "6px" }} />
                      </button>
                    </div>
                  )}

                  {/* Fix #3: complete the Review → Builder → Interview journey
                      instead of leaving Builder as the only next step. */}
                  <div className="next-step-card">
                    <div className="next-step-label">Next Recommended Step</div>
                    <Link to="/interview" className="next-step-cta">
                      Prepare for Interview <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              )}

              <div className="tool-step-nav" style={{ marginTop: "32px", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                {/* Fix #2: "Back" was ambiguous on the result page — say
                    exactly what it does. */}
                <button type="button" className="btn-secondary" onClick={handleBackToUpload}>
                  <ArrowLeft size={16} style={{ marginRight: "6px" }} /> Upload Different Resume
                </button>
                {/* Fix #1: "Start New Review" reads more naturally here than
                    "Review Another Resume". */}
                <button type="button" className="exp-btn" onClick={handleReviewAnother}>
                  <RotateCcw size={16} style={{ marginRight: "6px" }} /> Start New Review
                </button>
                <button type="button" className="reset-btn" style={{ marginLeft: "auto" }} onClick={handleChangeContext}>
                  Change Career Focus
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}