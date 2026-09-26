import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminUsers } from "../../services/admin.service";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [membership, setMembership] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminUsers({
        q: q || undefined,
        role: role || undefined,
        membership: membership || undefined,
        page: p,
        limit: 20,
      });
      setRows(res.data?.data?.users || []);
      setPagination(res.data?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
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
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    {
      key: "role",
      label: "Role",
      render: (r) => <StatusBadge status={r.role}>{r.role}</StatusBadge>,
    },
    { key: "membership", label: "Membership" },
    {
      key: "createdAt",
      label: "Joined",
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Directory</p>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-sub">Search, filter, and open a member’s full career state.</p>
        </div>
      </header>

      <FilterBar
        onSubmit={() => {
          setPage(1);
          load(1);
        }}
        onReset={() => {
          setQ("");
          setRole("");
          setMembership("");
          setPage(1);
          setTimeout(() => load(1), 0);
        }}
      >
        <input
          className="centered-input"
          placeholder="Search username or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="centered-input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Any role</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select
          className="centered-input"
          value={membership}
          onChange={(e) => setMembership(e.target.value)}
        >
          <option value="">Any membership</option>
          <option value="starter">Starter</option>
          <option value="plus">Plus</option>
          <option value="pro">Pro</option>
        </select>
      </FilterBar>

      {error && <div className="admin-error">{error}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="No users match these filters."
        onRowClick={(r) => navigate(`/admin/users/${r.id}`)}
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
    </div>
  );
}
