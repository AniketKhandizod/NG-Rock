const { BEARER_TOKEN } = require("../config/auth");
const { error: errBody } = require("../utils/response");
const { formatIstIso } = require("../utils/time");

/**
 * Reads `Authorization: Bearer <token>` and compares to configured BEARER_TOKEN.
 */
function getBearerToken(req) {
    const auth = req.headers.authorization;
    if (!auth || typeof auth !== "string") return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : null;
}

function bearerAuth(req, res, next) {
    const meta = { requestId: req.id, timestamp: formatIstIso() };
    const token = getBearerToken(req);
    if (!token) {
        return res
            .status(401)
            .set("WWW-Authenticate", 'Bearer realm="data-api", charset="UTF-8"')
            .json({
                ...errBody("Authentication required", {
                    code: "UNAUTHORIZED",
                    details: "Send: Authorization: Bearer <token> (see server config for valid token)"
                }),
                ...meta
            });
    }
    if (token !== BEARER_TOKEN) {
        return res
            .status(401)
            .set("WWW-Authenticate", 'Bearer realm="data-api", error="invalid_token"')
            .json({
                ...errBody("Invalid or expired token", {
                    code: "UNAUTHORIZED"
                }),
                ...meta
            });
    }
    next();
}

module.exports = bearerAuth;
