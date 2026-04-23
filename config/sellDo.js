/**
 * sell.do v2 public API base (override with SELL_DO_BASE_URL in env if ever needed).
 */
module.exports = {
    /** @type {string} */
    baseUrl: (process.env.SELL_DO_BASE_URL && String(process.env.SELL_DO_BASE_URL).replace(/\/$/, "")) || "https://v2.sell.do"
};
