const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// A Career Focus represents ONE career direction the user is actively
// pursuing (e.g. "MERN Backend Developer"). Opportunity, Resume, and
// Interview all read the active focus (or the focus explicitly passed in
// a request) as shared context — see careerFocusService.js.
//
// Starter/Go: at most 1 row per user may have is_active=true (enforced in
// careerFocusService.js, not just the UI — product-spec section 30/35).
// Pro: multiple rows may be is_active=true; the user switches which one
// is "current" via last_used_at (most-recently-used = the default focus
// when a request doesn't specify one explicitly).
//
// This is a NEW, dedicated entity rather than overloading Context (which
// is a short-lived "what job posting are we discussing right now" record
// created per verification/resume/interview event, not a durable career
// direction) or OpportunitySearch (one row per search event). Career
// Focus is the thing those already-existing records now optionally
// belong to (see career_focus_id on OpportunitySearch/SavedOpportunity/
// InterviewSession below).
const CareerFocus = sequelize.define(
  "CareerFocus",
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
    name: {
      // User-facing label, e.g. "MERN Backend Developer"
      type: DataTypes.STRING,
      allowNull: false,
    },
    target_role: {
      type: DataTypes.STRING,
      allowNull: true,
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
    work_mode: {
      // any | remote | onsite | hybrid
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "any",
    },
    experience_level: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Whether this focus currently counts toward the user's active-focus
    // limit (Starter/Go: max 1; Pro: unlimited). A user can archive a
    // focus (is_active=false) without deleting its history.
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Which focus is "current" for requests that don't explicitly name
    // one — the most recently used focus. Updated whenever
    // Opportunity/Resume/Interview operate under this focus.
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "career_focuses",
    timestamps: true,
    indexes: [
      { fields: ["user_id", "is_active"], name: "career_focuses_user_active" },
      { fields: ["user_id", "last_used_at"], name: "career_focuses_user_last_used" },
    ],
  }
);

module.exports = CareerFocus;
