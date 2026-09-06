/**
 * Spend guard — the hard backstop against runaway API cost.
 *
 * Every agent call is:
 *   1. checked against a per-day and per-month USD ceiling BEFORE the API is
 *      hit — if either is exceeded, the call is refused for free.
 *   2. after the API responds, its real token usage is converted to an
 *      estimated USD cost and added to the running totals.
 *
 * Totals are persisted to a small JSON file so a restart / redeploy does not
 * reset the counter. Rollover is automatic (new day / new month).
 *
 * This is defence in depth. You should ALSO set a spend limit on the API key
 * (or its workspace) in the Anthropic Console — that limit cannot be bypassed
 * by any bug in this file.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getConfig } from "../config.js";
import { logger } from "../logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(here, "..", "..", ".data", "spend.json");

/**
 * USD per 1,000,000 tokens. Cache reads are ~0.1x input; cache writes ~1.25x.
 * Update if Anthropic pricing changes. Unknown models fall back to Opus rates
 * (the safe, conservative choice).
 */
const PRICING = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-opus-5": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-fable-5": { in: 10, out: 50 },
};
const FALLBACK_RATE = { in: 5, out: 25 };

function rateFor(model) {
  for (const [key, rate] of Object.entries(PRICING)) {
    if (model && model.startsWith(key)) return rate;
  }
  return FALLBACK_RATE;
}

/**
 * @param {string} model
 * @param {object} usage  response.usage from the SDK
 * @returns {number} estimated USD
 */
export function estimateCostUSD(model, usage = {}) {
  const rate = rateFor(model);
  const inputTokens =
    (usage.input_tokens || 0) +
    0.1 * (usage.cache_read_input_tokens || 0) +
    1.25 * (usage.cache_creation_input_tokens || 0);
  const outputTokens = usage.output_tokens || 0;
  return (inputTokens / 1e6) * rate.in + (outputTokens / 1e6) * rate.out;
}

/* ---------- persistent counter ---------- */

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function load() {
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { day: todayKey(), dayUsd: 0, month: monthKey(), monthUsd: 0, calls: 0 };
  }
}

function save(state) {
  try {
    mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(state));
  } catch (err) {
    logger.warn("spendGuard.persist_failed", { error: err?.message });
  }
}

let state = load();

function rollover() {
  const d = todayKey();
  const m = monthKey();
  if (state.day !== d) {
    state.day = d;
    state.dayUsd = 0;
  }
  if (state.month !== m) {
    state.month = m;
    state.monthUsd = 0;
  }
}

/**
 * Call BEFORE hitting the API.
 * @returns {{ ok: boolean, reason?: string, dayUsd: number, monthUsd: number }}
 */
export function checkBudget() {
  rollover();
  const { agent } = getConfig();
  const dayLimit = agent.dailyUsdLimit;
  const monthLimit = agent.monthlyUsdLimit;

  if (dayLimit > 0 && state.dayUsd >= dayLimit) {
    return { ok: false, reason: "daily-limit", dayUsd: state.dayUsd, monthUsd: state.monthUsd };
  }
  if (monthLimit > 0 && state.monthUsd >= monthLimit) {
    return { ok: false, reason: "monthly-limit", dayUsd: state.dayUsd, monthUsd: state.monthUsd };
  }
  return { ok: true, dayUsd: state.dayUsd, monthUsd: state.monthUsd };
}

/**
 * Call AFTER the API responds, with the real usage.
 */
export function recordUsage(model, usage) {
  rollover();
  const cost = estimateCostUSD(model, usage);
  state.dayUsd = round(state.dayUsd + cost);
  state.monthUsd = round(state.monthUsd + cost);
  state.calls = (state.calls || 0) + 1;
  save(state);

  const { agent } = getConfig();
  if (agent.dailyUsdLimit > 0 && state.dayUsd >= agent.dailyUsdLimit) {
    logger.warn("spendGuard.daily_limit_reached", { dayUsd: state.dayUsd, limit: agent.dailyUsdLimit });
  }
  return { cost, dayUsd: state.dayUsd, monthUsd: state.monthUsd };
}

export function spendSnapshot() {
  rollover();
  return {
    day: state.day,
    dayUsd: state.dayUsd,
    month: state.month,
    monthUsd: state.monthUsd,
    calls: state.calls || 0,
  };
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
