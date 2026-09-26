const { Sequelize } = require("sequelize");
require("dotenv").config();

// Sprint 9 — explicit pool for predictable concurrency under the
// single-process Node deployment. Defaults are conservative; override
// via env without requiring env vars for boot.
const poolMax = Math.max(1, parseInt(process.env.DB_POOL_MAX, 10) || 10);
const poolMin = Math.max(0, parseInt(process.env.DB_POOL_MIN, 10) || 0);
const poolAcquire = Math.max(1000, parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000);
const poolIdle = Math.max(1000, parseInt(process.env.DB_POOL_IDLE, 10) || 10000);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    logging: false,
    pool: {
      max: poolMax,
      min: poolMin,
      acquire: poolAcquire,
      idle: poolIdle,
    },
  }
);

module.exports = sequelize;
