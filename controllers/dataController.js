const dataService = require("../services/dataService");
const AppError = require("../utils/AppError");
const { sendSuccess } = require("../utils/apiSend");

function parseIndexParam(raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
        throw new AppError(400, "Index must be a positive integer", "INVALID_INDEX");
    }
    return n;
}

function validateJsonBody(req) {
    if (req.body === undefined) {
        throw new AppError(
            400,
            "Request body is required (valid JSON). Send Content-Type: application/json",
            "VALIDATION_ERROR"
        );
    }
}

/**
 * POST /data
 */
function createRecord(req, res, next) {
    try {
        validateJsonBody(req);
        const index = dataService.create(req.body);
        res.set("Location", `${req.baseUrl}/${index}`);
        sendSuccess(res, req, 201, "Resource created", {
            index,
            stored: req.body
        });
    } catch (e) {
        next(e);
    }
}

/**
 * GET /data — list all stored index ids
 */
function listIndexes(req, res, next) {
    try {
        const indexes = dataService.getAllIndexIds();
        sendSuccess(res, req, 200, indexes.length ? "OK" : "Store is empty", {
            indexes,
            count: indexes.length
        });
    } catch (e) {
        next(e);
    }
}

/**
 * GET /data/all — full dump
 */
function getAllRecords(req, res, next) {
    try {
        const records = dataService.getAllAsObject();
        const count = dataService.size();
        sendSuccess(res, req, 200, "OK", {
            count,
            records
        });
    } catch (e) {
        next(e);
    }
}

/**
 * GET /data/:index
 */
function getOne(req, res, next) {
    try {
        const index = parseIndexParam(req.params.index);
        const value = dataService.getByIndex(index);
        if (value === undefined) {
            throw new AppError(404, `No data found for index ${index}`, "NOT_FOUND");
        }
        sendSuccess(res, req, 200, "OK", { index, data: value });
    } catch (e) {
        next(e);
    }
}

/**
 * PUT /data/:index
 */
function updateRecord(req, res, next) {
    try {
        validateJsonBody(req);
        const index = parseIndexParam(req.params.index);
        const ok = dataService.update(index, req.body);
        if (!ok) {
            throw new AppError(404, `No data found for index ${index}`, "NOT_FOUND");
        }
        sendSuccess(res, req, 200, "Resource updated", { index, data: req.body });
    } catch (e) {
        next(e);
    }
}

/**
 * DELETE /data/:index
 */
function deleteRecord(req, res, next) {
    try {
        const index = parseIndexParam(req.params.index);
        const ok = dataService.remove(index);
        if (!ok) {
            throw new AppError(404, `No data found for index ${index}`, "NOT_FOUND");
        }
        sendSuccess(res, req, 200, "Resource deleted", { index });
    } catch (e) {
        next(e);
    }
}

module.exports = {
    createRecord,
    listIndexes,
    getAllRecords,
    getOne,
    updateRecord,
    deleteRecord
};
