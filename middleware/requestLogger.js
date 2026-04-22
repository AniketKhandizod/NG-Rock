const { randomUUID } = require("crypto");
const { formatIst24hTime } = require("../utils/time");
const { getServerIPv4ForLogs } = require("../utils/serverStats");

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
 * IST time | Server IP | Request IP | endpoint | seconds | status
 */
function requestLogger(req, res, next) {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const serverIp = getServerIPv4ForLogs();
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1e6;
        const seconds = (ms / 1000).toFixed(4);
        const istTime = `${formatIst24hTime()} IST`;
        const requestIp = getClientIp(req);
        const endpoint = `${req.method} ${req.originalUrl || req.url}`;
        const status = res.statusCode;
        // eslint-disable-next-line no-console
        console.log(
            `${istTime} | ${serverIp} | ${requestIp} | ${endpoint} | ${seconds}s | ${status}`
        );
    });
    next();
}

module.exports = requestLogger;
