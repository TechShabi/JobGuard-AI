import API, { PublicAPI } from "./api";

const getInterviewAPI = () => {
  const token = localStorage.getItem("token");
  return token ? API : PublicAPI;
};

export const startInterviewService = (payload) =>
  getInterviewAPI().post("/interview/start", payload);

// Live (adaptive) mode only — always requires an authenticated user, same
// as list/getOne/delete below, so this always uses API (never PublicAPI).
export const nextInterviewStepService = (payload) => API.post("/interview/next", payload);

export const finishInterviewService = (payload) =>
  getInterviewAPI().post("/interview/finish", payload);

export const listInterviewsService = () => API.get("/interview");
export const getInterviewService = (id) => API.get(`/interview/${id}`);
export const deleteInterviewService = (id) => API.delete(`/interview/${id}`);
