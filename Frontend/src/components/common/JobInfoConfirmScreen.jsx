import { useState } from "react";
import { Sparkles, Briefcase, Building2, ArrowLeft, AlertCircle } from "lucide-react";
import HybridAutocomplete from "./HybridAutocomplete";
import { ROLES, EXPERIENCE_LEVELS } from "../../data/roles";
import { COMPANIES, EMPLOYMENT_TYPES } from "../../data/autocompleteData";

const CONFIDENCE_LABEL = (c) => {
  if (c >= 0.55) return { label: "Detected", tone: "badge-green" };
  if (c > 0) return { label: "Partially Detected", tone: "badge-purple" };
  return { label: "Not Detected", tone: "badge-red" };
};

/**
 * JobInfoConfirmScreen
 * Shown after URL/Image/Description auto-detection (or directly for the
 * Custom tab). Every field is pre-filled where detected but always
 * editable — confirmation, not blind manual entry.
 */
export default function JobInfoConfirmScreen({
  fields,
  setFields,
  errors = {},
  clearError,
  sourceLabel,
  detected = false,
  onBack,
  onConfirm,
  confirmLabel = "Confirm & Continue",
}) {

  const set = (key, val) => {
    setFields((prev) => ({ ...prev, [key]: val }));
    clearError?.(key);
  };

  const confidence = CONFIDENCE_LABEL(fields.confidence || 0);

  return (
    <div className="tool-step-fields">
      {detected && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
          <span className="badge badge-cyan">
            <Sparkles size={13} /> Auto-detected from {sourceLabel}
          </span>
          <span className={`badge ${confidence.tone}`}>{confidence.label}</span>
        </div>
      )}
      <p className="tool-step-sub" style={{ marginTop: 0 }}>
        {detected
          ? "Review what we found and correct anything that's off before continuing."
          : "Enter the job details manually."}
      </p>

      <HybridAutocomplete
        label="Job Title"
        icon={Briefcase}
        value={fields.role}
        onChange={(v) => set("role", v)}
        options={ROLES}
        historyKey="job_title"
        placeholder="e.g. Frontend Developer"
        error={errors.role}
        required
      />

      <HybridAutocomplete
        label="Company"
        icon={Building2}
        value={fields.company}
        onChange={(v) => set("company", v)}
        options={COMPANIES}
        historyKey="company"
        placeholder="e.g. Google (optional)"
        error={errors.company}
      />

      <div>
        <label className="form-label" id="job-level-label">Job Level *</label>
        <div className="exp-level-group" role="group" aria-labelledby="job-level-label">
          {EXPERIENCE_LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              className={fields.experience === lvl.label ? "exp-btn active" : "exp-btn"}
              onClick={() => set("experience", fields.experience === lvl.label ? "" : lvl.label)}
              aria-pressed={fields.experience === lvl.label}
            >
              {lvl.label}
            </button>
          ))}
        </div>
        {errors.experience && (
          <div className="field-error-msg pt-3">
            <AlertCircle size={13} /> {errors.experience}
          </div>
        )}
      </div>

      <div>
        <label className="form-label" id="employment-type-label">Employment Type</label>
        <div className="exp-level-group" role="group" aria-labelledby="employment-type-label">
          {EMPLOYMENT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={fields.employment_type === t.label ? "exp-btn active" : "exp-btn"}
              onClick={() => set("employment_type", fields.employment_type === t.label ? "" : t.label)}
              aria-pressed={fields.employment_type === t.label}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <HybridAutocomplete
        label="Location"
        value={fields.location}
        onChange={(v) => set("location", v)}
        options={[]}
        historyKey="location"
        placeholder="e.g. Remote, Karachi, Lahore (optional)"
      />

      <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
        {onBack && (
          <button type="button" className="btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} /> Back
          </button>
        )}
        <button 
          type="button"
          className="analyze-btn w-100"
          onClick={onConfirm}
          style={{ 
            opacity: !fields.role || !fields.employment_type || !fields.experience ? 0.5 : 1, 
            cursor: !fields.role || !fields.employment_type || !fields.experience ? "not-allowed" : "pointer" 
          }} 
          disabled={!fields.role || !fields.employment_type || !fields.experience}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
