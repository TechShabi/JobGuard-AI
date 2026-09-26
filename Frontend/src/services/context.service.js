import API from "./api";

export const getActiveContextService = () => API.get("/context");

export const createContextService = (payload) => API.post("/context", payload);

export const clearContextService = () => API.delete("/context");
