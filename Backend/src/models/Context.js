const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Context Engine table.
// Sirf 1 row `is_active: true` honi chahiye per user — enforce app-level in controller.
const Context = sequelize.define(
  "Context",
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
    source_module: {
      // kis module se context create hua
      type: DataTypes.ENUM(
        "verification",
        "resume_review",
        "resume_builder",
        "interview",
        "opportunity_find"
      ),
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    experience: {
      type: DataTypes.STRING, // e.g. "0-1", "2-4", "5+"
      allowNull: true,
    },
    source_label: {
      // display label e.g. "URL" / "Description" / "Image" (source_module stays the enum)
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      // job description / posting text, agar available ho
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "contexts",
    timestamps: true,
    indexes: [
      { fields: ["user_id", "is_active"], name: "contexts_user_active" },
      { fields: ["user_id", "createdAt"], name: "contexts_user_created" },
    ],
  }
);

module.exports = Context;
