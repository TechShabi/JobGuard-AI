import API from "./api";

export const loginService = (data) => API.post("/auth/login", data);
export const registerService = (data) => API.post("/auth/register", data);
export const getMeService = () => API.get("/auth/me");