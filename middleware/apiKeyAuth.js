const config = require("../config/env");
const { error: errBody } = require("../utils/response");
const { formatIstIso } = require("../utils/time");

/**
 * Requires `x-api-key` header to match configured API_KEY.
 */
function apiKeyAuth(req, res, next) {
    const meta = { requestId: req.id, timestamp: formatIstIso() };
    if (!config.isAuthReady) {
        return res.status(503).json({
            ...errBody("Data API is not configured yet: missing API_KEY", {
                code: "SERVICE_NOT_CONFIGURED",
                details:
                    "In Railway: open the NG-Rock service → Variables → add API_KEY (any long random string) → " +
                    "Redeploy. Public / and /health work without a key; /data requires x-api-key after that."
            }),
            ...meta
        });
    }
    const key = req.headers["x-api-key"];
    if (typeof key !== "string" || !key.trim()) {
        return res.status(401).json({
            ...errBody("Authentication required", {
                code: "UNAUTHORIZED",
                details: "Provide a valid x-api-key header"
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
