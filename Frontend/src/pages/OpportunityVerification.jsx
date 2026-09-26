import { useState } from "react";
import { NavLink, useSearchParams, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ShieldCheck } from "lucide-react";

// Sub-components — existing Verify modes (unchanged logic)
import UrlVerification from "./VerifyUrl";
import ImageVerification from "./VerifyImage";
import DescVerification from "./VerifyDescription";
import OpportunityFind from "./OpportunityFind";

const TOP_MODE = {
  VERIFY: "verify",
  FIND: "find",
};

const VERIFY_MODE = {
  URL: "url",
  IMAGE: "image",
  DESC: "description",
};

/**
 * Verify sub-tabs (URL / Image / Description) — same pattern as before.
 * Only shown when top mode is Verify.
 */
export function VerifyTabs() {
  const [searchParams] = useSearchParams();
  const currentMode = searchParams.get("mode") || VERIFY_MODE.URL;

  const tabs = [
    { to: `?view=${TOP_MODE.VERIFY}&mode=${VERIFY_MODE.URL}`, modeKey: VERIFY_MODE.URL, label: "URL Verification" },
    { to: `?view=${TOP_MODE.VERIFY}&mode=${VERIFY_MODE.IMAGE}`, modeKey: VERIFY_MODE.IMAGE, label: "Image Verification" },
    { to: `?view=${TOP_MODE.VERIFY}&mode=${VERIFY_MODE.DESC}`, modeKey: VERIFY_MODE.DESC, label: "Description Verification" },
  ];

  return (
    <div className="flex items-center gap-3 mb-8 flex-wrap">
      {tabs.map(({ to, modeKey, label }) => {
        const isActive = currentMode === modeKey;
        return (
          <NavLink
            key={modeKey}
            to={to}
            replace
            className={() => `verify-tabs px-5 py-2.5 rounded-xl font-medium ${isActive ? "active" : ""}`}
          >
            {label}
          </NavLink>
        );
      })}
    </div>
  );
}

/**
 * Opportunity tool shell — Verify (existing) + Find (Sprint 5).
 * Mode switch mirrors Resume Builder / Review: in-place, same visual language.
 */
export default function OpportunityVerification() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Top-level: verify | find. Default remains verify so existing links keep working.
  // Also accept legacy ?mode=url|image|description without view= as Verify.
  const rawView = searchParams.get("view");
  const rawMode = searchParams.get("mode");
  const isLegacyVerifyMode =
    !rawView && (rawMode === "url" || rawMode === "image" || rawMode === "description" || !rawMode);
  const topMode =
    rawView === TOP_MODE.FIND
      ? TOP_MODE.FIND
      : TOP_MODE.VERIFY;

  const activeVerifyMode = rawMode || VERIFY_MODE.URL;

  const [prefillData, setPrefillData] = useState(location.state?.prefillData || "");

  const switchTop = (view) => {
    if (view === TOP_MODE.FIND) {
      setSearchParams({ view: TOP_MODE.FIND }, { replace: true });
    } else {
      setSearchParams({ view: TOP_MODE.VERIFY, mode: VERIFY_MODE.URL }, { replace: true });
    }
  };

  const switchToUrl = (data = "") => {
    if (data) setPrefillData(data);
    setSearchParams({ view: TOP_MODE.VERIFY, mode: VERIFY_MODE.URL }, { replace: true });
  };
  const switchToImage = (data = "") => {
    if (data) setPrefillData(data);
    setSearchParams({ view: TOP_MODE.VERIFY, mode: VERIFY_MODE.IMAGE }, { replace: true });
  };
  const switchToDesc = (data = "") => {
    if (data) setPrefillData(data);
    setSearchParams({ view: TOP_MODE.VERIFY, mode: VERIFY_MODE.DESC }, { replace: true });
  };

  return (
    <>
      {/* Top mode switch — Find ↔ Verify */}
      <div className="tool-container" style={{ paddingBottom: 0 }}>
        <div className="opp-top-mode-switch">
          <button
            type="button"
            className={`opp-top-mode-btn ${topMode === TOP_MODE.VERIFY ? "active" : ""}`}
            onClick={() => switchTop(TOP_MODE.VERIFY)}
          >
            <ShieldCheck size={16} />
            Verify
          </button>
          <button
            type="button"
            className={`opp-top-mode-btn ${topMode === TOP_MODE.FIND ? "active" : ""}`}
            onClick={() => switchTop(TOP_MODE.FIND)}
          >
            <Search size={16} />
            Find
          </button>
        </div>
        <p className="opp-top-mode-hint">
          {topMode === TOP_MODE.VERIFY ? (
            <>
              Already have an opportunity? Verify it here.{" "}
              <button type="button" className="opp-inline-link" onClick={() => switchTop(TOP_MODE.FIND)}>
                Looking for opportunities? Find one with JobGuard →
              </button>
            </>
          ) : (
            <>
              Looking for opportunities? Find one with JobGuard.{" "}
              <button type="button" className="opp-inline-link" onClick={() => switchTop(TOP_MODE.VERIFY)}>
                Already have one? Verify it →
              </button>
            </>
          )}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={topMode === TOP_MODE.FIND ? "find" : activeVerifyMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          {topMode === TOP_MODE.FIND ? (
            <OpportunityFind />
          ) : (
            <>
              {activeVerifyMode === VERIFY_MODE.URL && (
                <UrlVerification
                  initialData={prefillData}
                  onSwitchToImage={switchToImage}
                  onSwitchToDesc={switchToDesc}
                />
              )}
              {activeVerifyMode === VERIFY_MODE.IMAGE && (
                <ImageVerification
                  initialData={prefillData}
                  onSwitchToUrl={switchToUrl}
                  onSwitchToDesc={switchToDesc}
                />
              )}
              {activeVerifyMode === VERIFY_MODE.DESC && (
                <DescVerification
                  initialData={prefillData}
                  onSwitchToUrl={switchToUrl}
                  onSwitchToImage={switchToImage}
                />
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
