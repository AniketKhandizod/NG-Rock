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

/** Upper bound for the delay below (avoids accidental huge waits). */
const MAX_DELAY_SECONDS = 50;

/**
 * Artificial delay before each request is handled (seconds). Edit this value only — not from env.
 * Example: `1` → wait 1s before route handlers; `0` → no delay (good for ngrok / slow-client tests).
 */
const REQUEST_DELAY_SECONDS = 10;

const effectiveRequestDelaySeconds = Math.min(
    MAX_DELAY_SECONDS,
    Math.max(0, Math.floor(Number(REQUEST_DELAY_SECONDS)) || 0)
);
if (Number(REQUEST_DELAY_SECONDS) > MAX_DELAY_SECONDS) {
    console.warn(
        `[config] REQUEST_DELAY_SECONDS (${REQUEST_DELAY_SECONDS}) capped at ${MAX_DELAY_SECONDS}s`
    );
}
const REQUEST_DELAY_MS = effectiveRequestDelaySeconds * 1000;

const AUTH = {
    API_KEY: "api_live_Uz7XkL9mQa3sVp5RjY2wTnHd8Ef4Bc6P",
    BEARER: "bear_live_JwT9XkLmPqRsTnUvWxYz123456789",
    BASIC_USER: "system.integration@sell.do",
    BASIC_PASS: "A9#kLm2!Pq7@Zx4$Rt8!Nv3#Bd"
};

// =====================================================
// EXPRESS INIT
// =====================================================
const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10mb" }));

// =====================================================
// REQUEST ID + START TIME (for logging & duration)
// =====================================================
app.use((req, res, next) => {
    req.requestId = uuidv4();
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
// TIME FORMAT → HH:MM:SS (local)
// =====================================================
function getTimeStamp() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

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
        `[${getTimeStamp()}]`,
        `${res.statusCode}`,
        `${req.method}`,
        req.originalUrl || req.url,
        `total=${totalMs}ms`,
        `delay=${effectiveRequestDelaySeconds}s`,
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
// GET LATEST INDEX (NO AUTH REQUIRED)
// =====================================================
app.get("/webhook/latest-index", (req, res) => {
    try {
        const data = safeReadFile();

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(200).json({ Index: 0 });
        }

        const last = data[data.length - 1];

        if (!last || typeof last.index !== "number") {
            console.warn(`${getTimeStamp()} | DATA_WARNING | Invalid index structure`);
            return res.status(200).json({ Index: 0 });
        }

        return res.status(200).json({
            Index: last.index
        });
    } catch (error) {
        console.error(`${getTimeStamp()} | ERROR | latest-index`, error);
        return res.status(500).json({
            success: false,
            errorCode: "LATEST_INDEX_FETCH_FAILED",
            message: "Failed to fetch latest index safely"
        });
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
            `${getTimeStamp()} | LOAD_PROTECT | CPU:${cpu.toFixed(1)}% MEM:${mem.toFixed(1)}% LAG:${lag}ms`
        );

        return res.status(429).json({
            success: false,
            errorCode: "SYSTEM_OVERLOAD",
            message: "System busy, try later"
        });
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
        console.error(`${getTimeStamp()} | FILE_READ_ERROR`, err.message);
        return [];
    }
}

function safeWriteFile(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`${getTimeStamp()} | FILE_WRITE_ERROR`, err.message);
        throw err;
    }
}

// =====================================================
// DAILY CLEANUP AT 1 AM
// =====================================================
function scheduleCleanup() {
    function delay() {
        const now = new Date();
        const next = new Date();
        next.setHours(1, 0, 0, 0);
        if (now > next) next.setDate(next.getDate() + 1);
        return next - now;
    }

    function run() {
        try {
            safeWriteFile([]);
            console.log(`${getTimeStamp()} | CLEANUP | webhook-data.json cleared`);
        } catch (err) {
            console.error(`${getTimeStamp()} | CLEANUP_FAILED`, err.message);
        }
        setTimeout(run, 86400000);
    }

    setTimeout(run, delay());
}
scheduleCleanup();

// =====================================================
// RESPONSE FORMAT
// =====================================================
const ApiResponse = {
    success: (data = {}, message = "OK") => ({
        success: true,
        message,
        data
    }),
    error: (code, message) => ({
        success: false,
        errorCode: code,
        message
    })
};

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
    if (req.headers["x-api-key"] !== AUTH.API_KEY)
        return res.status(401).json(ApiResponse.error("INVALID_API_KEY", "Invalid API Key"));
    next();
}

function bearerAuth(req, res, next) {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (token !== AUTH.BEARER)
        return res.status(401).json(ApiResponse.error("INVALID_BEARER", "Invalid Bearer Token"));
    next();
}

function basicAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Basic "))
        return res.status(401).json(ApiResponse.error("INVALID_BASIC", "Missing Basic Auth"));

    const decoded = Buffer.from(auth.split(" ")[1], "base64").toString();
    const [user, pass] = decoded.split(":");

    if (user !== AUTH.BASIC_USER || pass !== AUTH.BASIC_PASS)
        return res.status(401).json(ApiResponse.error("INVALID_BASIC", "Invalid Credentials"));

    next();
}

// =====================================================
// CORE WEBHOOK STORAGE
// =====================================================
function storeWebhook(payload) {
    const data = safeReadFile();

    const record = {
        index: data.length + 1,
        receivedAt: new Date().toISOString(),
        payload
    };

    data.push(record);
    safeWriteFile(data);

    return record;
}

function getWebhook(index) {
    return safeReadFile().find((x) => x.index === index);
}

// =====================================================
// ROUTE FACTORY
// =====================================================
function registerRoutes(base, auth = null) {
    const mid = auth ? [auth] : [];

    app.post(base, ...mid, (req, res) => {
        try {
            if (!req.body || !Object.keys(req.body).length)
                return res.status(400).json(ApiResponse.error("EMPTY", "Payload empty"));

            const r = storeWebhook(req.body);

            return res.json(ApiResponse.success({ index: r.index }));
        } catch (e) {
            console.error(`${getTimeStamp()} | STORE_FAIL`, e.message);
            return res.status(500).json(ApiResponse.error("STORE_FAIL", e.message));
        }
    });

    app.get(`${base}/:index`, ...mid, (req, res) => {
        try {
            const index = validateIndex(req.params.index);
            const rec = getWebhook(index);

            if (!rec) return res.status(404).json(ApiResponse.error("NOT_FOUND", "Webhook not found"));

            return res.json(ApiResponse.success(rec));
        } catch (e) {
            return res.status(400).json(ApiResponse.error("BAD_REQUEST", e.message));
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
// HEALTH
// =====================================================
app.get("/health", (req, res) => {
    res.json(ApiResponse.success({ uptime: process.uptime() }));
});

// =====================================================
// 404
// =====================================================
app.use((req, res) => {
    res.status(404).json(ApiResponse.error("NOT_FOUND", "Route not found"));
});

// =====================================================
// JSON BODY PARSE & OTHER EXPRESS ERRORS
// =====================================================
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json(ApiResponse.error("INVALID_JSON", "Request body must be valid JSON"));
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json(ApiResponse.error("PAYLOAD_TOO_LARGE", "Request body exceeds limit"));
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
    console.error(`[${getTimeStamp()}] UNHANDLED`, req.requestId, err);
    res.status(500).json(ApiResponse.error("UNHANDLED", "Internal server error"));
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
app.listen(PORT, () => {
    console.log("=================================");
    console.log("Webhook Server Started");
    console.log("Port:", PORT);
    console.log(
        "REQUEST_DELAY_SECONDS (variable):",
        REQUEST_DELAY_SECONDS,
        `→ effective ${effectiveRequestDelaySeconds}s (${REQUEST_DELAY_MS}ms before handling)`
    );
    console.log("=================================");
});
