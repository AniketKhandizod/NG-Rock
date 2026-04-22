const { success } = require("./response");
const { formatIstIso } = require("./time");

/**
 * Consistent success JSON with correation fields (Request-ID header matches).
 */
function sendSuccess(res, req, status, message, data) {
    res.status(status).json({
        ...success(message, data),
        requestId: req.id,
        timestamp: formatIstIso()
    });
}

module.exports = { sendSuccess };
