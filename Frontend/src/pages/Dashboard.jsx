import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, Shield, User,
  ArrowRight, FileText, Link2, Image as ImageIcon,
  LogOut, Search, Clock, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, getDashboardHistory, deleteScan } from "../services/dashboard.service";

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, () => setDark(p => !p)];
}

const footerLinks = [
  { to: '/verify/url', label: 'URL Verification' },
  { to: '/verify/description', label: 'Description' },
  { to: '/verify/image', label: 'Image' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/community', label: 'Community' },
  { to: '/about', label: 'About' },
];

// Scan type icon
function ScanTypeIcon({ type }) {
  if (type === 'url') return <Link2 size={14} />;
  if (type === 'image') return <ImageIcon size={14} />;
  return <FileText size={14} />;
}

export default function Dashboard() {
  useTheme();

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalScans: 0,
    highRisk: 0,
    lowRisk: 0,
    averageRisk: 0,
  });
  const [recentScans, setRecentScans] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setStatsLoading(true);
      setHistoryLoading(true);

      const [statsRes, historyRes] = await Promise.all([
        getDashboardStats(),
        getDashboardHistory(),
      ]);

      setStats(statsRes.data.stats || {});
      setRecentScans(historyRes.data.history || []);

    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setStatsLoading(false);
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteScan(id);
      setRecentScans(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const scanTypes = [
    { title: 'Scan Description', desc: 'Analyze job text', icon: FileText, href: '/verify/description', gradient: 'from-cyan-500 to-blue-600' },
    { title: 'Verify URL', desc: 'Check link safety', icon: Link2, href: '/verify/url', gradient: 'from-purple-500 to-cyan-500' },
    { title: 'Analyze Image', desc: 'Upload screenshot', icon: ImageIcon, href: '/verify/image', gradient: 'from-fuchsia-500 to-orange-500' },
  ];

  // Score color
  const getScoreStyle = (score) => {
    if (score >= 70) return { color: 'var(--red)', bg: 'rgba(239,68,68,0.1)' };
    if (score >= 40) return { color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)' };
    return { color: 'var(--green)', bg: 'rgba(16,185,129,0.1)' };
  };

  // Content preview
  const getContentPreview = (scan) => {
    if (scan.type === 'image') return '📷 Image scan';
    if (scan.type === 'url') return `🔗 ${scan.content?.slice(0, 60)}`;
    return `📝 ${scan.content?.slice(0, 60)}${scan.content?.length > 60 ? '...' : ''}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: 1 }} className="dashboard-page page-reveal">
        <div className="page-container">

          {/* Welcome Header */}
          <div className="dashboard-header">
            <div className="dashboard-welcome">
              <div className="dashboard-avatar">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="dashboard-title">
                  Welcome back, {user?.username?.split(' ')[0]}!
                </h1>
                <p className="dashboard-sub">Your personal security dashboard</p>
              </div>
            </div>
            <button onClick={handleLogout} className="dashboard-logout">
              <LogOut size={16} /> Sign Out
            </button>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 48 }}>
            {[
              { label: 'Total Scans', value: statsLoading ? '...' : stats.totalScans, icon: Shield, color: 'var(--cyan)' },
              { label: 'High Risk Found', value: statsLoading ? '...' : stats.highRisk, icon: AlertTriangle, color: 'var(--red)' },
              { label: 'Safe Jobs', value: statsLoading ? '...' : stats.lowRisk, icon: ShieldCheck, color: 'var(--green)' },
              { label: 'Account Type', value: 'Free', icon: User, color: 'var(--purple)' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="dash-stat"
                >
                  <div className="dash-stat-icon" style={{ backgroundColor: stat.color + '18', color: stat.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="dash-stat-val">{stat.value}</div>
                  <div className="dash-stat-label">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <h2 className="section-title">Quick Actions</h2>
          <div className="dash-actions">
            {scanTypes.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.a
                  key={item.href}
                  href={item.href}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="dash-action-card"
                >
                  <div className={`dash-action-icon bg-gradient-to-br ${item.gradient}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="dash-action-title">{item.title}</h3>
                  <p className="dash-action-desc">{item.desc}</p>
                  <span className="dash-action-link">Start now <ArrowRight size={14} /></span>
                </motion.a>
              );
            })}
          </div>

          {/* Recent Scans */}
          <h2 className="section-title" style={{ marginTop: 48 }}>Recent Scans</h2>

          {historyLoading ? (
            <div className="dash-empty">
              <div style={{ width: 32, height: 32, border: '3px solid var(--cyan)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12, color: 'var(--text-tertiary)' }}>Loading history...</p>
            </div>
          ) : recentScans.length === 0 ? (
            <div className="dash-empty">
              <Search size={32} />
              <h3>No scans yet</h3>
              <p>Start by verifying a job posting</p>
              <a href="/verify/description" className="btn-primary" style={{ marginTop: 16 }}>
                Start Scanning
              </a>
            </div>
          ) : (
            <div className="dash-scans-list">
              {recentScans.map((scan, i) => {
                const style = getScoreStyle(scan.scam_score);
                return (
                  <motion.div
                    key={scan.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="dash-scan-item"
                  >
                    {/* Score */}
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: style.bg,
                      color: style.color,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 16,
                      flexShrink: 0,
                    }}>
                      {scan.scam_score}
                    </div>

                    {/* Info */}
                    <div className="dash-scan-info" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="dash-scan-type" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'rgba(99,102,241,0.1)',
                          color: 'var(--indigo)',
                          textTransform: 'uppercase',
                        }}>
                          <ScanTypeIcon type={scan.type} />
                          {scan.type}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: style.bg,
                          color: style.color,
                        }}>
                          {scan.scam_score >= 70 ? 'HIGH RISK' : scan.scam_score >= 40 ? 'MEDIUM' : 'SAFE'}
                        </span>
                      </div>
                      <p className="dash-scan-text" style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                        {getContentPreview(scan)}
                      </p>
                      {scan.verdict && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {scan.verdict}
                        </p>
                      )}
                    </div>

                    {/* Date + Delete */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span className="dash-scan-date" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Clock size={12} />
                        {new Date(scan.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleDelete(scan.id)}
                        className="btn-icon btn-icon-sm"
                        style={{ color: 'var(--red)' }}
                        aria-label="Delete this scan"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Profile Card */}
          <div className="dash-profile" style={{ marginTop: 48 }}>
            <div className="dash-profile-header">
              <User size={20} />
              <h3>Your Profile</h3>
            </div>
            <div className="dash-profile-grid">
              <div>
                <div className="dash-profile-label">Username</div>
                <div className="dash-profile-value">{user?.username}</div>
              </div>
              <div>
                <div className="dash-profile-label">Email</div>
                <div className="dash-profile-value">{user?.email}</div>
              </div>
              <div>
                <div className="dash-profile-label">Member Since</div>
                <div className="dash-profile-value">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div>
                <div className="dash-profile-label">Plan</div>
                <div className="dash-profile-value">
                  <span className="badge badge-green">Free</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
     
    </div>
  );
}