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
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) and any
        // explicitly allow-listed origin. Everything else is rejected.
        if (!origin) return cb(null, true);
        if (config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Origin not allowed"), false);
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: "16kb" }));
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
  const source = origin || (referer ? safeOrigin(referer) : null);

  // No Origin AND no Referer → almost always a script / bot. Block.
  if (!source) {
    logger.warn("chat.no_origin", { requestId: req.id, ip: req.ip });
    return res.status(403).json({ reply: "Chat is not available from here." });
  }
  if (!config.corsOrigins.includes(source)) {
    logger.warn("chat.origin_not_allowed", { requestId: req.id, source });
    return res.status(403).json({ reply: "Chat is not available from here." });
  }
  next();
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
