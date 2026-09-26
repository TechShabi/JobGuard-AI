import { useState, useEffect } from "react";
import { Trash2, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDashboardHistory, deleteScan } from "../services/dashboard.service";
import { listResumesService, deleteResumeService } from "../services/resume.service";
import { listInterviewsService, deleteInterviewService } from "../services/interview.service";

const TABS = [
  { id: "verification", label: "Verification" },
  { id: "resume_review", label: "Resume Review" },
  { id: "resume_builder", label: "Resume Builder" },
  { id: "interview", label: "Interview" },
];

export default function History() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("verification");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (activeTab) => {
    setLoading(true);
    try {
      if (activeTab === "verification") {
        const { data } = await getDashboardHistory();
        setItems(data.history || []);
      } else if (activeTab === "resume_review") {
        const { data } = await listResumesService("review");
        setItems(data.resumes || []);
      } else if (activeTab === "resume_builder") {
        const { data } = await listResumesService("builder");
        setItems(data.resumes || []);
      } else if (activeTab === "interview") {
        const { data } = await listInterviewsService();
        setItems(data.sessions || []);
      }
    } catch (err) {
      console.error("history load error:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const handleDelete = async (id) => {
    try {
      if (tab === "verification") await deleteScan(id);
      else if (tab === "interview") await deleteInterviewService(id);
      else await deleteResumeService(id);
      setItems(items.filter((i) => i.id !== id));
    } catch (err) {
      console.error("delete error:", err);
    }
  };

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "20px" }}>Career Activity History</h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ opacity: 0.7 }}>Loading your Career Activity...</div>}

      {!loading && items.length === 0 && (
        <div className="dash-empty">
          {tab === "verification" && "No opportunities verified yet — check a job posting or offer to get started."}
          {tab === "resume_review" && "No resumes reviewed yet — upload one in Resume Builder & Review."}
          {tab === "resume_builder" && "No resumes built yet — create one in Resume Builder & Review."}
          {tab === "interview" && "No interview sessions yet — start a mock interview to practice."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(100,180,255,0.15)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{renderTitle(tab, item)}</div>
              <div style={{ fontSize: "12px", opacity: 0.6, marginTop: 2 }}>
                {new Date(item.createdAt).toLocaleString()}
                {tab === "interview" && item.interview_type ? ` · ${item.interview_type}` : ""}
                {tab === "interview" && item.difficulty ? ` · ${item.difficulty}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {tab === "interview" && item.status === "completed" && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={() => navigate(`/interview?report=${item.id}`)}
                  aria-label={`View report for ${item.role}`}
                >
                  <FileText size={14} />
                  View Report
                </button>
              )}
              {tab === "interview" && item.status === "in_progress" && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(245, 158, 11, 0.12)",
                    color: "#b45309",
                  }}
                >
                  Incomplete
                </span>
              )}
              {tab === "interview" && item.status === "completed" && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "#059669",
                  }}
                >
                  Completed
                </span>
              )}
              <button
                className="btn-icon"
                style={{ color: "var(--red)" }}
                onClick={() => handleDelete(item.id)}
                aria-label="Delete this entry"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderTitle(tab, item) {
  if (tab === "verification") return `${item.type?.toUpperCase()} — ${item.verdict || "Unknown"} (${item.scam_score ?? "-"})`;
  if (tab === "interview") {
    const statusLabel = item.status === "completed" ? "Completed" : "In progress";
    return `${item.role}${item.company ? ` @ ${item.company}` : ""} — ${statusLabel}`;
  }
  return `${item.role || "Resume"} — ATS ${item.ats_score ?? "-"}`;
}
