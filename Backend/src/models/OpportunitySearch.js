const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Persists a user's Opportunity Find search criteria + last result snapshot.
// One row per search event (recent searches). Guests do not hit this table.
const OpportunitySearch = sequelize.define(
  "OpportunitySearch",
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
    // Nullable — older rows and searches made with no active Career Focus
    // have none. When present, ties this search back to the Career Focus
    // whose context (role/skills/location) informed it.
    career_focus_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    skills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    remote_preference: {
      // any | remote | onsite | hybrid
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "any",
    },
    experience: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    preferences: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    // Snapshot of normalized + verified results from this search (for recent restore).
    results_snapshot: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    provider: {
      // which discovery adapter ran (e.g. "development_sample", future: "adzuna")
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_live: {
      // false when results come from a development/sample provider
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Added for Admin Panel Evolution — Opportunity Operations visibility
    // (section 8: provider health, verification outcomes). Additive/nullable,
    // mirrors the discover() meta the controller already computes per search
    // rather than inventing a second data model.
    discovery_status: {
      // "live_provider" | "sample" | "unavailable" | "error"
      type: DataTypes.STRING,
      allowNull: true,
    },
    providers_used: {
      // meta.providers_used from opportunityDiscoveryService.discover() —
      // [{ id, is_live, count, note }] per provider tried this search.
      type: DataTypes.JSON,
      allowNull: true,
    },
    verified_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rejected_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Added for the Search Quality pass — tally of WHY constraint-filtered
    // candidates were hidden (role/skill/remote/location mismatch), for
    // admin/debug observability only, never shown to end users.
    rejection_breakdown: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "opportunity_searches",
    timestamps: true,
    indexes: [
      { fields: ["user_id", "createdAt"], name: "opportunity_searches_user_created" },
    ],
  }
);

module.exports = OpportunitySearch;
