export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

export const isValidPhone = (v) => !v || /^[+\d][\d\s\-()]{6,}$/.test(v.trim());

export const isValidUrl = (v) => {
  if (!v || !v.trim()) return true; // optional fields
  try {
    new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return true;
  } catch (_) {
    return false;
  }
};

export const isNonEmpty = (v) => !!(v || "").trim();
