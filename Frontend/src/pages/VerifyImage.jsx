import { useState, useEffect, useRef, useCallback } from "react";
import { Image as ImageIcon, Sparkles, Upload, AlertTriangle, X } from "lucide-react";
import { useContextEngine } from "../context/ContextEngineContext";
import { useAuth } from "../context/AuthContext";
import { verifyImage } from "../services/verify.service";
import { VerifyTabs } from "./OpportunityVerification";
import { buildCareerContextPayload } from "../utils/careerContext";
import VerificationResultPanel from "../components/common/VerificationResultPanel";

// NOTE (Sprint 2 audit fix): an unused local `useTheme()` hook (copy-pasted
// from other pages) previously lived here — it was never called anywhere in
// this file. Removed as dead code. Theme is handled globally by
// ThemeProvider (see src/context/ThemeContext.jsx).

export default function VerifyImage() {
  const { requestScan, incrementScan } = useAuth();
  const { context, hasContext, setActiveContext } = useContextEngine();

  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = useCallback((selected) => {
    if (!selected) return;
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(selected.type)) {
      alert("Only PNG, JPG, WEBP files are allowed.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      alert("File size must be under 10 MB.");
      return;
    }
    setFile(selected);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(selected);
  }, []);

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const checks = [
    "Fake company logos",
    "Edited screenshots",
    "AI-generated images",
    "Document authenticity",
    "Visual scam indicators",
    "Metadata validation",
  ];

  const loadingMessages = [
    "Analyzing Job Image...",
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
    if (!file) return;

    // ── Permission check ──
    const allowed = requestScan("image");
    if (!allowed) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const start = Date.now();
      const res = await verifyImage(file);
      await new Promise((r) =>
        setTimeout(r, Math.max(3000 - (Date.now() - start), 0)),
      );

      const data = res.data.data || res.data;

      // Career Context comes back on this SAME verification response — no extra AI call.
      // Created BEFORE the popup is shown, so "Review Resume" navigation is correct immediately.
      const contextPayload = buildCareerContextPayload(data.career_context, "image");
      if (contextPayload) {
        try {
          await setActiveContext(contextPayload);
        } catch (ctxErr) {
          console.error("Career Context save failed (verification still succeeded):", ctxErr);
        }
      }

      // ✅ Count only on success
      incrementScan("image");

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
        err.response?.data?.message ||
        "Failed to analyze image. Please try again.",
      );
      setTimeout(() => setError(""), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-page page-reveal">
      <div className="verify-container">
        {/* Header - Left Aligned Layout */}
        <div className="verify-header">
          <div className="input-panel-label" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <ImageIcon size={14} className="text-[var(--fuchsia)]" />
            <span>Screenshot Analysis</span>
          </div>
          <h1 className="verify-title">
            Scan offer letters & chats 
            <br />
            before trusting them.
          </h1>
          <p className="verify-desc">
            Visual AI detection for edited screenshots, fake offer documents, and scam chat logs. Instant audit.
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
              <div className="input-panel-icon bg-gradient-to-br from-[var(--fuchsia)] to-[var(--orange)]">
                <ImageIcon size={22} />
              </div>
              <div>
                <div className="input-panel-label">Upload Image</div>
                <div className="input-panel-title">Screenshot Scan</div>
              </div>
            </div>

            <div className="input-group">
              {/* Upload Area */}
              <label
                htmlFor="image-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`upload-area ${dragOver ? "drag-over" : ""}`}
                style={{ position: "relative", cursor: "pointer", display: "block" }}
              >
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="Preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "16px" }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReset();
                      }}
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "#fff",
                        borderRadius: "50%",
                        padding: "6px",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        cursor: "pointer"
                      }}
                    >
                      <X size={18} style={{ color: "var(--text-primary)" }} />
                    </button>
                    <div style={{ position: "absolute", bottom: "12px", left: "12px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "12px", padding: "4px 10px", borderRadius: "8px" }}>
                      {file?.name}
                    </div>
                  </>
                ) : (
                  <div className="upload-inner">
                    <div className="upload-icon">
                      <Upload size={32} />
                    </div>
                    <div className="upload-title">Click or Drag & Drop</div>
                    <div className="upload-sub">PNG, JPG, WEBP • Max 10MB</div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  id="image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="upload-input"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
              </label>

              {preview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: "14px",
                    color: "var(--accent-primary, var(--fuchsia))",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginTop: "8px",
                    textAlign: "left"
                  }}
                >
                  Change Image
                </button>
              )}

              {/* Error */}
              {error && (
                <div className="field-error-msg pt-2">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              {/* Analyze Button */}
              <div className="analyze-btn-wrapper" style={{ marginTop: "24px" }}>
                <div className="analyze-btn-glow bg-gradient-to-br from-[var(--fuchsia)] to-[var(--orange)]" />
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !file}
                  className="analyze-btn analyze-btn-orange"
                  style={{ opacity: loading || !file ? 0.6 : 1, cursor: loading || !file ? "not-allowed" : "pointer" }}
                >
                  <Sparkles size={20} />
                  {loading ? "Analyzing…" : "Analyze Screenshot"}
                </button>
              </div>

              {/* Security Checks */}
              <div className="check-section">
                <div className="check-section-title">Security Checks</div>
                <div className="check-grid">
                  {checks.map((item) => (
                    <div key={item} className="check-item">
                      <div className="check-dot check-dot-pink" />
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
            <VerificationResultPanel result={result} sourceType="image" onReset={handleReset} />
          )}
        </div>
      </div>
    </div>
  );
}