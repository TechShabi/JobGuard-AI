const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { registerValidation, validate } = require("../middleware/validation");
const security = require("../middleware/security");
const { authLimiter } = require("../middleware/rateLimiter");

router.post(
  "/register",
  authLimiter,
  registerValidation,
  validate,
  authController.register
);

router.post("/login", authLimiter, authController.login);

router.get("/me", security, authController.me);

module.exports = router;
