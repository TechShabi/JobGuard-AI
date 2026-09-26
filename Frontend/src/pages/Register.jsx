import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, User, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { isValidEmail } from '../utils/validation';

export default function Register() {
  useThemeContext();

  // Fix: page should always open scrolled to top (e.g. "Get Started Free"
  // from the bottom of the landing page was opening Signup mid-scroll).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);

    try {
      await register(name.trim(), email.trim(), password);
      navigate('/profile', { replace: true });
    } catch (err) {
      // Sprint 2 audit fix (Critical): this previously read
      // err.response.data.message with no optional chaining, which threw a
      // TypeError (and silently swallowed the real error) whenever the
      // request failed before a response arrived — e.g. a network error or
      // timeout. Now falls back gracefully in that case too.
      setError(err.response?.data?.message || 'Registration failed. Please try again.');

      setTimeout(() => {
        setError("");
      }, 2000);

    } finally {
      setLoading(false);
    }
  };

  const passStrength = password.length === 0 ? 0
    : password.length < 4 ? 1
    : password.length < 8 ? 2
    : 3;

  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][passStrength];
  const strengthColor = ['', 'var(--red)', 'var(--amber)', 'var(--green)'][passStrength];

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
            <h1 className="auth-title">Create Your Account</h1>
            <p className="auth-subtitle">Protect and grow your career with AI — free to start</p>
          </div>
          <div className="auth-card">
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <div className="auth-error">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  {error}
                </div>
              )}

              <div className="auth-input-group">
                <label className="form-label" htmlFor="register-name">Full Name</label>
                <div className="auth-input-icon"><User size={18} /></div>
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="form-input"
                  style={{ paddingLeft: '48px' }}
                  autoComplete="name"
                />
              </div>

              <div className="auth-input-group">
                <label className="form-label" htmlFor="register-email">Email Address</label>
                <div className="auth-input-icon"><Mail size={18} /></div>
                <input
                  id="register-email"
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
                <label className="form-label" htmlFor="register-password">Password</label>
                <div className="auth-input-icon"><Lock size={18} /></div>
                <input
                  id="register-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="form-input"
                  style={{ paddingLeft: '48px' }}
                  autoComplete="new-password"
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

              {password.length > 0 && (
                <div className="auth-pass-strength">
                  <div className="auth-pass-bar">
                    <div
                      className="auth-pass-fill"
                      style={{
                        width: (passStrength / 3) * 100 + '%',
                        backgroundColor: strengthColor
                      }}
                    />
                  </div>
                  <span className="auth-pass-label" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </span>
                </div>
              )}

              <div className="auth-input-group">
                <label className="form-label" htmlFor="register-confirm-password">Confirm Password</label>
                <div className="auth-input-icon"><Lock size={18} /></div>
                <input
                  id="register-confirm-password"
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="form-input"
                  style={{ paddingLeft: '48px' }}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <Loader2 size={20} className="spinner" /> : (
                  <>Create Account <ShieldCheck size={18} /></>
                )}
              </button>
            </form>

            <div className="auth-divider">
              <p className="auth-divider-text">
                Already have an account?{' '}
                <Link to="/login" className="auth-divider-link">Sign in →</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}