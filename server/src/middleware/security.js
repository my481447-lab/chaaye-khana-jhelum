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

const config = getConfig();

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

export const chatRateLimiter = rateLimit({
  windowMs: config.rateLimits.chat.windowMs,
  max: config.rateLimits.chat.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    reply:
      "You're sending messages too quickly. Please wait a moment and try again.",
  },
});
