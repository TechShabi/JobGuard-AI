const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AdminAuditLog = sequelize.define(
  "AdminAuditLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    target_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    target_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    before: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    after: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "admin_audit_logs",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["createdAt"], name: "admin_audit_logs_created" },
      { fields: ["admin_id", "createdAt"], name: "admin_audit_logs_admin_id_created" },
    ],
  }
);

module.exports = AdminAuditLog;
