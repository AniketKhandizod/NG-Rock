/**
 * Centralised configuration.
 * Railway: PORT is injected. Set API_KEY in Variables. NODE_ENV=production for prod checks.
 * Local: copy .env.example to .env (optional) or export API_KEY.
 */
const path = require("path");
const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const port = Number(process.env.PORT) || 3000;
if (!Number.isInteger(port) || port < 1) {
    throw new Error("Invalid PORT");
}

const rawApiKey = process.env.API_KEY;
if (isProduction && (!rawApiKey || !String(rawApiKey).trim())) {
    // eslint-disable-next-line no-console
    console.error("FATAL: API_KEY is required in production (Railway Variables).");
    process.exit(1);
}

module.exports = {
    port,
    /**
     * Default for local dev only. Production must set API_KEY in Railway.
     */
    apiKey: (rawApiKey && String(rawApiKey).trim()) || "dev-insecure-key-change-via-api-key-env",
    nodeEnv,
    isProduction,
    isRailway: Boolean(process.env.RAILWAY_ENVIRONMENT)
};
