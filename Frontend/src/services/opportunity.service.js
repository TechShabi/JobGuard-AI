import API, { PublicAPI } from "./api";

const getAPI = () => {
  const token = localStorage.getItem("token");
  return token ? API : PublicAPI;
};

export const findOpportunitiesService = (payload) =>
  getAPI().post("/opportunity/find", payload);

export const getRecentSearchesService = () => getAPI().get("/opportunity/recent");

export const getSavedOpportunitiesService = (status) =>
  getAPI().get("/opportunity/saved", { params: status ? { status } : {} });

export const upsertSavedOpportunityService = (payload) =>
  getAPI().post("/opportunity/saved", payload);

export const removeSavedOpportunityService = (externalId) =>
  getAPI().delete(`/opportunity/saved/${encodeURIComponent(externalId)}`);

export const recommendNextService = (payload) =>
  getAPI().post("/opportunity/recommend", payload);
