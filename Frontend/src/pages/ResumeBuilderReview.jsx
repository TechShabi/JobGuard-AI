import { useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ResumeReview from "./ResumeReview";
import ResumeBuilder from "./ResumeBuilder";

/**
 * Resume Builder & Review — one tool, two modes.
 *
 * Mode switches happen in place (no route change, no remount-via-navigate,
 * no redirect flash) so the user never feels like they're leaving one tool
 * to open another — just switching modes inside "the Resume tool".
 */

const MODE = {
  REVIEW: "review",
  BUILD: "build",
};

export default function ResumeBuilderReview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Default entry point is the Builder — matches "Home → Resume Builder &
  // Review" opening straight into building, with Review one click away.
  const initialMode = searchParams.get("mode") === "review" ? MODE.REVIEW : MODE.BUILD;

  const [mode, setMode] = useState(initialMode);
  const [prefillSummary, setPrefillSummary] = useState(location.state?.prefillSummary || "");
  // Fix #10 (Resume Review "Builder connection"): carries the full
  // optimization output (skills/certifications/languages/achievements),
  // not just the rewritten text, so the Builder can prefill more than the
  // summary field.
  const [prefillResumeData, setPrefillResumeData] = useState(location.state?.prefillResumeData || null);

  const switchToReview = () => {
    setMode(MODE.REVIEW);
    setSearchParams({ mode: MODE.REVIEW }, { replace: true });
  };

  const switchToBuild = (summary = "", resumeData = null) => {
    if (summary) setPrefillSummary(summary);
    if (resumeData) setPrefillResumeData(resumeData);
    setMode(MODE.BUILD);
    setSearchParams({ mode: MODE.BUILD }, { replace: true });
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        {mode === MODE.REVIEW ? (
          <ResumeReview onSwitchToBuild={switchToBuild} />
        ) : (
          <ResumeBuilder initialSummary={prefillSummary} initialResumeData={prefillResumeData} onSwitchToReview={switchToReview} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
