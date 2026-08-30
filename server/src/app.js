/**
 * Express application wiring. Kept separate from `index.js` so it can be
 * imported by tests without binding a port.
 */

import express from "express";
import compression from "compression";

import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import {
  baseSecurity,
  apiRateLimiter,
} from "./middleware/security.js";
import { requestId, notFound, errorHandler } from "./middleware/common.js";
import apiRouter from "./routes/index.js";

export function createApp() {
  const config = getConfig();
  const app = express();

  baseSecurity(app);
  app.use(compression());
  app.use(requestId);

  // Lightweight access log (no bodies, no secrets).
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      logger.info("request", {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  app.use("/api", apiRateLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
