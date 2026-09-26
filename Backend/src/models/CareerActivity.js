const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// One row per meaningful AI career interaction (or blocked attempt).
// Powers "Recent Career Activity" on the Career Growth Profile and gives
// the business a single, centralized usage ledger instead of scattering
// counters across every feature module.
const CareerActivity = sequelize.define(
  "CareerActivity",
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
    feature_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    feature_label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    session_cost: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("completed", "blocked"),
      allowNull: false,
      defaultValue: "completed",
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "career_activities",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["user_id", "createdAt"], name: "career_activities_user_created" },
    ],
  }
);

module.exports = CareerActivity;
