const config = require("../config/env");
const { error: errBody } = require("../utils/response");
const { formatIstIso } = require("../utils/time");

/**
 * Requires `x-api-key` header to match configured API_KEY.
 */
function apiKeyAuth(req, res, next) {
    const key = req.headers["x-api-key"];
    const meta = { requestId: req.id, timestamp: formatIstIso() };
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
