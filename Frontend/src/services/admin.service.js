import API from "./api";

export const getAdminStats = (params = {}) => API.get("/admin/stats", { params });

export const getAdminUsers = (params = {}) =>
  API.get("/admin/users", { params });

export const getAdminUserDetail = (id) => API.get(`/admin/users/${id}`);

export const getAdminVerifications = (params = {}) =>
  API.get("/admin/verifications", { params });

export const getAdminReports = (params = {}) =>
  API.get("/admin/reports", { params });

export const updateAdminReportStatus = (id, payload) =>
  API.patch(`/admin/reports/${id}/status`, payload);

export const getAdminAuditLog = (params = {}) =>
  API.get("/admin/audit-log", { params });

export const getAdminAiUsage = (params = {}) =>
  API.get("/admin/ai-usage", { params });

// ── Admin Panel Evolution ──────────────────────────────────────────────
export const getAdminCareerSessions = (params = {}) =>
  API.get("/admin/career-sessions", { params });

export const getAdminOpportunityOperations = (params = {}) =>
  API.get("/admin/opportunities/operations", { params });
export const getAdminOpportunitySearches = (params = {}) =>
  API.get("/admin/opportunities", { params });
export const getAdminOpportunitySearchDetail = (id) =>
  API.get(`/admin/opportunities/${id}`);

export const getAdminInterviewOperations = (params = {}) =>
  API.get("/admin/interviews/operations", { params });
export const getAdminInterviews = (params = {}) =>
  API.get("/admin/interviews", { params });
export const getAdminInterviewDetail = (id) => API.get(`/admin/interviews/${id}`);

export const getAdminResumeOperations = (params = {}) =>
  API.get("/admin/resumes/operations", { params });
export const getAdminResumes = (params = {}) => API.get("/admin/resumes", { params });
export const getAdminResumeDetail = (id) => API.get(`/admin/resumes/${id}`);

export const getAdminSubscriptionOverview = () => API.get("/admin/subscriptions");
export const getAdminTransactions = (params = {}) =>
  API.get("/admin/transactions", { params });

// Paid interest (Zero-cost MVP demand signal)
export const getAdminMembershipInterestOverview = () =>
  API.get("/admin/membership-interest/overview");
export const getAdminMembershipInterests = (params = {}) =>
  API.get("/admin/membership-interest", { params });
export const updateAdminMembershipInterestStatus = (id, payload) =>
  API.patch(`/admin/membership-interest/${id}`, payload);

export const getAdminFeatureFlags = () => API.get("/admin/feature-flags");
export const createAdminFeatureFlag = (payload) => API.post("/admin/feature-flags", payload);
export const updateAdminFeatureFlag = (id, payload) =>
  API.patch(`/admin/feature-flags/${id}`, payload);

export const getAdminAnnouncements = (params = {}) =>
  API.get("/admin/announcements", { params });
export const createAdminAnnouncement = (payload) => API.post("/admin/announcements", payload);
export const updateAdminAnnouncement = (id, payload) =>
  API.patch(`/admin/announcements/${id}`, payload);
