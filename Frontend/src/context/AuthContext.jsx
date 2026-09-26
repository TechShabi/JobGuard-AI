import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { loginService, registerService, getMeService } from "../services/auth.service";
import {
  getMyMembershipService,
  upgradeMembershipService,
  createCheckoutService,
  confirmMockCheckoutService,
} from "../services/membership.service";
import { setUpgradeRequiredHandler } from "../services/api";
import UpgradeModal from "../components/common/UpgradeModal";

const AuthContext = createContext();

// ─── Legacy plan-limit shape, kept only so any code still reading
// PLAN_LIMITS[effectivePlan] doesn't crash. Real numbers now live in the
// backend's careerConfig and arrive via /api/membership/me. ───────────
export const PLAN_LIMITS = {
  guest: 1,
  starter: 20,
  plus: 150,
  pro: Infinity,
};

// Maps the tool-type strings every page already calls requestScan/
// incrementScan with onto the backend's Career Session feature keys.
// This is the ONLY place that mapping lives.
const TOOL_TO_FEATURE = {
  url: "opportunity_verification",
  image: "opportunity_verification",
  description: "opportunity_verification",
  opportunity_find: "opportunity_find",
  resume_review: "resume_review",
  resume_optimize: "resume_optimize",
  resume_builder: "resume_builder",
  interview: "interview_practice",
};

const STORAGE = {
  TOKEN: "token",
  GUEST_SCANS: "jg_guest_scans", // { url: bool, image: bool, description: bool, ... } — one free trial per tool, forever
};

const defaultGuest = {
  url: false,
  image: false,
  description: false,
  opportunity_find: false,
  resume_review: false,
  resume_builder: false,
  interview: false,
};

function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ─── Countdown hook kept for any component still importing it ─────────
export function useCountdown(resetTime) {
  const [display, setDisplay] = useState({ h: "00", m: "00", s: "00", total: 0 });

  useEffect(() => {
    if (!resetTime) {
      setDisplay({ h: "00", m: "00", s: "00", total: 0 });
      return;
    }
    const tick = () => {
      const diff = Math.max(0, resetTime - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay({
        h: String(h).padStart(2, "0"),
        m: String(m).padStart(2, "0"),
        s: String(s).padStart(2, "0"),
        total: diff,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetTime]);

  return display;
}

// ═════════════════════════════════════════════════════════════════════
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // popup: { reason: 'guest_limit' | 'membership_required' | 'sessions_exhausted', message: {title, body, cta} }
  const [popup, setPopup] = useState(null);

  // Guest: per-tool one-time free trial — unchanged behavior.
  const [guestScans, setGuestScans] = useState(() => readJSON(STORAGE.GUEST_SCANS, defaultGuest));

  // ── Career Growth Membership state (logged-in users only) ──────────
  // Single source of truth for these lives on the backend; this is just
  // the client's cached copy, refreshed after login and after every
  // successful AI feature call.
  const [membership, setMembership] = useState(null); // full membership config object
  const [careerSessions, setCareerSessions] = useState(null); // { sessionsUsed, sessionsLimit, sessionsRemaining, unlimited, cycleResetAt }
  const [permissions, setPermissions] = useState({}); // featureKey -> { allowed, requiredMembership, sessionCost, label }
  const [recentActivity, setRecentActivity] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  const effectivePlan = membership?.id || (user ? "starter" : "guest");

  const refreshMembership = useCallback(async () => {
    if (!localStorage.getItem(STORAGE.TOKEN)) return;
    try {
      const { data } = await getMyMembershipService();
      setMembership(data.data.membership);
      setCareerSessions(data.data.careerSessions);
      setPermissions(data.data.permissions);
      setRecentActivity(data.data.recentActivity || []);
      setSubscription(data.data.subscription || null);
      setSubscriptionStatus(data.data.subscriptionStatus || data.data.subscription?.status || null);
      setCurrentPeriodEnd(data.data.currentPeriodEnd || data.data.subscription?.current_period_end || null);
      setCancelAtPeriodEnd(!!(data.data.cancelAtPeriodEnd || data.data.subscription?.cancel_at_period_end));
    } catch (error) {
      console.error("refreshMembership error:", error);
    }
  }, []);

  // ── Register the global "server said upgrade required" hook once ───
  useEffect(() => {
    setUpgradeRequiredHandler((payload) => {
      setPopup({ reason: payload.reason || "membership_required", message: payload.message });
      // Server already has the freshest session count — sync it in.
      if (payload.careerSessions) setCareerSessions(payload.careerSessions);
    });
    return () => setUpgradeRequiredHandler(null);
  }, []);

  // ── Load user + membership on mount ─────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem(STORAGE.TOKEN);
        if (!token) {
          setLoading(false);
          return;
        }

        const { data } = await getMeService();
        setUser(data.data.user);
        await refreshMembership();
      } catch (error) {
        console.error("initAuth error:", error);
        localStorage.removeItem(STORAGE.TOKEN);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [refreshMembership]);

  // ── Auth actions ─────────────────────────────────────────────────────
  const login = async (email, password) => {
    const { data } = await loginService({ email, password });
    localStorage.setItem(STORAGE.TOKEN, data.data.token);
    setUser(data.data.user);
    await refreshMembership();
    return data;
  };

  const register = async (username, email, password) => {
    const { data } = await registerService({ username, email, password });
    return data;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE.TOKEN);
    setUser(null);
    setMembership(null);
    setCareerSessions(null);
    setPermissions({});
    setRecentActivity([]);
    setSubscription(null);
    setSubscriptionStatus(null);
    setCurrentPeriodEnd(null);
    setCancelAtPeriodEnd(false);
  };

  /**
   * Paid plans must not use this for activation.
   * Returns CHECKOUT_REQUIRED for plus/pro — callers should startCheckout.
   */
  const upgradeMembership = async (membershipId) => {
    const { data } = await upgradeMembershipService(membershipId);
    await refreshMembership();
    return data;
  };

  /**
   * Start billing checkout for a paid plan.
   * Development: confirms via mock endpoint (no real money).
   * Production real provider: would redirect to checkout_url when configured.
   */
  const startCheckout = async (planId, interval = "monthly") => {
    const { data } = await createCheckoutService({
      plan_id: planId === "go" ? "plus" : planId,
      interval,
    });
    const checkout = data.data;
    // Development mock path — confirm immediately after explicit user action
    if (checkout?.is_development && checkout?.development_confirm) {
      const conf = checkout.development_confirm;
      const confirmed = await confirmMockCheckoutService({
        payment_id: conf.payment_id,
        checkout_id: conf.checkout_id,
        signature: conf.signature,
        plan_id: conf.plan_id,
        amount: conf.amount,
        currency: conf.currency,
        interval: conf.interval,
      });
      await refreshMembership();
      return {
        mode: "development_confirmed",
        checkout,
        confirmation: confirmed.data,
        message:
          "Development membership activated. No real payment was processed.",
      };
    }
    if (checkout?.checkout_url) {
      return { mode: "redirect", checkout };
    }
    await refreshMembership();
    return { mode: "pending", checkout };
  };

  // ── Shared permission layer — every AI tool page asks this before
  // executing, via the same requestScan/incrementScan calls it always
  // has. Guests keep their exact prior trial behavior; logged-in users
  // are now checked against real Career Sessions from the backend. ────
  const checkScanPermission = useCallback((toolType) => {
    if (!user) {
      // Guest — unchanged one-time free trial per tool.
      if (guestScans[toolType]) {
        return {
          allowed: false,
          reason: "guest_limit",
          message: {
            title: "Free Session Used",
            body: "You've used your free Career Session for this tool. Create a free Career Starter account to keep going.",
            cta: "Create Free Account",
          },
        };
      }
      return { allowed: true, reason: "ok" };
    }

    const featureKey = TOOL_TO_FEATURE[toolType] || toolType;
    const perm = permissions[featureKey];

    // Permissions haven't loaded yet, or this tool isn't in the Career
    // Session catalog — fail open and let the backend's shared gate be
    // the real authority (it always re-checks server-side regardless).
    if (!perm) return { allowed: true, reason: "ok" };

    if (!perm.allowed) {
      return {
        allowed: false,
        reason: "membership_required",
        message: {
          title: `Unlock ${perm.label}`,
          body: `${perm.label} is part of a higher Career Growth Membership. Upgrade to continue your career growth.`,
          cta: "Upgrade to Continue",
        },
      };
    }

    if (
      careerSessions &&
      !careerSessions.unlimited &&
      careerSessions.sessionsRemaining < (perm.sessionCost ?? 1)
    ) {
      return {
        allowed: false,
        reason: "sessions_exhausted",
        message: {
          title: "Continue Your Career Growth",
          body: "You've used all of your Career Sessions for this cycle. Upgrade for more sessions and priority AI features.",
          cta: "Upgrade to Continue",
        },
      };
    }

    return { allowed: true, reason: "ok" };
  }, [user, guestScans, permissions, careerSessions]);

  const requestScan = useCallback((toolType) => {
    const { allowed, reason, message } = checkScanPermission(toolType);
    if (allowed) return true;
    setPopup({ reason, message });
    return false;
  }, [checkScanPermission]);

  // Called by tool pages right after a successful AI call. Guests still
  // flip their local one-time trial flag. Logged-in users don't need to
  // do local math — the backend already deducted the Career Session on
  // success, so this just re-syncs the display.
  const incrementScan = useCallback((toolType) => {
    if (!user) {
      const updated = { ...guestScans, [toolType]: true };
      setGuestScans(updated);
      writeJSON(STORAGE.GUEST_SCANS, updated);
      return;
    }
    refreshMembership();
  }, [user, guestScans, refreshMembership]);

  const canScan = useCallback((toolType) => checkScanPermission(toolType).allowed, [checkScanPermission]);
  const isLimitReached = useCallback((toolType) => !checkScanPermission(toolType).allowed, [checkScanPermission]);

  const remainingScans = useCallback((toolType) => {
    if (!user) return guestScans[toolType] ? 0 : 1;
    if (!careerSessions) return "-";
    if (careerSessions.unlimited) return "∞";
    return careerSessions.sessionsRemaining;
  }, [user, guestScans, careerSessions]);

  const resetScanCounts = useCallback(() => {
    setGuestScans(defaultGuest);
    writeJSON(STORAGE.GUEST_SCANS, defaultGuest);
    refreshMembership();
  }, [refreshMembership]);

  const value = useMemo(() => ({
        user,
        loading,
        login,
        register,
        logout,
        isLoggedIn: !!user,

        // Career Growth Membership
        effectivePlan,
        membership,
        careerSessions,
        permissions,
        recentActivity,
        refreshMembership,
        upgradeMembership,
        startCheckout,
        subscription,
        subscriptionStatus,
        currentPeriodEnd,
        cancelAtPeriodEnd,

        // Shared permission layer (unchanged call signatures)
        checkScanPermission,
        requestScan,
        incrementScan,
        canScan,
        isLimitReached,
        remainingScans,
        resetScanCounts,

        // Legacy exports kept so nothing that reads these shapes breaks
        PLAN_LIMITS,
        guestScans,
        userScans: {},
        scanCounts: {},
        FREE_LIMIT: PLAN_LIMITS.starter,
        resetTime: null,
  }), [
    user, loading, login, register, logout, effectivePlan, membership, careerSessions,
    permissions, recentActivity, refreshMembership, upgradeMembership, startCheckout,
    subscription, subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd,
    checkScanPermission, requestScan, incrementScan, canScan, isLimitReached,
    remainingScans, resetScanCounts, guestScans,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}

      {popup && (
        <UpgradeModal
          reason={popup.reason}
          message={popup.message}
          onClose={() => setPopup(null)}
        />
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
