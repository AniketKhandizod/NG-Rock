const express = require("express");
const helmet = require("helmet");
const requestLogger = require("./middleware/requestLogger");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const apiRoutes = require("./routes");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("strict routing", false);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

// IST logs + X-Request-Id (before routes so every response can be traced)
app.use(requestLogger);
app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
