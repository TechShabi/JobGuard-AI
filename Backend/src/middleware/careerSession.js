const User = require("../models/User");
const careerSessionService = require("../services/careerSessionService");

// gateFeature(featureKey) is the ONE reusable checkpoint every AI-powered
// route passes through. No module re-implements usage tracking or plan
// checks on its own — they all defer to this middleware + careerSessionService.
//
// Usage: router.post("/analyze", optionalAuth, gateFeature("resume_review"), controller.analyze)
//
// On success it attaches:
//   req.careerUser    → the fully-loaded Sequelize User row (logged-in only)
//   req.careerFeature → the feature key being gated
// so the controller can call consumeCareerSession(req) once the AI call
// actually succeeds.
function gateFeature(featureKey) {
  return async (req, res, next) => {
    try {
      // Guests (no JWT) — governed purely by guestAccess in careerConfig.
      if (!req.user?.id) {
        const access = careerSessionService.checkGuestAccess(featureKey);
        if (!access.allowed) {
          return res.status(403).json({
            success: false,
            code: "UPGRADE_REQUIRED",
            message: access.message.body,
            reason: access.reason,
            feature: featureKey,
            requiredMembership: access.requiredMembership,
            upgrade: access.message,
          });
        }
        req.careerFeature = featureKey;
        return next();
      }

      // Logged-in member — check against their real membership + session pool.
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: "User not found" });
      }

      await careerSessionService.ensureCycle(user);
      const access = careerSessionService.checkAccess(user, featureKey);

      if (!access.allowed) {
        // Log the blocked attempt so it still shows up in career activity.
        await careerSessionService.consumeSession(user, featureKey, { status: "blocked" });
        return res.status(403).json({
          success: false,
          code: "UPGRADE_REQUIRED",
          message: access.message.body,
          reason: access.reason,
          feature: featureKey,
          requiredMembership: access.requiredMembership,
          upgrade: access.message,
          careerSessions: access.status,
        });
      }

      req.careerUser = user;
      req.careerFeature = featureKey;
      return next();
    } catch (error) {
      console.error("careerSession gate error:", error);
      return res.status(500).json({ success: false, message: "Permission check failed" });
    }
  };
}

// Call from a controller AFTER the AI call has succeeded, so failed calls
// never cost the member a Career Session.
async function consumeCareerSession(req) {
  if (!req.careerUser || !req.careerFeature) return null;
  return careerSessionService.consumeSession(req.careerUser, req.careerFeature, {
    status: "completed",
  });
}

module.exports = { gateFeature, consumeCareerSession };
