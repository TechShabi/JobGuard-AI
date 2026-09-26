const User = require("../models/User");

/**
 * Admin authorization middleware.
 * MUST run AFTER the required auth middleware (req.user set from JWT).
 *
 * Security rule: do NOT trust JWT role alone. Always verify CURRENT
 * database role so demotions take effect before the 7-day JWT expires.
 */
module.exports = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "role", "email", "username"],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.adminUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return next();
  } catch (error) {
    console.error("admin middleware error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Authorization check failed",
    });
  }
};
