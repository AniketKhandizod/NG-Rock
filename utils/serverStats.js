const os = require("os");

/**
 * Human-readable host / region label for logs.
 * Optional: set SERVER_LOCATION in env (e.g. `ap-south-1` or `mumbai-prod`).
 */
function getServerLocationLabel() {
    return (
        (process.env.SERVER_LOCATION && String(process.env.SERVER_LOCATION).trim()) ||
        (process.env.RAILWAY_REGION && String(process.env.RAILWAY_REGION).trim()) ||
        os.hostname() ||
        "unknown-host"
    );
}

/**
 * System memory use % and 1-minute load average (when available).
 * On Windows, load average is often 0 — we show `L1m n/a`.
 */
function formatRamCpu() {
    const total = os.totalmem();
    let ramPart = "RAM —%";
    if (total > 0) {
        const pct = Math.round(((total - os.freemem()) / total) * 100);
        ramPart = `RAM ${pct}%`;
    }
    const [a, b, c] = os.loadavg();
    const winZero = process.platform === "win32" && a === 0 && b === 0 && c === 0;
    const loadPart = winZero ? "CPU L1m n/a" : `CPU L1m ${a.toFixed(2)}`;
    return `${ramPart} ${loadPart}`;
}

module.exports = { getServerLocationLabel, formatRamCpu };
