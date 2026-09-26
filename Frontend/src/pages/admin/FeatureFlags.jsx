import { useEffect, useState } from "react";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminFeatureFlags, createAdminFeatureFlag, updateAdminFeatureFlag } from "../../services/admin.service";

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null); // flag id currently saving
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminFeatureFlags();
      setFlags(res.data?.data?.flags || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load feature flags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (flag) => {
    setSaving(flag.id);
    try {
      const reason = window.prompt(
        `${flag.enabled ? "Disable" : "Enable"} "${flag.key}" — optional reason for the audit log:`,
        ""
      );
      if (reason === null) return; // cancelled
      const res = await updateAdminFeatureFlag(flag.id, { enabled: !flag.enabled, reason: reason || undefined });
      const updated = res.data?.data?.flag;
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? updated : f)));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update flag");
    } finally {
      setSaving(null);
    }
  };

  const createFlag = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!newKey.trim()) {
      setCreateError("Key is required.");
      return;
    }
    setCreating(true);
    try {
      const res = await createAdminFeatureFlag({ key: newKey.trim(), description: newDesc.trim() || undefined, enabled: false });
      setFlags((prev) => [...prev, res.data.data.flag].sort((a, b) => a.key.localeCompare(b.key)));
      setNewKey("");
      setNewDesc("");
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create flag");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Configuration</p>
          <h1 className="admin-page-title">Feature Flags</h1>
          <p className="admin-page-sub">Persisted, audited toggles — every change is logged with who/when/reason.</p>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-table-state"><div className="spinner-lg" /><span>Loading flags…</span></div>
      ) : flags.length === 0 ? (
        <div className="admin-table-empty">No feature flags yet — create one below.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Key</th><th>Description</th><th>Scope</th><th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id}>
                  <td><code>{f.key}</code></td>
                  <td className="admin-muted">{f.description || "—"}</td>
                  <td>{f.scope || "—"}</td>
                  <td><StatusBadge status={f.enabled ? "active" : "canceled"}>{f.enabled ? "Enabled" : "Disabled"}</StatusBadge></td>
                  <td className="admin-muted">{new Date(f.updatedAt).toLocaleString()}</td>
                  <td>
                    <button type="button" className="btn-secondary" disabled={saving === f.id} onClick={() => toggle(f)}>
                      {saving === f.id ? "Saving…" : f.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>New flag</h2></div>
        <form onSubmit={createFlag} className="admin-filter-fields" style={{ flexWrap: "wrap" }}>
          <input className="centered-input" placeholder="key (e.g. opportunity_live_discovery)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input className="centered-input" placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Creating…" : "Create flag"}</button>
        </form>
        {createError && <div className="admin-error" style={{ marginTop: 8 }}>{createError}</div>}
      </section>
    </div>
  );
}
