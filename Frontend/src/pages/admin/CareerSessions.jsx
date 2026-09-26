import { useEffect, useState } from "react";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminCareerSessions } from "../../services/admin.service";

export default function AdminCareerSessions() {
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminCareerSessions({ user_id: userId || undefined, status: status || undefined, page: p, limit: 20 });
      setRows(res.data?.data?.activity || []);
      setPagination(res.data?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load career activity");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const columns = [
    { key: "id", label: "ID", width: 70 },
    { key: "user_id", label: "User", width: 80 },
    { key: "feature_label", label: "Feature", render: (r) => r.feature_label || r.feature_key },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "session_cost", label: "Cost", width: 80 },
    { key: "reason", label: "Reason" },
    { key: "createdAt", label: "When", render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "—") },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Career</p>
          <h1 className="admin-page-title">Career Sessions / Activity</h1>
          <p className="admin-page-sub">How users are consuming JobGuard's AI features, from the real usage ledger.</p>
        </div>
      </header>

      <FilterBar
        onSubmit={() => { setPage(1); load(1); }}
        onReset={() => { setUserId(""); setStatus(""); setPage(1); setTimeout(() => load(1), 0); }}
      >
        <input className="centered-input" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <select className="centered-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
      </FilterBar>

      {error && <div className="admin-error">{error}</div>}

      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No career activity matches these filters." />

      <div className="admin-pagination">
        <button type="button" className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
        <span>Page {page} of {pagination.pages} · {pagination.total} total</span>
        <button type="button" className="btn-secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
