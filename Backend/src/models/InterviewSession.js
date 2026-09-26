const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const InterviewSession = sequelize.define(
  "InterviewSession",
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
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    experience: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("in_progress", "completed"),
      defaultValue: "in_progress",
    },
    questions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    report: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    interview_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    question_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    used_resume: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    used_opportunity: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Server-side authoritative flag for the adaptive ("live") engine's own
    // completion decision, independent of `status` (in_progress/completed)
    // which tracks report generation. Batch (practice/timed) sessions leave
    // this false/unused. Live-mode turn-by-turn Q&A reuses the existing
    // `questions` field (same {question,type,answer_type,answer,skipped}
    // shape already used by batch mode) instead of a second, duplicate
    // transcript column — one schema for "the questions asked this
    // session", regardless of mode.
    live_complete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "interview_sessions",
    timestamps: true,
    indexes: [
      { fields: ["user_id", "createdAt"], name: "interview_sessions_user_created" },
    ],
  }
);

module.exports = InterviewSession;
