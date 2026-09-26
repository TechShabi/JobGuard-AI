import { EXPERIENCE_LEVELS } from "../data/roles";
import {
  extractJobFromUrlService,
  extractJobFromDescriptionService,
  extractJobFromImageService,
} from "../services/jobExtraction.service";

// Normalized extraction shape used everywhere downstream.
function empty(overrides = {}) {
  return {
    role: "",
    company: "",
    experience: "",
    employment_type: "",
    location: "",
    confidence: 0,
    ...overrides,
  };
}

// Backend may name fields differently — normalize whatever comes back.
function normalizeApiResult(raw) {
  if (!raw) return null;
  const payload = raw.data || raw;
  const role = payload.job_title || payload.role || payload.title || "";
  const company = payload.company || payload.employer || "";
  if (!role && !company) return null;
  return {
    role,
    company,
    experience: payload.experience_level || payload.experience || "",
    employment_type: payload.employment_type || payload.job_type || "",
    location: payload.location || "",
    confidence: typeof payload.confidence === "number" ? payload.confidence : 0.6,
  };
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

function experienceFromYears(years) {
  if (years === 0) return EXPERIENCE_LEVELS[0].label;
  if (years <= 2) return EXPERIENCE_LEVELS[1].label;
  if (years <= 5) return EXPERIENCE_LEVELS[2].label;
  return EXPERIENCE_LEVELS[3].label;
}

// ── Local heuristic fallbacks — keep auto-detect useful even offline ──────
function heuristicFromDescription(text) {
  const result = empty();
  if (!text) return result;

  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
  if (firstLine && firstLine.length <= 80 && !/[.!?]$/.test(firstLine)) {
    result.role = firstLine.replace(/^job title[:\-]\s*/i, "");
  }

  const companyMatch = text.match(/(?:at|company|employer)[:\s]+([A-Z][A-Za-z0-9&.,'\- ]{1,40})/);
  if (companyMatch) result.company = companyMatch[1].trim().replace(/[.,]$/, "");

  const empMatch = text.match(/\b(full[- ]time|part[- ]time|contract|internship|freelance|remote)\b/i);
  if (empMatch) result.employment_type = capitalize(empMatch[1].replace(/-/g, " "));

  const locMatch = text.match(/(?:location|based in|office in)[:\s]+([A-Za-z, ]{2,40})/i);
  if (locMatch) result.location = locMatch[1].trim().replace(/[.,]$/, "");

  const expMatch = text.match(/(\d+)\+?\s*(?:-\s*\d+\s*)?years?/i);
  if (expMatch) result.experience = experienceFromYears(parseInt(expMatch[1], 10));

  result.confidence = result.role || result.company ? 0.35 : 0.05;
  return result;
}

function heuristicFromUrl(rawUrl) {
  const result = empty();
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const host = u.hostname.replace(/^www\./, "").split(".")[0];
    if (host && !["jobs", "careers", "apply"].includes(host)) {
      result.company = capitalize(host);
    }
    const segs = u.pathname.split("/").filter(Boolean);
    const slug = segs.find((s) => s.length > 3 && /[a-z]/i.test(s) && !/^\d+$/.test(s));
    if (slug) {
      result.role = slug
        .replace(/[-_]/g, " ")
        .replace(/\.\w+$/, "")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    result.confidence = result.role || result.company ? 0.2 : 0.05;
  } catch (_) {
    // not a parseable URL — leave empty, user fills in manually on confirm screen
  }
  return result;
}

// ── Public API ──────────────────────────────────────────────────────────
export async function extractFromUrl(url) {
  try {
    const res = await extractJobFromUrlService(url);
    const normalized = normalizeApiResult(res?.data);
    if (normalized) return { ...normalized, source: "url" };
  } catch (_) {
    // backend extraction unavailable — fall back to heuristic below
  }
  return { ...heuristicFromUrl(url), source: "url" };
}

export async function extractFromDescription(text) {
  try {
    const res = await extractJobFromDescriptionService(text);
    const normalized = normalizeApiResult(res?.data);
    if (normalized) return { ...normalized, source: "description" };
  } catch (_) {
    // backend extraction unavailable — fall back to heuristic below
  }
  return { ...heuristicFromDescription(text), source: "description" };
}

export async function extractFromImage(file) {
  try {
    const res = await extractJobFromImageService(file);
    const normalized = normalizeApiResult(res?.data);
    if (normalized) return { ...normalized, source: "image" };
  } catch (_) {
    // no client-side OCR fallback possible — return empty so the
    // confirmation screen simply asks the user to fill it in
  }
  return { ...empty(), source: "image" };
}
