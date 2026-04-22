/**
 * Consistent API envelope (as per product contract).
 * Success: error is null. Error: data is null, error is populated.
 */
function success(message, data = null) {
    return {
        status: "success",
        message,
        data: data === undefined ? null : data,
        error: null
    };
}

function error(message, errPayload = {}) {
    return {
        status: "error",
        message,
        data: null,
        error:
            errPayload && typeof errPayload === "object" && !Array.isArray(errPayload)
                ? { ...errPayload }
                : { detail: errPayload }
    };
}

module.exports = { success, error };
