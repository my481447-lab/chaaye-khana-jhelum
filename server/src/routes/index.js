/**
 * API router. Everything is mounted under /api.
 *
 * GET  /api/health
 * GET  /api/menu                 full menu (categories + items)
 * GET  /api/menu/categories      category list
 * GET  /api/menu/:category       items in one category
 * GET  /api/offers
 * GET  /api/reviews
 * GET  /api/restaurant           full restaurant info
 * GET  /api/restaurant/hours
 * GET  /api/restaurant/location
 * GET  /api/restaurant/contact
 * GET  /api/restaurant/facilities
 * GET  /api/search?q=...
 * POST /api/cart/quote           { items: [{ id, qty }] } -> priced cart
 * POST /api/chat                 { message, history? } -> agent reply
 */

import { Router } from "express";

import { getConfig } from "../config.js";
import { logger } from "../logger.js";
import {
  getMenu,
  getMenuCategories,
  getMenuItems,
  isValidCategory,
  getOffers,
  getReviews,
  getRestaurant,
  getOpeningHours,
  getLocation,
  getContact,
  getFacilities,
} from "../lib/content.js";
import { searchMenu } from "../lib/search.js";
import { quoteCart } from "../lib/cart.js";
import { askRestaurantAgent } from "../agent/restaurantAgent.js";
import {
  chatRateLimiter,
  chatGlobalRateLimiter,
  chatOriginGuard,
} from "../middleware/security.js";
import { MAX_HISTORY_MESSAGES } from "../lib/injection.js";
import { spendSnapshot } from "../lib/spendGuard.js";
import { cacheStats } from "../lib/answerCache.js";

const config = getConfig();
const router = Router();

/** Content is static & verified — safe to cache at the edge / in the browser. */
function cacheable(res) {
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
}

/* ---------- Health ---------- */

router.get("/health", (req, res) => {
  const spend = spendSnapshot();
  const rawKey = process.env.ANTHROPIC_API_KEY || "";
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    agent: config.agent.enabled ? "enabled" : "disabled",
    // Deploy diagnostics — booleans / lengths only, never the key itself.
    // Lets us confirm the running build is current and whether it can see
    // the ANTHROPIC_API_KEY environment variable. Safe to expose.
    build: {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
      nodeEnv: config.nodeEnv,
      keyPresent: rawKey.length > 0,
      keyLooksValid: /^sk-ant-/.test(rawKey.trim()),
      keyLen: rawKey.length,
      keyHadWhitespace: rawKey !== rawKey.trim(),
      model: config.agent.model,
    },
    // Cost visibility — estimated only, no secrets.
    spend: {
      dayUsd: spend.dayUsd,
      dayLimitUsd: config.agent.dailyUsdLimit,
      dayCalls: spend.dayCalls,
      dayCallLimit: config.agent.maxCallsPerDay,
      monthUsd: spend.monthUsd,
      monthLimitUsd: config.agent.monthlyUsdLimit,
      agentCallsTotal: spend.calls,
      cachedAnswers: cacheStats().size,
      counterPersistent: spend.persistent,
    },
  });
});

/* ---------- Menu ---------- */

router.get("/menu", (req, res) => {
  cacheable(res);
  res.json(getMenu());
});

router.get("/menu/categories", (req, res) => {
  cacheable(res);
  res.json({ categories: getMenuCategories() });
});

router.get("/menu/:category", (req, res) => {
  const { category } = req.params;
  if (!isValidCategory(category)) {
    return res.status(404).json({ error: `Unknown menu category: ${category}` });
  }
  cacheable(res);
  res.json({
    category,
    items: getMenuItems(category),
  });
});

/* ---------- Offers ---------- */

router.get("/offers", (req, res) => {
  cacheable(res);
  res.json(getOffers());
});

/* ---------- Reviews ---------- */

router.get("/reviews", (req, res) => {
  cacheable(res);
  res.json(getReviews());
});

/* ---------- Restaurant info ---------- */

router.get("/restaurant", (req, res) => {
  cacheable(res);
  res.json(getRestaurant());
});

router.get("/restaurant/hours", (req, res) => {
  cacheable(res);
  res.json(getOpeningHours());
});

router.get("/restaurant/location", (req, res) => {
  cacheable(res);
  res.json(getLocation());
});

router.get("/restaurant/contact", (req, res) => {
  cacheable(res);
  res.json(getContact());
});

router.get("/restaurant/facilities", (req, res) => {
  cacheable(res);
  res.json(getFacilities());
});

/* ---------- Search ---------- */

router.get("/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (q.trim().length < 2) {
    return res.json({ query: q, results: [], message: "Type at least 2 characters." });
  }
  if (q.length > 100) {
    return res.status(400).json({ error: "Query too long." });
  }
  const results = searchMenu(q);
  res.json({
    query: q,
    count: results.length,
    results,
    message: results.length ? undefined : `No results found for "${q}".`,
  });
});

/* ---------- Cart quote ---------- */

router.post("/cart/quote", (req, res) => {
  const items = req.body?.items;
  const quote = quoteCart(items);
  if (quote.error) return res.status(400).json({ error: quote.error });
  res.json(quote);
});

/* ---------- Chat (restaurant agent) ---------- */

router.post("/chat", chatOriginGuard, chatGlobalRateLimiter, chatRateLimiter, async (req, res) => {
  const message = req.body?.message;
  const history = req.body?.history;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Body must include a non-empty 'message' string." });
  }
  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ error: "'history' must be an array if provided." });
  }
  if (Array.isArray(history) && history.length > MAX_HISTORY_MESSAGES * 2) {
    return res.status(400).json({ error: "Conversation history is too long." });
  }

  try {
    const { reply, meta } = await askRestaurantAgent({
      message,
      history: history || [],
      requestId: req.id,
    });
    res.json({ reply, requestId: req.id, meta: publicMeta(meta) });
  } catch (err) {
    logger.error("chat.route_error", { requestId: req.id, error: err?.message });
    res.status(500).json({
      reply:
        "Sorry — I'm having trouble right now. Please try again shortly, or " +
        "call the branch on (0544) 610711.",
      requestId: req.id,
    });
  }
});

/** Only expose non-sensitive bits of the agent meta to the client. */
function publicMeta(meta = {}) {
  return {
    disabled: meta.disabled || undefined,
    refused: meta.refused || undefined,
    error: meta.error || undefined,
  };
}

export default router;
