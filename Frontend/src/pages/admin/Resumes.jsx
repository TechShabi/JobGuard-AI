import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminResumes } from "../../services/admin.service";

export default function AdminResumes() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminResumes({ user_id: userId || undefined, source: source || undefined, page: p, limit: 20 });
      setRows(res.data?.data?.resumes || []);
      setPagination(res.data?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load resumes");
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
    { key: "source", label: "Source", render: (r) => <StatusBadge status={r.source} /> },
    { key: "ats_score", label: "ATS Score", width: 100 },
    { key: "original_filename", label: "File" },
    { key: "createdAt", label: "Created", render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "—") },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Resume</p>
          <h1 className="admin-page-title">Resume Operations</h1>
          <p className="admin-page-sub">Processing metadata only — full content is never shown in this list view.</p>
        </div>
      </header>

      <FilterBar
        onSubmit={() => { setPage(1); load(1); }}
        onReset={() => { setUserId(""); setSource(""); setPage(1); setTimeout(() => load(1), 0); }}
      >
        <input className="centered-input" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <select className="centered-input" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Any source</option>
          <option value="builder">Builder</option>
          <option value="review">Review</option>
        </select>
      </FilterBar>

      {error && <div className="admin-error">{error}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="No resumes match these filters."
        onRowClick={(r) => navigate(`/admin/resumes/${r.id}`)}
      />

      <div className="admin-pagination">
        <button type="button" className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
        <span>Page {page} of {pagination.pages} · {pagination.total} total</span>
        <button type="button" className="btn-secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
