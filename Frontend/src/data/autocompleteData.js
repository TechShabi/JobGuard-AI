// Hybrid autocomplete data: static suggestion lists shared by
// HybridAutocomplete across Job Title, Company, Degree, Field of Study,
// Skills, and Employment Type inputs (Resume Review, Resume Builder,
// Interview Preparation).
//
// "Hybrid" = static suggestions + free manual text + the user's own
// recent entries (history), never suggestions-only.

export const DEGREES = [
  "High School Diploma",
  "Associate Degree",
  "Bachelor's Degree",
  "Bachelor of Science (BS)",
  "Bachelor of Arts (BA)",
  "Bachelor of Engineering (BE)",
  "Bachelor of Technology (BTech)",
  "Bachelor of Business Administration (BBA)",
  "Bachelor of Commerce (BCom)",
  "Master's Degree",
  "Master of Science (MS)",
  "Master of Arts (MA)",
  "Master of Business Administration (MBA)",
  "Master of Technology (MTech)",
  "Doctorate / PhD",
  "Diploma",
  "Certification",
];

export const FIELDS_OF_STUDY = [
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Data Science",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Business Administration",
  "Marketing",
  "Finance",
  "Accounting",
  "Economics",
  "Graphic Design",
  "Human Resources",
  "Psychology",
  "Communications",
  "Journalism",
  "Biology",
  "Nursing",
  "Medicine",
  "Law",
  "Architecture",
  "Education",
  "Mathematics",
  "Physics",
];

export const SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "SQL",
  "React", "Node.js", "Next.js", "Vue.js", "Angular", "Django", "Flask",
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Git",
  "Data Analysis", "Machine Learning", "Excel", "Power BI", "Tableau",
  "Project Management", "Agile / Scrum", "Communication", "Leadership",
  "Problem Solving", "Team Collaboration", "Figma", "Adobe Photoshop",
  "Adobe Illustrator", "UI/UX Design", "Content Writing", "SEO",
  "Digital Marketing", "Social Media Marketing", "Sales", "Negotiation",
  "Customer Service", "Financial Modeling", "Accounting", "Bookkeeping",
  "AutoCAD", "Public Speaking", "Time Management",
];

export const COMPANIES = [
  "Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix", "Tesla",
  "IBM", "Oracle", "Salesforce", "Adobe", "Intel", "Samsung", "Uber",
  "Airbnb", "Deloitte", "Accenture", "PwC", "EY", "KPMG", "TCS",
  "Infosys", "Wipro", "HDFC Bank", "Systems Limited", "NetSol",
  "Careem", "Daraz", "Foodpanda",
];

export const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "internship", label: "Internship" },
  { id: "freelance", label: "Freelance" },
  { id: "remote", label: "Remote" },
];

// Generic fuzzy search over a list of strings or {id,label} objects.
// Case-insensitive, whitespace tolerant, partial/substring match.
export function fuzzySearch(list, query, limit = 8) {
  const q = (query || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  const normalized = list.map((item) =>
    typeof item === "string" ? { id: item, label: item } : item
  );
  return normalized
    .filter((item) => item.label.toLowerCase().includes(q))
    .slice(0, limit);
}

// ── User history (per-field, localStorage-backed) ──────────────────────
// Guests and logged-in users both get local suggestion memory; this is
// intentionally lightweight (not synced to backend) so it works offline.
const HISTORY_PREFIX = "jg_history_";
const HISTORY_LIMIT = 8;

export function getFieldHistory(key) {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

export function addFieldHistory(key, value) {
  const v = (value || "").trim();
  if (!v) return;
  try {
    const existing = getFieldHistory(key).filter(
      (item) => item.toLowerCase() !== v.toLowerCase()
    );
    existing.unshift(v);
    localStorage.setItem(
      HISTORY_PREFIX + key,
      JSON.stringify(existing.slice(0, HISTORY_LIMIT))
    );
  } catch (_) {
    // localStorage unavailable — history is a nice-to-have, fail silently
  }
}
