const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// User-marked opportunities: saved / viewed / applied (explicit user action only).
const SavedOpportunity = sequelize.define(
  "SavedOpportunity",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    external_id: {
      // Stable id from the discovery provider / normalized result
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      // saved | viewed | applied
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "saved",
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    source_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    source_platform: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Full normalized opportunity payload at the time of save (for offline restore).
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    verification: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "saved_opportunities",
    timestamps: true,
    indexes: [
      { fields: ["user_id", "external_id"], unique: true },
      { fields: ["user_id", "status"] },
    ],
  }
);

module.exports = SavedOpportunity;
