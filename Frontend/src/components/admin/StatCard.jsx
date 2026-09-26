export default function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`admin-stat-card ${tone ? `admin-stat-${tone}` : ""}`}>
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value ?? "—"}</div>
      {hint ? <div className="admin-stat-hint">{hint}</div> : null}
    </div>
  );
}
