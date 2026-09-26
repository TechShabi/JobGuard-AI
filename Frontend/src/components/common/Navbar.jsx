import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Menu, X, LogOut, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Clean dropdown structure without description junk
const TOOL_LINKS = [
  { to: '/opportunity',        label: 'Opportunity' },
  { to: '/resume-builder-review', label: 'Resume Builder & Review' },
  { to: '/interview',      label: 'Interview Preparation' },
];

function ToolsDropdown({ mobile = false, onNavigate }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const location = useLocation();
  const isToolsActive = TOOL_LINKS.some((t) => location.pathname.startsWith(t.to));

  useEffect(() => {
    if (mobile) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobile]);

  if (mobile) {
    return (
      <div className="w-full">
        <button
          type="button"
          className="navbar-dropdown-trigger"
          onClick={() => setOpen((o) => !o)}
        >
          <span>Tools</span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center"
          >
            <ChevronDown size={18} />
          </motion.div>
        </button>
        
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="overflow-hidden bg-slate-50 dark:bg-slate-900/40 rounded-lg ml-2 mt-1"
            >
              {TOOL_LINKS.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  onClick={onNavigate}
                  className={({ isActive }) => `block py-2.5 px-4 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'text-[var(--cyan)] font-semibold' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </NavLink>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="navbar-dropdown">
      <button
        type="button"
        className={`navbar-dropdown-trigger navbar-link flex items-center gap-1.5 ${
          isToolsActive 
            ? 'active' 
            : ''
        }`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>Tools</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center"
        >
          <ChevronDown size={14} className="opacity-70" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="navbar-dropdown-menu"
          >
            {TOOL_LINKS.map((t) => {
              const isActive = location.pathname.startsWith(t.to);
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  onClick={() => setOpen(false)}
                  className="navbar-dropdown-item navbar-link"
                >
                  {t.label}
                </NavLink>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Lightweight notifications bell — no backend notification feed exists yet,
// so this is presented honestly as an empty state rather than faking activity.
function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-all cursor-pointer focus:outline-none"
      >
        <Bell size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-3 w-72 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl p-4 shadow-xl shadow-slate-200/40 dark:shadow-none z-[100]"
          >
            <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">Notifications</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You're all caught up — nothing new right now.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, loading } = useAuth();

  return (
    <header className="navbar">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Brand Grouping - Pure AI Career Workspace alignment */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--cyan)] to-[var(--purple)] p-[1px] shadow-sm shadow-[var(--cyan)]/10">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[var(--cyan)] to-[var(--purple)] blur-sm opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="navbar-logo">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div>
            <div className="navbar-brand-text">JobGuard AI</div>
            <div className="navbar-brand-sub">AI Career Workspace</div>
          </div>
        </Link>

        {/* Desktop Navigation Links - Fixed Spacing as requested */}
        <nav className="hidden md:flex items-center gap-8">
          {/* <FeaturesLink /> */}

          <NavLink 
            to="/" 
            className="navbar-link"
          >
            Home
          </NavLink>

          <ToolsDropdown />

          <NavLink 
            to="/pricing" 
            className="navbar-link"
          >
            Memberships
          </NavLink>

          <NavLink 
            to="/about" 
            className="navbar-link"
          >
            About
          </NavLink>
        </nav>

        {/* Right Side - Authentication Status Areas */}
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            {loading ? (
              <div className="w-[90px] h-9 rounded-lg bg-slate-100 dark:bg-slate-900 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <NotificationsMenu />
                <NavLink 
                  to="/profile" 
                  className="navbar-link"
                >
                  <div className="w-6 h-6 rounded-md bg-[var(--cyan)] text-white font-bold text-xs flex items-center justify-center shadow-sm shadow-[var(--cyan)]/10">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {user?.username?.split(' ')[0]}
                  </span>
                </NavLink>
                <button
                  onClick={() => { logout(); window.location.href = '/'; }}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-[var(--logout-color)] border border-transparent hover:border-[var(--logout-color)]/10 hover:bg-[var(--logout-color)]/5 rounded-lg transition-all cursor-pointer focus:outline-none"
                  title="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <NavLink to="/login" className="navbar-link">
                  Sign In
                </NavLink>
              </div>
            )}
          </div>

          {/* Mobile Action Hamburger Toggle Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="navbar-mobile-tools-trigger md:hidden"
            aria-label="Toggle structural layout menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu Layout */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="md:hidden absolute top-16 left-0 right-0 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 p-4 shadow-xl z-50"
          >
            <div className="flex flex-col space-y-2">

              <ToolsDropdown mobile onNavigate={() => setMobileOpen(false)} />

              <NavLink
                to="/pricing"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `block py-2.5 px-4 rounded-lg font-medium text-base transition-colors ${
                  isActive ? 'text-[var(--cyan)] bg-[var(--cyan)]/5 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                }`}
              >
                Pricing
              </NavLink>

              <NavLink
                to="/about"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `block py-2.5 px-4 rounded-lg font-medium text-base transition-colors ${
                  isActive ? 'text-[var(--cyan)] bg-[var(--cyan)]/5 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                }`}
              >
                About
              </NavLink>

              {/* Mobile Profile State Matrix */}
              {!loading && (
                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-900">
                  {user ? (
                    <div className="space-y-2">
                      <NavLink
                        to="/profile"
                        onClick={() => setMobileOpen(false)}
                        className="navbar-link"
                      >
                        <div className="w-8 h-8 rounded-md bg-[var(--cyan)] text-white font-bold text-sm flex items-center justify-center">
                          {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-base">{user?.username}</span>
                      </NavLink>
                      <div className="flex items-center gap-2 py-2.5 px-4 text-slate-500 dark:text-slate-400 text-sm">
                        <Bell size={16} /> No new notifications
                      </div>
                      <button
                        onClick={() => { logout(); setMobileOpen(false); window.location.href = '/'; }}
                        className="w-full flex items-center gap-2 py-2.5 px-4 rounded-lg text-[var(--logout-color)] hover:bg-[var(--logout-color)]/5 font-medium text-base transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 p-2">
                      <NavLink 
                        to="/login" 
                        onClick={() => setMobileOpen(false)} 
                        className="navbar-link"
                      >
                        Sign In
                      </NavLink>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}