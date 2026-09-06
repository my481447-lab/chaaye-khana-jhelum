/**
 * Security middleware bundle.
 *
 *  - helmet: sane security headers, no CSP here (this API serves JSON only)
 *  - CORS: strict origin allow-list from config (no wildcard in production)
 *  - body size limit: small — this API only receives short JSON
 *  - remove x-powered-by, disable etag for API responses
 *  - rate limiters: general API + stricter chat
 */

import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { getConfig } from "../config.js";
import { logger } from "../logger.js";

const config = getConfig();

const TOO_FAST = {
  reply:
    "You're sending messages too quickly. Please wait a moment and try again.",
};

export function baseSecurity(app) {
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", 1); // behind a reverse proxy / load balancer

  app.use(
    helmet({
      contentSecurityPolicy: false, // JSON API, not HTML
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  app.use(
    cors({
      // The content endpoints (menu, offers, hours, …) serve public, verified
      // data — reflecting the caller's origin is fine. The only endpoint that
      // costs money, /api/chat, is protected separately by chatOriginGuard
      // (same-origin OR allow-list), the rate limiters and the spend guard.
      origin: true,
      credentials: false,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Chat-Token"],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: "16kb" }));
}

/** Host of a URL, or null. */
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimits.api.windowMs,
  max: config.rateLimits.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Per-IP limiter for /api/chat.
export const chatRateLimiter = rateLimit({
  windowMs: config.rateLimits.chat.windowMs,
  max: config.rateLimits.chat.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_FAST,
});

// Global limiter for /api/chat — one bucket for ALL callers. Stops a
// distributed flood (many IPs, each under the per-IP limit) from draining the
// API budget. `keyGenerator` returns a constant so every request shares it.
export const chatGlobalRateLimiter = rateLimit({
  windowMs: config.rateLimits.chatGlobal.windowMs,
  max: config.rateLimits.chatGlobal.max,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: () => "global",
  message: {
    reply:
      "The chat assistant is very busy right now. Please try again in a minute.",
  },
});

/**
 * Extra gate for /api/chat: the request must look like it came from our own
 * site, not a script. Checks Origin / Referer against the CORS allow-list and,
 * if configured, a shared X-Chat-Token. CORS alone does NOT stop this — CORS is
 * a browser thing; curl / bots ignore it entirely.
 */
export function chatOriginGuard(req, res, next) {
  if (config.chatAccessToken) {
    if (req.get("X-Chat-Token") !== config.chatAccessToken) {
      logger.warn("chat.bad_token", { requestId: req.id, ip: req.ip });
      return res.status(403).json({ reply: "Chat is not available from here." });
    }
  }

  if (!config.enforceChatOrigin) return next();

  const origin = req.get("Origin");
  const referer = req.get("Referer");
  const source = origin || referer || null;

  // No Origin AND no Referer → almost always a script / bot. Block.
  if (!source) {
    logger.warn("chat.no_origin", { requestId: req.id, ip: req.ip });
    return res.status(403).json({ reply: "Chat is not available from here." });
  }

  const sourceHost = hostOf(source);
  const reqHost = req.get("X-Forwarded-Host") || req.get("Host");

  // Same-origin: the page and this API are on one domain (e.g. a single Vercel
  // project). Genuinely from our own site.
  if (sourceHost && reqHost && sourceHost === reqHost) return next();

  // Otherwise the source origin must be in the explicit allow-list.
  const sourceOrigin = safeOrigin(source);
  if (sourceOrigin && config.corsOrigins.includes(sourceOrigin)) return next();

  logger.warn("chat.origin_not_allowed", { requestId: req.id, source: sourceHost });
  return res.status(403).json({ reply: "Chat is not available from here." });
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
