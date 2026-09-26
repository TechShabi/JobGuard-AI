import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminOpportunitySearchDetail } from "../../services/admin.service";

export default function AdminOpportunityDetail() {
  const { id } = useParams();
  const [search, setSearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getAdminOpportunitySearchDetail(id);
        if (!cancelled) setSearch(res.data?.data?.search || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load search");
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
          <span>Loading search…</span>
        </div>
      </div>
    );
  }

  if (error || !search) {
    return (
      <div className="admin-page">
        <div className="admin-error">{error || "Search not found"}</div>
        <Link to="/admin/opportunities" className="admin-link">← Back to opportunities</Link>
      </div>
    );
  }

  const results = Array.isArray(search.results_snapshot) ? search.results_snapshot : [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <Link to="/admin/opportunities" className="admin-link">← Opportunities</Link>
          <h1 className="admin-page-title">Search #{search.id}</h1>
          <p className="admin-page-sub">
            {search.role} · {search.location || "Any location"} · user #{search.user_id}
          </p>
        </div>
        <StatusBadge status={search.discovery_status} />
      </header>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Query</h2></div>
        <ul className="admin-list">
          <li><div><strong>Role</strong></div><span>{search.role}</span></li>
          <li><div><strong>Location</strong></div><span>{search.location || "—"}</span></li>
          <li><div><strong>Remote preference</strong></div><span>{search.remote_preference || "—"}</span></li>
          <li><div><strong>Skills</strong></div><span>{(search.skills || []).join(", ") || "—"}</span></li>
          <li><div><strong>Searched</strong></div><span>{new Date(search.createdAt).toLocaleString()}</span></li>
        </ul>
      </section>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>Discovery outcome</h2></div>
        <ul className="admin-list">
          <li><div><strong>Discovery status</strong></div><span><StatusBadge status={search.discovery_status} /></span></li>
          <li><div><strong>Winning provider</strong></div><span>{search.provider || "—"}</span></li>
          <li><div><strong>Verified count</strong></div><span>{search.verified_count ?? "—"}</span></li>
          <li><div><strong>Rejected count</strong></div><span>{search.rejected_count ?? "—"}</span></li>
        </ul>
        {Array.isArray(search.providers_used) && search.providers_used.length > 0 && (
          <div className="admin-table-wrap" style={{ marginTop: 10 }}>
            <table className="admin-table">
              <thead><tr><th>Provider</th><th>Live</th><th>Count</th><th>Note</th></tr></thead>
              <tbody>
                {search.providers_used.map((p, i) => (
                  <tr key={i}>
                    <td>{p.id}</td>
                    <td>{p.is_live ? "Yes" : "No"}</td>
                    <td>{p.count}</td>
                    <td className="admin-muted">{p.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>Result snapshot ({results.length})</h2></div>
        {results.length === 0 ? (
          <div className="admin-table-empty">No results in this snapshot.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Role</th><th>Company</th><th>Verification</th><th>Source</th></tr></thead>
              <tbody>
                {results.slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td>{r.role}</td>
                    <td>{r.company}</td>
                    <td><StatusBadge status={r.verification?.status} /></td>
                    <td className="admin-muted">{r.source_platform}</td>
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
