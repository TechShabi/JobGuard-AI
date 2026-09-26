import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Link2, Image as ImageIcon,
  Sparkles, Upload, X, Check,
  AlertTriangle, ShieldCheck, Shield,
  LogIn, UserPlus, Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

// ── Theme Hook ───────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, () => setDark(p => !p)];
}

// ── Free Scan Limit ──────────────────────────────────────────
const FREE_LIMIT = 3;

function getGuestScans() {
  return parseInt(localStorage.getItem("guest_scans") || "0");
}
function incrementGuestScans() {
  const c = getGuestScans();
  localStorage.setItem("guest_scans", c + 1);
  return c + 1;
}

// ── Scanner Navbar ───────────────────────────────────────────
function ScannerNavbar({ dark, toggleTheme }) {
  const { user, logout } = useAuth();

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--color-card)',
      borderBottom: '1px solid var(--color-border)',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '0 20px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--cyan), var(--purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShieldCheck size={20} color="white" />
          </div>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-text)',
          }}>
            JobGuard AI
          </span>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <>
              <Link to="/dashboard" style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid var(--color-border)',
              }}>
                Dashboard
              </Link>
              <button
                onClick={() => { logout(); window.location.reload(); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'none',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <LogIn size={14} />
                Sign In
              </Link>
              <Link to="/register" style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, var(--cyan), var(--purple))',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <UserPlus size={14} />
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ── First Visit Popup ────────────────────────────────────────
function FirstVisitPopup({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: 'spring', damping: 18 }}
        style={{
          background: 'var(--color-card)',
          borderRadius: 28,
          padding: '40px 36px',
          maxWidth: 460,
          width: '100%',
          border: '1px solid var(--color-border)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.5)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.3), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--cyan), var(--purple))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 8px 32px rgba(6,182,212,0.4)',
        }}>
          <ShieldCheck size={32} color="white" />
        </div>

        <h2 style={{
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--color-text)',
          marginBottom: 10,
        }}>
          Welcome to JobGuard AI
        </h2>

        <p style={{
          color: 'var(--color-muted)',
          fontSize: 15,
          lineHeight: 1.7,
          marginBottom: 12,
        }}>
          Detect job scams instantly using AI.
          <br />
          <strong style={{ color: 'var(--color-text)' }}>3 free scans</strong> available without login.
        </p>

        {/* Free scans indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 28,
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(6,182,212,0.1)',
              border: '2px solid var(--cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}>
              🔍
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            to="/register"
            style={{
              padding: '14px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--cyan), var(--purple))',
              color: 'white',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 20px rgba(6,182,212,0.3)',
            }}
          >
            <UserPlus size={18} />
            Create Free Account
          </Link>

          <Link
            to="/login"
            style={{
              padding: '14px',
              borderRadius: 14,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontWeight: 600,
              fontSize: 15,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: '1px solid var(--color-border)',
            }}
          >
            <LogIn size={18} />
            Sign In
          </Link>

          <button
            onClick={onClose}
            style={{
              padding: '12px',
              borderRadius: 14,
              background: 'none',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Continue with 3 free scans →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Limit Reached Popup ──────────────────────────────────────
function LimitPopup({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: 'spring', damping: 18 }}
        style={{
          background: 'var(--color-card)',
          borderRadius: 28,
          padding: '40px 36px',
          maxWidth: 460,
          width: '100%',
          border: '1px solid var(--color-border)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.5)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16, right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-muted)',
          }}
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)',
          border: '2px solid var(--red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Shield size={32} color="var(--red)" />
        </div>

        <h2 style={{
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--color-text)',
          marginBottom: 10,
        }}>
          Free Scans Used Up!
        </h2>

        <p style={{
          color: 'var(--color-muted)',
          fontSize: 15,
          lineHeight: 1.7,
          marginBottom: 24,
        }}>
          You've used all <strong style={{ color: 'var(--red)' }}>3 free scans</strong>.
          <br />
          Create a free account for unlimited access!
        </p>

        {/* Used scans */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 28,
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              border: '2px solid var(--red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}>
              ✓
            </div>
          ))}
        </div>

        {/* Features */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
          textAlign: 'left',
          border: '1px solid var(--color-border)',
        }}>
          {[
            'Unlimited scans forever',
            'Full scan history',
            'Detailed AI reports',
            'Dashboard access',
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--color-text)',
              marginBottom: i < 3 ? 8 : 0,
            }}>
              <Check size={14} color="var(--green)" />
              {f}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            to="/register"
            style={{
              padding: '14px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--cyan), var(--purple))',
              color: 'white',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <UserPlus size={18} />
            Create Free Account
          </Link>

          <Link
            to="/login"
            style={{
              padding: '14px',
              borderRadius: 14,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontWeight: 600,
              fontSize: 15,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: '1px solid var(--color-border)',
            }}
          >
            <LogIn size={18} />
            Sign In
          </Link>

          <button
            onClick={onClose}
            style={{
              padding: '10px',
              borderRadius: 14,
              background: 'none',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Result Panel ─────────────────────────────────────────────
function ResultPanel({ result, onReset }) {
  if (!result) return null;

  const scoreColor = result.score >= 70
    ? 'var(--red)'
    : result.score >= 40
      ? 'var(--amber)'
      : 'var(--green)';

  const scoreBg = result.score >= 70
    ? 'rgba(239,68,68,0.1)'
    : result.score >= 40
      ? 'rgba(245,158,11,0.1)'
      : 'rgba(16,185,129,0.1)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: 20,
        borderTop: '1px solid var(--color-border)',
        paddingTop: 20,
      }}
    >
      {/* Score Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        padding: 16,
        borderRadius: 16,
        background: scoreBg,
        border: `1px solid ${scoreColor}30`,
      }}>
        <div style={{
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'var(--color-card)',
          border: `3px solid ${scoreColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 22,
            fontWeight: 800,
            color: scoreColor,
            lineHeight: 1,
          }}>
            {result.score}
          </span>
          <span style={{
            fontSize: 8,
            color: scoreColor,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}>
            RISK
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 17,
            fontWeight: 700,
            color: result.safe ? 'var(--green)' : 'var(--red)',
            marginBottom: 4,
          }}>
            {result.safe ? '✅ Looks Legitimate' : `⚠️ ${result.verdict}`}
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--color-muted)',
            lineHeight: 1.5,
          }}>
            {result.summary}
          </div>
          {result.risk_level && (
            <span style={{
              display: 'inline-block',
              marginTop: 6,
              padding: '2px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: scoreBg,
              color: scoreColor,
              letterSpacing: 0.5,
            }}>
              {result.risk_level} RISK
            </span>
          )}
        </div>
      </div>

      {/* Red Flags */}
      {result.flags?.length > 0 && (
        <div style={{
          marginBottom: 12,
          padding: 16,
          borderRadius: 14,
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--red)',
            letterSpacing: 1,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <AlertTriangle size={13} />
            RED FLAGS ({result.flags.length})
          </div>
          {result.flags.map((flag, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 8,
              fontSize: 13,
              color: 'var(--color-text)',
              marginBottom: 6,
              lineHeight: 1.4,
            }}>
              <span style={{ color: 'var(--red)', flexShrink: 0 }}>•</span>
              {flag}
            </div>
          ))}
        </div>
      )}

      {/* Positive Signals */}
      {result.positive_signals?.length > 0 && (
        <div style={{
          marginBottom: 12,
          padding: 16,
          borderRadius: 14,
          background: 'rgba(16,185,129,0.05)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--green)',
            letterSpacing: 1,
            marginBottom: 10,
          }}>
            ✅ POSITIVE SIGNALS
          </div>
          {result.positive_signals.map((s, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 8,
              fontSize: 13,
              color: 'var(--color-text)',
              marginBottom: 6,
            }}>
              <span style={{ color: 'var(--green)', flexShrink: 0 }}>•</span>
              {s}
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations?.length > 0 && (
        <div style={{
          marginBottom: 12,
          padding: 16,
          borderRadius: 14,
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--indigo)',
            letterSpacing: 1,
            marginBottom: 10,
          }}>
            💡 RECOMMENDATIONS
          </div>
          {result.recommendations.map((r, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 8,
              fontSize: 13,
              color: 'var(--color-text)',
              marginBottom: 6,
            }}>
              <span style={{ color: 'var(--indigo)', flexShrink: 0 }}>•</span>
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Final Decision */}
      {result.final_decision &&
        Object.keys(result.final_decision).length > 0 && (
          <div style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 14,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-muted)',
              letterSpacing: 1,
              marginBottom: 12,
            }}>
              🔍 FINAL DECISION
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}>
              {Object.entries(result.final_decision).map(([key, val]) => (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: val ? 'var(--green)' : 'var(--red)',
                }}>
                  {val ? '✅' : '❌'} {key.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* OCR Text */}
      {result.ocr_text && (
        <div style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 12,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--color-muted)',
            fontWeight: 600,
            letterSpacing: 1,
            marginBottom: 6,
          }}>
            EXTRACTED TEXT
          </div>
          <p style={{
            fontSize: 12,
            color: 'var(--color-muted)',
            fontStyle: 'italic',
            lineHeight: 1.5,
            margin: 0,
          }}>
            {result.ocr_text.slice(0, 200)}
            {result.ocr_text.length > 200 ? '...' : ''}
          </p>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={onReset}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--cyan)',
          fontSize: 13,
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: 0,
        }}
      >
        ← Scan another
      </button>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function Scanner() {
  const [dark, toggleTheme] = useTheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('description');
  const [showFirstVisit, setShowFirstVisit] = useState(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [guestScans, setGuestScans] = useState(getGuestScans());

  // Description
  const [description, setDescription] = useState('');

  // URL
  const [url, setUrl] = useState('');

  // Image
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Result
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // ── First visit check ──────────────────────────────────────
  useEffect(() => {
    if (!user) {
      const visited = localStorage.getItem("scanner_visited");
      if (!visited) {
        setTimeout(() => setShowFirstVisit(true), 800);
        localStorage.setItem("scanner_visited", "true");
      }
    }
  }, [user]);

  const tabs = [
    {
      id: 'description',
      label: 'Description',
      icon: FileText,
      color: 'var(--cyan)',
    },
    {
      id: 'url',
      label: 'URL',
      icon: Link2,
      color: 'var(--purple)',
    },
    {
      id: 'image',
      label: 'Image',
      icon: ImageIcon,
      color: 'var(--fuchsia)',
    },
  ];

  // ── Scan limit ─────────────────────────────────────────────
  const checkLimit = () => {
    if (user) return true;
    if (getGuestScans() >= FREE_LIMIT) {
      setShowLimitPopup(true);
      return false;
    }
    return true;
  };

  // ── Reset ──────────────────────────────────────────────────
  const handleReset = () => {
    setResult(null);
    setError('');
    setDescription('');
    setUrl('');
    setPreview(null);
    setFile(null);
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    handleReset();
  };

  // ── Image ──────────────────────────────────────────────────
  const handleFile = useCallback((selected) => {
    if (!selected) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(selected.type)) {
      alert('Only PNG, JPG, WEBP');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      alert('Max 10MB');
      return;
    }
    setFile(selected);
    setResult(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(selected);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // ── Analyze ────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!checkLimit()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let res;

      if (activeTab === 'description') {
        res = await API.post('/verify/description', { description });
      } else if (activeTab === 'url') {
        res = await API.post('/verify/url', { url });
      } else {
        const formData = new FormData();
        formData.append('image', file);
        res = await API.post('/verify/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      const data = res.data.data || res.data;

      setResult({
        score: data.scam_score ?? 50,
        safe: (data.scam_score ?? 50) < 50,
        verdict: data.verdict || "Analysis Complete",
        summary: data.summary || "",
        flags: data.red_flags || data.flags || [],
        recommendations: data.recommendations || [],
        risk_level: data.risk_level || "",
        positive_signals: data.positive_signals || [],
        final_decision: data.final_decision || {},
        ocr_text: res.data.ocr_text || "",
      });

      // Guest scan count
      if (!user) {
        const newCount = incrementGuestScans();
        setGuestScans(newCount);

        // Last scan ke baad popup
        if (newCount >= FREE_LIMIT) {
          setTimeout(() => setShowLimitPopup(true), 1500);
        }
      }

    } catch (err) {
      setError(
        err.response?.data?.message || 'Analysis failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    if (loading) return false;
    if (activeTab === 'description') return description.trim().length >= 50;
    if (activeTab === 'url') return url.trim().length > 0;
    if (activeTab === 'image') return !!file;
    return false;
  };

  const remaining = user ? '∞' : Math.max(0, FREE_LIMIT - guestScans);

  // ── Input style ────────────────────────────────────────────
  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

      {/* Popups */}
      <AnimatePresence>
        {showFirstVisit && !user && (
          <FirstVisitPopup onClose={() => setShowFirstVisit(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLimitPopup && (
          <LimitPopup onClose={() => setShowLimitPopup(false)} />
        )}
      </AnimatePresence>

      {/* Navbar */}
      <ScannerNavbar dark={dark} toggleTheme={toggleTheme} />

      {/* Main Content */}
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 20px 80px',
      }}>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 36 }}
        >
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontWeight: 800,
            color: 'var(--color-text)',
            lineHeight: 1.15,
            marginBottom: 12,
          }}>
            Is This Job Real or a{' '}
            <span style={{
              background: 'linear-gradient(135deg, var(--cyan), var(--purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Scam?
            </span>
          </h1>

          <p style={{
            fontSize: 16,
            color: 'var(--color-muted)',
            marginBottom: 16,
            lineHeight: 1.6,
          }}>
            Paste a job description, URL, or upload a screenshot.
            <br />
            AI will analyze it in seconds.
          </p>

          {/* Scan counter badge */}
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 20,
              background: user
                ? 'rgba(16,185,129,0.1)'
                : guestScans >= FREE_LIMIT
                  ? 'rgba(239,68,68,0.1)'
                  : 'rgba(6,182,212,0.1)',
              border: `1px solid ${
                user
                  ? 'rgba(16,185,129,0.3)'
                  : guestScans >= FREE_LIMIT
                    ? 'rgba(239,68,68,0.3)'
                    : 'rgba(6,182,212,0.3)'
              }`,
              fontSize: 13,
              fontWeight: 600,
              color: user
                ? 'var(--green)'
                : guestScans >= FREE_LIMIT
                  ? 'var(--red)'
                  : 'var(--cyan)',
            }}
          >
            <Shield size={14} />
            {user
              ? `✅ Logged in — Unlimited scans`
              : guestScans >= FREE_LIMIT
                ? '❌ Free scans used — Sign up for more'
                : `${remaining} free scan${remaining !== 1 ? 's' : ''} remaining`
            }
          </motion.div>
        </motion.div>

        {/* Scanner Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'var(--color-card)',
            borderRadius: 24,
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
          }}
        >
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    flex: 1,
                    padding: '16px 8px',
                    border: 'none',
                    background: isActive ? 'var(--color-card)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? tab.color : 'var(--color-muted)',
                    borderBottom: isActive
                      ? `2px solid ${tab.color}`
                      : '2px solid transparent',
                    transition: 'all 0.2s',
                    marginBottom: -1,
                  }}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Input Area */}
          <div style={{ padding: '24px 28px' }}>
            <AnimatePresence mode="wait">

              {/* Description */}
              {activeTab === 'description' && (
                <motion.div
                  key="desc"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Paste the job description, email, or recruitment message here..."
                    rows={8}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      lineHeight: 1.6,
                    }}
                  />
                  <div style={{
                    fontSize: 12,
                    color: description.trim().length >= 50
                      ? 'var(--green)'
                      : 'var(--color-muted)',
                    marginTop: 6,
                  }}>
                    {description.trim().length} characters •{' '}
                    {description.trim().length >= 50
                      ? '✓ Ready to analyze'
                      : 'Minimum 50 characters required'}
                  </div>
                </motion.div>
              )}

              {/* URL */}
              {activeTab === 'url' && (
                <motion.div
                  key="url"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <input
                    type="text"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && canSubmit()) handleAnalyze();
                    }}
                    placeholder="https://example-jobs.com/apply"
                    style={inputStyle}
                  />
                  <div style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(139,92,246,0.06)',
                    border: '1px solid rgba(139,92,246,0.15)',
                    fontSize: 12,
                    color: 'var(--color-muted)',
                  }}>
                    🔍 Checks: SSL certificate • Domain reputation • Phishing indicators • Fake portals
                  </div>
                </motion.div>
              )}

              {/* Image */}
              {activeTab === 'image' && (
                <motion.div
                  key="image"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <label
                    htmlFor="scanner-img"
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    style={{
                      display: 'block',
                      border: `2px dashed ${dragOver ? 'var(--fuchsia)' : 'var(--color-border)'}`,
                      borderRadius: 16,
                      minHeight: preview ? 'auto' : 180,
                      cursor: 'pointer',
                      background: dragOver
                        ? 'rgba(217,70,239,0.05)'
                        : 'var(--color-surface)',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'hidden',
                      textAlign: 'center',
                      padding: preview ? 0 : '40px 20px',
                    }}
                  >
                    {preview ? (
                      <>
                        <img
                          src={preview}
                          alt="Preview"
                          style={{
                            width: '100%',
                            maxHeight: 280,
                            objectFit: 'cover',
                            borderRadius: 14,
                            display: 'block',
                          }}
                        />
                        <button
                          type="button"
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreview(null);
                            setFile(null);
                          }}
                          style={{
                            position: 'absolute',
                            top: 10, right: 10,
                            background: 'rgba(0,0,0,0.7)',
                            border: 'none',
                            borderRadius: '50%',
                            width: 32, height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                          }}
                        >
                          <X size={16} />
                        </button>
                        <div style={{
                          position: 'absolute',
                          bottom: 10, left: 10,
                          background: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 8,
                        }}>
                          {file?.name}
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload
                          size={36}
                          color="var(--color-muted)"
                          style={{ marginBottom: 12 }}
                        />
                        <div style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          marginBottom: 6,
                        }}>
                          Click or Drag & Drop
                        </div>
                        <div style={{
                          fontSize: 13,
                          color: 'var(--color-muted)',
                        }}>
                          PNG, JPG, WEBP • Max 10MB
                        </div>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      id="scanner-img"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => {
                        handleFile(e.target.files?.[0]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 12,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: 'var(--red)',
                fontSize: 13,
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Analyze Button */}
            {!result && (
              <motion.button
                onClick={handleAnalyze}
                disabled={!canSubmit()}
                whileHover={{ scale: canSubmit() ? 1.01 : 1 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%',
                  marginTop: 16,
                  padding: '15px',
                  borderRadius: 14,
                  border: 'none',
                  background: canSubmit()
                    ? 'linear-gradient(135deg, var(--cyan), var(--purple))'
                    : 'var(--color-surface)',
                  color: canSubmit() ? 'white' : 'var(--color-muted)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: canSubmit() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'all 0.2s',
                  outline: canSubmit()
                    ? '1px solid rgba(6,182,212,0.3)'
                    : '1px solid var(--color-border)',
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 18,
                      height: 18,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Analyze Now
                  </>
                )}
              </motion.button>
            )}

            {/* Result */}
            <ResultPanel result={result} onReset={handleReset} />
          </div>
        </motion.div>

        {/* Guest bottom CTA */}
        {!user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              marginTop: 20,
              textAlign: 'center',
              padding: '20px 24px',
              borderRadius: 16,
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <p style={{
              color: 'var(--color-muted)',
              fontSize: 14,
              marginBottom: 14,
            }}>
              🔒 Sign up free for unlimited scans + full scan history
            </p>
            <div style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <Link
                to="/register"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--cyan), var(--purple))',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                <UserPlus size={15} />
                Sign Up Free
              </Link>
              <Link
                to="/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: 'none',
                  border: '1px solid var(--color-border)',
                }}
              >
                <LogIn size={15} />
                Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}