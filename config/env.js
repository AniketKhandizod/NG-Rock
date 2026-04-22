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
const trimmed = rawApiKey && String(rawApiKey).trim();
const keyPresent = Boolean(trimmed);

/**
 * In production, if API_KEY is missing the process no longer exits (so Railway health checks
 * can pass). If `API_KEY` is unset in production, `/data` routes return 503 until you add it.
 * Non-production falls back to a dev default for local work.
 */
let apiKey;
if (keyPresent) {
    apiKey = trimmed;
} else if (!isProduction) {
    apiKey = "dev-insecure-key-change-via-api-key-env";
} else {
    apiKey = null;
    // eslint-disable-next-line no-console
    console.warn(
        "[config] API_KEY is not set. Add it in Railway → Variables, then redeploy. " +
            "GET / will stay up; /data/* returns 503 until API_KEY is configured."
    );
}

module.exports = {
    port,
    /** Secret used for `x-api-key` (null in production if unset). */
    apiKey,
    /** If false, production has no API_KEY: `/data` returns 503 until Variables are set. */
    isAuthReady: keyPresent || !isProduction,
    nodeEnv,
    isProduction,
    isRailway: Boolean(process.env.RAILWAY_ENVIRONMENT)
};
