/**
 * Indian Standard Time (IST) helpers for log lines: Asia/Kolkata, UTC+05:30, no DST.
 */
const TIMEZONE = "Asia/Kolkata";

function nowIst() {
    return new Date();
}

/**
 * Time only, 24h, Asia/Kolkata — e.g. `16:32:10`
 */
function formatIst24hTime(date = new Date()) {
    try {
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: TIMEZONE,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            hourCycle: "h23"
        }).format(date);
    } catch {
        const d = new Date(date);
        return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
    }
}

/**
 * One-line log timestamp, e.g. "22-04-2026, 4:32:10 pm" with IST.
 */
function formatIstLogLine(date = new Date()) {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            timeZone: TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }).format(date) + " IST";
    } catch {
        return new Date().toISOString();
    }
}

/**
 * API-facing ISO string in IST (fixed offset for India).
 */
function formatIstIso(date = new Date()) {
    try {
        const s = new Date(date).toLocaleString("sv-SE", { timeZone: TIMEZONE });
        const t = s.includes("T") ? s.split("T")[1] : s.split(" ")[1] || "00:00:00";
        const d = s.includes("T") ? s.split("T")[0] : s.split(" ")[0];
        return `${d}T${t.split(".")[0]}+05:30`;
    } catch {
        return new Date().toISOString();
    }
}

module.exports = { formatIstLogLine, formatIstIso, formatIst24hTime, nowIst, TIMEZONE };
