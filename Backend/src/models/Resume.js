const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Har Resume Review ya Resume Builder run ka record — History tab ke liye.
const Resume = sequelize.define(
  "Resume",
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
    source: {
      type: DataTypes.ENUM("review", "builder"),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    original_filename: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Review ke liye: analysis result (ats, grammar, formatting, job_match, missing_skills...)
    analysis: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    // Builder / improved resume ka structured content (renders to PDF on frontend)
    resume_data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ats_score: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Future-ready hook for resume version history (see product audit).
    // Nullable, unused today — when a version chain is built later, this
    // just needs to start getting populated, no schema change required.
    parent_resume_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "resumes",
    timestamps: true,
    indexes: [
      { fields: ["user_id", "createdAt"], name: "resumes_user_created" },
    ],
  }
);

module.exports = Resume;
