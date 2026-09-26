import API, { PublicAPI } from "./api";

// ✅ Guest = PublicAPI, Logged in = API (with token) — same pattern as verify.service.js
const getExtractAPI = () => {
  const token = localStorage.getItem("token");
  return token ? API : PublicAPI;
};

export const extractJobFromUrlService = (url) =>
  getExtractAPI().post("/context/extract-url", { url });

export const extractJobFromDescriptionService = (description) =>
  getExtractAPI().post("/context/extract-description", { description });

export const extractJobFromImageService = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return getExtractAPI().post("/context/extract-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
