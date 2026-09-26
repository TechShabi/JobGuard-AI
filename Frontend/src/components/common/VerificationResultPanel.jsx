import { useNavigate } from "react-router-dom";
import { Check, AlertTriangle, ArrowRight } from "lucide-react";

// Copy differences per source type — everything else about the result panel
// (score circle, risk badge, red flags, positive signals, recommendations,
// final decision grid, "what's next" CTA) was byte-for-byte identical across
// VerifyUrl.jsx / VerifyImage.jsx / VerifyDescription.jsx.
const COPY = {
  url: { safeTitle: "✅ URL Appears Safe", unsafeTitle: "⚠️ URL Looks UnSafe", resetLabel: "Scan Another URL" },
  image: { safeTitle: "✅ Image Looks Safe", unsafeTitle: "⚠️ Image Appears UnSafe", resetLabel: "Scan Another Image" },
  description: { safeTitle: "✅ Looks Legitimate", unsafeTitle: "⚠️ Seems UnSafe", resetLabel: "Scan Another Description" },
};

/**
 * Full result popup (overlay + close button + score/verdict/flags/CTA) for
 * Opportunity Verification. `sourceType` picks the handful of strings that
 * actually differ between URL/Image/Description — everything structural is
 * shared. `onReset` closes the popup / lets the user scan again.
 */
export default function VerificationResultPanel({ result, sourceType, onReset }) {
  const navigate = useNavigate();
  const copy = COPY[sourceType] || COPY.url;

  if (!result) return null;

  return (
    <>
      <div className="screen-overlay" />
      <div className="popup-result">
        <button
          onClick={onReset}
          aria-label="Close result"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            fontSize: 15,
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px 8px",
            borderRadius: 8,
            zIndex: 9999,
          }}
        >
          x
        </button>
        <div className={`result-panel ${result.safe ? "result-safe" : "result-danger"}`}>
          {/* Score */}
          <div className="result-score-wrapper">
            <div className={`result-score-circle ${result.safe ? "score-safe" : "score-danger"}`}>
              <span className="result-score-number">{result.score}</span>
              <span className="result-score-label">RISK SCORE</span>
            </div>
          </div>

          {/* Risk Level */}
          {result.risk_level && (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                  background: result.safe ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                  color: result.safe ? "var(--green)" : "var(--red)",
                }}
              >
                {result.risk_level} RISK
              </span>
            </div>
          )}

          {/* Verdict */}
          <div className="result-verdict">
            <h3 className={`result-verdict-title ${result.safe ? "safe" : "danger"}`}>
              {result.safe ? copy.safeTitle : copy.unsafeTitle}
            </h3>
            <p className="result-verdict-summary">{result.summary}</p>
          </div>

          {/* Red Flags */}
          {result.flags?.length > 0 && (
            <div className="result-flags">
              <div className="result-flags-title">
                <AlertTriangle size={16} style={{ display: "inline", marginRight: "6px" }} />
                RED FLAGS ({result.flags.length})
              </div>
              <ul className="result-flags-list">
                {result.flags.map((flag, i) => (
                  <li key={i} className="result-flag-item">
                    <Check size={14} style={{ color: "var(--red)", flexShrink: 0, marginTop: "2px" }} />
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Positive Signals */}
          {result.positive_signals?.length > 0 && (
            <div className="result-flags" style={{ borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)" }}>
              <div className="result-flags-title" style={{ color: "var(--green)" }}>✅ POSITIVE SIGNALS</div>
              <ul className="result-flags-list">
                {result.positive_signals.map((s, i) => (
                  <li key={i} className="result-flag-item">
                    <Check size={16} style={{ color: "var(--green)", flexShrink: 0, marginTop: "2px" }} />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <div className="result-flags" style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.05)" }}>
              <div className="result-flags-title" style={{ color: "var(--indigo)" }}>💡 RECOMMENDATIONS</div>
              <ul className="result-flags-list">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="result-flag-item">
                    <Check size={16} style={{ color: "var(--indigo)", flexShrink: 0, marginTop: "2px" }} />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Final Decision */}
          {result.final_decision && Object.keys(result.final_decision).length > 0 && (
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 16, border: "1px solid var(--border-primary)", marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 12, textTransform: "uppercase" }}>
                🔍 Final Decision
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(result.final_decision).map(([key, val]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: val ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                      border: `1px solid ${val ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{val ? "✅" : "❌"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: val ? "var(--green)" : "var(--red)", lineHeight: 1.3 }}>
                      {key.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What's Next */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 18, border: "1px solid var(--border-primary)", marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>Continue Improving Your Application</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
              Your opportunity has been reviewed. If you're planning to apply, you can strengthen your application before submitting.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="analyze-btn" style={{ width: "auto" }} onClick={() => navigate("/resume-builder-review?mode=review")}>
                Review My Resume <ArrowRight size={16} style={{ marginLeft: "6px" }} />
              </button>
              <button type="button" className="exp-btn" onClick={onReset}>Maybe Later</button>
            </div>
          </div>

          {/* Reset */}
          <button onClick={onReset} className="reset-btn" style={{ marginTop: 20, width: "100%", padding: "12px", textAlign: "center" }}>
            {copy.resetLabel}
          </button>
        </div>
      </div>
    </>
  );
}
