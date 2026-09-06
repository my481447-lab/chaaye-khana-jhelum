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
      // Haiku is the default: for a scoped, verified-data FAQ bot it is
      // ~5-25x cheaper than Opus and fast enough. Set AGENT_MODEL to
      // claude-sonnet-5 or claude-opus-5 if you want a stronger model.
      model: process.env.AGENT_MODEL || "claude-haiku-4-5",
      effort: process.env.AGENT_EFFORT || "low",
      maxTokens: num("AGENT_MAX_TOKENS", 450),
      enabled: Boolean(process.env.ANTHROPIC_API_KEY),

      // Hard ceilings. When any is hit the agent stops calling the API until
      // rollover (new day / new month). 0 = no limit (not recommended).
      // Conservative defaults so an un-configured deploy still can't run up a
      // bill — raise them with env vars if the bot is busier than this.
      dailyUsdLimit: num("AGENT_DAILY_USD_LIMIT", 0.3),
      monthlyUsdLimit: num("AGENT_MONTHLY_USD_LIMIT", 3),
      // Absolute call count per day — holds even if token pricing is wrong.
      // ~200 Haiku FAQ answers/day is plenty for one restaurant branch.
      maxCallsPerDay: num("AGENT_MAX_CALLS_PER_DAY", 200),

      // Answer cache: identical questions are served free for this long.
      cacheTtlMs: num("AGENT_CACHE_TTL_MS", 15 * 60_000),
      cacheMaxEntries: num("AGENT_CACHE_MAX", 500),
    },

    // Only accept /api/chat requests whose Origin / Referer is in the CORS
    // allow-list. Blocks most scripted / drive-by bot abuse (they omit these).
    enforceChatOrigin: (process.env.ENFORCE_CHAT_ORIGIN || "true") !== "false",

    // Optional shared token the frontend must send as X-Chat-Token. Not secret
    // (it ships in the page), but stops the laziest scripted abuse. Empty = off.
    chatAccessToken: process.env.CHAT_ACCESS_TOKEN || "",

    rateLimits: {
      api: {
        windowMs: num("API_RATE_WINDOW_MS", 60_000),
        max: num("API_RATE_MAX", 120),
      },
      chat: {
        windowMs: num("CHAT_RATE_WINDOW_MS", 60_000),
        max: num("CHAT_RATE_MAX", 5),
      },
      // Global ceiling across ALL clients — catches distributed abuse that
      // slips past the per-IP limit.
      chatGlobal: {
        windowMs: num("CHAT_GLOBAL_WINDOW_MS", 60_000),
        max: num("CHAT_GLOBAL_MAX", 25),
      },
    },
  };

  // In production CORS_ORIGINS should be set, but same-origin requests (the
  // frontend and this API on one domain — e.g. a single Vercel project) are
  // always allowed by the same-origin check in chatOriginGuard, so a missing
  // value is a warning, not fatal.
  if (isProd && config.corsOrigins.length === 0) {
    console.warn(
      "[config] CORS_ORIGINS is not set. Cross-origin sites cannot call this " +
        "API; only same-origin requests (frontend + API on one domain) work.",
    );
  }
  if (isProd && !config.agent.apiKey) {
    // Not fatal — the rest of the API still works — but make it loud.
    console.warn(
      "[config] ANTHROPIC_API_KEY is not set. The /api/chat agent will be disabled.",
    );
  }
  if (
    isProd &&
    config.agent.apiKey &&
    config.agent.dailyUsdLimit <= 0 &&
    config.agent.monthlyUsdLimit <= 0 &&
    config.agent.maxCallsPerDay <= 0
  ) {
    console.warn(
      "[config] WARNING: no spend ceiling is set (AGENT_DAILY_USD_LIMIT / " +
        "AGENT_MONTHLY_USD_LIMIT / AGENT_MAX_CALLS_PER_DAY all 0). A public " +
        "chat endpoint with no ceiling can run up an API bill. Set at least one.",
    );
  }

  cached = config;
  return cached;
}
