import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminReports, updateAdminReportStatus } from "../../services/admin.service";

export default function AdminReports() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const load = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminReports({
        status: status || undefined,
        q: q || undefined,
        page: p,
        limit: 20,
      });
      setRows(res.data?.data?.reports || []);
      setPagination(res.data?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reports");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openStatusModal = (row) => {
    setSelected(row);
    setNextStatus(row.status === "pending" ? "verified" : "pending");
    setReason("");
    setActionMsg("");
  };

  const submitStatus = async () => {
    if (!selected || !nextStatus) return;
    if ((nextStatus === "verified" || nextStatus === "rejected") && !reason.trim()) {
      setActionMsg("Reason is required for verify/reject.");
      return;
    }
    setSaving(true);
    setActionMsg("");
    try {
      await updateAdminReportStatus(selected.id, {
        status: nextStatus,
        reason: reason.trim() || undefined,
      });
      setSelected(null);
      await load(page);
    } catch (err) {
      setActionMsg(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "id", label: "ID", width: 70 },
    { key: "title", label: "Title" },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status}>{r.status}</StatusBadge>,
    },
    { key: "scam_score", label: "Score", width: 80 },
    { key: "user_id", label: "User", width: 80 },
    {
      key: "createdAt",
      label: "When",
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"),
    },
    {
      key: "actions",
      label: "",
      width: 110,
      render: (r) => (
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: 12, padding: "6px 10px" }}
          onClick={(e) => {
            e.stopPropagation();
            openStatusModal(r);
          }}
        >
          Change status
        </button>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Moderation</p>
          <h1 className="admin-page-title">Reports</h1>
          <p className="admin-page-sub">Review community scam reports and update status with an audit trail.</p>
        </div>
      </header>

      <FilterBar
        onSubmit={() => {
          setPage(1);
          load(1);
        }}
        onReset={() => {
          setStatus("");
          setQ("");
          setPage(1);
          setTimeout(() => load(1), 0);
        }}
      >
        <input
          className="centered-input"
          placeholder="Search title"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="centered-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </FilterBar>

      {error && <div className="admin-error">{error}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="No reports found."
        onRowClick={(r) => setSelected(r)}
      />

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

      {selected && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <h2>Report #{selected.id}</h2>
            <p className="admin-muted" style={{ marginBottom: 8 }}>
              {selected.title}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12 }}>
              {selected.description?.slice(0, 400)}
              {selected.description?.length > 400 ? "…" : ""}
            </p>
            <dl className="admin-dl" style={{ marginBottom: 14 }}>
              <div>
                <dt>Current status</dt>
                <dd>
                  <StatusBadge status={selected.status}>{selected.status}</StatusBadge>
                </dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{selected.scam_score ?? "—"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd style={{ wordBreak: "break-all" }}>{selected.source_url || "—"}</dd>
              </div>
            </dl>

            <label className="form-label">New status</label>
            <select
              className="centered-input"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              style={{ marginBottom: 10 }}
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>

            <label className="form-label">Reason</label>
            <textarea
              className="centered-input"
              rows={3}
              placeholder="Required when verifying or rejecting"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ marginBottom: 12, resize: "vertical" }}
            />

            {actionMsg && <div className="admin-error">{actionMsg}</div>}

            <div className="admin-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitStatus} disabled={saving}>
                {saving ? "Saving…" : "Update status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
