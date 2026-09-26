import { useState } from "react";
import {
  Link2,
  Image as ImageIcon,
  FileText,
  UserCog,
  UploadCloud,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import JobInfoConfirmScreen from "./JobInfoConfirmScreen";
import { addFieldHistory } from "../../data/autocompleteData";
import { extractFromUrl, extractFromImage, extractFromDescription } from "../../utils/jobInfoExtraction";

// Same 4 sources used on Opportunity Verification (URL / Image / Description),
// plus Custom for tools that don't require a live scan first.
const TABS = [
  { id: "url", label: "URL", icon: Link2 },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "description", label: "Description", icon: FileText },
  { id: "custom", label: "Custom", icon: UserCog },
];

const emptyFields = () => ({
  role: "",
  company: "",
  experience: "",
  employment_type: "",
  location: "",
  confidence: 0,
});

/**
 * OpportunitySourceTabs
 * Reusable Step 1 for Resume Review, Resume Builder, and Interview Prep.
 *
 * Flow for URL / Image / Description (the primary flow — not manual typing):
 *   1. User provides the source (link / screenshot / pasted text).
 *   2. We auto-detect job info from it (detecting stage — loading).
 *   3. User reviews + edits the extracted fields on a confirmation screen
 *      before anything is submitted (confirm stage).
 *
 * Custom tab is the one deliberately manual entry point.
 *
 * onSubmit receives a complete context payload:
 *   { role, experience, company, employment_type, location, description,
 *     input_method, source_label, source_url, source_image_name }
 *   NOTE: source_module is intentionally NOT set here — that's owned by
 *   whichever tool renders this component (resume_review / resume_builder /
 *   interview), so it must be set by the caller, not this shared component.
 */
export default function OpportunitySourceTabs({ onSubmit, continueLabel = "Continue" }) {
  const [tab, setTab] = useState("url");
  // stage: "input" (source entry) -> "detecting" (loading) -> "confirm" (review/edit)
  const [stage, setStage] = useState("input");

  const [url, setUrl] = useState("");
  const [image, setImage] = useState(null);
  const [description, setDescription] = useState("");

  const [fields, setFields] = useState(emptyFields());
  const [errors, setErrors] = useState({});
  const [sourceError, setSourceError] = useState("");

  const switchTab = (id) => {
    setTab(id);
    setStage(id === "custom" ? "confirm" : "input");
    setFields(emptyFields());
    setErrors({});
    setSourceError("");
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const currentSourceLabel = TABS.find((t) => t.id === tab)?.label || "Custom";

  const handleDetect = async () => {
    if (tab === "url" && !url.trim()) {
      setSourceError("Paste the job URL to continue.");
      return;
    }
    if (tab === "image" && !image) {
      setSourceError("Upload a screenshot to continue.");
      return;
    }
    if (tab === "description" && !description.trim()) {
      setSourceError("Paste the job description to continue.");
      return;
    }
    setSourceError("");
    setStage("detecting");

    let extracted;
    if (tab === "url") extracted = await extractFromUrl(url.trim());
    else if (tab === "image") extracted = await extractFromImage(image);
    else extracted = await extractFromDescription(description.trim());

    setFields({
      role: extracted.role || "",
      company: extracted.company || "",
      experience: extracted.experience || "",
      employment_type: extracted.employment_type || "",
      location: extracted.location || "",
      confidence: extracted.confidence || 0,
    });
    setStage("confirm");
  };

  const validateFields = () => {
    const next = {};
    if (!fields.role?.trim()) next.role = "Enter the job title.";
    if (!fields.experience) next.experience = "Select an experience level.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConfirm = () => {
    if (!validateFields()) return;

    addFieldHistory("job_title", fields.role);
    if (fields.company) addFieldHistory("company", fields.company);
    if (fields.location) addFieldHistory("location", fields.location);

    onSubmit({
      role: fields.role.trim(),
      experience: fields.experience,
      company: (fields.company || "").trim(),
      employment_type: fields.employment_type || "",
      location: (fields.location || "").trim(),
      description: tab === "description" ? description.trim() : "",
      input_method: tab,
      source_label: currentSourceLabel,
      source_url: tab === "url" ? url.trim() : "",
      source_image_name: tab === "image" ? image?.name || "" : "",
    });
  };

  const handleBackToSource = () => {
    setStage("input");
    setErrors({});
  };

  return (
    <div className="tool-step-fields">
      <div className="source-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`source-tab${tab === id ? " active" : ""}`}
            onClick={() => switchTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {stage === "input" && tab === "url" && (
        <div>
          <label className="form-label" htmlFor="opp-url-input">Job URL</label>
          <input
            id="opp-url-input"
            type="text"
            className={`form-input${sourceError ? " field-invalid" : ""}`}
            placeholder="https://example-jobs.com/apply"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setSourceError("");
            }}
          />
          {sourceError && (
            <div className="field-error-msg">
              <AlertCircle size={13} /> {sourceError}
            </div>
          )}
          <button type="button" className="analyze-btn" onClick={handleDetect} style={{ opacity: !url.trim() ? 0.5 : 1, cursor: !url.trim() ? "not-allowed" : "pointer" }} disabled={!url.trim()}>
            <Sparkles size={18} /> Auto-Detect Job Info
          </button>
        </div>
      )}

      {stage === "input" && tab === "image" && (
        <div>
          <label className="form-label" htmlFor="opp-image-upload">Job Screenshot</label>
          <div
            className="upload-zone"
            onClick={() => document.getElementById("opp-image-upload").click()}
          >
            <UploadCloud size={30} style={{ opacity: 0.5, marginBottom: "10px" }} />
            {image ? (
              <div className="upload-zone-file">
                <FileText size={16} /> <span>{image.name}</span>
              </div>
            ) : (
              <>
                <div className="upload-zone-label">Click to upload screenshot</div>
                <div className="upload-zone-hint">PNG or JPG</div>
              </>
            )}
            <input
              id="opp-image-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                setImage(e.target.files?.[0] || null);
                setSourceError("");
              }}
            />
          </div>
          {sourceError && (
            <div className="field-error-msg">
              <AlertCircle size={13} /> {sourceError}
            </div>
          )}
          <button type="button" className="analyze-btn" onClick={handleDetect}  style={{ opacity: !image ? 0.5 : 1, cursor: !image ? "not-allowed" : "pointer" }} disabled={!image}>
            <Sparkles size={18} /> Auto-Detect Job Info
          </button>
        </div>
      )}

      {stage === "input" && tab === "description" && (
        <div>
          <label className="form-label" htmlFor="opp-description-input">Job Description</label>
          <textarea
            id="opp-description-input"
            className={`form-input${sourceError ? " field-invalid" : ""}`}
            rows={5}
            placeholder="Paste the job description here..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSourceError("");
            }}
          />
          {sourceError && (
            <div className="field-error-msg">
              <AlertCircle size={13} /> {sourceError}
            </div>
          )}
          <button type="button" className="analyze-btn" onClick={handleDetect}  style={{ opacity: !description.trim() ? 0.5 : 1, cursor: !url.trim() ? "not-allowed" : "pointer" }} disabled={!description.trim()}>
            <Sparkles size={18} /> Auto-Detect Job Info
          </button>
        </div>
      )}

      {stage === "detecting" && (
        <div className="tool-loading-state">
          <div className="tool-loading-spinner" />
          <div className="tool-loading-text">Detecting job info from your {currentSourceLabel.toLowerCase()}…</div>
          <div className="tool-loading-sub">Extracting title, company, level, and more.</div>
        </div>
      )}

      {stage === "confirm" && (
        <JobInfoConfirmScreen
          fields={fields}
          setFields={setFields}
          errors={errors}
          clearError={clearError}
          sourceLabel={currentSourceLabel}
          detected={tab !== "custom"}
          onBack={tab !== "custom" ? handleBackToSource : undefined}
          onConfirm={handleConfirm}
          confirmLabel={continueLabel}
        />
      )}
    </div>
  );
}
