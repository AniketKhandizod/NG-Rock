const { randomUUID } = require("crypto");
const { formatIstLogLine } = require("../utils/time");

/**
 * Assigns a request id (also returned as X-Request-Id) and logs one line per request:
 * IST time, method, path, status, response time in ms.
 */
function requestLogger(req, res, next) {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1e6;
        const method = req.method;
        const url = req.originalUrl || req.url;
        const status = res.statusCode;
        // eslint-disable-next-line no-console
        console.log(
            `[${formatIstLogLine()}] ${method} ${url} ${status} ${ms.toFixed(1)}ms id=${req.id}`
        );
    });
    next();
}

module.exports = requestLogger;
