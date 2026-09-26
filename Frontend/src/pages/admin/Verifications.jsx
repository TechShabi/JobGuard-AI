import { useEffect, useState } from "react";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import { getAdminVerifications } from "../../services/admin.service";

export default function AdminVerifications() {
  const [type, setType] = useState("");
  const [minScore, setMinScore] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminVerifications({
        type: type || undefined,
        min_score: minScore !== "" ? minScore : undefined,
        page: p,
        limit: 20,
      });
      setRows(res.data?.data?.verifications || []);
      setPagination(res.data?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load verifications");
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
    { key: "type", label: "Type", width: 110 },
    { key: "user_id", label: "User", width: 80 },
    { key: "scam_score", label: "Score", width: 80 },
    { key: "verdict", label: "Verdict" },
    {
      key: "content",
      label: "Content / source",
      render: (r) => (
        <span style={{ fontSize: 12, wordBreak: "break-all" }}>{r.content || "—"}</span>
      ),
    },
    {
      key: "createdAt",
      label: "When",
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Opportunity Verify</p>
          <h1 className="admin-page-title">Verifications</h1>
          <p className="admin-page-sub">Operational review of ScanHistory — not a second verification engine.</p>
        </div>
      </header>

      <FilterBar
        onSubmit={() => {
          setPage(1);
          load(1);
        }}
        onReset={() => {
          setType("");
          setMinScore("");
          setPage(1);
          setTimeout(() => load(1), 0);
        }}
      >
        <select className="centered-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Any type</option>
          <option value="url">URL</option>
          <option value="image">Image</option>
          <option value="description">Description</option>
        </select>
        <input
          className="centered-input"
          type="number"
          min="0"
          max="100"
          placeholder="Min score"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
        />
      </FilterBar>

      {error && <div className="admin-error">{error}</div>}

      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No verifications found." />

      <div className="admin-pagination">
        <button
          type="button"
          className="btn-secondary"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span>
          Page {page} of {pagination.pages} · {pagination.total} total
        </span>
        <button
          type="button"
          className="btn-secondary"
          disabled={page >= pagination.pages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
