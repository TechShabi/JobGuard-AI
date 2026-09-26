const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const { MEMBERSHIP_IDS } = require("../config/careerConfig");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // ── Career Growth Membership architecture ──────────────────────────
  // Every logged-in user belongs to exactly one Career Growth Membership.
  // Never expose this raw value to messaging without going through
  // careerConfig — this column is an internal implementation detail.
  membership: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: MEMBERSHIP_IDS.STARTER,
  },
  // Career Sessions consumed in the current cycle. Reset to 0 whenever
  // sessions_cycle_start rolls over (see careerSessionService.ensureCycle).
  sessions_used: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  sessions_cycle_start: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  // Sprint 6 — Admin Portal. Existing users remain "user" via defaultValue.
  role: {
    type: DataTypes.ENUM("user", "admin"),
    allowNull: false,
    defaultValue: "user",
  },
}, {
  tableName: "users",
  timestamps: true,
});

module.exports = User;