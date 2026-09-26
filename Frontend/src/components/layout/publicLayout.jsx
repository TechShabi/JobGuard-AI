// src/components/VerificationLayout.jsx
import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from '../common/Navbar';
import Footer from '../common/Footer';
import ScrollToTop from "../common/ScroolToTop";

// Countdown Hook
function useCountdown(resetTime) {
  const [display, setDisplay] = useState({ h: "00", m: "00", s: "00", total: 0 });

  useEffect(() => {
    if (!resetTime) {
      setDisplay({ h: "00", m: "00", s: "00", total: 0 });
      return;
    }
    const tick = () => {
      const diff = Math.max(0, resetTime - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay({
        h: String(h).padStart(2, "0"),
        m: String(m).padStart(2, "0"),
        s: String(s).padStart(2, "0"),
        total: diff,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetTime]);

  return display;
};

// Premium Styles
const S = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(16px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: "20px",
  },
  card: {
    background: "var(--popup-bg)",
    border: "1px solid var(--popup-border)",
    borderRadius: 24,
    maxWidth: 420,
    width: "100%",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 25px 70px rgba(0,0,0,0.4)",
    animation: "jgPopIn .3s cubic-bezier(.34,1.56,.64,1) both",
  },
  topBar: {
    height: 4,
    background: "linear-gradient(90deg, var(--purple-dark), var(--cyan), var(--purple-dark))",
    backgroundSize: "200% 100%",
    animation: "jgShimmer 3s linear infinite",
  },
  closeBtn: {
    position: "absolute", top: 16, right: 16,
    background: "var(--popup-close-bg)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "var(--text-muted)",
    width: 32, height: 32, borderRadius: 10,
    cursor: "pointer", fontSize: 15,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s",
  },
  body: { padding: "32px 28px 24px" },
  divider: { height: 1, background: "var(--popup-border)", margin: "0 0 20px" },
  highlight: { 
    color: "var(--purple)", 
    fontWeight: 700, 
    background: "rgba(167,139,250,0.15)", 
    padding: "2px 8px", 
    borderRadius: 6 
  },
  statBox: {
    background: "var(--popup-stat-bg)",
    border: "1px solid var(--popup-border)",
    borderRadius: 12, 
    padding: "14px 10px", 
    textAlign: "center"
  },
  primaryBtn: {
    width: "100%", 
    padding: "14px 20px",
    background: "linear-gradient(135deg, var(--purple-dark), var(--cyan))",
    border: "none", 
    borderRadius: 12,
    color: "white", 
    fontSize: 15, 
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  secondaryBtn: {
    width: "100%", 
    padding: "14px 20px",
    background: "var(--popup-btn-secondary-hover)",
    border: "1px solid var(--popup-border)",
    borderRadius: 12,
    color: "var(--text-primary)",
    fontSize: 15, 
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostBtn: {
    width: "100%", 
    padding: "12px",
    background: "transparent", 
    border: "none",
    color: "var(--text-muted)",
    fontSize: 13.5, 
    cursor: "pointer",
  },
  footer: {
    padding: "16px 28px 20px",
    borderTop: "1px solid var(--popup-border)",
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8,
    fontSize: 13,
  },
};

// Guest Limit Popup - Premium Look
function GuestLimitPopup({ onClose }) {
  const navigate = useNavigate();

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.card}>
        <div style={S.topBar} />

        <button 
          style={S.closeBtn} 
          onClick={onClose}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--popup-close-hover)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "var(--popup-close-bg)"}
        >✕</button>

        <div style={S.body}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, var(--purple-dark), var(--cyan))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, boxShadow: "0 4px 15px rgba(124,58,237,0.3)"
            }}>🛡️</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--purple-dark)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                ACCESS REQUIRED
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0, lineHeight: 1.1 }}>
                Free Scan Used
              </h2>
            </div>
          </div>

          <div style={S.divider} />

          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 24 }}>
            You've used your{" "}
            <span style={S.highlight}>1 free scan</span>{" "}
            for this tool. Create a free account to unlock{" "}
            <span style={S.highlight}>6 scans/day</span>.
          </p>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
            {[
              { num: "6", label: "Scans/Day", color: "var(--cyan)" },
              { num: "3", label: "Scan Types", color: "var(--purple)" },
              { num: "Free", label: "Forever", color: "var(--green)" }
            ].map((s) => (
              <div key={s.label} style={S.statBox}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.num}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button 
              style={S.primaryBtn}
              onClick={() => { onClose(); navigate("/register"); }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
            >
              ✨ Create Free Account
            </button>
            
            <button 
              style={S.secondaryBtn}
              onClick={() => { onClose(); navigate("/login"); }}
            >
              Sign In
            </button>

            <button style={S.ghostBtn} onClick={onClose}>
              Continue with limited access
            </button>
          </div>
        </div>

        <div style={S.footer}>
          <span>🔒</span>
          <span style={{ color: "var(--text-muted)" }}>No credit card required</span>
        </div>
      </div>
    </div>
  );
}

export default function PublicLayout() {
  const { checkScanPermission } = useAuth();
  const [popup, setPopup] = useState(null);

  function requestScan(toolType) {
    const { allowed, reason } = checkScanPermission(toolType);
    if (allowed) return true;
    setPopup(reason);
    return false;
  }

  return (
    <>
        <style>{`
          @keyframes jgPopIn {
            from { opacity:0; transform:scale(0.92) translateY(20px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
          }
          @keyframes jgShimmer {
            0% { background-position:200% 0; }
            100% { background-position:-200% 0; }
          }
        `}</style>

        {popup === "guest_limit" && <GuestLimitPopup onClose={() => setPopup(null)} />}

        <div className="min-h-screen flex flex-col">
            <Navbar />

            <ScrollToTop />

            <main className="flex-1">
                <Outlet context={{ requestScan }} />
            </main>

            <Footer />
        </div>
    
    </>
  );
}