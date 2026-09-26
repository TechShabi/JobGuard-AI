import API, { PublicAPI } from "./api";

const getResumeAPI = () => {
  const token = localStorage.getItem("token");
  return token ? API : PublicAPI;
};

// ── Resume Review ──
export const analyzeResumeService = (file, { role, experience, description }) => {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("role", role);
  if (experience) formData.append("experience", experience);
  if (description) formData.append("description", description);
  return getResumeAPI().post("/resume/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ── Optimize (OPTIONAL, separate AI call, only after review is shown) ──
export const optimizeResumeService = (
  file,
  { role, experience, description },
  { weaknesses, priority_fixes, missing_skills, user_edits } = {},
) => {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("role", role);
  if (experience) formData.append("experience", experience);
  if (description) formData.append("description", description);
  if (weaknesses) formData.append("weaknesses", JSON.stringify(weaknesses));
  if (priority_fixes) formData.append("priority_fixes", JSON.stringify(priority_fixes));
  if (missing_skills) formData.append("missing_skills", JSON.stringify(missing_skills));
  if (user_edits) formData.append("user_edits", JSON.stringify(user_edits));
  return getResumeAPI().post("/resume/optimize", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ── Resume Builder ──
export const generateResumeService = (role, profileData) =>
  API.post("/resume/generate", { role, profileData });

export const getResumeProfileService = () => API.get("/resume/profile");
export const updateResumeProfileService = (profileData) => API.put("/resume/profile", profileData);

// ── History ──
export const listResumesService = (source) =>
  API.get("/resume", { params: source ? { source } : {} });
export const getResumeService = (id) => API.get(`/resume/${id}`);
export const deleteResumeService = (id) => API.delete(`/resume/${id}`);
