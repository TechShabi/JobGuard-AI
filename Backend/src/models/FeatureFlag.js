const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

/**
 * Minimal persistent feature-flag store (Admin Panel Evolution, section 14).
 * Deliberately small — a name/description/on-off switch plus an optional
 * scope string, not a targeting/rollout-percentage system. Every change is
 * audited via auditLogService (see adminController.updateFeatureFlag) and
 * records who changed it and when.
 */
const FeatureFlag = sequelize.define(
  "FeatureFlag",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      // stable machine identifier, e.g. "opportunity_live_discovery"
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    scope: {
      // free-text scope note (e.g. "all users", "admin only") — not an
      // enforcement mechanism by itself, just an operational label
      type: DataTypes.STRING,
      allowNull: true,
    },
    updated_by: {
      // admin user id of the last change — nullable (e.g. seed data)
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "feature_flags",
    timestamps: true,
  }
);

module.exports = FeatureFlag;
