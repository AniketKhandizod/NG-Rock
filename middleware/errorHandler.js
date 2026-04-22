const AppError = require("../utils/AppError");
const { error: errEnvelope } = require("../utils/response");
const { formatIstIso } = require("../utils/time");

function notFoundHandler(req, res, next) {
    const e = new AppError(404, `Cannot ${req.method} ${req.originalUrl}`, "NOT_FOUND");
    next(e);
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    const meta = { requestId: req.id, timestamp: formatIstIso() };

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            ...errEnvelope(err.message, {
                code: err.code,
                ...(err.details != null ? { details: err.details } : {})
            }),
            ...meta
        });
    }

    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            ...errEnvelope("Invalid JSON in request body", { code: "INVALID_JSON" }),
            ...meta
        });
    }

    if (err && err.type === "entity.too.large") {
        return res.status(413).json({
            ...errEnvelope("Request body too large", { code: "PAYLOAD_TOO_LARGE" }),
            ...meta
        });
    }

    // eslint-disable-next-line no-console
    console.error(`[${formatIstIso()}]`, req.id, err);
    return res.status(500).json({
        ...errEnvelope("Internal server error", { code: "INTERNAL_ERROR" }),
        ...meta
    });
}

module.exports = { notFoundHandler, errorHandler };
