// =====================================================
// IMPORTS
// =====================================================
const express = require("express");
const fs = require("fs");
const path = require("path");
const helmet = require("helmet");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

// =====================================================
// CONFIG
// =====================================================
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, "webhook-data.json");
const IS_RAILWAY = Boolean(process.env.RAILWAY_ENVIRONMENT);
const IS_PROD = process.env.NODE_ENV === "production" || IS_RAILWAY;

/**
 * Logs and API `timestamp` fields use Asia/Kolkata (IST) for local readability in India.
 * Override the whole process timezone on Railway: TZ=Asia/Kolkata (optional; app still formats explicitly).
 */
const TZ_IST = "Asia/Kolkata";

/** Upper bound for the delay below (avoids accidental huge waits). */
const MAX_DELAY_SECONDS = 50;

/**
 * Per-request delay (ms) before business logic. Default 0 on Railway/production, else env or 0.
 * Set e.g. WEBHOOK_REQUEST_DELAY_MS=1000 to simulate slow clients.
 */
const REQUEST_DELAY_MS = (() => {
    const fromEnv = process.env.WEBHOOK_REQUEST_DELAY_MS;
    if (fromEnv !== undefined && fromEnv !== "") {
        const n = Math.min(MAX_DELAY_SECONDS * 1000, Math.max(0, Number(fromEnv) || 0));
        return n;
    }
    if (IS_PROD) return 0;
    return 0;
})();

if (Number(process.env.WEBHOOK_REQUEST_DELAY_MS) > MAX_DELAY_SECONDS * 1000) {
    console.warn(`[config] WEBHOOK_REQUEST_DELAY_MS capped at ${MAX_DELAY_SECONDS}s`);
}

/** Credentials: set on Railway (Variables); fallbacks for local/Postman. */
const AUTH = {
    API_KEY: process.env.WEBHOOK_API_KEY || "api_live_Uz7XkL9mQa3sVp5RjY2wTnHd8Ef4Bc6P",
    BEARER: process.env.WEBHOOK_BEARER || "bear_live_JwT9XkLmPqRsTnUvWxYz123456789",
    BASIC_USER: process.env.WEBHOOK_BASIC_USER || "system.integration@sell.do",
    BASIC_PASS: process.env.WEBHOOK_BASIC_PASS || "A9#kLm2!Pq7@Zx4$Rt8!Nv3#Bd"
};

/** For console lines (India Standard Time). */
function formatIstForLogs(date = new Date()) {
    try {
        return (
            new Intl.DateTimeFormat("en-IN", {
                timeZone: TZ_IST,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }).format(date) + " IST"
        );
    } catch {
        return String(date);
    }
}

/**
 * API-facing ISO-like timestamp in IST (India has fixed UTC+05:30, no DST).
 * Example: 2026-04-22T15:30:45+05:30
 */
function formatTimestampIstIso(date = new Date()) {
    try {
        const s = new Date(date).toLocaleString("sv-SE", { timeZone: TZ_IST });
        const head = s.includes("T") ? s.split("T") : s.split(" ");
        const d = (head[0] || "").replace(/\//g, "-");
        const t = (s.includes("T") ? s.split("T")[1] : s.split(" ")[1] || "").split(".")[0] || "00:00:00";
        if (!d) return new Date(date).toISOString();
        return `${d}T${t}+05:30`;
    } catch {
        return new Date().toISOString();
    }
}

// =====================================================
// EXPRESS INIT
// =====================================================
const app = express();
app.disable("x-powered-by");
// Railway, Heroku, and other reverse proxies: correct req.ip / X-Forwarded-* usage
app.set("trust proxy", 1);
app.set("strict routing", false);
app.use(helmet());
app.use(express.json({ limit: "10mb" }));

// =====================================================
// REQUEST ID + START TIME (for logging & duration)
// =====================================================
app.use((req, res, next) => {
    const incoming = req.headers["x-request-id"] || req.headers["x-correlation-id"];
    req.requestId = (typeof incoming === "string" && incoming.trim() ? incoming.trim() : null) || uuidv4();
    res.setHeader("X-Request-Id", req.requestId);
    req.startedAt = Date.now();
    next();
});

// =====================================================
// OPTIONAL ARTIFICIAL DELAY (per request, after body parse)
// =====================================================
app.use(async (req, res, next) => {
    if (REQUEST_DELAY_MS <= 0) return next();
    try {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
        next();
    } catch (err) {
        next(err);
    }
});

// =====================================================
// CLIENT INFO (for consolidated log on response finish)
// =====================================================
app.use((req, res, next) => {
    const forwarded = req.headers["x-forwarded-for"];
    req.clientIp =
        (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) ||
        req.socket?.remoteAddress ||
        "unknown";
    req.clientUa = req.headers["user-agent"] || "unknown";
    next();
});

// =====================================================
// AUDIT / REQUEST LOG (single readable line per completed request)
// =====================================================
function extractCredential(req) {
    try {
        if (req.headers["x-api-key"]) return "api_key_present";
        if (req.headers.authorization?.startsWith("Bearer ")) return "bearer_present";
        if (req.headers.authorization?.startsWith("Basic ")) return "basic_present";
        return "no_auth";
    } catch {
        return "cred_parse_error";
    }
}

function truncate(str, max = 80) {
    if (!str || str.length <= max) return str;
    return `${str.slice(0, max - 1)}…`;
}

function logRequestComplete(req, res) {
    const totalMs = Date.now() - (req.startedAt || Date.now());
    const parts = [
        `[${formatIstForLogs()}]`,
        `${res.statusCode}`,
        `${req.method}`,
        req.originalUrl || req.url,
        `total=${totalMs}ms`,
        `preDelayMs=${REQUEST_DELAY_MS}`,
        `id=${req.requestId}`,
        `ip=${req.clientIp}`,
        `auth=${extractCredential(req)}`,
        `ua=${truncate(req.clientUa, 100)}`
    ];
    console.log(parts.join(" | "));
}

app.use((req, res, next) => {
    res.on("finish", () => logRequestComplete(req, res));
    next();
});

// =====================================================
// GET LATEST INDEX (NO AUTH — Postman uses response.Index)
// =====================================================
app.get("/webhook/latest-index", (req, res) => {
    try {
        const data = safeReadFile();

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(200).json({ Index: 0, ...apiMeta(req) });
        }

        const last = data[data.length - 1];

        if (!last || typeof last.index !== "number") {
            console.warn(`${formatIstForLogs()} | DATA_WARNING | Invalid index structure`);
            return res.status(200).json({ Index: 0, ...apiMeta(req) });
        }

        return res.status(200).json({ Index: last.index, ...apiMeta(req) });
    } catch (error) {
        console.error(`${formatIstForLogs()} | ERROR | latest-index`, error);
        return res.status(500).json(
            jsonError(req, "LATEST_INDEX_FETCH_FAILED", "Failed to fetch latest index safely")
        );
    }
});

// =====================================================
// ADAPTIVE SYSTEM LOAD PROTECTION
// =====================================================
let eventLoopLag = 0;

setInterval(() => {
    const start = Date.now();
    setImmediate(() => {
        eventLoopLag = Date.now() - start;
    });
}, 500);

function cpuUsage() {
    const cpus = os.cpus()?.length || 1;
    return (os.loadavg()[0] / cpus) * 100;
}

function memoryUsage() {
    return ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
}

app.use((req, res, next) => {
    const cpu = cpuUsage();
    const mem = memoryUsage();
    const lag = eventLoopLag;

    if (cpu > 85 || mem > 85 || lag > 250) {
        console.warn(
            `${formatIstForLogs()} | LOAD_PROTECT | CPU:${cpu.toFixed(1)}% MEM:${mem.toFixed(1)}% LAG:${lag}ms`
        );

        return res
            .status(429)
            .set("Retry-After", "10")
            .json(jsonError(req, "SYSTEM_OVERLOAD", "Service temporarily unavailable; try again after a short wait"));
    }

    next();
});

// =====================================================
// SAFE FILE HANDLING
// =====================================================
function safeReadFile() {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        console.error(`${formatIstForLogs()} | FILE_READ_ERROR`, err.message);
        return [];
    }
}

function safeWriteFile(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`${formatIstForLogs()} | FILE_WRITE_ERROR`, err.message);
        throw err;
    }
}

// =====================================================
// DAILY CLEANUP — 1:00 AM (Asia/Kolkata, IST)
// =====================================================
function getIstParts(date = new Date()) {
    const p = new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ_IST,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(date);
    const get = (t) => Number(p.find((x) => x.type === t)?.value || 0);
    return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
}

let lastCleanupIstYmd = null;

function scheduleCleanupIst1Am() {
    const run = () => {
        const now = new Date();
        const { y, m, d, h, min } = getIstParts(now);
        const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        if (h === 1 && min === 0 && ymd !== lastCleanupIstYmd) {
            lastCleanupIstYmd = ymd;
            try {
                safeWriteFile([]);
                console.log(`${formatIstForLogs()} | CLEANUP_IST_1AM | webhook-data.json cleared (Asia/Kolkata)`);
            } catch (err) {
                console.error(`${formatIstForLogs()} | CLEANUP_FAILED`, err.message);
            }
        }
    };
    setInterval(run, 30_000);
    run();
}
scheduleCleanupIst1Am();

// =====================================================
// RESPONSE FORMAT (problem-style JSON: code, message, requestId, timestamp)
// =====================================================
function apiMeta(req) {
    return {
        requestId: req.requestId,
        timestamp: formatTimestampIstIso()
    };
}

function jsonSuccess(req, data = {}, message = "OK") {
    return { success: true, message, data, ...apiMeta(req) };
}

function jsonError(req, errorCode, message) {
    return { success: false, errorCode, message, ...apiMeta(req) };
}

// =====================================================
// VALIDATION
// =====================================================
function validateIndex(i) {
    const n = Number(i);
    if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_INDEX");
    return n;
}

// =====================================================
// AUTH MIDDLEWARES
// =====================================================
function apiKeyAuth(req, res, next) {
    if (req.headers["x-api-key"] !== AUTH.API_KEY) {
        return res
            .status(401)
            .json(jsonError(req, "INVALID_API_KEY", "The x-api-key header is missing or invalid"));
    }
    next();
}

function bearerAuth(req, res, next) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (token !== AUTH.BEARER) {
        return res
            .status(401)
            .set("WWW-Authenticate", 'Bearer realm="webhook", error="invalid_token"')
            .json(jsonError(req, "INVALID_BEARER", "The Bearer access token is missing or invalid"));
    }
    next();
}

function basicAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Basic ")) {
        return res
            .status(401)
            .set("WWW-Authenticate", 'Basic realm="Webhook", charset="UTF-8"')
            .json(jsonError(req, "INVALID_BASIC", "Basic authentication is required (Authorization: Basic ...)"));
    }

    const decoded = Buffer.from(auth.split(" ")[1] || "", "base64").toString("utf8");
    const [user, ...rest] = decoded.split(":");
    const pass = rest.join(":");

    if (user !== AUTH.BASIC_USER || pass !== AUTH.BASIC_PASS) {
        return res
            .status(401)
            .set("WWW-Authenticate", 'Basic realm="Webhook", charset="UTF-8"')
            .json(jsonError(req, "INVALID_BASIC", "Invalid basic authentication credentials"));
    }
    next();
}

// =====================================================
// CORE WEBHOOK STORAGE
// =====================================================
function storeWebhook(payload) {
    const data = safeReadFile();

    const now = new Date();
    const record = {
        index: data.length + 1,
        receivedAt: now.toISOString(),
        receivedAtIst: formatTimestampIstIso(now),
        payload
    };

    data.push(record);
    safeWriteFile(data);

    return record;
}

function getWebhook(index) {
    return safeReadFile().find((x) => x.index === index);
}

function normalizeQueryPayload(query) {
    if (!query || typeof query !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(query)) {
        if (k === "json" || k === "payload" || k === "data") {
            if (typeof v === "string" && v.trim() !== "") {
                try {
                    const parsed = JSON.parse(v);
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        Object.assign(out, parsed);
                    }
                } catch {
                    out[k] = v;
                }
            }
        } else if (v !== undefined) {
            out[k] = v;
        }
    }
    return out;
}

// =====================================================
// ROUTE FACTORY
// =====================================================
function registerRoutes(base, auth = null) {
    const mid = auth ? [auth] : [];
    const collectionPaths = [base, base.endsWith("/") ? base.slice(0, -1) : `${base}/`].filter(
        (p, i, a) => a.indexOf(p) === i
    );

    const postHandler = (req, res) => {
        try {
            if (!req.body || !Object.keys(req.body).length)
                return res.status(400).json(jsonError(req, "EMPTY", "Request body must be a non-empty JSON object"));

            const r = storeWebhook(req.body);

            return res.status(200).json(jsonSuccess(req, { index: r.index }, "OK"));
        } catch (e) {
            console.error(`${formatIstForLogs()} | STORE_FAIL`, e.message);
            const out = jsonError(req, "STORE_FAIL", "Could not persist webhook");
            if (!IS_PROD) out.detail = e.message;
            return res.status(500).json(out);
        }
    };

    // POST: accept JSON body (industry default for webhooks)
    app.post(collectionPaths, ...mid, postHandler);

    // GET: same store as POST, from query (browsers, simple integrations, or ?text=PASS)
    const getIngestHandler = (req, res) => {
        try {
            const fromQuery = normalizeQueryPayload(req.query);
            if (!fromQuery || !Object.keys(fromQuery).length) {
                return res.status(200).json(
                    jsonSuccess(
                        req,
                        {
                            hint: "Add query parameters to store data (e.g. ?text=PASS) or use POST with a JSON body.",
                            fetchByIndex: `GET ${base}/<positive integer>`,
                            viaPost: `POST ${base} with Content-Type: application/json`
                        },
                        "No query parameters to store"
                    )
                );
            }
            const r = storeWebhook(fromQuery);
            return res.status(200).json(jsonSuccess(req, { index: r.index, via: "GET" }, "OK"));
        } catch (e) {
            console.error(`${formatIstForLogs()} | STORE_FAIL`, e.message);
            const out = jsonError(req, "STORE_FAIL", "Could not persist webhook");
            if (!IS_PROD) out.detail = e.message;
            return res.status(500).json(out);
        }
    };
    app.get(collectionPaths, ...mid, getIngestHandler);

    // HEAD/OPTIONS: safe for health checks and CORS preflight
    const headHandler = (req, res) => {
        res.set("Allow", "POST, GET, OPTIONS, HEAD");
        res.set("Accept", "application/json, text/plain, */*");
        return res.status(204).end();
    };
    app.head(collectionPaths, ...mid, headHandler);
    app.options(collectionPaths, ...mid, (req, res) => {
        res.set("Allow", "POST, GET, HEAD, OPTIONS");
        res.set("Accept", "application/json");
        return res.status(204).end();
    });

    // GET single record by index
    app.get(`${base}/:index`, ...mid, (req, res) => {
        try {
            const index = validateIndex(req.params.index);
            const rec = getWebhook(index);

            if (!rec) return res.status(404).json(jsonError(req, "NOT_FOUND", "No stored webhook for this index"));

            return res.status(200).json(jsonSuccess(req, rec, "OK"));
        } catch (e) {
            return res.status(400).json(jsonError(req, "BAD_REQUEST", e.message || "Invalid index"));
        }
    });
}

// =====================================================
// REGISTER ROUTES
// =====================================================
registerRoutes("/webhook");
registerRoutes("/webhook/api_key", apiKeyAuth);
registerRoutes("/webhook/berartoken", bearerAuth);
registerRoutes("/webhook/basicauthentication", basicAuth);

// =====================================================
// ROOT (Railway & manual checks without /health)
// =====================================================
app.get("/", (req, res) => {
    res.json(
        jsonSuccess(
            req,
            {
                service: "webhook-server",
                environment: IS_RAILWAY ? "railway" : "local",
                docs: "Postman: set NG_URL to https://<project>.up.railway.app (no trailing slash).",
                endpoints: {
                    postWebhook: "POST /webhook (JSON body)",
                    getWebhook: "GET /webhook?key=value&… (optional; prefer POST for secrets)",
                    getLatestIndex: "GET /webhook/latest-index  →  { Index }",
                    getByIndex: "GET /webhook/:index",
                    health: "GET /health"
                }
            },
            "OK"
        )
    );
});

// =====================================================
// HEALTH
// =====================================================
app.get("/health", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(200).json(
        jsonSuccess(
            req,
            {
                status: "ok",
                uptimeSeconds: process.uptime(),
                ts: formatTimestampIstIso()
            },
            "OK"
        )
    );
});

// =====================================================
// 404
// =====================================================
app.use((req, res) => {
    res.status(404).json(jsonError(req, "NOT_FOUND", "No route matches this request method and path"));
});

// =====================================================
// JSON BODY PARSE & OTHER EXPRESS ERRORS
// =====================================================
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res
            .status(400)
            .json(jsonError(req, "INVALID_JSON", "The request body must be valid application/json"));
    }
    if (err && err.type === "entity.too.large") {
        return res
            .status(413)
            .json(jsonError(req, "PAYLOAD_TOO_LARGE", "Request body is larger than the allowed limit (10mb)"));
    }
    next(err);
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    console.error(`[${formatIstForLogs()}] UNHANDLED`, req.requestId, err);
    const out = jsonError(req, "INTERNAL_ERROR", "An unexpected error occurred on the server");
    if (!IS_PROD) out.detail = err && err.message ? String(err.message) : String(err);
    res.status(500).json(out);
});

process.on("unhandledRejection", (reason) => {
    console.error("[process] unhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
    console.error("[process] uncaughtException", err);
    process.exit(1);
});

// =====================================================
// START SERVER
// =====================================================
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("Webhook Server Started");
    console.log("Port:", PORT);
    console.log("Timestamps: Asia/Kolkata (IST) in logs and API `timestamp` fields");
    if (IS_RAILWAY) console.log("Railway: set WEBHOOK_* env for credentials; public URL in NG_URL (Postman).");
    console.log("WEBHOOK_REQUEST_DELAY_MS →", REQUEST_DELAY_MS, "ms (0 = none, recommended for Railway).");
    console.log("=================================");
});

function shutdown(signal) {
    return () => {
        console.log(`[${formatIstForLogs()}] ${signal} — closing server`);
        server.close((err) => {
            if (err) {
                console.error("shutdown error", err);
                process.exit(1);
            }
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 15_000).unref();
    };
}
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
