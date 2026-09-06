/**
 * Server entry point.
 *
 * Start with:  npm start   (from the server/ directory, after `npm install`
 * and copying .env.example to .env).
 */

import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import { createApp } from "./app.js";
import { persistenceHealthy } from "./lib/spendGuard.js";

const config = getConfig();
const app = createApp();

const server = app.listen(config.port, () => {
  logger.info("server.listening", {
    port: config.port,
    env: config.nodeEnv,
    agent: config.agent.enabled ? "enabled" : "disabled",
    model: config.agent.enabled ? config.agent.model : undefined,
  });

  if (config.agent.enabled) {
    logger.info("agent.protections", {
      model: config.agent.model,
      dailyUsdLimit: config.agent.dailyUsdLimit || "OFF",
      monthlyUsdLimit: config.agent.monthlyUsdLimit || "OFF",
      maxCallsPerDay: config.agent.maxCallsPerDay || "OFF",
      spendCounterPersistent: persistenceHealthy(),
      enforceChatOrigin: config.enforceChatOrigin,
      chatToken: config.chatAccessToken ? "set" : "off",
      chatRatePerIpPerMin: config.rateLimits.chat.max,
      chatRateGlobalPerMin: config.rateLimits.chatGlobal.max,
      answerCacheTtlMin: Math.round(config.agent.cacheTtlMs / 60000),
      corsOrigins: config.corsOrigins,
    });
    if (!persistenceHealthy()) {
      logger.warn("agent.protections", {
        note: "spend counter is NOT persistent on this host (serverless / read-only FS). The day/month ceilings reset on cold start — rely on the Anthropic Console spend limit. See SECURITY.md.",
      });
    }
  }
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
