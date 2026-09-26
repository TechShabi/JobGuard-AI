const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// One row per user. Yahi "Profile remembered data" hai jo Resume Builder
// autofill karta hai — Name, Phone, Email, GitHub, Portfolio, LinkedIn,
// Education, Previous Projects, Previous Companies, etc.
const ResumeProfile = sequelize.define(
  "ResumeProfile",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    preferred_role: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    experience_level: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    industry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: { type: DataTypes.STRING, allowNull: true },
    github: { type: DataTypes.STRING, allowNull: true },
    linkedin: { type: DataTypes.STRING, allowNull: true },
    portfolio: { type: DataTypes.STRING, allowNull: true },

    // Dynamic / role-specific + repeatable sections stored as JSON.
    // education: [{school, degree, field, start, end}]
    // experience: [{company, title, start, end, description}]
    // projects: [{name, description, link}]
    // skills: [string]
    // role_specific: { license, hospital, subjects, ... } — role ke hisaab se
    education: { type: DataTypes.JSON, allowNull: true },
    experience: { type: DataTypes.JSON, allowNull: true },
    projects: { type: DataTypes.JSON, allowNull: true },
    skills: { type: DataTypes.JSON, allowNull: true },
    role_specific: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: "resume_profiles",
    timestamps: true,
  }
);

module.exports = ResumeProfile;
