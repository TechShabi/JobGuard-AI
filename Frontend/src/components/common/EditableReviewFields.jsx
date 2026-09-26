import { useState } from "react";
import { Plus, X, Check } from "lucide-react";

/**
 * Shared editable-field controls used by the review/results screens.
 * Kept generic and reusable (not tool-specific) so both Resume Review's
 * "fill in what's missing" step and Resume Builder's inline Final Review
 * editing can share the same primitives instead of duplicating markup.
 *
 * Every control follows the same tiny contract: value + onChange(next).
 * None of these call any API — they're pure, controlled inputs; the page
 * that renders them owns the state and decides what to do with it.
 */

// ── Chip multi-select (works for "checkbox chips" AND "multi select" —
//    visually/interactionally the same: click a chip to toggle it on/off).
//    Also supports adding a free-text custom item when allowCustom is set,
//    for fields where the AI's suggestion list isn't exhaustive (e.g. skills).
export function ChipMultiSelect({ label, hint, suggestions = [], value = [], onChange, allowCustom = true }) {
  const [custom, setCustom] = useState("");
  const selected = new Set(value.map((v) => v.toLowerCase()));

  // Union of AI suggestions + anything the user already picked/typed, so a
  // custom addition shows up as a chip too instead of vanishing into value[].
  const allOptions = Array.from(
    new Set([...suggestions, ...value].map((s) => s.trim()).filter(Boolean))
  );

  const toggle = (item) => {
    if (selected.has(item.toLowerCase())) {
      onChange(value.filter((v) => v.toLowerCase() !== item.toLowerCase()));
    } else {
      onChange([...value, item]);
    }
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.has(v.toLowerCase())) onChange([...value, v]);
    setCustom("");
  };

  return (
    <div className="editable-field-block">
      <div className="form-label">{label}</div>
      {hint && <p className="tool-step-sub" style={{ margin: "0 0 10px" }}>{hint}</p>}
      <div className="source-tabs" role="group" aria-label={label}>
        {allOptions.map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={selected.has(item.toLowerCase())}
            className={`source-tab chip-toggle${selected.has(item.toLowerCase()) ? " active" : ""}`}
            onClick={() => toggle(item)}
          >
            {selected.has(item.toLowerCase()) && <Check size={13} />}
            {item}
          </button>
        ))}
        {allOptions.length === 0 && (
          <span className="tool-step-sub" style={{ margin: 0 }}>Nothing detected — add your own below.</span>
        )}
      </div>
      {allowCustom && (
        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <input
            type="text"
            className="form-input"
            style={{ margin: 0 }}
            placeholder={`Add another…`}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button type="button" className="exp-btn" onClick={addCustom} aria-label="Add">
            <Plus size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Textarea (Summary / Projects / Achievements / any free-text narrative) ──
export function TextAreaField({ label, hint, value = "", onChange, placeholder, rows = 4 }) {
  return (
    <div className="editable-field-block">
      <div className="form-label">{label}</div>
      {hint && <p className="tool-step-sub" style={{ margin: "0 0 10px" }}>{hint}</p>}
      <textarea
        className="form-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── Text list (Missing Links — one text input per link, add/remove rows) ──
export function TextListField({ label, hint, value = [], onChange, placeholder }) {
  const update = (i, v) => onChange(value.map((item, idx) => (idx === i ? v : item)));
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, ""]);

  return (
    <div className="editable-field-block">
      <div className="form-label">{label}</div>
      {hint && <p className="tool-step-sub" style={{ margin: "0 0 10px" }}>{hint}</p>}
      {value.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            className="form-input"
            placeholder={placeholder}
            value={item}
            onChange={(e) => update(i, e.target.value)}
          />
          <button type="button" className="reset-btn" onClick={() => remove(i)} aria-label="Remove">
            <X size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="exp-btn" onClick={add}>
        <Plus size={15} style={{ marginRight: "6px" }} /> Add link
      </button>
    </div>
  );
}

// ── Structured list editor (Experience / Education) — a small set of named
//    fields per entry, add/remove entries. `fields` describes the shape so
//    the same component serves both Experience and Education without a fork.
export function StructuredListEditor({ label, hint, fields, value = [], onChange, emptyEntry }) {
  const update = (i, key, v) =>
    onChange(value.map((entry, idx) => (idx === i ? { ...entry, [key]: v } : entry)));
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { ...emptyEntry }]);

  return (
    <div className="editable-field-block">
      <div className="form-label">{label}</div>
      {hint && <p className="tool-step-sub" style={{ margin: "0 0 10px" }}>{hint}</p>}
      {value.map((entry, i) => (
        <div key={i} className="structured-entry-card">
          <div className="structured-entry-grid">
            {fields.map((f) => (
              <div key={f.key} style={{ gridColumn: f.wide ? "1 / -1" : "auto" }}>
                {f.type === "textarea" ? (
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder={f.placeholder}
                    value={entry[f.key] || ""}
                    onChange={(e) => update(i, f.key, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    placeholder={f.placeholder}
                    value={entry[f.key] || ""}
                    onChange={(e) => update(i, f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <button type="button" className="reset-btn" onClick={() => remove(i)}>
            <X size={14} style={{ marginRight: "4px" }} /> Remove entry
          </button>
        </div>
      ))}
      <button type="button" className="exp-btn" onClick={add}>
        <Plus size={15} style={{ marginRight: "6px" }} /> Add entry
      </button>
    </div>
  );
}
