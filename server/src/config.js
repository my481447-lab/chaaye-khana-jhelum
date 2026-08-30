/**
 * Central configuration. Reads from environment variables only — no secret is
 * ever hard-coded here. `getConfig()` validates once and caches the result.
 *
 * NOTHING in this module is exposed through the API. The error handler and the
 * agent both refuse to echo config values back to a caller.
 */

import "dotenv/config";

let cached = null;

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function list(name, fallback = []) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getConfig() {
  if (cached) return cached;

  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";

  const config = {
    nodeEnv,
    isProd,
    port: num("PORT", 8787),
    corsOrigins: list("CORS_ORIGINS", [
      "http://localhost:4173",
      "http://localhost:4175",
    ]),

    agent: {
      // The Anthropic key is held here and used only by the server-side agent.
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.AGENT_MODEL || "claude-opus-5",
      effort: process.env.AGENT_EFFORT || "low",
      maxTokens: num("AGENT_MAX_TOKENS", 800),
      enabled: Boolean(process.env.ANTHROPIC_API_KEY),
    },

    rateLimits: {
      api: {
        windowMs: num("API_RATE_WINDOW_MS", 60_000),
        max: num("API_RATE_MAX", 120),
      },
      chat: {
        windowMs: num("CHAT_RATE_WINDOW_MS", 60_000),
        max: num("CHAT_RATE_MAX", 15),
      },
    },
  };

  // Fail fast on genuinely broken configuration, but never print the value.
  if (isProd && config.corsOrigins.length === 0) {
    throw new Error(
      "CORS_ORIGINS must be set in production (comma-separated list of allowed site origins).",
    );
  }
  if (isProd && !config.agent.apiKey) {
    // Not fatal — the rest of the API still works — but make it loud.
    console.warn(
      "[config] ANTHROPIC_API_KEY is not set. The /api/chat agent will be disabled.",
    );
  }

  cached = config;
  return cached;
}
