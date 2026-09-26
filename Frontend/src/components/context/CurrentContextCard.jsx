import { Briefcase, Building2, X } from "lucide-react";
import { useContextEngine } from "../../context/ContextEngineContext";

const SOURCE_LABELS = {
  url: "URL",
  image: "Image",
  description: "Description",
  custom: "Custom",
  opportunity_find: "Opportunity Search",
  opportunity_match: "Opportunity",
};

// Shown wherever context reuse applies: Resume Review, Resume Builder, Interview Prep.
// NOT shown on Opportunity Verification.
// Rule: context replace is never automatic — clear/change is always an explicit user action.
export default function CurrentContextCard({ onChange, showChangeAction = true }) {
  const { context, clearActiveContext } = useContextEngine();

  if (!context) return null;

  const sourceLabel =
    context.source_label || SOURCE_LABELS[context.source_module] || "Manual";

  const handleChange = async () => {
    await clearActiveContext();
    onChange?.();
  };

  return (
  <div className="context-card relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 pr-10">
    
    {/* Left Side: Icon & Meta Content */}
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
      <Briefcase size={18} style={{ marginTop: "2px", flexShrink: 0 }} />
      <div>
        <div className="context-card-tag">Current Opportunity</div>
        <div className="context-card-title">
          {context.role}
          {context.company ? (
            <span style={{ fontWeight: 400, opacity: 0.75, fontSize: "14px" }}>
              {" "}
              · <Building2 size={12} style={{ display: "inline", marginBottom: "-1px" }} />{" "}
              {context.company}
            </span>
          ) : null}
        </div>
        <div className="context-card-meta flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs">
          <span>Job Title: <strong>{context.role}</strong></span>
          {context.experience && <span>Job Level: <strong>{context.experience}</strong></span>}
          {context.employment_type && <span>Type: <strong>{context.employment_type}</strong></span>}
          {context.location && <span>Location: <strong>{context.location}</strong></span>}
          <span>Source: <strong>{sourceLabel}</strong></span>
        </div>
      </div>
    </div>

    {/* Right Side: Change Context Action Button */}
    {showChangeAction && (
      <div className="context-card-actions ml-auto flex-shrink-0">
        <button type="button" className="btn-ghost pe-1" onClick={handleChange}>
          Change Context
        </button>
      </div>
    )}
    
  </div>
);
}
