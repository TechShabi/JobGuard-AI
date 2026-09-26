import API from "./api";

export const getDashboardStats = () => API.get("/dashboard/stats");
export const getDashboardHistory = () => API.get("/dashboard/history");
export const deleteScan = (id) => API.delete(`/dashboard/history/${id}`);