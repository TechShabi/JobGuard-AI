import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminInterviews } from "../../services/admin.service";

export default function AdminInterviews() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminInterviews({
        user_id: userId || undefined,
        status: status || undefined,
        mode: mode || undefined,
        page: p,
        limit: 20,
      });
      setRows(res.data?.data?.interviews || []);
      setPagination(res.data?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load interviews");
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
    { key: "role", label: "Role" },
    { key: "difficulty", label: "Difficulty" },
    { key: "mode", label: "Mode" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "question_count", label: "Questions", width: 90 },
    { key: "createdAt", label: "Started", render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "—") },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Interview</p>
          <h1 className="admin-page-title">Interview Operations</h1>
          <p className="admin-page-sub">Real session and report data — see Dashboard for score distribution.</p>
        </div>
      </header>

      <FilterBar
        onSubmit={() => { setPage(1); load(1); }}
        onReset={() => { setUserId(""); setStatus(""); setMode(""); setPage(1); setTimeout(() => load(1), 0); }}
      >
        <input className="centered-input" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <select className="centered-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
        <select className="centered-input" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">Any mode</option>
          <option value="practice">Practice</option>
          <option value="timed">Timed</option>
          <option value="live">Live</option>
        </select>
      </FilterBar>

      {error && <div className="admin-error">{error}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="No interview sessions match these filters."
        onRowClick={(r) => navigate(`/admin/interviews/${r.id}`)}
      />

      <div className="admin-pagination">
        <button type="button" className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
        <span>Page {page} of {pagination.pages} · {pagination.total} total</span>
        <button type="button" className="btn-secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
