import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminUserDetail } from "../../services/admin.service";

export default function AdminUserDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getAdminUserDetail(id);
        if (!cancelled) setData(res.data?.data || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load user");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-table-state">
          <div className="spinner-lg" />
          <span>Loading user…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-page">
        <div className="admin-error">{error || "User not found"}</div>
        <Link to="/admin/users" className="admin-link">
          ← Back to users
        </Link>
      </div>
    );
  }

  const u = data.user;

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <Link to="/admin/users" className="admin-link">
            ← Users
          </Link>
          <h1 className="admin-page-title" style={{ marginTop: 8 }}>
            {u.username}
          </h1>
          <p className="admin-page-sub">{u.email}</p>
        </div>
        <div className="admin-detail-badges">
          <StatusBadge status={u.role}>{u.role}</StatusBadge>
          <StatusBadge status="user">{u.membership}</StatusBadge>
        </div>
      </header>

      <section className="admin-panel">
        <h2>Identity</h2>
        <dl className="admin-dl">
          <div>
            <dt>ID</dt>
            <dd>{u.id}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{fmt(u.createdAt)}</dd>
          </div>
          <div>
            <dt>Sessions used</dt>
            <dd>{u.sessions_used ?? 0}</dd>
          </div>
          <div>
            <dt>Cycle start</dt>
            <dd>{fmt(u.sessions_cycle_start)}</dd>
          </div>
        </dl>
      </section>

      <Section title="Career context" empty={!data.career_context?.length}>
        <MiniTable
          cols={["Role", "Company", "Module", "Active", "When"]}
          rows={(data.career_context || []).map((c) => [
            c.role,
            c.company,
            c.source_module,
            c.is_active ? "yes" : "no",
            fmt(c.createdAt),
          ])}
        />
      </Section>

      <Section title="Resumes" empty={!data.resumes?.length}>
        <MiniTable
          cols={["Source", "Role", "ATS", "When"]}
          rows={(data.resumes || []).map((r) => [
            r.source,
            r.role,
            r.ats_score ?? "—",
            fmt(r.createdAt),
          ])}
        />
      </Section>

      <Section title="Interviews" empty={!data.interviews?.length}>
        <MiniTable
          cols={["Role", "Company", "Status", "When"]}
          rows={(data.interviews || []).map((i) => [
            i.role,
            i.company,
            i.status,
            fmt(i.createdAt),
          ])}
        />
      </Section>

      <Section title="Opportunity activity" empty={!data.opportunity_searches?.length && !data.saved_opportunities?.length}>
        <h3 className="admin-subhead">Searches</h3>
        <MiniTable
          cols={["Role", "Location", "Live", "When"]}
          rows={(data.opportunity_searches || []).map((o) => [
            o.role,
            o.location || "—",
            o.is_live ? "yes" : "sample",
            fmt(o.createdAt),
          ])}
        />
        <h3 className="admin-subhead">Saved</h3>
        <MiniTable
          cols={["Role", "Company", "Status", "When"]}
          rows={(data.saved_opportunities || []).map((o) => [
            o.role,
            o.company,
            o.status,
            fmt(o.updatedAt || o.createdAt),
          ])}
        />
      </Section>

      <Section title="Verifications" empty={!data.verifications?.length}>
        <MiniTable
          cols={["Type", "Score", "Verdict", "When"]}
          rows={(data.verifications || []).map((v) => [
            v.type,
            v.scam_score,
            v.verdict,
            fmt(v.createdAt),
          ])}
        />
      </Section>

      <Section title="Subscription" empty={!data.subscription}>
        {data.subscription && (
          <MiniTable
            cols={["Plan", "Status", "Provider", "Period end", "Cancel at end"]}
            rows={[[
              data.subscription.plan_id,
              data.subscription.status,
              data.subscription.provider,
              fmt(data.subscription.current_period_end),
              data.subscription.cancel_at_period_end ? "yes" : "no",
            ]]}
          />
        )}
      </Section>

      <Section title="Reports filed by this user" empty={!data.reports?.length}>
        <MiniTable
          cols={["Title", "Status", "Score", "When"]}
          rows={(data.reports || []).map((r) => [
            r.title,
            r.status,
            r.scam_score ?? "—",
            fmt(r.createdAt),
          ])}
        />
      </Section>

      <Section title="Usage activity" empty={!data.usage_activity?.length}>
        <MiniTable
          cols={["Feature", "Status", "Cost", "When"]}
          rows={(data.usage_activity || []).map((a) => [
            a.feature_label || a.feature_key,
            a.status,
            a.session_cost,
            fmt(a.createdAt),
          ])}
        />
      </Section>
    </div>
  );
}

function Section({ title, empty, children }) {
  return (
    <section className="admin-panel" style={{ marginTop: 14 }}>
      <h2>{title}</h2>
      {empty ? <div className="admin-table-empty">None yet.</div> : children}
    </section>
  );
}

function MiniTable({ cols, rows }) {
  if (!rows.length) return <div className="admin-table-empty">None yet.</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}
