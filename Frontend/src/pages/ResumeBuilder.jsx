import { useState, useEffect, useId } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  Download,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Pencil,
  Briefcase,
  Sparkles,
  Wand2,
  RotateCcw,
  Plus,
  Trash2,
  Info,
  FileEdit,
  UserCog,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Star,
  ShieldCheck,
  LayoutTemplate,
  Type,
  KeyRound,
  SpellCheck,
  PlusCircle,
  Eye
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { useAuth } from "../context/AuthContext";
import { useContextEngine } from "../context/ContextEngineContext";
import OpportunitySourceTabs from "../components/common/OpportunitySourceTabs";
import CurrentContextCard from "../components/context/CurrentContextCard";
import StepProgress from "../components/common/StepProgress";
import HybridAutocomplete from "../components/common/HybridAutocomplete";
import SkillsAutocomplete from "../components/common/SkillsAutocomplete";
import { getRoleFields } from "../data/roles";
import { DEGREES, FIELDS_OF_STUDY, COMPANIES } from "../data/autocompleteData";
import { isValidEmail, isValidPhone, isValidUrl, isNonEmpty } from "../utils/validation";
import { generateResumeService } from "../services/resume.service";

// Multi-step flow definitions.
// Fix #14: Links (github/linkedin/portfolio) now live inside Basic Info,
// and the Professional Summary editor lives there too (Fix #6) — so a
// separate "Links" step is gone. Role-specific fields (Fix #9) now render
// right after Experience instead of being tucked into the old Links step.
const STEPS = ["Role", "Basic Info", "Experience", "Education", "Skills", "Projects", "Review"];
const STEP = {
  ROLE: 1,
  BASIC: 2,
  EXPERIENCE: 3,
  EDUCATION: 4,
  SKILLS: 5,
  PROJECTS: 6,
  REVIEW: 7,
  RESULT: 8
};

const MAX_RESUME_MB = 5;
const ALLOWED_RESUME_EXT = [".pdf", ".docx"];

// Regenerate Layout options — every one of these is still a plain, single
// column, recruiter/ATS-friendly layout (no colors, no graphics, no icons
// in the export). Only spacing/section order/heading treatment changes.
// Regenerating NEVER touches `resume` (the data) — only which of these
// three the result panel is rendered with.
const LAYOUT_VARIANTS = [
  { id: "standard", label: "Standard" },
  { id: "compact", label: "Compact" },
  { id: "timeline", label: "Timeline" },
];

// Fix #3 / #4: local draft so a refresh or accidental close never wipes out
// everything the user just filled in across 7 steps.
const DRAFT_KEY = "resume_builder_draft_v1";

// Fix #10: named checklist steps for the generation loading state, instead
// of one line of text that just rotates.
const LOADING_STEPS = [
  "Reading Career Focus",
  "Analyzing Resume Data",
  "Optimizing ATS Keywords",
  "Generating Summary",
  "Formatting Layout"
];

function validateResumeFile(f) {
  if (!f) return "Please select a resume file first.";
  const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_RESUME_EXT.includes(ext)) return "Only PDF or DOCX resumes are supported.";
  if (f.size > MAX_RESUME_MB * 1024 * 1024) return `File is too large. Max size is ${MAX_RESUME_MB}MB.`;
  return "";
}

// ── Reusable Field Editors ──────────────────────────────────────────────────
function BulletsTextarea({ bullets, onChange }) {
  return (
    <textarea
      className="centered-input "
      rows={3}
      placeholder="One bullet per line"
      value={(bullets || []).join("\n")}
      onChange={(e) => onChange(e.target.value.split("\n"))}
    />
  );
}

// Fix: Drag & Drop reordering — shared by Experience/Education/Projects.
// Native HTML5 drag events, no extra dependency; drag starts from the grip
// handle so text fields inside each card keep working normally.
function reorderList(items, from, to) {
  if (from === to || from == null || to == null) return items;
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

function DragHandle({ index, dragIndexRef, onDrop }) {
  return (
    <div
      className="drag-handle"
      draggable
      title="Drag to reorder"
      onDragStart={() => { dragIndexRef.current = index; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(dragIndexRef.current, index); dragIndexRef.current = null; }}
    >
      <GripVertical size={14} />
    </div>
  );
}

const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Intern", "Freelance", "Contract"];

function ExperienceEditor({ items, setItems, onRemove }) {
  const dragIndexRef = { current: null };
  const update = (i, key, val) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [key]: val };
    setItems(copy);
  };
  const onDrop = (from, to) => setItems(reorderList(items, from, to));
  const handleRemove = (i) => {
    if (onRemove) onRemove(items[i], i);
    else setItems(items.filter((_, idx) => idx !== i));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "12px" }}>
      {items.map((e, i) => (
        <div key={i} className="result-section draggable-item" style={{ paddingLeft: items.length > 1 ? "40px" : "" }} >
          {items.length > 1 && <DragHandle index={i} dragIndexRef={dragIndexRef} onDrop={onDrop} />}
          <div className="tool-step-fields">
            <HybridAutocomplete
              placeholder="Job Title"
              value={e.title || ""}
              onChange={(val) => update(i, "title", val)}
              options={FIELDS_OF_STUDY}
              historyKey={"job_title"}
            />
            <HybridAutocomplete
              placeholder="Company"
              value={e.company || ""}
              onChange={(val) => update(i, "company", val)}
              options={COMPANIES}
              historyKey={"company"}
            />
            <select
              className="centered-input"
              value={e.employment_type || ""}
              onChange={(ev) => update(i, "employment_type", ev.target.value)}
            >
              <option value="">Employment Type</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input className="centered-input" placeholder="Start Date (e.g. Jan 2022)" value={e.start || ""} onChange={(ev) => update(i, "start", ev.target.value)} />
            <input className="centered-input" placeholder="End Date (e.g. Present)" value={e.end || ""} onChange={(ev) => update(i, "end", ev.target.value)} />

            <BulletsTextarea bullets={e.bullets} onChange={(b) => update(i, "bullets", b)} />
          </div>
          {items.length > 1 && (
            <button type="button" className="btn-ghost" style={{ color: "var(--red)", marginTop: "8px" }} onClick={() => handleRemove(i)}>
              <Trash2 size={14} style={{ marginRight: "4px" }} /> Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost" style={{ width: "fit-content" }} onClick={() => setItems([...items, { company: "", title: "", start: "", end: "", employment_type: "", bullets: [] }])}>
        <Plus size={14} style={{ marginRight: "4px" }} /> Add Experience
      </button>
    </div>
  );
}

function ProjectsEditor({ items, setItems, onRemove }) {
  const dragIndexRef = { current: null };
  const update = (i, key, val) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [key]: val };
    setItems(copy);
  };
  const onDrop = (from, to) => setItems(reorderList(items, from, to));
  const handleRemove = (i) => {
    if (onRemove) onRemove(items[i], i);
    else setItems(items.filter((_, idx) => idx !== i));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "12px" }}>
      {items.map((p, i) => (
        <div key={i} className="result-section draggable-item" style={{ paddingLeft: items.length > 1 ? "40px" : "" }} >
          {items.length > 1 && <DragHandle index={i} dragIndexRef={dragIndexRef} onDrop={onDrop} />}
          <div className="tool-step-fields">
            <input className="centered-input" placeholder="Project Name" value={p.name || ""} onChange={(ev) => update(i, "name", ev.target.value)} />
            <input className="centered-input" placeholder="Your Role (e.g. Full-Stack Developer)" value={p.role || ""} onChange={(ev) => update(i, "role", ev.target.value)} />
            <input className="centered-input" placeholder="Duration (e.g. Jan 2023 – Jun 2023)" value={p.duration || ""} onChange={(ev) => update(i, "duration", ev.target.value)} />
            <input className="centered-input" placeholder="Technologies (comma-separated, e.g. React, Node.js)" value={Array.isArray(p.technologies) ? p.technologies.join(", ") : (p.technologies || "")} onChange={(ev) => update(i, "technologies", ev.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            <input className="centered-input" placeholder="GitHub URL" value={p.github || ""} onChange={(ev) => update(i, "github", ev.target.value)} />
            <input className="centered-input" placeholder="Live Demo URL" value={p.live_demo || p.link || ""} onChange={(ev) => update(i, "live_demo", ev.target.value)} />
            <textarea className="centered-input" rows={3} placeholder="Short description" value={p.description || ""} onChange={(ev) => update(i, "description", ev.target.value)} />
            <BulletsTextarea bullets={p.bullets} onChange={(b) => update(i, "bullets", b)} />
          </div>
          {items.length > 1 && (
            <button type="button" className="btn-ghost" style={{ color: "var(--red)", marginTop: "8px" }} onClick={() => handleRemove(i)}>
              <Trash2 size={14} style={{ marginRight: "4px" }} /> Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost" style={{ width: "fit-content" }} onClick={() => setItems([...items, { name: "", role: "", duration: "", technologies: [], github: "", live_demo: "", description: "", link: "", bullets: [] }])}>
        <Plus size={14} style={{ marginRight: "4px" }} /> Add Project
      </button>
    </div>
  );
}

function EducationEditor({ items, setItems }) {
  const dragIndexRef = { current: null };
  const update = (i, key, val) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [key]: val };
    setItems(copy);
  };
  const onDrop = (from, to) => setItems(reorderList(items, from, to));
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "12px" }}>
      {items.map((ed, i) => (
        <div key={i} className="result-section draggable-item" style={{ paddingLeft: items.length > 1 ? "40px" : "" }} >
          {items.length > 1 && <DragHandle index={i} dragIndexRef={dragIndexRef} onDrop={onDrop} />}
          <div className="tool-step-fields">
            <HybridAutocomplete placeholder="School / University" value={ed.school || ""} onChange={(val) => update(i, "school", val)} options={[]} historyKey={"school"} />
            <HybridAutocomplete placeholder="Degree" value={ed.degree || ""} onChange={(val) => update(i, "degree", val)} options={DEGREES} historyKey={"degree"} />
            <HybridAutocomplete placeholder="Field of Study" value={ed.field || ""} onChange={(val) => update(i, "field", val)} options={FIELDS_OF_STUDY} historyKey={"field_of_study"} />
            <input className="centered-input" placeholder="Start Date" value={ed.start || ""} onChange={(ev) => update(i, "start", ev.target.value)} />
            <input className="centered-input" placeholder="End Date" value={ed.end || ""} onChange={(ev) => update(i, "end", ev.target.value)} />
          </div>
          {items.length > 1 && (
            <button type="button" className="btn-ghost" style={{ color: "var(--red)", marginTop: "8px" }} onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
              <Trash2 size={14} style={{ marginRight: "4px" }} /> Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost" style={{ width: "fit-content" }} onClick={() => setItems([...items, { school: "", degree: "", field: "", start: "", end: "" }])}>
        <Plus size={14} style={{ marginRight: "4px" }} /> Add Education
      </button>
    </div>
  );
}

function ListTextarea({ label, value, onChange, rows = 3, placeholder = "One item per line" }) {
  const id = useId();
  return (
    <div>
      <label className="form-label" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="centered-input"
        rows={rows}
        placeholder={placeholder}
        value={(value || []).join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
      />
    </div>
  );
}

// Fix #9: role-specific dynamic fields, now rendered right after Experience
// instead of being mixed into the old Links step.
function RoleSpecificFields({ dynamicFields, roleSpecific, setRoleSpecific }) {
  if (!dynamicFields.length) return null;
  return (
    <div style={{ marginTop: "20px" }}>
      <h3 className="tool-step-heading" style={{ fontSize: "16px", marginBottom: "4px" }}>Role-Specific Details</h3>
      <p className="tool-step-sub" style={{ marginTop: 0 }}>A couple of extra fields that matter specifically for this role.</p>
      <div className="tool-step-fields">
        {dynamicFields.map((f) => (
          <div key={f.key}>
            {f.type === "textarea" ? (
              <textarea className="centered-input" placeholder={f.label} rows={3} value={roleSpecific[f.key] || ""} onChange={(e) => setRoleSpecific({ ...roleSpecific, [f.key]: e.target.value })} />
            ) : (
              <input className="centered-input" placeholder={f.label} value={roleSpecific[f.key] || ""} onChange={(e) => setRoleSpecific({ ...roleSpecific, [f.key]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export Helpers ──────────────────────────────────────────────────────────
function contactLine(p = {}) {
  return [p.email, p.phone, p.github, p.linkedin, p.portfolio].filter(Boolean).join("  |  ");
}

// ── Fix: Skills Auto-Categorization ─────────────────────────────────────────
// Groups a flat skills array into buckets (Frontend / Backend / Database /
// Cloud & DevOps / Languages / Design / Tools) purely on the client, so the
// resume paper and review step both show organized skills instead of one
// long comma list.
const SKILL_CATEGORY_MAP = [
  { category: "Frontend", keywords: ["react", "next", "next.js", "vue", "angular", "svelte", "html", "css", "sass", "scss", "tailwind", "bootstrap", "javascript", "typescript", "jquery", "redux", "webpack", "vite", "figma"] },
  { category: "Backend", keywords: ["node", "node.js", "express", "django", "flask", "spring", "spring boot", "laravel", "php", "ruby", "rails", ".net", "asp.net", "fastapi", "nestjs", "graphql", "rest api", "python", "java", "c#", "golang", "go"] },
  { category: "Database", keywords: ["mysql", "mongo", "mongodb", "postgres", "postgresql", "sqlite", "redis", "oracle", "firebase", "dynamodb", "sql", "nosql", "elasticsearch"] },
  { category: "Cloud & DevOps", keywords: ["aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s", "jenkins", "ci/cd", "terraform", "ansible", "linux", "nginx", "git", "github", "gitlab", "bitbucket"] },
  { category: "Mobile", keywords: ["android", "ios", "flutter", "react native", "swift", "kotlin", "xamarin"] },
  { category: "Design", keywords: ["photoshop", "illustrator", "figma", "adobe xd", "canva", "ui/ux", "ux", "ui design"] },
  { category: "Data & AI", keywords: ["pandas", "numpy", "tensorflow", "pytorch", "machine learning", "deep learning", "power bi", "tableau", "excel", "data analysis", "nlp", "scikit-learn"] },
  { category: "Tools & Other", keywords: ["jira", "slack", "trello", "postman", "notion", "agile", "scrum"] },
];

// Canonical aliases so "React", "ReactJS", "React.js" collapse to one skill.
const SKILL_ALIASES = {
  reactjs: "React",
  "react.js": "React",
  react: "React",
  "nextjs": "Next.js",
  "next.js": "Next.js",
  next: "Next.js",
  "nodejs": "Node.js",
  "node.js": "Node.js",
  node: "Node.js",
  "vuejs": "Vue.js",
  "vue.js": "Vue.js",
  vue: "Vue.js",
  "expressjs": "Express",
  "express.js": "Express",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  typescript: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  ts: "TypeScript",
  "react native": "React Native",
  reactnative: "React Native",
};

function normalizeSkillName(skill) {
  const raw = String(skill || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  return SKILL_ALIASES[key] || raw;
}

/** Deduplicate skills (case-insensitive + known aliases). Keeps first canonical form. */
function dedupeSkills(skills = []) {
  const seen = new Set();
  const out = [];
  for (const s of skills || []) {
    const canonical = normalizeSkillName(s);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}

function categorizeSkills(skills = []) {
  const groups = {};
  const other = [];
  dedupeSkills(skills).forEach((skill) => {
    const lower = String(skill).toLowerCase().trim();
    const match = SKILL_CATEGORY_MAP.find((c) => c.keywords.some((k) => lower === k || lower.includes(k)));
    if (match) {
      groups[match.category] = groups[match.category] || [];
      groups[match.category].push(skill);
    } else {
      other.push(skill);
    }
  });
  if (other.length) groups["Other"] = other;
  return groups;
}

// ── Fix: Client-Side Resume Score ───────────────────────────────────────────
// A transparent, deterministic quality score (no extra AI call, no backend
// change) so the Result page isn't missing the "how good is this resume"
// signal. Purely computed from the data the user already entered/generated.
const ACTION_VERBS = ["led", "built", "created", "designed", "developed", "managed", "improved", "increased", "reduced", "launched", "implemented", "optimized", "delivered", "achieved", "drove", "spearheaded", "automated", "streamlined", "architected", "mentored"];

function computeResumeScore(data = {}, effectiveRole = "") {
  const personal = data.personal_information || {};
  const experience = data.experience || [];
  const education = data.education || [];
  const skills = data.skills || [];
  const projects = data.projects || [];
  const summary = data.professional_summary || "";
  const allBullets = experience.flatMap((e) => e.bullets || []).concat(projects.flatMap((p) => p.bullets || []));

  // ATS: presence of core parsable sections + contact completeness.
  let ats = 40;
  if (personal.name) ats += 10;
  if (personal.email) ats += 10;
  if (personal.phone) ats += 5;
  if (experience.some((e) => e.title || e.company)) ats += 15;
  if (education.some((e) => e.school || e.degree)) ats += 10;
  if (skills.length) ats += 10;
  ats = Math.min(100, ats);

  // Formatting: balanced sections, bullets used instead of paragraphs.
  let formatting = 50;
  if (experience.some((e) => (e.bullets || []).length >= 2)) formatting += 20;
  if (summary && summary.length >= 40 && summary.length <= 500) formatting += 15;
  if (projects.some((p) => p.name)) formatting += 10;
  if (education.length) formatting += 5;
  formatting = Math.min(100, formatting);

  // Keywords: skill count relative to a healthy target, plus role match.
  let keywords = Math.min(70, Math.round((skills.length / 12) * 70));
  if (effectiveRole && summary.toLowerCase().includes(String(effectiveRole).toLowerCase().split(" ")[0])) keywords += 15;
  if (skills.length >= 6) keywords += 15;
  keywords = Math.min(100, Math.max(20, keywords));

  // Grammar/impact: rewards measurable, action-verb-led bullets.
  let grammar = 55;
  if (allBullets.length) {
    const strongBullets = allBullets.filter((b) => {
      const lower = (b || "").toLowerCase().trim();
      return ACTION_VERBS.some((v) => lower.startsWith(v)) || /\d/.test(b || "");
    });
    grammar += Math.round((strongBullets.length / allBullets.length) * 35);
  }
  if (summary) grammar += 10;
  grammar = Math.min(100, grammar);

  const overall = Math.round((ats + formatting + keywords + grammar) / 4);
  const stars = Math.max(1, Math.min(5, Math.round(overall / 20)));

  return { overall, ats, formatting, keywords, grammar, stars };
}

// ── Fix: Missing Section Recommendations ────────────────────────────────────
// Instead of the AI silently skipping sections the user left blank, surface
// them explicitly so the user knows exactly what to add for a stronger resume.
function getMissingSections(data = {}) {
  const recs = [];
  if (!(data.projects || []).some((p) => p.name)) {
    recs.push({ key: "projects", label: "Add Projects", detail: "Showcase 1-2 projects with measurable impact." });
  }
  if (!(data.achievements || []).length) {
    recs.push({ key: "skills", label: "Add Achievements", detail: "Awards, recognitions, or measurable wins stand out to recruiters." });
  }
  if (!(data.certifications || []).length) {
    recs.push({ key: "skills", label: "Add Certifications", detail: "Relevant certifications boost credibility and ATS keyword match." });
  }
  const p = data.personal_information || {};
  if (!p.portfolio && !p.github && !p.linkedin) {
    recs.push({ key: "basic", label: "Add Portfolio / LinkedIn", detail: "A portfolio, GitHub, or LinkedIn link gives recruiters more to review." });
  }
  if (!(data.languages || []).length) {
    recs.push({ key: "skills", label: "Add Languages", detail: "List languages you speak, especially for roles needing communication." });
  }
  return recs;
}

// ── Fix: Shared Resume Paper Renderer ───────────────────────────────────────
// Same markup used for both the live preview (fed by `formData` while the
// user is still typing) and the final generated result (fed by `resume`) —
// so what the user sees while building matches what they get at the end.
function ResumePaperBody({ data = {}, effectiveRole = "" }) {
  const p = data.personal_information || {};
  const skillGroups = categorizeSkills(data.skills || []);
  return (
    <>
      <div className="resume-paper-header">
        <div className="resume-paper-name">{p.name || effectiveRole || "Your Name"}</div>
        <div className="resume-paper-contact">{contactLine(p) || "email · phone · links"}</div>
      </div>

      {data.professional_summary && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Professional Summary</div>
          <p>{data.professional_summary}</p>
        </div>
      )}

      {(data.experience || []).some((e) => e.title || e.company) && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Experience</div>
          {data.experience.filter((e) => e.title || e.company).map((e, i) => (
            <div key={i} style={{ marginBottom: "12px" }}>
              <strong style={{ display: "block" }}>
                {e.title} — {e.company}
                {e.employment_type ? ` · ${e.employment_type}` : ""}
                {" "}({e.start} - {e.end})
              </strong>
              <ul className="result-section-list">
                {(e.bullets || []).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {(data.projects || []).some((p2) => p2.name) && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Projects</div>
          {data.projects.filter((p2) => p2.name).map((pr, i) => {
            const tech = Array.isArray(pr.technologies) ? pr.technologies.filter(Boolean).join(", ") : (pr.technologies || "");
            const links = [pr.github && `GitHub: ${pr.github}`, (pr.live_demo || pr.link) && `Demo: ${pr.live_demo || pr.link}`].filter(Boolean).join(" · ");
            return (
              <div key={i} style={{ marginBottom: "12px" }}>
                <strong style={{ display: "block" }}>
                  {pr.name}
                  {pr.role ? ` — ${pr.role}` : ""}
                  {pr.duration ? ` (${pr.duration})` : ""}
                </strong>
                {tech && <div style={{ fontSize: "0.92em", opacity: 0.9 }}>Tech: {tech}</div>}
                {links && <div style={{ fontSize: "0.92em", opacity: 0.9 }}>{links}</div>}
                {pr.description && <p>{pr.description}</p>}
                <ul className="result-section-list">
                  {(pr.bullets || []).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {(data.education || []).some((e) => e.school || e.degree) && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Education</div>
          {data.education.filter((e) => e.school || e.degree).map((ed, i) => (
            <div key={i}>{ed.degree}{ed.field ? `, ${ed.field}` : ""} — {ed.school} ({ed.start} - {ed.end})</div>
          ))}
        </div>
      )}

      {Object.keys(skillGroups).length > 0 && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Skills</div>
          {Object.entries(skillGroups).map(([cat, list]) => (
            <div key={cat} className="resume-skill-group">
              <strong>{cat}: </strong>{list.join(", ")}
            </div>
          ))}
        </div>
      )}

      {(data.certifications || []).length > 0 && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Certifications</div>
          <ul className="result-section-list">
            {data.certifications.filter(Boolean).map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {(data.achievements || []).length > 0 && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Achievements</div>
          <ul className="result-section-list">
            {data.achievements.filter(Boolean).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {(data.languages || []).length > 0 && (
        <div className="resume-paper-section">
          <div className="resume-paper-heading">Languages</div>
          <div>{data.languages.filter(Boolean).join(", ")}</div>
        </div>
      )}
    </>
  );
}

// ── Fix: Live Preview Panel ─────────────────────────────────────────────────
// Renders the same paper markup at a smaller scale, live, next to the form —
// so the user sees the resume take shape in real time instead of only after
// clicking Generate.
function LivePreviewPanel({ formData, layoutVariant, effectiveRole }) {
  return (
    <div className="live-preview-col ms-4">
      <div className="live-preview-label">
        <Eye size={13} /> Live Preview
      </div>
      <div className="live-preview-frame">
        <div className={`resume-paper live-preview-paper layout-${layoutVariant}`}>
          <ResumePaperBody data={formData} effectiveRole={effectiveRole} />
        </div>
      </div>
    </div>
  );
}

function downloadPdf(resume, effectiveRole) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginBottom = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  let y = 52;
  const LINE = 13;
  const SECTION_GAP = 10;

  const ensureSpace = (extra = LINE) => {
    if (y + extra > pageHeight - marginBottom) {
      doc.addPage();
      y = 52;
    }
  };
  const addHeading = (text) => {
    ensureSpace(LINE + 10);
    y += SECTION_GAP;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(text.toUpperCase(), marginX, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
  };
  const addParagraph = (text, opts = {}) => {
    if (!text) return;
    const fontSize = opts.fontSize || 10;
    const lineH = opts.lineH || LINE;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text), contentWidth - (opts.indent || 0));
    lines.forEach((ln) => {
      ensureSpace(lineH);
      doc.text(ln, marginX + (opts.indent || 0), y);
      y += lineH;
    });
  };

  const p = resume.personal_information || {};
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 15, 15);
  doc.text(p.name || effectiveRole || "Resume", marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  addParagraph(contactLine(p), { fontSize: 9, lineH: 12 });
  y += 4;
  doc.setTextColor(20, 20, 20);

  if (resume.professional_summary) {
    addHeading("Professional Summary");
    addParagraph(resume.professional_summary, { lineH: 13 });
  }

  if (resume.experience?.length) {
    addHeading("Experience");
    resume.experience.forEach((e) => {
      const typeBit = e.employment_type ? ` · ${e.employment_type}` : "";
      addParagraph(`${e.title || ""} — ${e.company || ""}${typeBit} (${e.start || ""} - ${e.end || ""})`, { bold: true, fontSize: 10 });
      (e.bullets || []).filter(Boolean).forEach((b) => addParagraph(`• ${b}`, { indent: 8 }));
      y += 6;
    });
  }

  if (resume.projects?.length) {
    addHeading("Projects");
    resume.projects.forEach((pr) => {
      const roleBit = pr.role ? ` — ${pr.role}` : "";
      const durBit = pr.duration ? ` (${pr.duration})` : "";
      addParagraph(`${pr.name || ""}${roleBit}${durBit}`, { bold: true });
      const tech = Array.isArray(pr.technologies) ? pr.technologies.filter(Boolean).join(", ") : (pr.technologies || "");
      if (tech) addParagraph(`Technologies: ${tech}`, { fontSize: 9, indent: 4 });
      const linkBits = [pr.github && `GitHub: ${pr.github}`, (pr.live_demo || pr.link) && `Demo: ${pr.live_demo || pr.link}`].filter(Boolean).join("  |  ");
      if (linkBits) addParagraph(linkBits, { fontSize: 9, indent: 4 });
      if (pr.description) addParagraph(pr.description, { indent: 4 });
      (pr.bullets || []).filter(Boolean).forEach((b) => addParagraph(`• ${b}`, { indent: 8 }));
      y += 6;
    });
  }

  if (resume.education?.length) {
    addHeading("Education");
    resume.education.forEach((ed) => {
      addParagraph(`${ed.degree || ""}${ed.field ? ", " + ed.field : ""} — ${ed.school || ""} (${ed.start || ""} - ${ed.end || ""})`);
    });
    y += 4;
  }

  const skillsList = dedupeSkills(resume.skills || []);
  if (skillsList.length) {
    addHeading("Skills");
    const groups = categorizeSkills(skillsList);
    Object.entries(groups).forEach(([cat, list]) => {
      addParagraph(`${cat}: ${list.join(", ")}`, { fontSize: 9.5 });
    });
    y += 4;
  }

  if (resume.certifications?.length) {
    addHeading("Certifications");
    resume.certifications.forEach((c) => addParagraph(`• ${c}`));
    y += 4;
  }

  if (resume.achievements?.length) {
    addHeading("Achievements");
    resume.achievements.forEach((a) => addParagraph(`• ${a}`));
    y += 4;
  }

  if (resume.languages?.length) {
    addHeading("Languages");
    addParagraph(resume.languages.join(", "));
  }

  doc.save(`${p.name || effectiveRole || "resume"}.pdf`);
}

async function downloadDocx(resume, effectiveRole) {
  const p = resume.personal_information || {};
  const children = [];
  children.push(new Paragraph({ text: p.name || effectiveRole || "Resume", heading: HeadingLevel.TITLE }));
  const contact = contactLine(p);
  if (contact) children.push(new Paragraph({ text: contact }));

  if (resume.professional_summary) {
    children.push(new Paragraph({ text: "Professional Summary", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: resume.professional_summary }));
  }

  if (resume.experience?.length) {
    children.push(new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }));
    resume.experience.forEach((e) => {
      const typeBit = e.employment_type ? ` · ${e.employment_type}` : "";
      children.push(new Paragraph({ text: `${e.title || ""} — ${e.company || ""}${typeBit} (${e.start || ""} - ${e.end || ""})`, bold: true }));
      (e.bullets || []).filter(Boolean).forEach((b) => children.push(new Paragraph({ text: b, bullet: { level: 0 } })));
    });
  }

  if (resume.projects?.length) {
    children.push(new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_2 }));
    resume.projects.forEach((pr) => {
      const roleBit = pr.role ? ` — ${pr.role}` : "";
      const durBit = pr.duration ? ` (${pr.duration})` : "";
      children.push(new Paragraph({ text: `${pr.name || ""}${roleBit}${durBit}`, bold: true }));
      const tech = Array.isArray(pr.technologies) ? pr.technologies.filter(Boolean).join(", ") : (pr.technologies || "");
      if (tech) children.push(new Paragraph({ text: `Technologies: ${tech}` }));
      const linkBits = [pr.github && `GitHub: ${pr.github}`, (pr.live_demo || pr.link) && `Demo: ${pr.live_demo || pr.link}`].filter(Boolean).join("  |  ");
      if (linkBits) children.push(new Paragraph({ text: linkBits }));
      if (pr.description) children.push(new Paragraph({ text: pr.description }));
      (pr.bullets || []).filter(Boolean).forEach((b) => children.push(new Paragraph({ text: b, bullet: { level: 0 } })));
    });
  }

  if (resume.education?.length) {
    children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }));
    resume.education.forEach((ed) => {
      children.push(new Paragraph({ text: `${ed.degree || ""}${ed.field ? ", " + ed.field : ""} — ${ed.school || ""} (${ed.start || ""} - ${ed.end || ""})` }));
    });
  }

  const skillsList = dedupeSkills(resume.skills || []);
  if (skillsList.length) {
    children.push(new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }));
    const groups = categorizeSkills(skillsList);
    Object.entries(groups).forEach(([cat, list]) => {
      children.push(new Paragraph({ text: `${cat}: ${list.join(", ")}` }));
    });
  }

  if (resume.certifications?.length) {
    children.push(new Paragraph({ text: "Certifications", heading: HeadingLevel.HEADING_2 }));
    resume.certifications.forEach((c) => children.push(new Paragraph({ text: c, bullet: { level: 0 } })));
  }

  if (resume.achievements?.length) {
    children.push(new Paragraph({ text: "Achievements", heading: HeadingLevel.HEADING_2 }));
    resume.achievements.forEach((a) => children.push(new Paragraph({ text: a, bullet: { level: 0 } })));
  }

  if (resume.languages?.length) {
    children.push(new Paragraph({ text: "Languages", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: resume.languages.join(", ") }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.name || effectiveRole || "resume"}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Merged Component ───────────────────────────────────────────────────
export default function ResumeBuilder({ initialSummary = "", initialResumeData = null, onSwitchToReview } = {}) {
  const navigate = useNavigate();
  const { requestScan, incrementScan } = useAuth();
  const { context, hasContext, setActiveContext } = useContextEngine();

  const [step, setStep] = useState(STEP.ROLE);
  const [sourceMode, setSourceMode] = useState("scratch"); // "improve" | "scratch"
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resume, setResume] = useState(null);

  // Final Review inline editing — a section expands into its editor right
  // here instead of navigating back to an earlier step. `sectionDraft` is a
  // snapshot taken when a section opens, so Cancel can restore it exactly.
  const [expandedSection, setExpandedSection] = useState(null);
  const [sectionDraft, setSectionDraft] = useState(null);
  const [layoutVariant, setLayoutVariant] = useState("standard");
  const [roleSpecific, setRoleSpecific] = useState([]);

  // Fix: Review page accordion — only one section body visible at a time
  // instead of every section rendering fully expanded (1000+ px scroll).
  const [openAccordion, setOpenAccordion] = useState("basic");
  const toggleAccordion = (name) => setOpenAccordion((prev) => (prev === name ? null : name));

  // Fix #5: soft confirmation instead of a hard block when Experience /
  // Projects are left empty — `warning` holds the pending prompt,
  // `skipConfirm` remembers which sections the user already said "continue
  // anyway" for so we don't nag them twice for the same empty section.
  const [warning, setWarning] = useState(null);
  const [skipConfirm, setSkipConfirm] = useState({ experience: false, projects: false });

  // Undo for accidental Experience / Project / Education deletes.
  const [undoItem, setUndoItem] = useState(null); // { section, index, item, expires }

  // Result-page inline edit (summary + quick section edits without leaving RESULT).
  const [resultEditField, setResultEditField] = useState(null); // "summary" | null
  const [resultEditDraft, setResultEditDraft] = useState("");

  // Fix #3 / #4: autosave draft state.
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const openSection = (name) => {
    setSectionDraft({
      formData: structuredClone(formData),
      roleSpecific: structuredClone(roleSpecific)
    });
    setExpandedSection(name);
    setOpenAccordion(name);
  };
  const cancelSection = () => {
    if (sectionDraft) {
      setFormData(sectionDraft.formData);
      setRoleSpecific(sectionDraft.roleSpecific);
    }
    setExpandedSection(null);
    setSectionDraft(null);
  };
  const saveSection = () => {
    // formData/roleSpecific are already live-bound to the same editors used
    // in the wizard steps, so "Save" just closes the editor and keeps them.
    setExpandedSection(null);
    setSectionDraft(null);
  };

  // Form local state for multi-step builder flow
  const [formData, setFormData] = useState({
    personal_information: { name: "", email: "", phone: "", github: "", linkedin: "", portfolio: "" },
    professional_summary: initialSummary,
    experience: [{ title: "", company: "", start: "", end: "", employment_type: "", bullets: [] }],
    education: [{ school: "", degree: "", field: "", start: "", end: "" }],
    // Fix #10 (Resume Review "Builder connection"): prefill from the full
    // optimization output when it's handed off from Resume Review, not just
    // the summary text. Falls back to empty as before when absent.
    skills: initialResumeData?.skills?.length ? initialResumeData.skills : [],
    projects: [{ name: "", role: "", duration: "", technologies: [], github: "", live_demo: "", description: "", link: "", bullets: [] }],
    certifications: initialResumeData?.certifications?.length ? initialResumeData.certifications : [],
    achievements: initialResumeData?.achievements?.length ? initialResumeData.achievements : [],
    languages: initialResumeData?.languages?.length ? initialResumeData.languages : []
  });

  const pushUndo = (section, index, item) => {
    setUndoItem({ section, index, item: structuredClone(item), expires: Date.now() + 8000 });
  };

  const applyUndo = () => {
    if (!undoItem) return;
    const { section, index, item } = undoItem;
    setFormData((prev) => {
      const list = [...(prev[section] || [])];
      const insertAt = Math.min(Math.max(index, 0), list.length);
      list.splice(insertAt, 0, item);
      return { ...prev, [section]: list };
    });
    setUndoItem(null);
  };

  const handleRemoveExperience = (item, index) => {
    pushUndo("experience", index, item);
    setFormData((prev) => ({ ...prev, experience: prev.experience.filter((_, idx) => idx !== index) }));
  };

  const handleRemoveProject = (item, index) => {
    pushUndo("projects", index, item);
    setFormData((prev) => ({ ...prev, projects: prev.projects.filter((_, idx) => idx !== index) }));
  };

  const handleSkillsChange = (skills) => {
    setFormData((prev) => ({ ...prev, skills: dedupeSkills(skills) }));
  };

  const startResultSummaryEdit = () => {
    setResultEditField("summary");
    setResultEditDraft(resume?.professional_summary || "");
  };

  const saveResultSummaryEdit = () => {
    if (!resume) return;
    setResume((prev) => ({ ...prev, professional_summary: resultEditDraft }));
    setFormData((prev) => ({ ...prev, professional_summary: resultEditDraft }));
    setResultEditField(null);
    setResultEditDraft("");
  };

  const cancelResultSummaryEdit = () => {
    setResultEditField(null);
    setResultEditDraft("");
  };

  // Fix #3 / #4: restore a previously autosaved draft once on mount. If the
  // page was opened with a prefill summary (e.g. from Resume Review →
  // "Improve with AI"), we leave the draft alone so that prefill isn't lost.
  useEffect(() => {
    if (initialSummary) {
      setDraftRestored(true);
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.formData) setFormData((prev) => ({ ...prev, ...draft.formData }));
        if (draft.roleSpecific) setRoleSpecific(draft.roleSpecific);
        if (draft.layoutVariant) setLayoutVariant(draft.layoutVariant);
        if (draft.resume) setResume(draft.resume);
      }
    } catch (e) {
      // Corrupt or inaccessible storage — just start fresh.
    }
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave — debounced so we're not writing to localStorage on every
  // keystroke. Runs after the initial restore so we never immediately
  // overwrite a draft with the pre-restore empty state.
  useEffect(() => {
    if (!draftRestored) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ formData, roleSpecific, layoutVariant, resume, step })
        );
        setDraftSavedAt(Date.now());
      } catch (e) {
        // Storage full or unavailable — silently skip, nothing else to do.
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [formData, roleSpecific, layoutVariant, resume, step, draftRestored]);

  const effectiveRole = hasContext ? context.role : "";
  const effectiveExperience = hasContext ? context.experience : "";
  const effectiveCompany = hasContext ? context.company : "";
  const effectiveDescription = hasContext ? context.description : "";

  const [loadingIndex, setLoadingIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setLoadingIndex(0);
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_STEPS.length;
      setLoadingIndex(i);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-dismiss undo toast after ~8s
  useEffect(() => {
    if (!undoItem) return;
    const left = Math.max(0, (undoItem.expires || 0) - Date.now());
    const t = setTimeout(() => setUndoItem(null), left || 8000);
    return () => clearTimeout(t);
  }, [undoItem]);

  const dynamicFields = getRoleFields(effectiveRole?.id);

  useEffect(() => {
    if (hasContext && step === STEP.ROLE) {
      setStep(STEP.BASIC);
    }
  }, [hasContext, step]);

  const handleOpportunitySubmit = async (payload) => {
    await setActiveContext({ ...payload, source_module: "resume_builder" });
    setStep(STEP.BASIC);
  };

  const handleChangeContext = () => {
    setError("");
    setResume(null);
    setStep(STEP.ROLE);
  };

  const updatePersonal = (key, val) => {
    setFormData((prev) => ({
      ...prev,
      personal_information: { ...prev.personal_information, [key]: val }
    }));
  };

  const validateCurrentStep = () => {
    setError("");
    if (step === STEP.BASIC) {
      const { name, email, phone, github, linkedin, portfolio } = formData.personal_information;
      if (!isNonEmpty(name)) return "Name is required.";
      if (!isValidEmail(email)) return "Valid email is required.";
      if (phone && !isValidPhone(phone)) return "Phone number format is invalid.";
      if (github && !isValidUrl(github)) return "Invalid GitHub URL.";
      if (linkedin && !isValidUrl(linkedin)) return "Invalid LinkedIn URL.";
      if (portfolio && !isValidUrl(portfolio)) return "Invalid Portfolio URL.";
    }
    return "";
  };

  // Fix #5: sections that are fine to submit empty but worth a nudge first.
  const isSectionEmpty = (key) => {
    if (key === "experience") return !formData.experience.some((e) => e.title || e.company);
    if (key === "projects") return !formData.projects.some((p) => p.name);
    return false;
  };

  const nextStep = () => {
    const err = validateCurrentStep();
    if (err) {
      setError(err);
      return;
    }
    setError("");

    if (step === STEP.EXPERIENCE && !skipConfirm.experience && isSectionEmpty("experience")) {
      setWarning({ key: "experience", message: "You haven't added any work experience. Continue without it?" });
      return;
    }
    if (step === STEP.PROJECTS && !skipConfirm.projects && isSectionEmpty("projects")) {
      setWarning({ key: "projects", message: "You haven't added any projects. Continue without them?" });
      return;
    }

    setWarning(null);
    if (step < STEP.REVIEW) setStep(step + 1);
  };

  const confirmWarningAndContinue = () => {
    if (!warning) return;
    setSkipConfirm((s) => ({ ...s, [warning.key]: true }));
    setWarning(null);
    if (step < STEP.REVIEW) setStep(step + 1);
  };

  const dismissWarning = () => setWarning(null);

  const prevStep = () => {
    setError("");
    setWarning(null);
    if (step > STEP.ROLE) setStep(step - 1);
  };

  const handleGenerate = async () => {
    if (!hasContext) {
      setError("Career Focus missing. Please set your target role first.");
      setStep(STEP.ROLE);
      return;
    }
    if (sourceMode === "improve") {
      const fileErr = validateResumeFile(file);
      if (fileErr) {
        setError(fileErr);
        return;
      }
    }

    setError("");
    const allowed = requestScan("resume_builder");
    if (!allowed) return;

    setLoading(true);
    try {
      const { personal_information = {}, ...restDraft } = formData;
      // NOTE: restDraft already contains the real `experience` (job history
      // array) and `education` etc. — don't add career-level/company/description
      // under the same keys here, that would silently clobber them.
      const profileData = { ...restDraft, ...personal_information, ...roleSpecific };

      const { data } = await generateResumeService(effectiveRole, profileData);

      incrementScan("resume_builder");
      const generated = data.resume || data.data || data;
      if (generated && Array.isArray(generated.skills)) {
        generated.skills = dedupeSkills(generated.skills);
      }
      setResume(generated);
      setStep(STEP.RESULT);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Resume generation failed. Please check your network connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Fix #1 / #2: "Edit Resume" on the Result page no longer flips a dummy
  // local flag — it pulls the AI-generated content back into `formData` (so
  // edits continue from the polished output, not the stale original input)
  // and reopens the SAME Review step used earlier in the flow. No second,
  // duplicate editing surface.
  const handleEditResume = () => {
    if (resume) {
      setFormData((prev) => ({
        ...prev,
        personal_information: { ...prev.personal_information, ...(resume.personal_information || {}) },
        professional_summary: resume.professional_summary ?? prev.professional_summary,
        experience: resume.experience?.length ? resume.experience : prev.experience,
        education: resume.education?.length ? resume.education : prev.education,
        skills: resume.skills?.length ? dedupeSkills(resume.skills) : prev.skills,
        projects: resume.projects?.length ? resume.projects : prev.projects,
        certifications: resume.certifications?.length ? resume.certifications : prev.certifications,
        achievements: resume.achievements?.length ? resume.achievements : prev.achievements,
        languages: resume.languages?.length ? resume.languages : prev.languages
      }));
    }
    setError("");
    setWarning(null);
    setStep(STEP.REVIEW);
  };

  // Regenerate Layout — cycles to the next professional template. Purely a
  // presentation change: `resume` (the actual content) is never touched, so
  // the same AI-optimized data just re-renders under a different, still
  // recruiter/ATS-friendly, layout.
  const handleRegenerateLayout = () => {
    setLayoutVariant((current) => {
      const idx = LAYOUT_VARIANTS.findIndex((v) => v.id === current);
      return LAYOUT_VARIANTS[(idx + 1) % LAYOUT_VARIANTS.length].id;
    });
  };

  return (
    <div className="tool-page">
      <div className="tool-container">
        <div className="tool-page-header">
          <span className="input-panel-label mb-2" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Briefcase size={14} />
            AI Resume Builder
          </span>
          <h1 className="tool-page-title">Craft job-winning resumes in minutes.</h1>
          <p className="tool-page-sub">
            Smart AI tailoring for ATS pass-rates, modern templates, and auto-generated bullet points. Stand out fast.
          </p>
          <button
            type="button"
            className="tool-mode-switch-link"
            onClick={() => (onSwitchToReview ? onSwitchToReview() : navigate("/resume-builder-review"))}
          >
            Already have a resume? Upload it for AI Review →
          </button>
        </div>

        {hasContext && <CurrentContextCard onChange={handleChangeContext} />}

        {step <= STEP.REVIEW && (
          <>
            <StepProgress steps={STEPS} currentStep={step} />
            {/* Fix #3 / #4: quiet confirmation that progress won't be lost. */}
            {draftSavedAt && step > STEP.ROLE && (
              <div className="autosave-badge" style={{ marginBottom: "15px" }}>
                <CheckCircle2 size={12} />
                <span>Draft auto-saved</span>
              </div>
            )}
          </>
        )}

        <div className={`verify-layout ${loading ? "modal-active" : ""}`}>
          {/* STEP 1: CAREER FOCUS / ROLE */}
          {step === STEP.ROLE && !hasContext && (
            <div className="tool-card">
              <h2 className="input-panel-title">What role are you applying for?</h2>
              <p className="tool-step-sub">This lets us tailor the review to the job — matching skills, keywords, and expectations.</p>

              <OpportunitySourceTabs onSubmit={handleOpportunitySubmit} />

              {error && <div className="field-error-msg pt-2">{error}</div>}
            </div>
          )}

          {step > STEP.ROLE && (
            <> 
              <div className="tool-card">
                {/* STEP 2: BASIC INFO (now includes Professional Summary + Links — Fix #6 / #14) */}
                {step === STEP.BASIC && (
                  <div className="tool-step-body">
                    <h2 className="tool-step-heading">Basic Information</h2>
                    <p className="tool-step-sub">Enter your primary contact details for your resume header.</p>
                    <div className="tool-step-fields">
                      <div>
                        <input
                          className="centered-input"
                          placeholder="Full Name"
                          value={formData.personal_information.name}
                          onChange={(e) => updatePersonal("name", e.target.value)}
                        />
                      </div>
                
                      <div>
                        <input
                          className="centered-input"
                          placeholder="Email"
                          value={formData.personal_information.email}
                          onChange={(e) => updatePersonal("email", e.target.value)}
                        />
                      </div>
                      <div>
                        <input
                          className="centered-input"
                          placeholder="Phone"
                          value={formData.personal_information.phone}
                          onChange={(e) => updatePersonal("phone", e.target.value)}
                        />
                      </div>
                    </div>
                
                    <div style={{ marginTop: "20px" }}>
                      <label className="form-label" htmlFor="resume-build-summary">Professional Summary</label>
                      <textarea
                        id="resume-build-summary"
                        className="centered-input"
                        rows={4}
                        placeholder="A short 2-3 sentence pitch — your experience, strengths, and what you're looking for. You can also let AI refine this during generation."
                        value={formData.professional_summary}
                        onChange={(e) => setFormData({ ...formData, professional_summary: e.target.value })}
                      />
                    </div>
                
                    <div className="tool-step-fields" style={{ marginTop: "20px" }}>
                      <input
                        className="centered-input"
                        placeholder="GitHub Profile URL"
                        value={formData.personal_information.github}
                        onChange={(e) => updatePersonal("github", e.target.value)}
                      />
                      <input
                        className="centered-input"
                        placeholder="LinkedIn Profile URL"
                        value={formData.personal_information.linkedin}
                        onChange={(e) => updatePersonal("linkedin", e.target.value)}
                      />
                      <input
                        className="centered-input"
                        placeholder="Portfolio / Personal Site"
                        value={formData.personal_information.portfolio}
                        onChange={(e) => updatePersonal("portfolio", e.target.value)}
                      />
                    </div>
                  </div>
                )}
  
                {/* STEP 3: EXPERIENCE (+ role-specific fields right after — Fix #9) */}
                {step === STEP.EXPERIENCE && (
                  <div className="tool-step-body">
                    <h2 className="tool-step-heading">Work Experience</h2>
                    <p className="tool-step-sub">Add relevant job roles, internships, or professional history.</p>
                
                    <ExperienceEditor
                      items={formData.experience}
                      setItems={(items) => setFormData({ ...formData, experience: items })}
                      onRemove={handleRemoveExperience}
                    />
  
                    <RoleSpecificFields dynamicFields={dynamicFields} roleSpecific={roleSpecific} setRoleSpecific={setRoleSpecific} />
                  </div>
                )}
  
                {/* STEP 4: EDUCATION */}
                {step === STEP.EDUCATION && (
                  <div className="tool-step-body">
                    <h2 className="tool-step-heading">Education</h2>
                    <p className="tool-step-sub">Add your academic background and qualifications.</p>
                
                    <EducationEditor
                      items={formData.education}
                      setItems={(items) => setFormData({ ...formData, education: items })}
                    />
                  </div>
                )}
  
                {/* STEP 5: SKILLS (+ Certifications / Achievements / Languages — Fix #7) */}
                {step === STEP.SKILLS && (
                  <div className="tool-step-body">
                    <h2 className="tool-step-heading">Skills & Technologies</h2>
                    <p className="tool-step-sub">List hard skills, tools, and technical competencies. Duplicates like React / ReactJS are merged automatically.</p>
                
                    <SkillsAutocomplete
                      value={formData.skills}
                      onChange={handleSkillsChange}
                    />
  
                    <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <ListTextarea
                        label="Certifications"
                        placeholder="One certification per line (optional)"
                        value={formData.certifications}
                        onChange={(certifications) => setFormData({ ...formData, certifications })}
                      />
                      <ListTextarea
                        label="Achievements"
                        placeholder="One achievement or award per line (optional)"
                        value={formData.achievements}
                        onChange={(achievements) => setFormData({ ...formData, achievements })}
                      />
                      <ListTextarea
                        label="Languages"
                        placeholder="One language per line (optional)"
                        value={formData.languages}
                        onChange={(languages) => setFormData({ ...formData, languages })}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
  
                {/* STEP 6: PROJECTS */}
                {step === STEP.PROJECTS && (
                  <div className="tool-step-body">
                    <h2 className="tool-step-heading">Key Projects</h2>
                    <p className="tool-step-sub">Highlight key projects, open source contributions, or personal work.</p>
                
                    <ProjectsEditor
                      items={formData.projects}
                      setItems={(items) => setFormData({ ...formData, projects: items })}
                      onRemove={handleRemoveProject}
                    />
                  </div>
                )}
  
                {/* STEP 7: REVIEW & SOURCE SELECTION — Fix: accordion instead of
                    every section rendering fully expanded (was 1000+ px of
                    scroll). Only the open section's body renders; the rest show
                    a one-line summary, e.g. "2 Positions Added". */}
                {step === STEP.REVIEW && (
                  <div className="tool-step-body">
                    <h2 className="tool-step-heading">Review before you generate</h2>
                    <p className="tool-step-sub">Tap a section to open it — hit Edit to fix it right here.</p>
                
                    {(() => {
                      const expCount = formData.experience.filter((e) => e.company || e.title).length;
                      const eduCount = formData.education.filter((e) => e.school || e.degree).length;
                      const skillsCount = formData.skills.length;
                      const projCount = formData.projects.filter((p) => p.name).length;
                      const skillsSummaryBits = [
                        skillsCount ? `${skillsCount} Skill${skillsCount === 1 ? "" : "s"}` : null,
                        formData.certifications.length ? `${formData.certifications.length} Certification${formData.certifications.length === 1 ? "" : "s"}` : null,
                        formData.languages.length ? `${formData.languages.length} Language${formData.languages.length === 1 ? "" : "s"}` : null,
                      ].filter(Boolean);
                    
                      return (
                        <>
                          {/* Role */}
                          <div className="result-section accordion-section" style={{ textAlign: "left", marginBottom: "5px" }}>
                            <div className="accordion-header">
                              <div className="accordion-header-left">
                                <button type="button" className="accordion-btn" onClick={() => toggleAccordion("role")}>
                                  {openAccordion === "role" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                                <span className="result-section-title">Role</span>
                              </div>
                              <span className="accordion-summary">{effectiveRole || "Not set"}</span>
                            </div>
                            {openAccordion === "role" && (
                              <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginTop: "8px" }}>
                                <div>{effectiveRole || "—"}{effectiveExperience ? ` · ${effectiveExperience}` : ""}</div>
                              </div>
                            )}
                          </div>
                          
                          {/* Basic Info */}
                          <div className="result-section accordion-section" style={{ textAlign: "left", marginBottom: "5px" }}>
                            <div className="accordion-header">
                              <div className="accordion-header-left">
                                <button type="button" className="accordion-btn" onClick={() => toggleAccordion("basic")}>
                                  {openAccordion === "basic" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                                <span className="result-section-title">Basic Info</span>
                              </div>
                              <span className="accordion-summary">{formData.personal_information.name || "Not set"}</span>
                            </div>
                            {openAccordion === "basic" && (
                              <div className={`${(expandedSection !== "basic") ? "flex justify-between items-center" : "" }`} style={{ marginTop: "10px" }}>
                                {expandedSection === "basic" ? (
                                  <>
                                    <div className="accordion-edit-toggle">
                                      <div style={{ display: "flex", gap: "0px" }}>
                                        <button type="button" className="btn-ghost" onClick={cancelSection} style={{ fontSize: "13px" }}>Cancel</button>
                                        <button type="button" className="btn-ghost" onClick={saveSection} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                          <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> Save
                                        </button>
                                      </div>
                                    </div>

                                    <div style={{ marginTop: "10px" }}>
                                      <div className="tool-step-fields">
                                        <input className="centered-input" placeholder="Full Name" value={formData.personal_information.name} onChange={(e) => updatePersonal("name", e.target.value)} />
                                        <input className="centered-input" placeholder="Email" value={formData.personal_information.email} onChange={(e) => updatePersonal("email", e.target.value)} />
                                        <input className="centered-input" placeholder="Phone" value={formData.personal_information.phone} onChange={(e) => updatePersonal("phone", e.target.value)} />
                                      </div>
                                      <div style={{ marginTop: "12px" }}>
                                        <label className="form-label" htmlFor="resume-review-summary">Professional Summary</label>
                                        <textarea id="resume-review-summary" className="centered-input" rows={4} value={formData.professional_summary} onChange={(e) => setFormData({ ...formData, professional_summary: e.target.value })} />
                                      </div>
                                      <div className="tool-step-fields" style={{ marginTop: "12px" }}>
                                        <input className="centered-input" placeholder="GitHub Profile URL" value={formData.personal_information.github} onChange={(e) => updatePersonal("github", e.target.value)} />
                                        <input className="centered-input" placeholder="LinkedIn Profile URL" value={formData.personal_information.linkedin} onChange={(e) => updatePersonal("linkedin", e.target.value)} />
                                        <input className="centered-input" placeholder="Portfolio / Personal Site" value={formData.personal_information.portfolio} onChange={(e) => updatePersonal("portfolio", e.target.value)} />
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                                    <div>{formData.personal_information.name || "—"}</div>
                                    <div>{[formData.personal_information.email, formData.personal_information.phone].filter(Boolean).join(" · ")}</div>
                                    {formData.professional_summary && <div style={{ marginTop: "4px" }}>{formData.professional_summary}</div>}
                                    <div style={{ marginTop: "4px" }}>{[formData.personal_information.github, formData.personal_information.linkedin, formData.personal_information.portfolio].filter(Boolean).join(" · ")}</div>
                                  </div>
                                )}
                                <div className="accordion-edit-toggle">
                                  {expandedSection !== "basic" && (
                                    <button type="button" className="btn-ghost" onClick={() => openSection("basic")} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                      <Pencil size={12} style={{ marginRight: "4px" }} /> Edit
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Experience */}
                          <div className="result-section accordion-section" style={{ textAlign: "left", marginBottom: "5px" }}>
                            <div className="accordion-header">
                              <div className="accordion-header-left">
                                <button type="button" className="accordion-btn" onClick={() => toggleAccordion("experience")}>
                                  {openAccordion === "experience" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                                <span className="result-section-title">Experience</span>
                              </div>
                              <span className="accordion-summary">{expCount} Position{expCount === 1 ? "" : "s"} Added</span>
                            </div>
                            {openAccordion === "experience" && (
                              <div className={`${(expandedSection !== "experience") ? "flex justify-between items-center" : "" }`} style={{ marginTop: "10px" }}>
                                {expandedSection === "experience" ? (
                                  <>
                                    <div className="accordion-edit-toggle">
                                      <div style={{ display: "flex", gap: "0px" }}>
                                        <button type="button" className="btn-ghost" onClick={cancelSection} style={{ fontSize: "13px" }}>Cancel</button>
                                        <button type="button" className="btn-ghost" onClick={saveSection} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                          <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> Save
                                        </button>
                                      </div>
                                    </div>
                                    <div style={{ marginTop: "10px" }}>
                                      <ExperienceEditor items={formData.experience} setItems={(items) => setFormData({ ...formData, experience: items })} onRemove={handleRemoveExperience} />
                                      <RoleSpecificFields dynamicFields={dynamicFields} roleSpecific={roleSpecific} setRoleSpecific={setRoleSpecific} />
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                                    {expCount === 0 && <div>No experience added.</div>}
                                    {formData.experience.filter((e) => e.company || e.title).map((e, i) => (
                                      <div key={i}>{e.title} — {e.company}{e.employment_type ? ` · ${e.employment_type}` : ""} ({e.start} - {e.end})</div>
                                    ))}
                                    {dynamicFields.filter((f) => roleSpecific[f.key]).map((f) => (
                                      <div key={f.key}>{f.label}: {roleSpecific[f.key]}</div>
                                    ))}
                                  </div>
                                )}
                                {expandedSection !== "experience" && (
                                  <div className="accordion-edit-toggle">
                                    <button type="button" className="btn-ghost" onClick={() => openSection("experience")} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                      <Pencil size={12} style={{ marginRight: "4px" }} /> Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Education */}
                          <div className="result-section accordion-section" style={{ textAlign: "left", marginBottom: "5px" }}>
                            <div className="accordion-header">
                              <div className="accordion-header-left">
                                <button type="button" className="accordion-btn" onClick={() => toggleAccordion("education")}>
                                  {openAccordion === "education" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                                <span className="result-section-title">Education</span>
                              </div>
                              <span className="accordion-summary">{eduCount} Degree{eduCount === 1 ? "" : "s"} Added</span>
                            </div>
                            {openAccordion === "education" && (
                              <div className={`${(expandedSection !== "education") ? "flex justify-between items-center" : "" }`}  style={{ marginTop: "10px" }}>
                                {expandedSection === "education" ? (
                                  <>
                                  <div className="accordion-edit-toggle">
                                    <div style={{ display: "flex", gap: "0px" }}>
                                      <button type="button" className="btn-ghost" onClick={cancelSection} style={{ fontSize: "13px" }}>Cancel</button>
                                      <button type="button" className="btn-ghost" onClick={saveSection} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                        <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> Save
                                      </button>
                                    </div>
                                  </div>
                                  <div style={{ marginTop: "10px" }}>
                                    <EducationEditor items={formData.education} setItems={(items) => setFormData({ ...formData, education: items })} />
                                  </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                                    {eduCount === 0 && <div>No education added.</div>}
                                    {formData.education.filter((e) => e.school || e.degree).map((e, i) => (
                                      <div key={i}>{e.degree}{e.field ? `, ${e.field}` : ""} — {e.school} ({e.start} - {e.end})</div>
                                    ))}
                                  </div>
                                )}
                                {expandedSection !== "education" && (
                                  <div className="accordion-edit-toggle">
                                    <button type="button" className="btn-ghost" onClick={() => openSection("education")} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                      <Pencil size={12} style={{ marginRight: "4px" }} /> Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Skills */}
                          <div className="result-section accordion-section" style={{ textAlign: "left", marginBottom: "5px" }}>
                            <div className="accordion-header">
                              <div className="accordion-header-left">
                                <button type="button" className="accordion-btn" onClick={() => toggleAccordion("skills")}>
                                  {openAccordion === "skills" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                                <span className="result-section-title">Skills</span>
                              </div>
                              <span className="accordion-summary">{skillsSummaryBits.length ? skillsSummaryBits.join(" · ") : "Not set"}</span>
                            </div>
                            {openAccordion === "skills" && (
                              <div className={`${(expandedSection !== "skills") ? "flex justify-between items-center" : "" }`} style={{ marginTop: "10px" }}>
                                {expandedSection === "skills" ? (
                                  <>
                                    <div className="accordion-edit-toggle">
                                      <div style={{ display: "flex", gap: "0px" }}>
                                        <button type="button" className="btn-ghost" onClick={cancelSection} style={{ fontSize: "13px" }}>Cancel</button>
                                        <button type="button" className="btn-ghost" onClick={saveSection} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                          <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> Save
                                        </button>
                                      </div>
                                    </div> 
                                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "14px" }}>
                                      <SkillsAutocomplete value={formData.skills} onChange={handleSkillsChange} />
                                      <ListTextarea label="Certifications" value={formData.certifications} onChange={(certifications) => setFormData({ ...formData, certifications })} />
                                      <ListTextarea label="Achievements" value={formData.achievements} onChange={(achievements) => setFormData({ ...formData, achievements })} />
                                      <ListTextarea label="Languages" value={formData.languages} onChange={(languages) => setFormData({ ...formData, languages })} rows={2} />
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                                    {Object.entries(categorizeSkills(formData.skills)).map(([cat, list]) => (
                                      <div key={cat}><strong>{cat}:</strong> {list.join(", ")}</div>
                                    ))}
                                    {!skillsCount && <div>—</div>}
                                    {formData.certifications.length > 0 && <div style={{ marginTop: "4px" }}>Certifications: {formData.certifications.join(", ")}</div>}
                                    {formData.achievements.length > 0 && <div style={{ marginTop: "4px" }}>Achievements: {formData.achievements.join(", ")}</div>}
                                    {formData.languages.length > 0 && <div style={{ marginTop: "4px" }}>Languages: {formData.languages.join(", ")}</div>}
                                  </div>
                                )}
                                {expandedSection !== "skills" && (
                                  <div className="accordion-edit-toggle">
                                    <button type="button" className="btn-ghost" onClick={() => openSection("skills")} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                      <Pencil size={12} style={{ marginRight: "4px" }} /> Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Projects */}
                          <div className="result-section accordion-section" style={{ textAlign: "left", marginBottom: "5px" }}>
                            <div className="accordion-header">
                              <div className="accordion-header-left">
                                <button type="button" className="accordion-btn" onClick={() => toggleAccordion("projects")}>
                                  {openAccordion === "projects" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                                <span className="result-section-title">Projects</span>
                              </div>
                              <span className="accordion-summary">{projCount} Project{projCount === 1 ? "" : "s"} Added</span>
                            </div>
                            {openAccordion === "projects" && (
                              <div className={`${(expandedSection !== "projects") ? "flex justify-between items-center" : "" }`}  style={{ marginTop: "10px" }}>
                                {expandedSection === "projects" ? (
                                  <>
                                    <div className="accordion-edit-toggle">
                                      <div style={{ display: "flex", gap: "0px" }}>
                                        <button type="button" className="btn-ghost" onClick={cancelSection} style={{ fontSize: "13px" }}>Cancel</button>
                                        <button type="button" className="btn-ghost" onClick={saveSection} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                          <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> Save
                                        </button>
                                      </div>
                                    </div>
                                    <div style={{ marginTop: "10px" }}>
                                      <ProjectsEditor items={formData.projects} setItems={(items) => setFormData({ ...formData, projects: items })} onRemove={handleRemoveProject} />
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                                    {projCount === 0 && <div>No projects added.</div>}
                                    {formData.projects.filter((p) => p.name).map((p, i) => (
                                      <div key={i}>
                                        {p.name}
                                        {p.role ? ` — ${p.role}` : ""}
                                        {p.duration ? ` (${p.duration})` : ""}
                                        {(p.live_demo || p.link) ? ` · ${p.live_demo || p.link}` : ""}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {expandedSection !== "projects" && (
                                  <div className="accordion-edit-toggle">
                                    <button type="button" className="btn-ghost" onClick={() => openSection("projects")} style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}>
                                      <Pencil size={12} style={{ marginRight: "4px" }} /> Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
  
                {warning && step <= STEP.REVIEW && (
                  <div className="step-warning-banner">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertTriangle size={16} />
                      <span>{warning.message}</span>
                    </div>
                    <div className="step-warning-actions">
                      <button type="button" className="btn-ghost" onClick={dismissWarning}>Go back &amp; add</button>
                      <button type="button" className="btn-secondary" onClick={confirmWarningAndContinue}>Continue anyway</button>
                    </div>
                  </div>
                )}
  
                {undoItem && step <= STEP.REVIEW && (
                  <div className="step-warning-banner" style={{ borderColor: "rgba(6,182,212,0.35)", background: "rgba(6,182,212,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <RotateCcw size={16} />
                      <span>
                        {undoItem.section === "experience" ? "Experience" : undoItem.section === "projects" ? "Project" : "Item"} removed.
                      </span>
                    </div>
                    <div className="step-warning-actions">
                      <button type="button" className="btn-secondary" onClick={applyUndo}>Undo</button>
                      <button type="button" className="btn-ghost" onClick={() => setUndoItem(null)}>Dismiss</button>
                    </div>
                  </div>
                )}
  
                {error && step <= STEP.REVIEW && (
                  <div className="field-error-msg pt-2" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--red)", marginTop: "8px" }}>
                    <AlertTriangle size={16} /> {error}
                  </div>
                )}
  
                {/* Navigation Controls */}
                <div className="tool-step-nav">
                  {step > STEP.BASIC && step < STEPS.length && (
                    <button type="button" className="btn-secondary" onClick={prevStep}>
                      <ArrowLeft size={16} style={{ marginRight: "6px" }} /> Back
                    </button>
                  )}
  
                  {step < STEPS.length ? (
                    <button type="button" className="btn-primary" style={{ marginLeft: "auto" }} onClick={nextStep} disabled={!effectiveRole}>
                      Next <ArrowRight size={16} style={{ marginLeft: "6px" }} />
                    </button>
                  ) : (
                    <button type="button" className="analyze-btn" style={{ marginLeft: "auto" }} onClick={handleGenerate} disabled={loading || !!expandedSection}>
                      {loading ? "Generating..." : "Generate Resume"}
                    </button>
                  )}
                </div>
              </div>
            
              <LivePreviewPanel formData={formData} layoutVariant={layoutVariant} effectiveRole={effectiveRole} />
            </>
          )}

          {/* LOADING MODAL — Fix #10: a real progress checklist instead of one rotating line. */}
          {loading && (
            <>
              <div className="screen-overlay" />
              <div className="popup-modal">
                <div className="popup-spinner">
                  <Sparkles size={40} />
                </div>
                <h3 style={{ color: "white" }}>Generating Resume...</h3>
                <div className="loading-checklist">
                  {LOADING_STEPS.map((label, i) => (
                    <div key={label} className={`loading-checklist-item ${i < loadingIndex ? "done" : i === loadingIndex ? "active" : ""}`}>
                      {i < loadingIndex ? <CheckCircle2 size={14} /> : i === loadingIndex ? <Sparkles size={14} /> : <span className="loading-dot" />}
                      <span>{label}{i < loadingIndex ? "" : i === loadingIndex ? "…" : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* RESULT PREVIEW — Fix #8: header/badge/action-bar match the
              Opportunity Verification result language; the resume itself
              renders as one continuous "paper" instead of stacked cards. */}
          {!loading && step === STEP.RESULT && resume && (
            <div className="tool-card resume-result-card">
              <div className="result-verdict" style={{ textAlign: "center" }}>
                <h3 className="result-verdict-title safe">✅ Resume Generated Successfully</h3>
                <p className="result-verdict-summary">
                  Your ATS-optimized resume is ready. Review it below, fine-tune anything, then export or get it reviewed by AI.
                </p>
              </div>

              {/* Fix: Resume Score — quality breakdown that was completely missing. */}
              {(() => {
                const score = computeResumeScore(resume, effectiveRole);
                const missing = getMissingSections(resume);
                return (
                  <>
                    <div className="resume-score-card">
                      <div className="resume-score-main">
                        <div className="resume-score-title">
                          <ShieldCheck size={16} /> Resume Quality
                        </div>
                        <div className="resume-score-value">{score.overall}%</div>
                        <div className="resume-score-stars">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={16} fill={i < score.stars ? "currentColor" : "none"} />
                          ))}
                        </div>
                      </div>
                      <div className="resume-score-breakdown">
                        <div className="resume-score-row">
                          <span><ShieldCheck size={13} /> ATS</span>
                          <div className="resume-score-bar"><div className="resume-score-bar-fill" style={{ width: `${score.ats}%` }} /></div>
                          <span className="resume-score-pct">{score.ats}%</span>
                        </div>
                        <div className="resume-score-row">
                          <span><LayoutTemplate size={13} /> Formatting</span>
                          <div className="resume-score-bar"><div className="resume-score-bar-fill" style={{ width: `${score.formatting}%` }} /></div>
                          <span className="resume-score-pct">{score.formatting}%</span>
                        </div>
                        <div className="resume-score-row">
                          <span><KeyRound size={13} /> Keywords</span>
                          <div className="resume-score-bar"><div className="resume-score-bar-fill" style={{ width: `${score.keywords}%` }} /></div>
                          <span className="resume-score-pct">{score.keywords}%</span>
                        </div>
                        <div className="resume-score-row">
                          <span><SpellCheck size={13} /> Grammar</span>
                          <div className="resume-score-bar"><div className="resume-score-bar-fill" style={{ width: `${score.grammar}%` }} /></div>
                          <span className="resume-score-pct">{score.grammar}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Fix: Missing Section Recommendations — instead of the AI
                        silently ignoring blank sections. */}
                    {missing.length > 0 && (
                      <div className="missing-sections-card">
                        <div className="missing-sections-title">
                          <Info size={15} /> Recommendations to strengthen this resume
                        </div>
                        <div className="missing-sections-list">
                          {missing.map((m) => (
                            <button
                              type="button"
                              key={m.label}
                              className="missing-section-chip"
                              onClick={() => {
                                handleEditResume();
                                setTimeout(() => openSection(m.key), 0);
                              }}
                              title={m.detail}
                            >
                              <PlusCircle size={13} /> {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="resume-action-bar">
                <div className="layout-select-wrapper">
                  <label className="layout-select-label" htmlFor="resume-layout-select">Layout</label>
                  <select
                    id="resume-layout-select"
                    className="layout-select"
                    value={layoutVariant}
                    onChange={(e) => setLayoutVariant(e.target.value)}
                  >
                    {LAYOUT_VARIANTS.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-ghost" title="Cycle to next layout" onClick={handleRegenerateLayout} style={{ padding: "6px" }}>
                    <RotateCcw size={15} />
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="btn-secondary" onClick={handleEditResume}>
                    <Pencil size={16} />
                    <span style={{ marginLeft: "6px" }}>Edit Resume</span>
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => downloadPdf(resume, effectiveRole)}>
                    <Download size={16} /> PDF
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => downloadDocx(resume, effectiveRole)}>
                    <Download size={16} /> DOCX
                  </button>
                  <button
                    type="button"
                    className="analyze-btn"
                    onClick={() => (onSwitchToReview ? onSwitchToReview() : navigate("/resume-builder-review"))}
                  >
                    Review with AI
                  </button>
                </div>
              </div>

              {/* Inline editable summary on result (click to type + save) */}
              <div className="result-section" style={{ textAlign: "left", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div className="result-section-title" style={{ margin: 0 }}>Professional Summary</div>
                  {resultEditField !== "summary" ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={startResultSummaryEdit}
                      style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}
                    >
                      <Pencil size={12} style={{ marginRight: "4px" }} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" className="btn-ghost" onClick={cancelResultSummaryEdit} style={{ fontSize: "13px" }}>Cancel</button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={saveResultSummaryEdit}
                        style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center", fontSize: "13px" }}
                      >
                        <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> Save
                      </button>
                    </div>
                  )}
                </div>
                {resultEditField === "summary" ? (
                  <textarea
                    className="centered-input"
                    rows={4}
                    value={resultEditDraft}
                    onChange={(e) => setResultEditDraft(e.target.value)}
                    placeholder="Write your professional summary..."
                    autoFocus
                  />
                ) : (
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                    {resume.professional_summary || "No summary yet. Click Edit to add one."}
                  </p>
                )}
              </div>

              <div className="resume-paper-wrapper">
                <div className={`resume-paper layout-${layoutVariant}`}>
                  <ResumePaperBody data={resume} effectiveRole={effectiveRole} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
