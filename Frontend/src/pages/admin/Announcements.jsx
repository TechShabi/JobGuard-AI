import { useEffect, useState } from "react";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminAnnouncements, createAdminAnnouncement, updateAdminAnnouncement } from "../../services/admin.service";

export default function AdminAnnouncements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminAnnouncements({ limit: 50 });
      setItems(res.data?.data?.announcements || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (a) => {
    setSaving(a.id);
    try {
      const res = await updateAdminAnnouncement(a.id, { active: !a.active });
      const updated = res.data?.data?.announcement;
      setItems((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update announcement");
    } finally {
      setSaving(null);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!title.trim() || !message.trim()) {
      setCreateError("Title and message are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await createAdminAnnouncement({ title: title.trim(), message: message.trim(), active: false });
      setItems((prev) => [res.data.data.announcement, ...prev]);
      setTitle("");
      setMessage("");
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create announcement");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Communication</p>
          <h1 className="admin-page-title">Announcements</h1>
          <p className="admin-page-sub">Create and manage announcements. User-facing rendering is a later phase.</p>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-table-state"><div className="spinner-lg" /><span>Loading announcements…</span></div>
      ) : items.length === 0 ? (
        <div className="admin-table-empty">No announcements yet — create one below.</div>
      ) : (
        <ul className="admin-list">
          {items.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <span className="admin-muted"> · {a.message.slice(0, 80)}{a.message.length > 80 ? "…" : ""}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <StatusBadge status={a.active ? "active" : "canceled"}>{a.active ? "Active" : "Inactive"}</StatusBadge>
                <button type="button" className="btn-secondary" disabled={saving === a.id} onClick={() => toggleActive(a)}>
                  {saving === a.id ? "Saving…" : a.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>New announcement</h2></div>
        <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="centered-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="centered-input" placeholder="Message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          <div>
            <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Creating…" : "Create announcement"}</button>
          </div>
        </form>
        {createError && <div className="admin-error" style={{ marginTop: 8 }}>{createError}</div>}
      </section>
    </div>
  );
}
