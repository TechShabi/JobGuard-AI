const MAP = {
  pending: "admin-badge-warn",
  verified: "admin-badge-ok",
  rejected: "admin-badge-bad",
  completed: "admin-badge-ok",
  blocked: "admin-badge-bad",
  admin: "admin-badge-info",
  user: "admin-badge-muted",
  trusted: "admin-badge-ok",
  caution: "admin-badge-warn",
  // Admin Panel Evolution additions
  live_provider: "admin-badge-ok",
  sample: "admin-badge-warn",
  unavailable: "admin-badge-bad",
  error: "admin-badge-bad",
  in_progress: "admin-badge-info",
  active: "admin-badge-ok",
  past_due: "admin-badge-warn",
  canceling: "admin-badge-warn",
  canceled: "admin-badge-muted",
  expired: "admin-badge-muted",
  incomplete: "admin-badge-muted",
  builder: "admin-badge-info",
  review: "admin-badge-muted",
  // Paid-interest statuses
  requested: "admin-badge-info",
  contacted: "admin-badge-warn",
  converted: "admin-badge-ok",
  cancelled: "admin-badge-muted",
};

export default function StatusBadge({ status, children }) {
  const key = String(status || "").toLowerCase();
  const cls = MAP[key] || "admin-badge-muted";
  return <span className={`admin-badge ${cls}`}>{children || status || "—"}</span>;
}
