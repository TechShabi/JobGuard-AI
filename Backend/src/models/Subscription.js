const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

/**
 * Billing relationship for a user. Runtime entitlement remains User.membership.
 * Subscription status drives WHEN membership is activated/downgraded.
 */
const Subscription = sequelize.define(
  "Subscription",
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
      // careerConfig membership id: starter | plus (Go) | pro
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "incomplete",
        "active",
        "past_due",
        "canceling",
        "canceled",
        "expired"
      ),
      allowNull: false,
      defaultValue: "incomplete",
    },
    interval: {
      // monthly only in Sprint 7
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "monthly",
    },
    current_period_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "mock",
    },
    provider_subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pending_plan_id: {
      // scheduled downgrade target (e.g. pro → plus at period end)
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "subscriptions",
    timestamps: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["status"] },
      {
        unique: true,
        fields: ["provider", "provider_subscription_id"],
        name: "subscriptions_provider_sub_unique",
      },
    ],
  }
);

module.exports = Subscription;
