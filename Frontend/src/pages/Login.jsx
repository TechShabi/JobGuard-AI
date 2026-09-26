import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';

export default function Login() {
  useThemeContext();

  // Fix: page should always open scrolled to top, regardless of where the
  // user navigated from (e.g. bottom of a long landing page).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/profile';

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      // Sprint 2 audit fix (High): previously used err.message, which for an
      // axios error is a generic string like "Request failed with status
      // code 400" rather than the backend's actual message. Now reads the
      // backend's message first (same pattern as Register.jsx), with a safe
      // fallback if the request never got a response at all.
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
      </div>
      <div className="auth-wrapper">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="auth-header">
            <Link to="/" className="auth-logo-link">
              <div className="auth-logo-icon"><ShieldCheck size={24} /></div>
              <span className="auth-logo-text">JobGuard AI</span>
            </Link>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to continue your career growth</p>
          </div>
          <div className="auth-card">
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <div className="auth-error">{error}</div>
              )}
              <div className="auth-input-group">
                <label className="form-label" htmlFor="login-email">Email Address</label>
                <div className="auth-input-icon"><Mail size={18} /></div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="form-input"
                  style={{ paddingLeft: '48px' }}
                  autoComplete="email"
                />
              </div>
              <div className="auth-input-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <div className="auth-input-icon"><Lock size={18} /></div>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="form-input"
                  style={{ paddingLeft: '48px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <Loader2 size={20} className="spinner" /> : (
                  <>Sign In <Mail size={18} /></>
                )}
              </button>
            </form>
            <div className="auth-divider">
              <p className="auth-divider-text">
                Don't have an account?{' '}
                <Link to="/register" className="auth-divider-link">Create one free →</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}