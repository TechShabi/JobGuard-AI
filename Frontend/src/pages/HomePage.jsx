import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ShieldCheck, ArrowRight, Check, Sun, Moon,
  Briefcase, MessagesSquare, Wrench, Sparkles,
  ChevronRight, Zap, Target, UserCheck
} from "lucide-react";
import { useContextEngine } from "../context/ContextEngineContext";
import { useThemeContext } from "../context/ThemeContext";

// ── Theme Toggle Button Component ───────────────────────────────────────────
function ThemeToggle() {
  const { dark, toggleTheme } = useThemeContext();

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      aria-label="Toggle theme"
      className="fixed bottom-8 right-8 z-50 flex items-center justify-center w-14 h-14 rounded-full cursor-pointer backdrop-blur-xl transition-all duration-300"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-lg)"
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={{ rotate: -60, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 60, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          {dark ? (
            <Moon size={22} style={{ color: "var(--cyan)" }} />
          ) : (
            <Sun size={22} style={{ color: "var(--amber)" }} />
          )}
        </motion.span>
      </AnimatePresence>

      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{
          boxShadow: dark
            ? ["0 0 0 0px rgba(34,211,238,0.3)", "0 0 0 8px rgba(34,211,238,0)", "0 0 0 0px rgba(34,211,238,0)"]
            : ["0 0 0 0px rgba(245,158,11,0.3)", "0 0 0 8px rgba(245,158,11,0)", "0 0 0 0px rgba(245,158,11,0)"]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.button>
  );
}

// ── Shared Hover Animation Props ─────────────────────────────────────────────
const cardHoverProps = {
  whileHover: {
    y: -4,
    scale: 1.01,
    transition: { duration: 0.22, ease: "easeInOut" }
  }
};

export default function HomePage() {
  const { hasContext, context, clearActiveContext } = useContextEngine();

  const heroWorkflowSteps = [
    "Opportunity",
    "Verified Safe",
    "Career Focus Saved",
    "Resume Builder",
    "Resume Review",
    "Interview Preparation",
    "Ready To Apply"
  ];

  const mainTools = [
    {
      title: "Opportunity Verification",
      description: "Verify a job post, link, or message before you apply. Stay safe from fake listings and scams.",
      icon: ShieldCheck,
      href: "/opportunity",
      badge: "JOB SCAN",
      cta: "Verify Job Safety",
    },
    {
      title: "Resume Builder & Review",
      description: "Create an ATS-ready resume and review using AI guidance and your saved career context.",
      icon: Briefcase,
      href: "/resume-builder-review",
      badge: "ATS OPTIMIZED",
      cta: "Build From Scratch",
    },
    {
      title: "Interview Preparation",
      description: "Practice role-specific interviews using your saved career context and resume.",
      icon: MessagesSquare,
      href: "/interview",
      badge: "APPLY READY",
      cta: "Start Mock Interview",
    },
  ];

  const journeySteps = [
    { step: "01", icon: Target, title: "Find an Opportunity", desc: "Found a job post online or received a message?" },
    { step: "02", icon: ShieldCheck, title: "Verify It", desc: "Scan links and posts to confirm it's 100% legitimate and safe.", href: "/opportunity" },
    { step: "03", icon: Briefcase, title: "Build Your Resume", desc: "Generate an ATS-ready resume structured specifically for the role.", href: "/resume-builder-review" },
    { step: "04", icon: Wrench, title: "Improve Your Resume", desc: "Fix layout flaws and match missing keywords to pass job filters.", href: "/resume-builder-review" },
    { step: "05", icon: MessagesSquare, title: "Prepare for Interview", desc: "Practice interactive role-specific questions with AI coaching.", href: "/interview" },
    { step: "06", icon: UserCheck, title: "Apply With Confidence", desc: "Submit your application knowing everything is verified and tailored.", href: null },
  ];

  const trustPoints = [
    { title: "Scam Detection", desc: "Instant detection of fake job offers and honey traps.", icon: ShieldCheck },
    { title: "ATS Optimization", desc: "Tailor keyword matches for automated resume screeners.", icon: Wrench },
    { title: "Smart Context", desc: "Save career information once to power all tools.", icon: Target },
    { title: "AI Resume Builder", desc: "Generate professional resumes in standardized formats.", icon: Briefcase },
    { title: "Interview Preparation", desc: "Role-specific practice scenarios with active AI feedback.", icon: MessagesSquare },
    { title: "Privacy First", desc: "Your data stays private and encrypted at every stage.", icon: UserCheck },
  ];

  const productValues = [
    { title: "AI Guidance", desc: "Personalized assistance tailored to your specific career targets.", sub: "Personalized Coaching" },
    { title: "Save Time", desc: "Skip repeated data entry with seamless tool synchronization.", sub: "Automated Workflows" },
    { title: "Stay Protected", desc: "Avoid fake listings, pay-to-apply schemes, and employment scams.", sub: "100% Verified Safe" },
    { title: "Smart Career Focus", desc: "Unified profile details seamlessly inform every workspace utility.", sub: "Single Data Profile" },
    { title: "Better Interviews", desc: "Practice role-driven mock questions with actionable scoring.", sub: "Confidence Building" },
    { title: "Better Opportunities", desc: "Target high-conviction job openings with optimized materials.", sub: "Higher Match Rate" },
  ];

  return (
    <div className="home-page">
      <ThemeToggle />

      {/* Decorative Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-40" 
        style={{ 
          backgroundImage: `linear-gradient(to right, var(--grid-color) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-color) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }} 
      />

      {/* ══════════════════════════════
          PART 1 — HERO SECTION
      ══════════════════════════════ */}
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-container">
          <div className="hero-grid">
            
            {/* Hero Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="badge badge-purple mb-2">
                <Sparkles size={14} />
                AI Career Workspace
              </div>

              <h1 id="hero-heading" className="hero-title">
                Your Complete <br />
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-brand)" }}>
                  AI Career Workspace
                </span>
              </h1>

              <p className="hero-subtitle">
                JobGuard AI helps you verify opportunities, build stronger resumes, improve ATS compatibility, and prepare for interviews—all while keeping your career context connected across every tool.
              </p>

              <div className="hero-buttons">
                <button
                  type="button"
                  aria-label="Scroll to main tools"
                  className="btn-primary"
                  onClick={() => document.getElementById("tools-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Explore Workspace
                  <ArrowRight size={16} />
                </button>
                <Link 
                  to="/pricing" 
                  className="btn-secondary"
                >
                  Compare Plans
                  <Sparkles size={18} style={{ color: "var(--amber)" }} />
                </Link>
              </div>


            </motion.div>

            {/* Hero Right — Visual Workflow Visualizer */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hero-visual"
            >
              <div className="hero-visual-card">
                <div className="hero-visual-bg">
                  <img src="/images/ai-cyber-shield.jpg" alt="AI Shield" />
                  <div className="hero-visual-bg-overlay" />
                </div>

                <div className="hero-visual-content">
                  {/* Radar */}
                  <div className="hero-radar">
                    <div className="hero-radar-glow" />
                    <div className="hero-radar-outer">
                      <div className="hero-radar-inner">
                        <div className="hero-radar-icon">
                          <ShieldCheck size={40} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                    <div className="hero-radar-ring" />
                  </div>

                  {/* Detection Info */}
                  <div>
                    <div className="hero-detection-badge">
                      <div className="hero-detection-dot" />
                      <span className="hero-detection-text">
                        Detection Coverage
                      </span>
                    </div>
                    <h3 className="hero-detection-title">
                      Verify • Improve • Prepare
                    </h3>
                    <p className="hero-detection-desc">
                      Start with free tools today. Upgrade only when you need more AI power.
                    </p>

                    <div className="hero-stats">
                      <div className="hero-stat">
                        <div
                          className="hero-stat-val"
                          style={{ color: "var(--cyan)" }}
                        >
                          99.2%
                        </div>
                        <div className="hero-stat-label">Accuracy</div>
                      </div>
                      <div className="hero-stat-divider" />
                      <div className="hero-stat">
                        <div
                          className="hero-stat-val"
                          style={{ color: "var(--purple)" }}
                        >
                          &lt;2s
                        </div>
                        <div className="hero-stat-label">Analysis</div>
                      </div>
                      <div className="hero-stat-divider" />
                      <div className="hero-stat">
                        <div
                          className="hero-stat-val"
                          style={{ color: "var(--indigo)" }}
                        >
                          50K+
                        </div>
                        <div className="hero-stat-label">Scans</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating top */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
                className="hero-float hero-float-top"
              >
                <div className="hero-float-live">
                  <div className="hero-float-live-dot" />
                  <span className="hero-float-live-text">Live Protection</span>
                </div>
              </motion.div>

              {/* Floating bottom */}
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 6, repeat: Infinity, delay: 1 }}
                className="hero-float hero-float-bottom"
              >
                <div className="hero-float-score-label">Scam Score</div>
                <div className="hero-float-score-val">87%</div>
              </motion.div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          PART 2 — ACTIVE CONTEXT BANNER
      ══════════════════════════════ */}
      <AnimatePresence>
        {hasContext && (
          <section className="relative z-10 py-4" aria-label="Active context configuration info">
            <div className="max-w-7xl mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border rounded-2xl gap-6"
                style={{
                  backgroundColor: "var(--bg-card-strong)",
                  borderColor: "var(--badge-purple-border)",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <div className="space-y-2">
                  <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--badge-purple-bg)", color: "var(--purple)" }}>
                    Current Career Focus
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {context.role && <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{context.role}</span>}
                    {context.company && <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>at {context.company}</span>}
                    {context.experience && <span className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: "var(--border-secondary)", color: "var(--text-muted)" }}>{context.experience}</span>}
                  </div>

                  {context.skills && context.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {context.skills.slice(0, 5).map((skill, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md" style={{ backgroundColor: "var(--badge-cyan-bg)", color: "var(--cyan)" }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {context.source_module && (
                    <div className="text-xs font-semibold" style={{ color: "var(--cyan)" }}>
                      Source: {context.source_module}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    type="button"
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    style={{ background: "var(--gradient-brand)", color: "var(--text-inverse)" }}
                    onClick={() => document.getElementById("tools-section")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Continue Journey <ChevronRight size={14} />
                  </button>
                  <button 
                    type="button" 
                    className="flex-1 md:flex-none inline-flex items-center justify-center text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors cursor-pointer hover:opacity-80"
                    style={{ borderColor: "var(--logout-border)", color: "var(--logout-color)", backgroundColor: "var(--logout-bg)" }}
                    onClick={clearActiveContext}
                  >
                    Clear Context
                  </button>
                </div>
              </motion.div>
            </div>
          </section>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════
          PART 3 — MAIN TOOLS SECTION
      ══════════════════════════════ */}

      <section className="main-tools" id="tools-section">
        <div className="main-tools-container">
            
          <div className="main-tools-header">
            <h2 className="main-tools-title">What do you need right now?</h2>
            <p className="main-tools-desc">
              Choose a tool to start or let our smart context bridge your entire application journey automatically.
            </p>
          </div>
            
          <div className="main-tools-grid-equal">
            {mainTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <motion.div 
                  key={tool.href} 
                  className="main-tools-item"
                  {...cardHoverProps} 
                >
                  <Link to={tool.href} className="tools-card tools-card-purple">
                    <div className="tools-card-inner">
                      <div className="tools-card-header">
                        <div
                          className="tools-card-icon"
                          style={{ background: "linear-gradient(135deg,var(--purple),var(--cyan))" }}
                        >
                          <Icon size={20} />
                        </div>
                        <span className="tools-card-badge">{tool.badge}</span>
                      </div>
                      
                      <h3 className="tools-card-title">{tool.title}</h3>
                      <p className="tools-card-desc">{tool.description}</p>
              
                      <div className="tools-card-action">
                        <span>{tool.cta}</span>
                        <ArrowRight size={12} className="transform transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
          
        </div>
      </section>

      {/* ══════════════════════════════
          PART 4 — SMART CONTEXT SECTION (NEW)
      ══════════════════════════════ */}
      <section className="relative z-10 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div 
            className="p-8 sm:p-12 rounded-3xl border text-center relative overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-secondary)",
              boxShadow: "var(--shadow-md)"
            }}
          >
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--badge-cyan-bg)", color: "var(--cyan)" }}>
                <Zap size={14} /> Smart Context Architecture
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">One Context. Every Tool.</h2>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Enter your career information once. Every JobGuard AI tool automatically reuses it.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold pt-2" style={{ color: "var(--cyan)" }}>
                <span>✓ No repeated forms</span>
                <span>✓ No repeated typing</span>
                <span>✓ Smarter AI everywhere</span>
              </div>
            </div>

            {/* Smart Context Flow Diagram */}
            <div className="mt-10 pt-8 border-t flex flex-wrap items-center justify-center gap-3 sm:gap-4" style={{ borderColor: "var(--border-primary)" }}>
              {["Job Opportunity", "Career Focus", "Resume Builder", "Resume Review", "Interview", "Ready to Apply"].map((step, idx, arr) => (
                <div key={step} className="flex items-center gap-3">
                  <div 
                    className="px-3.5 py-2 rounded-xl border text-xs font-bold"
                    style={{
                      backgroundColor: idx === 1 ? "var(--badge-purple-bg)" : "var(--bg-tertiary)",
                      borderColor: idx === 1 ? "var(--purple)" : "var(--border-primary)",
                      color: idx === 1 ? "var(--purple)" : "var(--text-primary)"
                    }}
                  >
                    {step}
                  </div>
                  {idx < arr.length - 1 && <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          PART 5 — JOURNEY SECTION
      ══════════════════════════════ */}
      <section className="relative z-10 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Your Path with JobGuard AI</h2>
            <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              A structured step-by-step roadmap to navigate from job search to offer letter.
            </p>
          </div>

          <div className="relative max-w-3xl mx-auto flex flex-col space-y-10">
            {/* Smooth Thread Integration using Locked Indigo/Cyan Segment */}
            <div className="absolute top-6 bottom-6 left-[23px] w-[2px] bg-gradient-to-b from-[var(--cyan)] via-[var(--indigo)] to-purple-600 z-0 opacity-80" />

            {journeySteps.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="relative z-10 flex gap-5 items-start"
                >
                  {/* 1. Static Icon - Direct <div> (Is par KOI hover animation nahi aayegi) */}
                  <div 
                    className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-[var(--indigo)] select-none"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-primary)",
                      boxShadow: "var(--shadow-sm)",
                      borderWidth: "1px",
                      borderStyle: "solid"
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  
                  {/* 2. Card Content - Sirf yeh HOVER par Motion karega */}
                  <motion.div 
                    {...cardHoverProps}
                    className="p-5 rounded-xl flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-primary)",
                      boxShadow: "var(--shadow-sm)",
                      borderWidth: "1px",
                      borderStyle: "solid"
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span 
                          className="px-3 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0" 
                          style={{ backgroundColor: "var(--badge-purple-bg)", color: "var(--purple)" }}
                        >
                          STAGE {item.step}
                        </span>
                        <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {item.desc}
                      </p>
                    </div>

                    {item.href && (
                      <Link 
                        to={item.href} 
                        className="inline-flex items-center gap-1 text-xs font-bold hover:underline whitespace-nowrap self-start sm:self-auto" 
                        style={{ color: "var(--purple)" }}
                      >
                        Launch <ArrowRight size={12} />
                      </Link>
                    )}
                  </motion.div>
                  
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          PART 7 — PRICING CTA
      ══════════════════════════════ */}
      <section className="relative z-10 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div 
            className="p-10 sm:p-14 rounded-3xl border text-center relative overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-secondary)",
              boxShadow: "var(--shadow-lg)"
            }}
          >
            <h2 className="text-3xl font-black tracking-tight mb-3">Your next role is waiting.</h2>
            <p className="max-w-md mx-auto text-xs sm:text-sm leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              Join 50,000+ job seekers who trust JobGuard AI to verify, build, and prepare.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/register" 
                className="btn-primary"
              >
                Get Started Free <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}