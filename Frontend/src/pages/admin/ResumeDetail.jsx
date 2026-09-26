import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminResumeDetail } from "../../services/admin.service";

export default function AdminResumeDetail() {
  const { id } = useParams();
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getAdminResumeDetail(id);
        if (!cancelled) setResume(res.data?.data?.resume || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load resume");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-table-state"><div className="spinner-lg" /><span>Loading resume…</span></div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="admin-page">
        <div className="admin-error">{error || "Resume not found"}</div>
        <Link to="/admin/resumes" className="admin-link">← Back to resumes</Link>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <Link to="/admin/resumes" className="admin-link">← Resumes</Link>
          <h1 className="admin-page-title">Resume #{resume.id}</h1>
          <p className="admin-page-sub">user #{resume.user_id} · <StatusBadge status={resume.source} /></p>
        </div>
      </header>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Processing metadata</h2></div>
        <ul className="admin-list">
          <li><div><strong>Role</strong></div><span>{resume.role || "—"}</span></li>
          <li><div><strong>Source</strong></div><span>{resume.source}</span></li>
          <li><div><strong>ATS score</strong></div><span>{resume.ats_score ?? "Not analyzed"}</span></li>
          <li><div><strong>Original file</strong></div><span>{resume.original_filename || "—"}</span></li>
          <li><div><strong>Created</strong></div><span>{new Date(resume.createdAt).toLocaleString()}</span></li>
        </ul>
      </section>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>Analysis summary</h2></div>
        {!resume.analysis ? (
          <div className="admin-table-empty">No analysis recorded for this resume.</div>
        ) : (
          <ul className="admin-list">
            <li><div><strong>Hiring readiness</strong></div><span>{resume.analysis.hiring_readiness?.label || "—"}</span></li>
            <li><div><strong>Missing skills</strong></div><span>{(resume.analysis.missing_skills || []).join(", ") || "None recorded"}</span></li>
          </ul>
        )}
      </section>
    </div>
  );
}
