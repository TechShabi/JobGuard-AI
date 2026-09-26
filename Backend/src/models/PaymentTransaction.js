const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

/**
 * Immutable payment attempts from the application business perspective.
 * Never stores card numbers / CVV / secrets.
 */
const PaymentTransaction = sequelize.define(
  "PaymentTransaction",
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
    plan_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    provider_payment_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    provider_event_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    amount: {
      type: DataTypes.INTEGER, // minor units (cents) where applicable; 0 for free
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "usd",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "succeeded",
        "failed",
        "canceled",
        "mismatched"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    interval: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "monthly",
    },
    is_development: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "payment_transactions",
    timestamps: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["status"] },
      {
        unique: true,
        fields: ["provider", "provider_payment_id"],
        name: "payment_tx_provider_payment_unique",
      },
    ],
  }
);

module.exports = PaymentTransaction;
