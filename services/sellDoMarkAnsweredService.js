const AppError = require("../utils/AppError");
const { baseUrl: SELL_BASE } = require("../config/sellDo");

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_PER_PAGE = 15;
const IVR_TOTAL_DURATION_DEFAULT = 12121212;

/**
 * @param {number} n
 * @returns {string}
 */
function randomHexString(n) {
    const chars = "abcdef0123456789";
    let s = "";
    for (let i = 0; i < n; i += 1) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
}

/**
 * Calendar day in Asia/Kolkata as DD-MM-YYYY
 * @param {Date} d
 * @returns {string}
 */
function toIstDdMmYyyy(d) {
    const p = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).formatToParts(d);
    const day = p.find((x) => x.type === "day")?.value;
    const month = p.find((x) => x.type === "month")?.value;
    const year = p.find((x) => x.type === "year")?.value;
    return `${day}-${month}-${year}`;
}

/**
 * @param {number} addDays
 * @returns {Date}
 */
function istCalendarAddMs(addDays) {
    const t = new Date();
    return new Date(t.getTime() + addDays * 86400 * 1000);
}

/**
 * Build `date_range_start` / `date_range_end` (match Postman: start ≈ 30d ago, end = tomorrow, IST).
 */
function buildDefaultDateRange() {
    return {
        date_range_start: toIstDdMmYyyy(istCalendarAddMs(-DEFAULT_LOOKBACK_DAYS)),
        date_range_end: toIstDdMmYyyy(istCalendarAddMs(1))
    };
}

/**
 * @param {string} u
 * @param {Record<string, string>} [headers]
 * @returns {Promise<{ ok: boolean, status: number, data: any, text: string }>}
 */
async function doFetchJson(u, { method = "GET", body = null, headers = {} } = {}) {
    const h = { Accept: "application/json", ...headers };
    if (body && method !== "GET") {
        h["Content-Type"] = "application/json";
    }
    const r = await fetch(u, { method, headers: h, body: body != null ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { _raw: text };
    }
    return { ok: r.ok, status: r.status, data, text };
}

/**
 * Page through GET /client/calls.json with status=placed
 */
async function fetchCallsPage({ apiKey, clientId, page, perPage, range }) {
    const p = new URLSearchParams();
    p.set("filter_type", "Call");
    p.set("search_attributes[direction]", "all");
    p.set("search_attributes[date_range_start]", range.date_range_start);
    p.set("search_attributes[date_range_end]", range.date_range_end);
    p.set("retrieve_lead_data", "true");
    p.set("search_attributes[status]", "placed");
    p.set("page", String(page));
    p.set("per_page", String(perPage));
    p.set("api_key", apiKey);
    p.set("client_id", clientId);
    const url = `${SELL_BASE}/client/calls.json?${p.toString()}`;
    return doFetchJson(url, { method: "GET" });
}

/**
 * @param {object} p
 * @param {string} p.apiKey
 * @param {string} p.clientId
 * @param {string} p.leadId
 * @param {string} p.callId
 * @param {string} p.remoteId
 * @param {number} p.totalDuration
 */
async function putCallRemoteId({ apiKey, clientId, leadId, callId, remoteId }) {
    const url = `${SELL_BASE}/client/leads/${encodeURIComponent(leadId)}/calls/${encodeURIComponent(callId)}`;
    return doFetchJson(url, {
        method: "PUT",
        body: { api_key: apiKey, client_id: clientId, remote_id: remoteId }
    });
}

/**
 * @param {object} p
 * @param {string} p.clientId
 * @param {string} p.remoteId
 * @param {number} p.totalDuration
 */
async function postIvrConnected({ clientId, remoteId, totalDuration }) {
    const url = `${SELL_BASE}/ivr/generic/mcube_v2/${encodeURIComponent(clientId)}`;
    return doFetchJson(url, {
        method: "POST",
        body: {
            remote_id: remoteId,
            status: "CONNECTED",
            total_duration: totalDuration
        }
    });
}

/**
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.clientId
 * @param {string} [o.dateRangeStart] DD-MM-YYYY in IST; default window from service
 * @param {string} [o.dateRangeEnd] DD-MM-YYYY in IST
 * @param {number} [o.perPage]
 * @param {number} [o.ivrTotalDuration] default 12121212 if not from call
 * @param {number} [o.delayMs] between call updates
 */
async function markAllPlacedCallsAnswered({
    apiKey,
    clientId,
    dateRangeStart,
    dateRangeEnd,
    perPage = DEFAULT_PER_PAGE,
    ivrTotalDuration = IVR_TOTAL_DURATION_DEFAULT,
    delayMs = 150
}) {
    if (!apiKey || !String(apiKey).trim() || !clientId || !String(clientId).trim()) {
        throw new AppError(400, "api_key and client_id are required", "VALIDATION_ERROR");
    }

    const range = {
        date_range_start: dateRangeStart || buildDefaultDateRange().date_range_start,
        date_range_end: dateRangeEnd || buildDefaultDateRange().date_range_end
    };

    const summary = {
        dateRange: range,
        pagesFetched: 0,
        sellDoTotalFromList: null,
        totalCallsFromApi: 0,
        placedCandidates: 0,
        processed: 0,
        ok: 0,
        failed: 0,
        results: /** @type {any[]} */ ([])
    };

    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const { ok, status, data } = await fetchCallsPage({ apiKey, clientId, page, perPage, range });
        summary.pagesFetched += 1;
        if (!ok) {
            throw new AppError(502, `sell.do list calls failed (HTTP ${status})`, "SELL_DO_LIST", {
                page,
                body: data
            });
        }

        const results = Array.isArray(data?.results) ? data.results : [];
        if (page === 1) {
            summary.sellDoTotalFromList = data?.total;
        }
        summary.totalCallsFromApi += results.length;

        if (results.length === 0) {
            hasMore = false;
            break;
        }

        for (const row of results) {
            const c = row?.call;
            if (!c?._id || !c?.lead_id) {
                continue;
            }
            if (c.status !== "placed") {
                continue;
            }
            summary.placedCandidates += 1;
            const remoteId = randomHexString(24);
            const callId = c._id;
            const leadId = c.lead_id;
            const durationFromCall = Number(c.duration) >= 0 ? Number(c.duration) : ivrTotalDuration;

            const one = { callId, leadId, remoteId, steps: { put: null, ivr: null } };

            const putRes = await putCallRemoteId({ apiKey, clientId, leadId, callId, remoteId });
            one.steps.put = { status: putRes.status, ok: putRes.ok, body: putRes.data };
            if (!putRes.ok) {
                one.error = "put_remote_id_failed";
                summary.failed += 1;
                summary.processed += 1;
                summary.results.push(one);
                continue;
            }

            if (delayMs) {
                await new Promise((r) => setTimeout(r, delayMs));
            }

            const ivr = await postIvrConnected({ clientId, remoteId, totalDuration: durationFromCall || ivrTotalDuration });
            one.steps.ivr = { status: ivr.status, ok: ivr.ok, body: ivr.data };
            if (!ivr.ok) {
                one.error = "ivr_connect_failed";
                summary.failed += 1;
            } else {
                summary.ok += 1;
            }
            summary.processed += 1;
            summary.results.push(one);
        }

        if (results.length < perPage) {
            hasMore = false;
        } else {
            page += 1;
        }
    }

    return summary;
}

module.exports = {
    markAllPlacedCallsAnswered,
    toIstDdMmYyyy,
    buildDefaultDateRange,
    IVR_TOTAL_DURATION_DEFAULT
};
