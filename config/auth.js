/**
 * Load after `env` so `.env` is applied for local dev.
 * Railway: set **BEARER_TOKEN** in the service Variables (same value you send as `Authorization: Bearer …`).
 * Do not commit real secrets; only placeholder in `.env.example`.
 */
require("./env");

const trimmed = (process.env.BEARER_TOKEN && String(process.env.BEARER_TOKEN).trim()) || "";
const isBearerReady = Boolean(trimmed);

module.exports = {
    /** Resolved secret, or `""` if unset. */
    BEARER_TOKEN: trimmed,
    isBearerReady
};
