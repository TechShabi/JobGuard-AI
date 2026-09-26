import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lightbulb, Users, Globe, Mail, Target, AlertTriangle } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';

// ── About Page ───────────────────────────────────────────────────────────────
export default function About() {
  useThemeContext();

  const values = [
    { icon: Shield, title: 'Safety First', desc: 'Protecting job seekers from fraud' },
    { icon: Lightbulb, title: 'AI Innovation', desc: 'Cutting-edge detection technology' },
    { icon: Users, title: 'Community', desc: 'Built by and for job seekers' },
    { icon: Globe, title: 'Accessibility', desc: 'Free and open to everyone' }
  ];

  return (
    <div className="how-page page-reveal">
      <div className="page-container">
        <div className="page-header-center">
          <div className="page-eyebrow badge badge-green">
            <Target size={14} />
            Our Mission
          </div>
          <h1 className="page-title gradient-text">About JobGuard AI</h1>
          <p className="page-desc">
            We're on a mission to make job hunting safer for everyone.
          </p>
        </div>

        {/* Mission Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="about-hero-card"
        >
          <div className="about-hero-glow" />
          <div className="about-icon-large">
            <Target size={32} />
          </div>
          <h2 className="about-title">Our Story</h2>
          <p className="about-text">
            Job scams are on the rise. Every day, thousands of job seekers fall victim to fraudulent opportunities that steal money, personal information, and hope. We built JobGuard AI because we've seen friends and family get scammed by too-good-to-be-true offers.
          </p>
          <p className="about-text">
            Using advanced AI pattern recognition, we analyze job postings for red flags that humans might miss. Our goal is simple: give job seekers the tools to verify opportunities before they share personal information or pay fees.
          </p>
        </motion.div>

        {/* Values */}
        <div className="text-center" style={{ marginBottom: 48 }}>
          <h2 className="page-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>Our Values</h2>
        </div>

        <div className="values-grid">
          {values.map((value, i) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="value-card"
              >
                <div className="value-icon">
                  <Icon size={28} />
                </div>
                <h3 className="value-title">{value.title}</h3>
                <p className="value-desc">{value.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div className="disclaimer-card" style={{ maxWidth: 768, margin: '0 auto 80px' }}>
          <div className="disclaimer-icon">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="disclaimer-title">Disclaimer</h3>
            <p className="disclaimer-text">
              JobGuard AI provides analysis based on pattern recognition and should be used as one tool among many in your job search safety toolkit.
              We are not a legal authority, employment agency, or verification service. Always conduct independent research, verify companies through official channels,
              and consult professionals when needed.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="contact-card">
          <div className="contact-icon">
            <Mail size={28} />
          </div>
          <h3 className="contact-title">Get In Touch</h3>
          <p className="contact-desc">
            Have feedback, found a bug, or want to contribute? We'd love to hear from you.
          </p>
          <a href="mailto:hello@jobguard.ai" className="contact-btn">
            <Mail size={18} />
            hello@jobguard.ai
          </a>
        </div>
      </div>
    </div>
  );
}