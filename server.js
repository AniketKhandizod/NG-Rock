/**
 * Entry point for local runs and Railway deploys.
 * Railway injects process.env.PORT; do not hardcode a port in production.
 */
const app = require("./app");
const config = require("./config/env");

const host = "0.0.0.0";
const server = app.listen(config.port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://${host}:${config.port} (${config.nodeEnv})`);
    if (config.isRailway) {
        // eslint-disable-next-line no-console
        console.log("[server] Railway: set variable API_KEY; logs use India Standard Time (IST).");
    }
});

function shutdown(signal) {
    return () => {
        // eslint-disable-next-line no-console
        console.log(`[server] ${signal} — graceful shutdown`);
        server.close((err) => {
            if (err) {
                // eslint-disable-next-line no-console
                console.error(err);
                process.exit(1);
            }
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
}

process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
