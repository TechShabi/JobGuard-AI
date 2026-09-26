import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  FileSearch,
  ScrollText,
  ArrowLeft,
  Briefcase,
  MessageSquare,
  FileText,
  Activity,
  CreditCard,
  ToggleLeft,
  Megaphone,
} from "lucide-react";

const NAV = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/career-sessions", label: "Career Activity", icon: Activity },
  { to: "/admin/opportunities", label: "Opportunities", icon: Briefcase },
  { to: "/admin/interviews", label: "Interviews", icon: MessageSquare },
  { to: "/admin/resumes", label: "Resumes", icon: FileText },
  { to: "/admin/reports", label: "Reports", icon: ShieldAlert },
  { to: "/admin/verifications", label: "Verifications", icon: FileSearch },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/admin/feature-flags", label: "Feature Flags", icon: ToggleLeft },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-eyebrow">JobGuard AI</span>
          <strong>Admin Portal</strong>
        </div>
        <nav className="admin-sidebar-nav" aria-label="Admin">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `admin-nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="admin-back-link">
          <ArrowLeft size={14} /> Back to app
        </Link>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
