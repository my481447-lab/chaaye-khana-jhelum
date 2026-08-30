/**
 * Server entry point.
 *
 * Start with:  npm start   (from the server/ directory, after `npm install`
 * and copying .env.example to .env).
 */

import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import { createApp } from "./app.js";

const config = getConfig();
const app = createApp();

const server = app.listen(config.port, () => {
  logger.info("server.listening", {
    port: config.port,
    env: config.nodeEnv,
    agent: config.agent.enabled ? "enabled" : "disabled",
    model: config.agent.enabled ? config.agent.model : undefined,
  });
});

function shutdown(signal) {
  logger.info("server.shutdown", { signal });
  server.close(() => process.exit(0));
  // Force-exit if connections hang.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", { error: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { error: err?.message });
  shutdown("uncaughtException");
});
