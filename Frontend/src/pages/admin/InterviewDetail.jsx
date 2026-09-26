import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/admin/StatusBadge";
import { getAdminInterviewDetail } from "../../services/admin.service";

export default function AdminInterviewDetail() {
  const { id } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getAdminInterviewDetail(id);
        if (!cancelled) setInterview(res.data?.data?.interview || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load interview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-table-state"><div className="spinner-lg" /><span>Loading interview…</span></div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="admin-page">
        <div className="admin-error">{error || "Interview not found"}</div>
        <Link to="/admin/interviews" className="admin-link">← Back to interviews</Link>
      </div>
    );
  }

  const report = interview.report || null;

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <Link to="/admin/interviews" className="admin-link">← Interviews</Link>
          <h1 className="admin-page-title">Interview #{interview.id}</h1>
          <p className="admin-page-sub">{interview.role} · user #{interview.user_id} · {interview.mode} mode</p>
        </div>
        <StatusBadge status={interview.status} />
      </header>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Session</h2></div>
        <ul className="admin-list">
          <li><div><strong>Role</strong></div><span>{interview.role}</span></li>
          <li><div><strong>Company</strong></div><span>{interview.company || "—"}</span></li>
          <li><div><strong>Difficulty</strong></div><span>{interview.difficulty}</span></li>
          <li><div><strong>Type</strong></div><span>{interview.interview_type}</span></li>
          <li><div><strong>Questions asked</strong></div><span>{(interview.questions || []).length}</span></li>
          <li><div><strong>Used resume context</strong></div><span>{interview.used_resume ? "Yes" : "No"}</span></li>
          <li><div><strong>Used opportunity context</strong></div><span>{interview.used_opportunity ? "Yes" : "No"}</span></li>
          <li><div><strong>Started</strong></div><span>{new Date(interview.createdAt).toLocaleString()}</span></li>
        </ul>
      </section>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>Report / readiness</h2></div>
        {!report ? (
          <div className="admin-table-empty">Interview readiness hasn't been assessed yet — no report generated.</div>
        ) : (
          <ul className="admin-list">
            <li><div><strong>Overall score</strong></div><span>{report.overall_score ?? "—"}</span></li>
            <li><div><strong>Hiring readiness</strong></div><span>{report.hiring_readiness?.label || "—"}</span></li>
            <li><div><strong>Missing skills</strong></div><span>{(report.missing_skills || []).join(", ") || "None recorded"}</span></li>
            <li><div><strong>Strengths</strong></div><span>{(report.strengths || []).join(", ") || "—"}</span></li>
          </ul>
        )}
      </section>
    </div>
  );
}
