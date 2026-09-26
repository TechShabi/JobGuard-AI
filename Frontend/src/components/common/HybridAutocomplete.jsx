import { useState, useRef, useEffect, useId } from "react";
import { Search, Clock } from "lucide-react";
import { fuzzySearch, getFieldHistory, addFieldHistory } from "../../data/autocompleteData";

/**
 * HybridAutocomplete
 * Reusable "suggestions + manual + user history" input used for Job Title,
 * Company, Degree, Field of Study, School, Location etc.
 *
 * - Manual typing is always allowed (value is never forced to match a
 *   suggestion — free text commits as-is).
 * - Static `options` show first-party suggestions.
 * - Previously entered values (per `historyKey`) show as "Recent" so the
 *   user's own history is always part of the pool, not just a fixed list.
 *
 * Controlled: value is a plain string, onChange(newValue) fires on every
 * keystroke and on suggestion pick. History is committed on blur / pick,
 * not on every keystroke.
 */
export default function HybridAutocomplete({
  value,
  onChange,
  options = [],
  historyKey,
  label,
  placeholder = "Type to search or enter your own...",
  error,
  required = false,
  icon: Icon = Search,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        if (historyKey && (value || "").trim()) addFieldHistory(historyKey, value);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value, historyKey]);

  const history = historyKey ? getFieldHistory(historyKey) : [];

  const query = (value || "").trim();
  const suggestionMatches = query ? fuzzySearch(options, query, 6) : [];
  const historyMatches = query
    ? history.filter((h) => h.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
    : history.slice(0, 5);

  // De-dupe: don't show a history item that's already an exact-label suggestion
  const suggestionLabels = new Set(suggestionMatches.map((s) => s.label.toLowerCase()));
  const historyItems = historyMatches.filter((h) => !suggestionLabels.has(h.toLowerCase()));

  const hasResults = suggestionMatches.length > 0 || historyItems.length > 0;

  const handleChange = (e) => {
    onChange(e.target.value);
    setOpen(true);
  };

  const handlePick = (label) => {
    onChange(label);
    setOpen(false);
    if (historyKey) addFieldHistory(historyKey, label);
  };

  // Sprint 2 audit fix: this label was never linked to its input (no
  // htmlFor/id). useId() gives each instance a stable, unique id without
  // requiring every call site to pass one in.
  const inputId = useId();

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      {label && (
        <label className="form-label" htmlFor={inputId}>
          {label}
          {required ? " *" : ""}
        </label>
      )}
      <div
        className={`form-input${error ? " field-invalid" : ""}`}
        style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: 0 }}
      >
        <Icon size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
        <input
          id={inputId}
          type="text"
          value={value || ""}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          autoComplete="off"
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: "14px", fontFamily: "inherit" }}
        />
      </div>
      {error && (
        <div className="field-error-msg pt-2">{error}</div>
      )}

      {open && hasResults && (
        <ul
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            listStyle: "none",
            margin: 0,
            padding: "6px",
            borderRadius: "12px",
            border: "1px solid var(--border-primary)",
            background: "var(--bg-secondary)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          {historyItems.map((h) => (
            <li key={`h-${h}`}>
              <button
                type="button"
                onClick={() => handlePick(h)}
                style={optionBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={12} style={{ opacity: 0.5 }} />
                  {h}
                </span>
                <span style={{ fontSize: "11px", opacity: 0.45 }}>Recent</span>
              </button>
            </li>
          ))}
          {suggestionMatches.map((s) => (
            <li key={`s-${s.id}`}>
              <button
                type="button"
                onClick={() => handlePick(s.label)}
                style={optionBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span>{s.label}</span>
                {s.category && (
                  <span style={{ fontSize: "11px", opacity: 0.45, textTransform: "capitalize" }}>{s.category}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const optionBtnStyle = {
  width: "100%",
  textAlign: "left",
  padding: "9px 12px",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--text-primary)",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
