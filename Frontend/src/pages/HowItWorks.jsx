import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useThemeContext } from '../context/ThemeContext';

// NOTE (Sprint 2 audit fix): a local `footerLinks` array previously lived
// here pointing at stale routes (/verify/url, /verify/description,
// /verify/image) that no longer exist — the app now routes verification
// through /opportunity. The array was never actually rendered anywhere in
// this file, so it was dead code as well as stale; removed rather than
// fixed in place. The real, live footer is components/common/Footer.jsx.

export default function HowItWorks() {
  useThemeContext();

  const steps = [
    {
      num: '01',
      title: 'Paste The Message',
      description: 'Copy the job description, email, or screenshot you received.',
      icon: FileText,
      gradient: 'from-[var(--cyan)] to-blue-600'
    },
    {
      num: '02',
      title: 'Pattern Check Runs',
      description: 'Our AI analyzes language patterns, red flags, and scam indicators instantly.',
      icon: Search,
      gradient: 'from-[var(--purple)] to-pink-600'
    },
    {
      num: '03',
      title: 'Review The Evidence',
      description: 'Get a detailed breakdown with risk score, red flags, and recommendations.',
      icon: ShieldCheck,
      gradient: 'from-[var(--indigo)] to-purple-600'
    },
    {
      num: '04',
      title: 'Verify Before Applying',
      description: 'Make informed decisions and avoid fraudulent opportunities.',
      icon: AlertTriangle,
      gradient: 'from-orange-500 to-red-600'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: 1 }} className="how-page page-reveal">
        <div className="page-container">
          <div className="page-header-center">
            <div className="page-eyebrow badge" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>
              <span>Simple Process</span>
            </div>
            <h1 className="page-title">How JobGuard AI Works</h1>
            <p className="page-desc">
              Four simple steps to verify job opportunities and protect yourself from scams.
            </p>
          </div>

          <div className="steps-grid">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="step-card"
                >
                  <div className="step-header">
                    <div className={`step-icon bg-gradient-to-br ${step.gradient}`}>
                      <Icon size={22} />
                    </div>
                    <span className="step-num">{step.num}</span>
                  </div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.description}</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="disclaimer-card">
              <div className="disclaimer-icon">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="disclaimer-title">Important Disclaimer</h3>
                <p className="disclaimer-text">
                  JobGuard AI is a tool to assist your judgment, not replace it. Always verify companies independently through official channels.
                  No AI system is 100% accurate. When in doubt, trust your instincts and consult with career advisors or legal professionals.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    
    </div>
  );
}