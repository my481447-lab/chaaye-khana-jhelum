/**
 * Small shared middleware: request id, 404, and the final error handler.
 *
 * The error handler NEVER sends stack traces, config, env values or internal
 * messages to the client. Details go to the server log only.
 */

import { randomUUID } from "node:crypto";

import { getConfig } from "../config.js";
import { logger } from "../logger.js";

const config = getConfig();

export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

export function notFound(req, res) {
  res.status(404).json({ error: "Not found." });
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // CORS rejection and body-parser errors are client problems, not 500s.
  const clientError =
    err.message === "Origin not allowed" ||
    err.type === "entity.too.large" ||
    err.type === "entity.parse.failed";

  const finalStatus = clientError ? 400 : status;

  logger.error("request.error", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    status: finalStatus,
    // err.message is logged (scrubbed by the logger) but never sent to client.
    error: err.message,
    stack: config.isProd ? undefined : err.stack,
  });

  res.status(finalStatus).json({
    error:
      finalStatus === 400
        ? "Bad request."
        : "Something went wrong. Please try again later.",
    requestId: req.id,
  });
}
