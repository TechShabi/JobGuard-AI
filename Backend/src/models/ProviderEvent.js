const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

/**
 * Webhook / provider event idempotency ledger.
 * Unique (provider, provider_event_id) — duplicate delivery is a safe no-op.
 */
const ProviderEvent = sequelize.define(
  "ProviderEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    provider_event_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    event_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    result: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payload_summary: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "provider_events",
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["provider", "provider_event_id"],
        name: "provider_events_unique",
      },
    ],
  }
);

module.exports = ProviderEvent;
