import { useState, useEffect } from "react";
import { FileText, Sparkles, AlertTriangle } from "lucide-react";
import { VerifyTabs } from "./OpportunityVerification";
import { useContextEngine } from "../context/ContextEngineContext";
import { useAuth } from "../context/AuthContext";
import { verifyDescription } from "../services/verify.service";
import { buildCareerContextPayload } from "../utils/careerContext";
import VerificationResultPanel from "../components/common/VerificationResultPanel";

// NOTE (Sprint 2 audit fix): an unused local `useTheme()` hook (copy-pasted
// from other pages) previously lived here — it was never called anywhere in
// this file. Removed as dead code. Theme is handled globally by
// ThemeProvider (see src/context/ThemeContext.jsx).

const MIN_CHARS = 50;

export default function VerifyDescription() {
  const { requestScan, incrementScan } = useAuth();
  const { context, hasContext, setActiveContext } = useContextEngine();

  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const checks = [
    "Upfront fees",
    "Unrealistic salary",
    "Poor grammar",
    "Urgency tactics",
    "Missing company",
    "Contact methods",
  ];

  const charCount = description.trim().length;
  const canSubmit = charCount >= MIN_CHARS && !loading;

  const loadingMessages = [
    "Analyzing Job Description...",
    "Checking salary claims...",
    "Detecting scam patterns...",
    "Verifying company details...",
    "Looking for red flags...",
    "Checking suspicious language...",
    "Analyzing contact information...",
    "Evaluating risk score...",
    "Generating final report...",
  ];

  const [loadingText, setLoadingText] = useState(loadingMessages[0]);

  useEffect(() => {
    if (!loading) return;
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % loadingMessages.length;
      setLoadingText(loadingMessages[index]);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = async () => {
    if (!description) return;

    // ── Permission check ──
    const allowed = requestScan("description");
    if (!allowed) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const start = Date.now();
      const res = await verifyDescription(description);
      await new Promise((r) =>
        setTimeout(r, Math.max(3000 - (Date.now() - start), 0)),
      );

      const data = res.data.data || res.data;

      // Career Context comes back on this SAME verification response — no extra AI call.
      // Created BEFORE the popup is shown, so "Review Resume" navigation is correct immediately.
      const contextPayload = buildCareerContextPayload(data.career_context, "description");
      if (contextPayload) {
        try {
          await setActiveContext(contextPayload);
        } catch (ctxErr) {
          console.error("Career Context save failed (verification still succeeded):", ctxErr);
        }
      }

      // ✅ Count only on success
      incrementScan("description");

      setResult({
        score: data.scam_score ?? 50,
        safe: (data.scam_score ?? 50) < 50,
        verdict: data.verdict ?? "Analysis Complete",
        summary: data.summary ?? "",
        flags: data.red_flags ?? [],
        recommendations: data.recommendations ?? [],
        risk_level: data.risk_level ?? "",
        confidence: data.confidence ?? 0,
        positive_signals: data.positive_signals ?? [],
        final_decision: data.final_decision ?? {},
        url_analysis: data.url_analysis ?? {},
        domain_analysis: data.domain_analysis ?? {},
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to analyze. Please try again.",
      );
      setTimeout(() => setError(""), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDescription("");
    setResult(null);
    setError("");
  };

  return (
    <div className="verify-page page-reveal">
      <div className="verify-container">
        {/* Header - Standardized Layout */}
        <div className="verify-header">
          <div className="input-panel-label" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <FileText size={14} className="text-[var(--cyan)]" />
            <span>Description Checker</span>
          </div>
          <h1 className="verify-title">
            Detect hiring scams <br />
            before you apply.
          </h1>
          <p className="verify-desc">
            Advanced AI detection for fake job offers, unrealistic salary promises, and suspicious posting details. Safe job hunting.
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px", marginTop: "20px" }}>
            <VerifyTabs />
          </div>
        </div>

        <div className={`verify-layout ${loading || result ? "modal-active" : ""}`}>
          {/* ── Input Panel ── */}
          <div className="input-panel">
            <div className="input-panel-header">
              <div className="input-panel-icon bg-gradient-to-br from-[var(--cyan)] to-blue-600">
                <FileText size={22} />
              </div>
              <div>
                <div className="input-panel-label">Paste and Scan</div>
                <div className="input-panel-title">Job Verification</div>
              </div>
            </div>

            <div className="input-group">
              <div>
                <label className="form-label" htmlFor="verify-description-textarea">Job Description</label>
                <textarea
                  id="verify-description-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Paste the job description, email content, or recruitment message here..."
                  className="form-input"
                  rows={8}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      transition: "color 0.2s",
                      color: canSubmit ? "var(--green)" : "var(--text-tertiary)"
                    }}
                  >
                    {charCount} characters •{" "}
                    {canSubmit
                      ? "✓ Ready to analyze"
                      : `Min ${MIN_CHARS} required`}
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="field-error-msg pt-2">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              {/* Analyze Button */}
              <div className="analyze-btn-wrapper" style={{ marginTop: "24px" }}>
                <div className="analyze-btn-glow bg-gradient-to-br from-[var(--cyan)] to-indigo-600" />
                <button
                  onClick={handleAnalyze}
                  disabled={!canSubmit}
                  className="analyze-btn"
                  style={{ opacity: !canSubmit ? 0.6 : 1, cursor: !canSubmit ? "not-allowed" : "pointer" }}
                >
                  <Sparkles size={20} />
                  {loading ? "Analyzing…" : "Analyze Job"}
                </button>
              </div>

              {/* What we check */}
              <div className="check-section">
                <div className="check-section-title">What we check</div>
                <div className="check-grid">
                  {checks.map((item) => (
                    <div key={item} className="check-item">
                      <div className="check-dot check-dot-cyan" />
                      <span className="check-label">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <>
              <div className="screen-overlay" />
              <div className="popup-modal">
                <div className="popup-spinner">
                  <Sparkles size={40} />
                </div>
                <h3 style={{ color: "white" }}>{loadingText}</h3>
              </div>
            </>
          )}

          {/* ── Result ── */}
          {!loading && result && (
            <VerificationResultPanel result={result} sourceType="description" onReset={handleReset} />
          )}
        </div>
      </div>
    </div>
  );
}