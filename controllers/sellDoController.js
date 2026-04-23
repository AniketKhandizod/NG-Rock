const { markAllPlacedCallsAnswered } = require("../services/sellDoMarkAnsweredService");
const { sendSuccess } = require("../utils/apiSend");
const AppError = require("../utils/AppError");

/**
 * POST /sell-do/mark-placed-answered
 * Body: { "api_key", "client_id", ...optional } — fetches `status=placed` calls (paginated) from sell.do,
 * generates remote_id, PUTs each call, then IVR `CONNECTED` (same flow as your Postman chain).
 */
async function markPlacedAnswered(req, res, next) {
    try {
        const b = req.body;
        if (!b || typeof b !== "object") {
            return next(new AppError(400, "JSON body is required", "VALIDATION_ERROR"));
        }
        const { api_key: apiKey, client_id: clientId } = b;
        if (!apiKey || !String(apiKey).trim() || !clientId || !String(clientId).trim()) {
            return next(
                new AppError(400, "body must include api_key and client_id (sell.do credentials)", "VALIDATION_ERROR")
            );
        }

        const perPage = b.per_page != null ? Math.min(100, Math.max(1, Number(b.per_page))) : undefined;
        const delayMs = b.delay_ms != null ? Math.max(0, Number(b.delay_ms)) : undefined;
        const ivrTotalDuration =
            b.ivr_total_duration != null ? Math.max(0, Number(b.ivr_total_duration)) : undefined;

        if (b.per_page != null && !Number.isFinite(perPage)) {
            return next(new AppError(400, "per_page must be a number", "VALIDATION_ERROR"));
        }

        const out = await markAllPlacedCallsAnswered({
            apiKey: String(apiKey).trim(),
            clientId: String(clientId).trim(),
            dateRangeStart: b.date_range_start ? String(b.date_range_start).trim() : undefined,
            dateRangeEnd: b.date_range_end ? String(b.date_range_end).trim() : undefined,
            perPage,
            ivrTotalDuration,
            delayMs
        });

        sendSuccess(
            res,
            req,
            200,
            "Completed: list placed → update remote_id → IVR CONNECTED (see results for per-call status)",
            out
        );
    } catch (e) {
        next(e);
    }
}

module.exports = { markPlacedAnswered };
