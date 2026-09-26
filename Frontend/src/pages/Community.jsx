import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';

// ── Community Page ───────────────────────────────────────────────────────────
export default function Community() {
  useThemeContext();

  const reports = [
    {
      id: 1,
      company: 'QuickHire Solutions',
      score: 87,
      type: 'description',
      summary: 'Requested $150 registration fee via WhatsApp',
      date: 'Dec 18, 2025',
      flags: 5
    },
    {
      id: 2,
      company: 'Global Work From Home',
      score: 92,
      type: 'url',
      summary: 'Fake domain mimicking legitimate company',
      date: 'Dec 15, 2025',
      flags: 7
    },
    {
      id: 3,
      company: 'Elite Careers Inc',
      score: 78,
      type: 'image',
      summary: 'Unrealistic salary promises in WhatsApp screenshot',
      date: 'Dec 13, 2025',
      flags: 4
    },
    {
      id: 4,
      company: 'Tech Talent Hub',
      score: 65,
      type: 'description',
      summary: 'Vague job description with urgency tactics',
      date: 'Dec 10, 2025',
      flags: 3
    }
  ];

  const getScoreColor = (score) => {
    if (score >= 75) return { bg: 'var(--red)', light: 'rgba(239,68,68,0.1)', text: 'var(--red)' };
    if (score >= 50) return { bg: 'var(--amber)', light: 'rgba(245,158,11,0.1)', text: 'var(--amber)' };
    return { bg: 'var(--green)', light: 'rgba(16,185,129,0.1)', text: 'var(--green)' };
  };

  return (
    <div className="how-page page-reveal">
      <div className="page-container">
        <div className="page-header-center">
          <div className="page-eyebrow badge badge-purple">
            <Users size={14} />
            Community Reports
          </div>
          <h1 className="page-title">Shared Scam Reports</h1>
          <p className="page-desc">
            See the kinds of scam patterns other job seekers have flagged. Help others avoid scams by sharing your findings.
          </p>
          {/*
            Sprint 2 audit fix (Critical): this page previously said "Real
            reports from the community" while rendering a hardcoded, static
            `reports` array with no backend call anywhere in this file
            (confirmed via grep — no fetch/API/service call exists here).
            Presenting fabricated report data and stats as real community
            activity is a trust issue for a safety product, not just a
            missing feature. A live community-reports backend is a new
            feature and out of scope for this sprint (functionality/
            stability fixes only, no new features) — so the fix here is
            honesty, not fabrication: the copy above no longer claims these
            are real, and the line below labels the data as illustrative
            until a real endpoint exists.
          */}
          <p className="page-desc" style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>
            Showing illustrative examples. Live, user-submitted reports are coming soon.
          </p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 48,
            display: 'flex',
            justifyContent: 'center',
            gap: 80,
            flexWrap: 'wrap'}}>
          {[
            { label: 'Total Reports', value: '1,247', icon: AlertTriangle },
            { label: 'This Week', value: '89', icon: TrendingUp },
            { label: 'Avg Risk Score', value: '73%', icon: Users }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="stat-card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                <div>
                  <div className="stat-val" style={{ fontSize: '2rem' }}>{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-primary)' }}>
                  <Icon size={20} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reports List */}
        <div className="reports-grid">
          {reports.map((report, i) => {
            const color = getScoreColor(report.score);
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="report-card"
              >
                <div className="report-score" style={{ backgroundColor: color.light }}>
                  <div className="report-score-val" style={{ color: color.text }}>{report.score}</div>
                  <div className="report-score-label" style={{ color: color.text }}>RISK</div>
                </div>

                <div className="report-content">
                  <h3 className="report-company">{report.company}</h3>
                  <div className="report-meta">
                    <span className="report-badge">{report.type}</span>
                    <span className="report-date">
                      <Calendar size={12} />
                      {report.date}
                    </span>
                  </div>
                  <p className="report-summary">{report.summary}</p>
                </div>

                <div className="report-flags">
                  <AlertTriangle size={14} />
                  {report.flags} flags
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="built-by" style={{ marginTop: 64 }}>
          <div className="built-by-card">
            <h3 className="built-by-title">Share Your Report</h3>
            <p className="built-by-desc">
              Help protect the community by sharing scam job postings you've encountered.
            </p>
            <button className="btn-primary" style={{ marginTop: 16 }}>
              Submit Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}