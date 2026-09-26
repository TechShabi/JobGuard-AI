import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getMembershipPlansService,
  requestMembershipInterestService,
  getMyMembershipInterestsService,
} from "../services/membership.service";

const RANK = { starter: 0, plus: 1, pro: 2 };

const PLAN_ICON = {
  starter: "🔍",
  plus: "🚀",
  pro: "👑",
};

// Theme-aware CSS variables (see index.css) — one source of truth instead
// of separate light/dark JS lookup tables that had to be kept in sync.
const PLAN_ICON_BG = {
  starter: "var(--plan-starter-bg)",
  plus: "var(--plan-plus-bg)",
  pro: "var(--plan-pro-bg)",
};

const PLAN_CTA_CLASS = { starter: "free", plus: "go", pro: "pro" };
const PLAN_CARD_TYPE = { starter: "free", plus: "popular", pro: "pro" };

// Premium, non-numeric session-tier wording (Sprint 3.5 §12/13) — never
// surface raw session counts to users; the tier name carries the meaning.
const SESSION_TIER_LABEL = {
  starter: "Limited Career Sessions",
  plus: "More Career Sessions",
  pro: "Maximum Career Sessions",
};

const faqs = [
  {
    q: "What is a Career Session?",
    a: "A Career Session is one meaningful AI career interaction — reviewing a resume, running a mock interview, verifying an opportunity, and so on. Simple actions use fewer sessions; deeper ones like a full Resume Optimization use a couple more. You always see the count, never the technical details behind it.",
  },
  {
    q: "Can I upgrade or downgrade my membership anytime?",
    a: "Yes. You can change your Career Growth Membership anytime from your Profile or this page. Changes apply immediately and your Career Session pool resets for the new membership.",
  },
  {
    q: "What happens when I run out of Career Sessions?",
    a: "You'll see a friendly prompt to continue your career growth by upgrading — never a hard technical error. Career Starter resets monthly with a smaller pool; Career Plus gives you a much larger one; Career Pro is unlimited.",
  },
  {
    q: "Why sessions instead of credits or tokens?",
    a: "Credits and tokens describe how the AI works underneath, not what you're actually doing. A Career Session describes the real thing you're getting: a completed resume review, a finished mock interview, a verified opportunity — one clear unit tied to your career growth.",
  },
  {
    q: "What can I actually do with JobGuard AI?",
    a: "Three things, all connected: verify an opportunity or job posting before you trust it, get your resume reviewed and optimized (or build a new one from scratch), and practice a realistic mock interview with AI feedback. Set your role once and every tool uses it.",
  },
  {
    q: "What's the difference between Resume Review and Resume Builder?",
    a: "They're one connected workspace, not two separate tools. Already have a resume? Upload it for an AI review, then optimize it. Starting from nothing? Build a new ATS-ready resume step by step. Either way you land in the same place — Resume Builder & Review.",
  },
  {
    q: "How does Interview Practice work?",
    a: "Set your role and a few preferences (difficulty, question count, timed or practice pace), and the AI generates a realistic mock interview — the question format adapts automatically (multiple choice, written answer, code, and more). You get a full readiness report with a question-by-question breakdown at the end.",
  },
  {
    q: "Is my data saved across memberships?",
    a: "Yes. Your resumes, interview history, and career profile stay with your account regardless of membership. Career Plus and Career Pro add deeper reports and saved comparisons on top.",
  },
  {
    q: "Do guests get to try JobGuard AI first?",
    a: "Yes — each tool offers one free session with no account required. Creating a free Career Starter account unlocks a full monthly pool of Career Sessions across every tool.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [interestByPlan, setInterestByPlan] = useState({}); // plan_id -> status

  const navigate = useNavigate();
  const { isLoggedIn, effectivePlan, startCheckout, upgradeMembership } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getMembershipPlansService();
        setPlans(data.data.plans);
        setFeatures(data.data.features);
        setPaymentsEnabled(!!data.data.billing?.payments_enabled);
        if (data.data.billing && data.data.billing.annual_supported === false) {
          setAnnual(false);
        }
      } catch (error) {
        console.error("Failed to load membership plans:", error);
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  // Load the user's own early-access requests so an already-requested plan
  // shows "You're on the list" instead of letting them resubmit.
  useEffect(() => {
    if (!isLoggedIn) {
      setInterestByPlan({});
      return;
    }
    (async () => {
      try {
        const { data } = await getMyMembershipInterestsService();
        const map = {};
        (data.data || []).forEach((row) => {
          if (row.status === "requested" || row.status === "contacted") {
            map[row.plan_id] = row.status;
          }
        });
        setInterestByPlan(map);
      } catch (error) {
        console.error("Failed to load early-access requests:", error);
      }
    })();
  }, [isLoggedIn]);

  const handleCta = async (plan) => {
    if (!isLoggedIn) {
      navigate("/register");
      return;
    }
    if (plan.id === effectivePlan) return;

    setUpgrading(plan.id);
    setUpgradeMsg("");
    try {
      // Free starter — no checkout, no interest request needed.
      if (!plan.requiresCheckout && plan.monthlyPrice === 0) {
        await upgradeMembership(plan.id);
        setUpgradeMsg(`You are on ${plan.name}.`);
        return;
      }

      // Zero-cost MVP: paid plans record real demand instead of running a
      // checkout. Current membership and Career Sessions are unaffected.
      if (!paymentsEnabled) {
        const { data } = await requestMembershipInterestService(plan.id, "pricing_page");
        setInterestByPlan((prev) => ({ ...prev, [plan.id]: "requested" }));
        setUpgradeMsg(data.message || `You're on the early-access list for ${plan.name}.`);
        return;
      }

      // Real payments enabled — checkout → verified activation.
      const result = await startCheckout(plan.id, "monthly");
      if (result.mode === "development_confirmed") {
        setUpgradeMsg(
          `Development only: ${plan.name} activated. No real payment was processed. Your Career Sessions were refreshed.`
        );
      } else if (result.mode === "redirect" && result.checkout?.checkout_url) {
        window.location.href = result.checkout.checkout_url;
      } else {
        setUpgradeMsg("Checkout started. Complete payment to activate your plan.");
      }
    } catch (error) {
      const code = error.response?.data?.code;
      const msg =
        error.response?.data?.message ||
        "Couldn't process your request. Please try again.";
      setUpgradeMsg(code === "CHECKOUT_REQUIRED" ? msg : msg);
    } finally {
      setUpgrading(null);
    }
  };

  const ctaLabel = (plan) => {
    if (isLoggedIn && plan.id === effectivePlan) return "Current Membership";
    if (upgrading === plan.id) return "Updating…";
    if (plan.id === "starter") return "Get Started Free →";
    if (!paymentsEnabled) {
      if (interestByPlan[plan.id]) return "You're on the list ✓";
      return "Request Early Access →";
    }
    return `Continue with ${plan.name} →`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ flex: 1 }} className="pricing-page">
        {/* ════════════════════════════════ HERO ════════════════════════════════ */}
        <div className="pricing-hero">
          <div className="pricing-hero-blob pricing-hero-blob-1" />
          <div className="pricing-hero-blob pricing-hero-blob-2" />

          <div className="pricing-hero-badge">
            <div className="pricing-hero-badge-dot" />
            💎 Career Growth Memberships
          </div>

          <h1 className="pricing-hero-title">
            Invest In Your{" "}
            <span className="pricing-hero-title-gradient">Career Growth</span>
          </h1>

          <p className="pricing-hero-desc">
            Opportunity Verification, Resume Review, Resume Builder, Resume Optimization,
            and Interview Preparation — one membership, powered by Career Sessions.
            Start free, upgrade when your search picks up.
          </p>

          <div className="pricing-toggle-row">
            <span className={`pricing-toggle-label ${annual ? "inactive" : "active"}`}>Monthly</span>
            <div className="pricing-toggle-track" onClick={() => setAnnual(!annual)}>
              <div className={`pricing-toggle-thumb ${annual ? "on" : "off"}`} />
            </div>
            <span className={`pricing-toggle-label ${annual ? "active" : "inactive"}`}>Annual</span>
            <span className="pricing-save-badge">Save 40%</span>
          </div>
        </div>

        {/* ════════════════════════════════ MEMBERSHIP CARDS ════════════════════════════════ */}
        <div className="pricing-cards-section">
          {upgradeMsg && (
            <div
              style={{
                maxWidth: 640,
                margin: "0 auto 24px",
                padding: "14px 20px",
                borderRadius: 12,
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.35)",
                color: "var(--green-dark)",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {upgradeMsg}
            </div>
          )}

          {loadingPlans ? (
            <div style={{ textAlign: "center", padding: "60px 0", opacity: 0.6 }}>
              Loading Career Growth Memberships…
            </div>
          ) : (
            <div className="pricing-grid">
              {plans.map((plan, idx) => {
                const cardType = PLAN_CARD_TYPE[plan.id] || "free";
                const isPro = cardType === "pro";
                const isPop = cardType === "popular";
                const isCurrent = isLoggedIn && plan.id === effectivePlan;

                return (
                  <div
                    key={plan.id}
                    className={["pricing-card", isPop ? "is-popular" : "", isPro ? "is-pro" : ""].join(" ")}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    {plan.badge && <div className="pricing-popular-badge">{plan.badge}</div>}

                    <div
                      className="pricing-card-icon"
                      style={{ background: PLAN_ICON_BG[plan.id] }}
                    >
                      {PLAN_ICON[plan.id]}
                    </div>

                    <div className="pricing-plan-name">{plan.name}</div>
                    <div className="pricing-plan-title">{plan.id === "starter" ? "Free" : plan.id === "pro" ? "Unlimited" : "Power User"}</div>
                    <div className="pricing-plan-desc">{plan.tagline}</div>

                    <div className="pricing-price-row">
                      <span className="pricing-currency">$</span>
                      <span className="pricing-amount">{annual ? plan.annualPrice : plan.monthlyPrice}</span>
                    </div>
                    <div className="pricing-period">/ month</div>
                    <div className="pricing-note">
                      {plan.id === "starter" ? "No credit card required" : annual ? "Billed annually • Save 40%" : plan.priceNote}
                    </div>

                    <div className="pricing-divider" />

                    <div className="pricing-section-label">🔋 Career Sessions</div>
                    <div className="pricing-scan-row">
                      <div className="pricing-scan-row-left">
                        <div className="pricing-scan-icon url">⚡</div>
                        <span className="pricing-scan-label">Every month</span>
                      </div>
                      <span className={`pricing-scan-count ${plan.isUnlimited ? "unlimited" : "limited"}`}>
                        {SESSION_TIER_LABEL[plan.id] || "Career Sessions"}
                      </span>
                    </div>

                    <div className="pricing-divider" style={{ marginTop: 16 }} />

                    <div className="pricing-section-label" style={{ marginTop: 16 }}>✨ What's Included</div>
                    {plan.highlights.map((h, i) => (
                      <div key={i} className="pricing-feature-row">
                        <div className="pricing-feature-dot included">✓</div>
                        {h}
                      </div>
                    ))}

                    <button
                      className={`pricing-cta-btn ${PLAN_CTA_CLASS[plan.id]}`}
                      disabled={isCurrent || upgrading === plan.id || (!paymentsEnabled && !!interestByPlan[plan.id])}
                      onClick={() => handleCta(plan)}
                      style={isCurrent || (!paymentsEnabled && !!interestByPlan[plan.id]) ? { opacity: 0.6, cursor: "default" } : undefined}
                    >
                      {ctaLabel(plan)}
                    </button>

                    <div className="pricing-guarantee">
                      {!paymentsEnabled && plan.id !== "starter"
                        ? "No payment required — we'll reach out when paid plans open up"
                        : plan.guarantee}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ════════════════════════════════ STATS ════════════════════════════════ */}
        <div className="pricing-stats-section">
          <div className="pricing-stats-grid">
            {[
              ["99.2%", "Analysis Accuracy"],
              ["50K+", "Job Seekers Helped"],
              ["<2s", "Average Response Time"],
            ].map(([val, label]) => (
              <div key={label} className="pricing-stat-box">
                <div className="pricing-stat-val">{val}</div>
                <div className="pricing-stat-label">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════ COMPARE TABLE ════════════════════════════════ */}
        <div className="pricing-compare-section">
          <h2 className="pricing-compare-title">Full Membership Comparison</h2>
          <p className="pricing-compare-desc">See exactly what each Career Growth Membership unlocks</p>

          <div className="pricing-compare-wrap">
            <div className="pricing-compare-inner">
              <table className="pricing-compare-table">
                <thead>
                  <tr className="pricing-compare-thead-row">
                    <th className="pricing-compare-th feature-col">Feature</th>
                    <th className="pricing-compare-th free-col">Career Starter</th>
                    <th className="pricing-compare-th go-col">Career Plus</th>
                    <th className="pricing-compare-th pro-col">Career Pro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="pricing-compare-row">
                    <td className="pricing-compare-td feature-col">Career Session Allowance</td>
                    <td className="pricing-compare-td free-col"><span className="pricing-val-default">{SESSION_TIER_LABEL.starter}</span></td>
                    <td className="pricing-compare-td go-col"><span className="pricing-val-go">{SESSION_TIER_LABEL.plus}</span></td>
                    <td className="pricing-compare-td pro-col"><span className="pricing-val-unlimited">{SESSION_TIER_LABEL.pro}</span></td>
                  </tr>
                  {features.map((f) => (
                    <tr key={f.key} className="pricing-compare-row">
                      <td className="pricing-compare-td feature-col">{f.label}</td>
                      {["starter", "plus", "pro"].map((tier) => {
                        const unlocked = RANK[tier] >= RANK[f.minMembership];
                        return (
                          <td key={tier} className={`pricing-compare-td ${tier === "plus" ? "go" : tier}-col`}>
                            <span className={unlocked ? "pricing-check-yes" : "pricing-check-no"}>
                              {unlocked ? "✓" : "✕"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════ FAQ ════════════════════════════════ */}
        <div className="pricing-faq-section">
          <div className="pricing-faq-inner">
            <h2 className="pricing-faq-title">Frequently Asked Questions</h2>

            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`pricing-faq-item ${openFaq === i ? "is-open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="pricing-faq-header">
                  <span>{faq.q}</span>
                  <span className={`pricing-faq-icon ${openFaq === i ? "is-open" : ""}`}>+</span>
                </div>
                {openFaq === i && <div className="pricing-faq-body">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
