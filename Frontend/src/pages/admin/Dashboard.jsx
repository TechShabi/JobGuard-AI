import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../../components/admin/StatCard";
import StatusBadge from "../../components/admin/StatusBadge";
import {
  getAdminStats,
  getAdminAiUsage,
  getAdminOpportunityOperations,
  getAdminInterviewOperations,
  getAdminResumeOperations,
} from "../../services/admin.service";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export default function AdminDashboard() {
  const [range, setRange] = useState("7d");
  const [stats, setStats] = useState(null);
  const [usage, setUsage] = useState(null);
  const [oppOps, setOppOps] = useState(null);
  const [interviewOps, setInterviewOps] = useState(null);
  const [resumeOps, setResumeOps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [s, u, o, i, r] = await Promise.all([
          getAdminStats({ range }),
          getAdminAiUsage({ days: 30 }),
          getAdminOpportunityOperations({ days: 30 }),
          getAdminInterviewOperations({ days: 30 }),
          getAdminResumeOperations({ days: 30 }),
        ]);
        if (!cancelled) {
          setStats(s.data?.data || null);
          setUsage(u.data?.data || null);
          setOppOps(o.data?.data || null);
          setInterviewOps(i.data?.data || null);
          setResumeOps(r.data?.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-table-state">
          <div className="spinner-lg" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error">{error}</div>
      </div>
    );
  }

  const s = stats || {};
  const pending = s.attention?.pending_reports || [];
  const recent = s.attention?.recent_activity || [];
  const byFeature = usage?.by_feature || s.usage?.by_feature || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-sub">What needs attention right now — real data only.</p>
        </div>
        <div className="admin-filter-fields" style={{ marginTop: 0 }}>
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={range === r.value ? "exp-btn active" : "exp-btn"}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="admin-stat-grid">
        <StatCard label="Total users" value={s.users?.total} hint={`+${s.users?.new_in_range ?? 0} in range`} />
        <StatCard label="Verifications" value={s.verifications?.in_range} hint={`${s.verifications?.total ?? 0} all time`} />
        <StatCard
          label="Pending reports"
          value={s.reports?.pending}
          hint={`${s.reports?.total ?? 0} total`}
          tone={s.reports?.pending > 0 ? "warn" : undefined}
        />
        <StatCard label="Opportunity searches" value={s.opportunity?.searches_in_range} hint={`${s.opportunity?.live_searches_in_range ?? 0} live in range`} />
        <StatCard label="Resumes" value={s.resumes?.total} />
        <StatCard label="Interviews completed" value={s.interviews?.completed_in_range} hint={`${s.interviews?.total ?? 0} all time`} />
        <StatCard label="Sessions completed" value={s.usage?.completed} />
        <StatCard label="Sessions blocked" value={s.usage?.blocked} tone={s.usage?.blocked > 0 ? "warn" : undefined} />
      </div>

      {/* Operational health — Opportunity / Interview / Resume (30d, real data only) */}
      <div className="admin-two-col" style={{ marginTop: 16 }}>
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Opportunity health (30d)</h2>
            <Link to="/admin/opportunities" className="admin-link">Inspect searches</Link>
          </div>
          {!oppOps ? (
            <div className="admin-table-empty">Data not available.</div>
          ) : (
            <>
              <ul className="admin-list">
                <li><div><strong>Live searches</strong></div><span>{oppOps.live_searches} / {oppOps.total_searches}</span></li>
                <li><div><strong>Sample fallback</strong></div><span>{oppOps.sample_searches}</span></li>
                <li><div><strong>Avg verified / search</strong></div><span>{oppOps.avg_verified_per_search ?? "—"}</span></li>
                <li><div><strong>Avg rejected / search</strong></div><span>{oppOps.avg_rejected_per_search ?? "—"}</span></li>
              </ul>
              {oppOps.provider_health?.length > 0 && (
                <div className="admin-table-wrap" style={{ marginTop: 10 }}>
                  <table className="admin-table">
                    <thead><tr><th>Provider</th><th>Searches</th><th>Successes</th><th>Failures</th></tr></thead>
                    <tbody>
                      {oppOps.provider_health.map((p) => (
                        <tr key={p.provider_id}>
                          <td>{p.provider_id}</td><td>{p.searches}</td><td>{p.successes}</td>
                          <td>{p.failures > 0 ? <StatusBadge status="rejected">{p.failures}</StatusBadge> : p.failures}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Interview health (30d)</h2>
            <Link to="/admin/interviews" className="admin-link">Inspect sessions</Link>
          </div>
          {!interviewOps ? (
            <div className="admin-table-empty">Data not available.</div>
          ) : (
            <ul className="admin-list">
              <li><div><strong>Total sessions</strong></div><span>{interviewOps.total_sessions}</span></li>
              {interviewOps.by_status.map((r) => (
                <li key={r.status}><div><StatusBadge status={r.status} /></div><span>{r.count}</span></li>
              ))}
              <li><div><strong>Avg overall score</strong></div><span>{interviewOps.avg_overall_score ?? "Not enough completed sessions"}</span></li>
            </ul>
          )}
        </section>
      </div>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <h2>Resume processing (30d)</h2>
          <Link to="/admin/resumes" className="admin-link">Inspect resumes</Link>
        </div>
        {!resumeOps ? (
          <div className="admin-table-empty">Data not available.</div>
        ) : (
          <ul className="admin-list">
            <li><div><strong>Total resumes</strong></div><span>{resumeOps.total_resumes}</span></li>
            <li><div><strong>Avg ATS score</strong></div><span>{resumeOps.avg_ats_score ?? "—"}</span></li>
            <li><div><strong>Missing analysis</strong></div><span>{resumeOps.missing_analysis_count}</span></li>
          </ul>
        )}
      </section>

      <div className="admin-two-col" style={{ marginTop: 16 }}>
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Pending reports</h2>
            <Link to="/admin/reports?status=pending" className="admin-link">
              View all
            </Link>
          </div>
          {pending.length === 0 ? (
            <div className="admin-table-empty">No pending reports.</div>
          ) : (
            <ul className="admin-list">
              {pending.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{r.title}</strong>
                    <span className="admin-muted">
                      {" "}
                      · score {r.scam_score ?? "—"} · {fmtDate(r.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Recent activity</h2>
            <Link to="/admin/verifications" className="admin-link">
              Verifications
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="admin-table-empty">No recent activity.</div>
          ) : (
            <ul className="admin-list">
              {recent.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.feature_label || a.feature_key}</strong>
                    <span className="admin-muted">
                      {" "}
                      · user #{a.user_id} · {fmtDate(a.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <h2>Usage by feature (30d)</h2>
        </div>
        {byFeature.length === 0 ? (
          <div className="admin-table-empty">No usage data yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Total</th>
                  <th>Completed</th>
                  <th>Blocked</th>
                </tr>
              </thead>
              <tbody>
                {byFeature.map((f) => (
                  <tr key={f.feature_key}>
                    <td>{f.feature_label || f.feature_key}</td>
                    <td>{f.count}</td>
                    <td>{f.completed}</td>
                    <td>{f.blocked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}
