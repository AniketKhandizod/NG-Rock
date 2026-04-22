const express = require("express");
const { sendSuccess } = require("../utils/apiSend");
const { formatIstIso } = require("../utils/time");
const config = require("../config/env");
const dataRoutes = require("./dataRoutes");

const router = express.Router();

/**
 * Public liveness (Railway / load balancers) — no API key, no secrets in response.
 */
router.get("/health", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
        status: "success",
        message: "OK",
        data: {
            service: "data-api",
            uptimeSeconds: process.uptime(),
            environment: config.nodeEnv,
            time: formatIstIso()
        },
        error: null,
        requestId: req.id,
        timestamp: formatIstIso()
    });
});

/**
 * API discovery (public).
 */
router.get("/", (req, res) => {
    sendSuccess(res, req, 200, "Data API — all write/read routes are under /data and require x-api-key", {
        version: "1.0.0",
        dataRoutes: {
            listIndexes: "GET /data",
            getAll: "GET /data/all",
            getOne: "GET /data/:index",
            create: "POST /data",
            update: "PUT /data/:index",
            remove: "DELETE /data/:index"
        }
    });
});

router.use("/data", dataRoutes);

module.exports = router;
