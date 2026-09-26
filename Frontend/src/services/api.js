// api.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ✅ Main API — with token
const API = axios.create({ baseURL: BASE_URL });

API.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Career Growth Membership: single shared upgrade hook ──────────────
// AuthProvider registers a handler here on mount. Any AI feature call that
// gets blocked by the backend's shared permission layer (403 +
// code: "UPGRADE_REQUIRED") surfaces the same UpgradeModal, from anywhere,
// without every page having to wire this up individually.
let upgradeRequiredHandler = null;
export function setUpgradeRequiredHandler(fn) {
  upgradeRequiredHandler = fn;
}

function handleResponseError(error) {
  const status = error.response?.status;
  const url = error.config?.url || '';
  const code = error.response?.data?.code;

  if (status === 403 && code === "UPGRADE_REQUIRED") {
    if (upgradeRequiredHandler) upgradeRequiredHandler(error.response.data);
    // The shared UpgradeModal already renders the full { title, body, cta }.
    // Flatten `message` to a plain string here so every existing page that
    // does `err.response?.data?.message` (written before this feature
    // existed) keeps working instead of rendering "[object Object]".
    if (error.response.data && typeof error.response.data.message === "object") {
      error.response.data.message = error.response.data.message.title || "Upgrade required to continue.";
    }
  }

  const isVerifyRoute =
    url.includes('/verify/url') ||
    url.includes('/verify/image') ||
    url.includes('/verify/description');

  if (status === 401 && !isVerifyRoute) {
    localStorage.removeItem("token");
    window.location.href = '/login';
  }

  return Promise.reject(error);
}

API.interceptors.response.use(response => response, handleResponseError);

// ✅ Public API — without token (verify ke liye)
export const PublicAPI = axios.create({ baseURL: BASE_URL });
PublicAPI.interceptors.response.use(response => response, handleResponseError);

export default API;