/**
 * Operational error with HTTP status and optional error code (for `error` field in JSON).
 */
class AppError extends Error {
    constructor(statusCode, message, code = "ERROR", details = null) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        if (typeof Error.captureStackTrace === "function") {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

module.exports = AppError;
