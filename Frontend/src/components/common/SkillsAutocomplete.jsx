import { useState, useRef, useEffect } from "react";
import { Clock, AlertCircle, Search } from "lucide-react";
import { SKILLS, fuzzySearch, getFieldHistory, addFieldHistory } from "../../data/autocompleteData";

/**
 * SkillsAutocomplete — hybrid (suggestions + manual + history) tag input.
 * value: string[]; onChange(nextArray)
 */
export default function SkillsAutocomplete({ value = [], onChange, historyKey = "skills", error, icon: Icon = Search, }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const alreadyAdded = new Set(value.map((v) => v.toLowerCase()));
  const query = input.trim();
  const history = getFieldHistory(historyKey);

  const suggestionMatches = (query ? fuzzySearch(SKILLS, query, 6) : SKILLS.slice(0, 0))
    .filter((s) => !alreadyAdded.has(s.label.toLowerCase()));
  const historyMatches = (query
    ? history.filter((h) => h.toLowerCase().includes(query.toLowerCase()))
    : history
  ).filter((h) => !alreadyAdded.has(h.toLowerCase())).slice(0, 5);

  const suggestionLabels = new Set(suggestionMatches.map((s) => s.label.toLowerCase()));
  const historyItems = historyMatches.filter((h) => !suggestionLabels.has(h.toLowerCase()));
  const hasResults = suggestionMatches.length > 0 || historyItems.length > 0;

  const addSkill = (skill) => {
    const v = skill.trim();
    if (!v || alreadyAdded.has(v.toLowerCase())) return;
    onChange([...value, v]);
    addFieldHistory(historyKey, v);
    setInput("");
    setOpen(false);
  };

  const removeSkill = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div 
        className={`form-input${error ? " field-invalid" : ""}`}
        style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
      >
        <Icon size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              addSkill(input.trim());
            }
          }}
          placeholder="Type a skill (suggestions + your history) and press Enter"
          autoComplete="off"
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: "14px", fontFamily: "inherit" }}
        />
      </div>

      {open && hasResults && (
        <ul
          style={{
            position: "absolute",
            top: "44px",
            left: 0,
            right: 0,
            zIndex: 99,
            listStyle: "none",
            margin: 0,
            padding: "6px",
            borderRadius: "12px",
            border: "1px solid var(--border-primary)",
            background: "var(--bg-secondary)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {historyItems.map((h) => (
            <li key={`h-${h}`}>
              <button 
                type="button" 
                onClick={() => addSkill(h)} 
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
                onClick={() => addSkill(s.label)} 
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

      {error && <div className="field-error-msg pt-2"><AlertCircle size={13} /> {error}</div>}

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {value.map((s, i) => (
          <span key={i} className="badge badge-cyan" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {s}
            <button onClick={() => removeSkill(i)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              ×
            </button>
          </span>
        ))}
      </div>
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
