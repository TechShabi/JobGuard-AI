const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

/**
 * Zero-cost MVP paid-interest signal.
 *
 * Recorded when a logged-in user asks for early access to a paid plan from
 * the Pricing page. This is a DEMAND SIGNAL only:
 *   - it NEVER creates a Subscription or PaymentTransaction
 *   - it NEVER changes User.membership
 *   - it NEVER marks any payment as succeeded
 *
 * One row per (user_id, plan_id) — re-requesting the same plan while a
 * request is already "requested"/"contacted" is rejected as a duplicate.
 * A previously "cancelled" request can be reactivated instead of creating
 * a second row.
 */
const MembershipInterest = sequelize.define(
  "MembershipInterest",
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
      // careerConfig membership id: plus (Go) | pro — starter never needs interest
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("requested", "contacted", "converted", "cancelled"),
      allowNull: false,
      defaultValue: "requested",
    },
    source: {
      // where the request originated, e.g. "pricing_page", "upgrade_modal"
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pricing_page",
    },
    requested_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "membership_interests",
    timestamps: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["plan_id"] },
      { fields: ["status"] },
      {
        unique: true,
        fields: ["user_id", "plan_id"],
        name: "membership_interests_user_plan_unique",
      },
    ],
  }
);

module.exports = MembershipInterest;
