const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ScanHistory = sequelize.define("ScanHistory", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM("url", "image", "description"),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  scam_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  verdict: {
    type: DataTypes.STRING,
    defaultValue: "Unknown",
  },
  ai_response: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "scanhistories",
  timestamps: true,
});

module.exports = ScanHistory;