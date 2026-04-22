const { randomUUID } = require("crypto");
const { formatIst24hTime } = require("../utils/time");
const { getServerLocationLabel, formatRamCpu } = require("../utils/serverStats");

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
        return String(forwarded[0]).trim();
    }
    return req.socket?.remoteAddress || req.ip || "unknown";
}

/**
 * One readable line per completed request:
 * {{>>}} {HH:mm:ss IST} | {location} | {RAM% + CPU L1m} | {METHOD path} | {client IP} | {status} {ms}
 */
function requestLogger(req, res, next) {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1e6;
        const time = `${formatIst24hTime()} IST`;
        const location = getServerLocationLabel();
        const resources = formatRamCpu();
        const endpoint = `${req.method} ${req.originalUrl || req.url}`;
        const ip = getClientIp(req);
        const status = res.statusCode;
        // eslint-disable-next-line no-console
        console.log(
            `{{>>}} ${time} | ${location} | ${resources} | ${endpoint} | ${ip} | ${status} ${ms.toFixed(0)}ms`
        );
    });
    next();
}

module.exports = requestLogger;
