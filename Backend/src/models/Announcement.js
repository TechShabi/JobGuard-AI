const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

/**
 * Minimal announcement model (Admin Panel Evolution, section 15). Title +
 * message + active flag + optional scheduling window — not a CMS. User-
 * facing rendering is out of scope for this pass (admin management only,
 * per the task's stated scope); this just gives Admin a real place to
 * create/edit/activate announcements with audited changes.
 */
const Announcement = sequelize.define(
  "Announcement",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "announcements",
    timestamps: true,
  }
);

module.exports = Announcement;
