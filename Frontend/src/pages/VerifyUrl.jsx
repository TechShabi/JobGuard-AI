import { useState, useEffect } from "react";
import { Link2, Sparkles, Globe, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContextEngine } from "../context/ContextEngineContext";
import { verifyUrl } from "../services/verify.service";
import { buildCareerContextPayload } from "../utils/careerContext";
import { VerifyTabs } from "./OpportunityVerification";
import VerificationResultPanel from "../components/common/VerificationResultPanel";


export default function VerifyUrl() {
  const { requestScan, incrementScan } = useAuth();
  const { context, hasContext, setActiveContext } = useContextEngine();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingText, setLoadingText] = useState("");

  const checks = [
    "SSL certificate validation",
    "Domain age & reputation",
    "Suspicious keywords",
    "Phishing patterns",
  ];

  const loadingMessages = [
    "Analyzing Job URL...",
    "Checking salary claims...",
    "Detecting scam patterns...",
    "Verifying company details...",
    "Looking for red flags...",
    "Checking suspicious language...",
    "Analyzing contact information...",
    "Evaluating risk score...",
    "Generating final report...",
  ];

  useEffect(() => {
    if (!loading) return;
    let index = 0;
    setLoadingText(loadingMessages[0]);
    const interval = setInterval(() => {
      index = (index + 1) % loadingMessages.length;
      setLoadingText(loadingMessages[index]);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleScan = async () => {
    if (!url.trim()) return;

    const allowed = requestScan("url");
    if (!allowed) return;

    setLoading(true);
    setResult(null);
    setError("");

    try {
      const start = Date.now();
      const res = await verifyUrl(url.trim());
      const elapsed = Date.now() - start;
      await new Promise((r) => setTimeout(r, Math.max(3000 - elapsed, 0)));
      
      const data = res.data.data || res.data;
      const scamScore = data.scam_score ?? 50;

      // Career Context comes back on this SAME verification response — no extra AI call.
      // Created BEFORE the popup is shown, so "Review Resume" navigation is correct immediately.
      const contextPayload = buildCareerContextPayload(data.career_context, "url");
      if (contextPayload) {
        try {
          await setActiveContext(contextPayload);
        } catch (ctxErr) {
          console.error("Career Context save failed (verification still succeeded):", ctxErr);
        }
      }

      // ✅ Count only on success
      incrementScan("url");

      setResult({
        score: scamScore,
        safe: scamScore < 50,
        verdict: data.verdict ?? "Analysis Complete",
        summary: data.summary ?? "",
        flags: data.red_flags ?? [],
        recommendations: data.recommendations ?? [],
        risk_level: data.risk_level ?? "",
        confidence: data.confidence ?? 0,
        positive_signals: data.positive_signals ?? [],
        final_decision: data.final_decision ?? {
          safe_to_use: scamScore < 40,
          safe_to_apply_job: scamScore < 40,
          safe_to_invest: scamScore < 20,
          safe_to_download: scamScore < 30,
        },
        url_analysis: data.url_analysis ?? {},
        domain_analysis: data.domain_analysis ?? {},
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to analyze URL. Please try again.",
      );
      setTimeout(() => setError(""), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUrl("");
    setResult(null);
    setError("");
  };

  return (
    <div className="verify-page page-reveal">
      <div className="verify-container">
        {/* Header - Left Aligned Layout */}
        <div className="verify-header">
          <div className="input-panel-label" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <Link2 size={14} className="text-purple" />
            <span>URL Risk Scan</span>
          </div>
          <h1 className="verify-title">
            Verify suspicious links
            <br />
            before you click.
          </h1>
          <p className="verify-desc">
            Advanced AI analysis for phishing domains, fake job portals, and
            malicious URLs. Real-time protection.
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
              <div className="input-panel-icon bg-gradient-to-br from-[var(--purple)] to-[var(--cyan)]">
                <Globe size={22} />
              </div>
              <div>
                <div className="input-panel-label">Scan URL</div>
                <div className="input-panel-title">Link Verification</div>
              </div>
            </div>

            <div className="input-group">
              <div>
                <label className="input-panel-label" htmlFor="verify-url-input" style={{ display: "block", marginBottom: "8px" }}>Job Link</label>
                <input
                  id="verify-url-input"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  placeholder="https://example-jobs.com/apply"
                  className="centered-input"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="field-error-msg pt-2">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              {/* Scan Button */}
              <div className="analyze-btn-wrapper">
                <div className="analyze-btn-glow bg-gradient-to-br from-[var(--purple)] to-[var(--cyan)]" />
                <button
                  onClick={handleScan}
                  disabled={loading || !url.trim()}
                  className="analyze-btn analyze-btn-purple"
                  style={{ opacity: loading || !url.trim() ? 0.5 : 1, cursor: loading || !url.trim() ? "not-allowed" : "pointer" }}
                >
                  <Sparkles size={20} />
                  {loading ? "Scanning…" : "Scan URL"}
                </button>
              </div>

              {/* Security Checks */}
              <div className="check-section">
                <div className="check-section-title">Security Checks</div>
                <div className="check-grid">
                  {checks.map((item) => (
                    <div key={item} className="check-item">
                      <div className="check-dot check-dot-purple" />
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
            <VerificationResultPanel result={result} sourceType="url" onReset={handleReset} />
          )}
        </div>
      </div>
    </div>
  );
}