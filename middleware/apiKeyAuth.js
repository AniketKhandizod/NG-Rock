const config = require("../config/env");
const { error: errBody } = require("../utils/response");
const { formatIstIso } = require("../utils/time");

/**
 * Resolve client key from common header names (Postman often uses `API_KEY` by mistake).
 */
function getClientApiKey(req) {
    const h = req.headers;
    const candidates = [
        h["x-api-key"],
        h["x-apikey"],
        h["api-key"],
        h["api_key"],
        h["apikey"]
    ];
    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim();
    }
    return null;
}

/**
 * Requires an API key header to match configured API_KEY / APT_KEY.
 */
function apiKeyAuth(req, res, next) {
    const meta = { requestId: req.id, timestamp: formatIstIso() };
    if (!config.isAuthReady) {
        return res.status(503).json({
            ...errBody("Data API is not configured yet: missing API_KEY", {
                code: "SERVICE_NOT_CONFIGURED",
                details:
                    "Railway → NG-Rock → Variables: set API_KEY (or APT_KEY) to your secret, then Deploy. " +
                    "Request header: x-api-key (or API_KEY) must match that value."
            }),
            ...meta
        });
    }
    const key = getClientApiKey(req);
    if (!key) {
        return res.status(401).json({
            ...errBody("Authentication required", {
                code: "UNAUTHORIZED",
                details: "Send header x-api-key (or API_KEY) with the same value as Railway API_KEY / APT_KEY"
            }),
            ...meta
        });
    }
    if (key !== config.apiKey) {
        return res.status(401).json({
            ...errBody("Invalid API key", {
                code: "UNAUTHORIZED",
                details: "The x-api-key value is not valid"
            }),
            ...meta
        });
    }
    next();
}

module.exports = apiKeyAuth;
