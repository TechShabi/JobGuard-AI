import { useEffect, useState } from "react";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import { getAdminAuditLog } from "../../services/admin.service";

export default function AdminAuditLog() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminAuditLog({
        action: action || undefined,
        page: p,
        limit: 25,
      });
      setRows(res.data?.data?.logs || []);
      setPagination(res.data?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load audit log");
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
    {
      key: "createdAt",
      label: "Time",
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"),
    },
    { key: "admin_id", label: "Admin", width: 80 },
    { key: "action", label: "Action" },
    {
      key: "target",
      label: "Target",
      render: (r) =>
        r.target_type ? `${r.target_type}${r.target_id != null ? ` #${r.target_id}` : ""}` : "—",
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => r.reason || "—",
    },
    {
      key: "diff",
      label: "Before → After",
      render: (r) => (
        <span style={{ fontSize: 12 }}>
          {summarize(r.before)} → {summarize(r.after)}
        </span>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Compliance</p>
          <h1 className="admin-page-title">Audit Log</h1>
          <p className="admin-page-sub">Read-only history of admin mutations. Secrets are redacted at write time.</p>
        </div>
      </header>

      <FilterBar
        onSubmit={() => {
          setPage(1);
          load(1);
        }}
        onReset={() => {
          setAction("");
          setPage(1);
          setTimeout(() => load(1), 0);
        }}
      >
        <input
          className="centered-input"
          placeholder="Filter by action (e.g. report.status_change)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </FilterBar>

      {error && <div className="admin-error">{error}</div>}

      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No audit events yet." />

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

function summarize(obj) {
  if (obj == null) return "—";
  if (typeof obj !== "object") return String(obj);
  if (obj.status != null) return `status=${obj.status}`;
  try {
    const s = JSON.stringify(obj);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  } catch {
    return "—";
  }
}
