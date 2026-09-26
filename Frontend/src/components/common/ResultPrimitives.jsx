import { CheckCircle2 } from "lucide-react";

/**
 * Shared "AI result" visual primitives used by every tool that shows an AI
 * score/report (Resume Review, Interview Report, Opportunity Verification).
 * Previously each tool page defined its own copy of these — same markup,
 * same CSS classes, independently maintained. Consolidated here so a future
 * visual/behavior change (e.g. an a11y fix) only has to happen once.
 */

// Backend items are usually plain strings, but the AI may occasionally return
// a small object for an analysis row — render either without crashing.
function renderItemText(it) {
  if (typeof it === "string") return it;
  if (it == null) return "";
  if (typeof it === "object") {
    return it.text || it.point || it.note || it.title || it.summary || JSON.stringify(it);
  }
  return String(it);
}

export function ScoreChip({ label, score }) {
  if (score == null) return null;
  const color = score >= 70 ? "var(--green)" : score >= 40 ? "var(--amber)" : "var(--red)";
  return (
    <div className="score-chip" style={{ textAlign: "center" }}>
      <div className="score-chip-label">{label}</div>
      <div className="score-chip-val" style={{ color, fontSize: "28px", marginTop: "4px" }}>
        {score}/100
      </div>
    </div>
  );
}

export function ListSection({ title, items, positive }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="result-section">
      <div className="result-section-title">{title}</div>
      <ul className="result-section-list">
        {items.map((it, i) => (
          <li key={i} className="result-section-item">
            {positive && <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />}
            <span>{renderItemText(it)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
