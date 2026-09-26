import API, { PublicAPI } from "./api";

// ✅ Guest = PublicAPI, Logged in = API (with token)
const getVerifyAPI = () => {
  const token = localStorage.getItem("token");
  return token ? API : PublicAPI;
};

export const verifyDescription = (description) =>
  getVerifyAPI().post("/verify/description", { description });

export const verifyUrl = (url) =>
  getVerifyAPI().post("/verify/url", { url });

export const verifyImage = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return getVerifyAPI().post("/verify/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};