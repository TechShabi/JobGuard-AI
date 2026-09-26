import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

// Fix #4: Updated footer — reflects the full JobGuard AI platform, not just verification.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <Link to="/" className="footer-brand">
            <div className="footer-logo">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="navbar-brand-text">JobGuard AI</div>
            <div className="navbar-brand-sub">AI Career Workspace</div>
            </div>
          </Link>

          <div className="footer-nav-groups">
            <div className="footer-nav-group">
              <div className="footer-nav-group-title">Tools</div>
              <Link to="/opportunity" className="footer-nav-link">Opportunity Verification</Link>
              <Link to="/resume-builder-review" className="footer-nav-link">Resume Builder & Review</Link>
              <Link to="/interview" className="footer-nav-link">Interview Preparation</Link>
            </div>
            <div className="footer-nav-group">
              <div className="footer-nav-group-title">Company</div>
              <Link to="/how-it-works" className="footer-nav-link">How It Works</Link>
              <Link to="/community" className="footer-nav-link">JobGuard AI Community</Link>
              {/* Sprint 2 audit fix: "Terms & Conditions" previously linked
                  to "/" (the homepage) — there is no Terms page in this app.
                  Removed rather than pointed at a fake destination. Add back
                  once a real Terms page exists. */}
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">© 2026 JobGuard AI. All rights reserved.</p>
          <p className="footer-copy">Powered by AI · Built for Modern Job Seekers</p>
        </div>
      </div>
    </footer>
  );
}
