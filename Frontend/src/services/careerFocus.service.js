import API from "./api";

// Career Focus is a logged-in-only concept (see backend routes/careerFocusRoutes.js).
export const listCareerFocusesService = () => API.get("/career-focus");

export const getActiveCareerFocusService = () => API.get("/career-focus/active");

export const createCareerFocusService = (payload) => API.post("/career-focus", payload);

export const updateCareerFocusService = (id, payload) => API.patch(`/career-focus/${id}`, payload);

export const activateCareerFocusService = (id) => API.post(`/career-focus/${id}/activate`);

export const archiveCareerFocusService = (id) => API.post(`/career-focus/${id}/archive`);

export const deleteCareerFocusService = (id) => API.delete(`/career-focus/${id}`);
