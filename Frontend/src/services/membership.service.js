import API from "./api";

export const getMembershipPlansService = () => API.get("/membership/plans");

export const getMyMembershipService = () => API.get("/membership/me");

/**
 * Paid plans return CHECKOUT_REQUIRED. Prefer startCheckout / createCheckoutService.
 */
export const upgradeMembershipService = (membership) =>
  API.post("/membership/upgrade", { membership });

export const getCareerActivityService = (limit) =>
  API.get("/membership/activity", { params: limit ? { limit } : {} });

// Paid-interest validation (Zero-cost MVP) — own records only.
export const requestMembershipInterestService = (planId, source = "pricing_page") =>
  API.post("/membership/interest", { plan_id: planId, source });

export const getMyMembershipInterestsService = () => API.get("/membership/interest");

export const createCheckoutService = (payload) =>
  API.post("/billing/checkout", payload);

export const confirmMockCheckoutService = (payload) =>
  API.post("/billing/mock/confirm", payload);

export const getSubscriptionService = () => API.get("/billing/subscription");

export const cancelSubscriptionService = () =>
  API.post("/billing/subscription/cancel");
