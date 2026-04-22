/**
 * Centralised configuration.
 * Railway injects PORT. Optional: .env for local PORT only.
 */
const path = require("path");
const nodeEnv = process.env.NODE_ENV || "development";

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const port = Number(process.env.PORT) || 3000;
if (!Number.isInteger(port) || port < 1) {
    throw new Error("Invalid PORT");
}

module.exports = {
    port,
    nodeEnv,
    isProduction: nodeEnv === "production",
    isRailway: Boolean(process.env.RAILWAY_ENVIRONMENT)
};
