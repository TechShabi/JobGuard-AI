import { useNavigate } from "react-router-dom";

/**
 * The ONE upgrade experience for the whole platform.
 *
 * Every AI feature that hits a permission wall — guest trial used up,
 * membership too low, Career Sessions exhausted — renders this same
 * component with different copy. Never "You have no tokens." Always
 * framed as career investment, never software restriction.
 *
 * reason: "guest_limit" | "membership_required" | "sessions_exhausted"
 * message: { title, body, cta } — already built server-side (or a sane
 *          client-side fallback for the guest trial case) so the wording
 *          lives in one place (careerConfig on the backend).
 */
export default function UpgradeModal({ reason, message, onClose }) {
  const navigate = useNavigate();

  const isGuest = reason === "guest_limit";
  const isSessionsExhausted = reason === "sessions_exhausted";

  const eyebrow = isGuest
    ? "ACCESS REQUIRED"
    : isSessionsExhausted
    ? "CAREER SESSIONS"
    : "UNLOCK FEATURE";

  const title = message?.title || "Continue Your Career Growth";
  const body =
    message?.body ||
    "Upgrade your Career Growth Membership to keep using this feature.";
  const ctaLabel = message?.cta || "Upgrade to Continue";

  const stats = isGuest
    ? [
        { num: "Free", label: "Career Starter", color: "var(--cyan)" },
        { num: "4+", label: "AI Tools", color: "var(--purple)" },
        { num: "Instant", label: "Analysis", color: "var(--green)" },
      ]
    : [
        { num: "3", label: "Membership Tiers", color: "var(--cyan)" },
        { num: "All", label: "AI Features", color: "var(--purple)" },
        { num: "Priority", label: "Processing", color: "var(--green)" },
      ];

  return (
    <div
      className="popup-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="popup-card">
        <div className="popup-topBar" />
        <button className="closeBtn" onClick={onClose} aria-label="Close">✕</button>

        <div className="popup-body">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, var(--purple-dark), var(--cyan))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                boxShadow: "0 4px 15px rgba(124,58,237,0.3)",
              }}
            >
              🚀
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--purple-dark)",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                {eyebrow}
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: 0,
                  lineHeight: 1.15,
                }}
              >
                {title}
              </h2>
            </div>
          </div>

          <div className="popup-divider" />

          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 24 }}>
            {body}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
            {stats.map((s) => (
              <div key={s.label} className="statBox">
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.num}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isGuest ? (
              <>
                <button className="btn-primary" onClick={() => { onClose(); navigate("/register"); }}>
                  ✨ Create Free Account
                </button>
                <button className="btn-secondary" onClick={() => { onClose(); navigate("/login"); }}>
                  Sign In
                </button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={() => { onClose(); navigate("/pricing"); }}>
                  🚀 {ctaLabel}
                </button>
                <button className="btn-secondary" onClick={onClose}>
                  Maybe Later
                </button>
              </>
            )}
          </div>
        </div>

        <div className="popup-footer">
          <span>🔒</span>
          <span style={{ color: "var(--text-muted)" }}>Secure & Encrypted</span>
        </div>
      </div>
    </div>
  );
}
