import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  User,
  Download,
  Briefcase,
  Zap,
  TrendingUp,
  ShieldCheck,
  FileText,
  MessagesSquare,
  Link2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getResumeProfileService } from "../services/resume.service";

// Quick launch tiles — merged in from the old standalone Dashboard page
// (Profile is now the single Dashboard/Profile; see App.jsx redirect).
// Kept in sync with the actual current tool set rather than the original
// verification-only list.
const QUICK_ACTIONS = [
  {
    title: "Resume Builder & Review",
    desc: "Review, optimize, or build a new ATS-ready resume",
    icon: FileText,
    href: "/resume-builder-review",
    gradient: "from-[var(--cyan)] to-blue-600",
  },
  {
    title: "Interview Simulator",
    desc: "Practice a realistic mock interview with AI feedback",
    icon: MessagesSquare,
    href: "/interview",
    gradient: "from-[var(--purple)] to-fuchsia-500",
  },
  {
    title: "Opportunity Verification",
    desc: "Check a job posting, URL, or screenshot for scam signals",
    icon: Link2,
    href: "/opportunity",
    gradient: "from-[var(--fuchsia)] to-[var(--orange)]",
  },
];

// "Not a social profile. Purpose: Save Time." — no badges, no achievements,
// no vanity analytics. Just career identity + Career Growth Membership status.

// Same premium, non-numeric session-tier wording as the Pricing page —
// never surface raw session counts to users (Sprint 3.5 §12/13).
const SESSION_TIER_LABEL = {
  starter: "Limited Career Sessions",
  plus: "More Career Sessions",
  pro: "Maximum Career Sessions",
};

export default function Profile() {
  const {
    user,
    logout,
    membership,
    careerSessions,
    permissions,
    recentActivity,
    refreshMembership,
  } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getResumeProfileService();
        setProfile(data?.profile || null);
      } catch (_) {
        setProfile(null);
      }
    })();
    refreshMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionsUsed = careerSessions?.sessionsUsed ?? 0;
  const cycleResetAt = careerSessions?.cycleResetAt ? new Date(careerSessions.cycleResetAt) : null;
  const sessionTierLabel = SESSION_TIER_LABEL[membership?.id] || "Career Sessions";

  const progressPct =
    careerSessions && !careerSessions.unlimited && careerSessions.sessionsLimit
      ? Math.min(100, Math.round((sessionsUsed / careerSessions.sessionsLimit) * 100))
      : 0;

  const permissionRows = Object.entries(permissions || {}).filter(([, p]) => !p.comingSoon);

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
        <div className="dashboard-avatar">
          <User size={22} />
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700 }}>{user?.username || "Guest"}</div>
          <div style={{ opacity: 0.6, fontSize: "13px" }}>{user?.email}</div>
        </div>
      </div>

      {/* ── Quick Actions (merged from the old Dashboard page) ──── */}
      <div style={{ marginBottom: "8px" }}>
        <div className="section-title">Quick Actions</div>
        <div className="dash-actions">
          {QUICK_ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} className="dash-action-card">
                <div className={`dash-action-icon bg-gradient-to-br ${item.gradient}`}>
                  <Icon size={22} />
                </div>
                <h3 className="dash-action-title">{item.title}</h3>
                <p className="dash-action-desc">{item.desc}</p>
                <span className="dash-action-link">Start now <ArrowRight size={14} /></span>
              </a>
            );
          })}
        </div>
      </div>

      {/* ── Career Growth Membership ─────────────────────────────── */}
      <Section title="Career Growth Membership">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{membership?.name || "Career Starter"}</div>
            <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 2 }}>{membership?.tagline}</div>
          </div>
          <button className="btn-primary" style={{ padding: "10px 18px", fontSize: 13 }} onClick={() => navigate("/pricing")}>
            <TrendingUp size={14} style={{ marginRight: 6 }} />
            Upgrade
          </button>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--popup-stat-bg, rgba(124,58,237,0.06))",
            border: "1px solid var(--popup-border, rgba(124,58,237,0.15))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Zap size={14} color="var(--purple-dark)" /> Career Sessions
            </span>
            <span style={{ fontSize: 13, opacity: 0.7 }}>
              {sessionTierLabel}
            </span>
          </div>
          {!careerSessions?.unlimited && (
            <div style={{ height: 8, borderRadius: 999, background: "rgba(124,58,237,0.12)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg,var(--purple-dark),var(--cyan))",
                  transition: "width .3s ease",
                }}
              />
            </div>
          )}
          {cycleResetAt && !careerSessions?.unlimited && (
            <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 8 }}>
              Resets {cycleResetAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          )}
        </div>
      </Section>

      {/* ── Membership Benefits ──────────────────────────────────── */}
      <Section title="Membership Benefits">
        {membership?.highlights?.length ? (
          membership.highlights.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <ShieldCheck size={14} color="var(--green)" />
              {h}
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.6 }}>Loading benefits…</div>
        )}
      </Section>

      {/* ── Feature Access ───────────────────────────────────────── */}
      <Section title="Feature Access">
        {permissionRows.length ? (
          permissionRows.map(([key, p]) => (
            <Row
              key={key}
              label={p.label}
              value={p.allowed ? "Unlocked" : `Requires ${p.requiredMembership}`}
            />
          ))
        ) : (
          <div style={{ opacity: 0.6 }}>Loading feature access…</div>
        )}
      </Section>

      <Section title="Career Identity">
        <Row label="Preferred Role" value={profile?.preferred_role || "Not set"} icon={<Briefcase size={14} />} />
        <Row label="Experience Level" value={profile?.experience_level || "Not set"} />
        <Row label="Industry" value={profile?.industry || "Not set"} />
      </Section>

      <Section title="Saved Resume">
        {profile ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Last saved builder profile available</span>
            <button className="btn-ghost" onClick={() => navigate("/history")}>
              <Download size={14} style={{ marginRight: "4px" }} /> View in History
            </button>
          </div>
        ) : (
          <div style={{ opacity: 0.6 }}>No saved resume yet — build one in Resume Builder.</div>
        )}
      </Section>

      <Section title="Saved Information">
        <Row label="Phone" value={profile?.phone || "Not set"} />
        <Row label="GitHub" value={profile?.github || "Not set"} />
        <Row label="Portfolio" value={profile?.portfolio || "Not set"} />
        <Row label="LinkedIn" value={profile?.linkedin || "Not set"} />
      </Section>

      {/* ── Recent Career Activity ───────────────────────────────── */}
      <Section title="Recent Career Activity">
        {recentActivity?.length ? (
          recentActivity.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span style={{ opacity: 0.8 }}>
                {a.feature_label}
                {a.status === "blocked" ? " (blocked)" : ""}
              </span>
              <span style={{ opacity: 0.5 }}>
                {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.6 }}>No career activity yet — try a tool to get started.</div>
        )}
      </Section>

      <button
        className="btn-secondary"
        style={{
          marginTop: "20px",
          color: "var(--logout-color)",
          borderColor: "var(--logout-border)",
        }}
        onClick={logout}
      >
        <LogOut size={16} style={{ marginRight: "6px" }} /> Logout
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ fontWeight: 700, marginBottom: "10px", fontSize: "15px" }}>{title}</div>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: "12px",
          border: "1px solid rgba(100,180,255,0.15)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, icon }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
      <span style={{ opacity: 0.7, display: "flex", alignItems: "center", gap: "6px" }}>{icon} {label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
