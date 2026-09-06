/**
 * Spend guard — the hard backstop against runaway API cost.
 *
 * Every agent call is:
 *   1. checked BEFORE the API is hit against three ceilings — per-day USD,
 *      per-month USD, and an absolute per-day call count. If any is exceeded,
 *      the call is refused for free.
 *   2. after the API responds, its real token usage is priced and added to the
 *      running totals.
 *
 * The counter lives IN MEMORY (always authoritative for this process) and is
 * ALSO written to disk so a normal restart doesn't reset it. Rollover is
 * automatic (new day / new month).
 *
 * IMPORTANT — serverless: on read-only / ephemeral filesystems (Vercel/Netlify
 * functions) disk persistence and even in-memory counters reset on every cold
 * start, so these ceilings become best-effort only. On such hosts the Anthropic
 * Console spend limit is your real cap. For a durable cap, run this on a host
 * that keeps the process alive (Railway, Render, Fly.io, a VPS) or back the
 * counter with Redis. See SECURITY.md.
 *
 * This is defence in depth. ALWAYS also set a spend limit on the API key (or
 * its workspace) in the Anthropic Console — no bug in this file can bypass it.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

import { getConfig } from "../config.js";
import { logger } from "../logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Pick a writable location: explicit override → project .data → OS temp dir.
const CANDIDATE_PATHS = [
  process.env.SPEND_STORE_PATH,
  path.join(here, "..", "..", ".data", "spend.json"),
  path.join(tmpdir(), "chaaye-khana-spend.json"),
].filter(Boolean);

let STORE_PATH = null;
let persistenceWorks = false;
for (const p of CANDIDATE_PATHS) {
  try {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, readFileSyncOr(p, "{}"), { flag: "a" }); // touch, keep contents
    STORE_PATH = p;
    persistenceWorks = true;
    break;
  } catch {
    /* try the next candidate */
  }
}
if (!persistenceWorks) {
  logger.warn("spendGuard.no_persistence", {
    note: "spend counter is in-memory only; it resets on restart. Rely on the Anthropic Console spend limit.",
  });
}

function readFileSyncOr(p, fallback) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return fallback;
  }
}

export function persistenceHealthy() {
  return persistenceWorks;
}

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

const FRESH = () => ({
  day: todayKey(),
  dayUsd: 0,
  dayCalls: 0,
  month: monthKey(),
  monthUsd: 0,
  calls: 0,
});

function load() {
  if (!STORE_PATH) return FRESH();
  try {
    return { ...FRESH(), ...JSON.parse(readFileSync(STORE_PATH, "utf8")) };
  } catch {
    return FRESH();
  }
}

function save(state) {
  if (!STORE_PATH) return;
  try {
    writeFileSync(STORE_PATH, JSON.stringify(state));
  } catch (err) {
    persistenceWorks = false;
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
    state.dayCalls = 0;
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
  const snap = { dayUsd: state.dayUsd, monthUsd: state.monthUsd, dayCalls: state.dayCalls };

  if (agent.dailyUsdLimit > 0 && state.dayUsd >= agent.dailyUsdLimit) {
    return { ok: false, reason: "daily-usd-limit", ...snap };
  }
  if (agent.monthlyUsdLimit > 0 && state.monthUsd >= agent.monthlyUsdLimit) {
    return { ok: false, reason: "monthly-usd-limit", ...snap };
  }
  // Absolute call ceiling — a backstop that holds even if token pricing is
  // wrong or an attacker sends tiny near-zero-cost requests.
  if (agent.maxCallsPerDay > 0 && state.dayCalls >= agent.maxCallsPerDay) {
    return { ok: false, reason: "daily-call-limit", ...snap };
  }
  return { ok: true, ...snap };
}

/**
 * Call AFTER the API responds, with the real usage.
 */
export function recordUsage(model, usage) {
  rollover();
  const cost = estimateCostUSD(model, usage);
  state.dayUsd = round(state.dayUsd + cost);
  state.monthUsd = round(state.monthUsd + cost);
  state.dayCalls = (state.dayCalls || 0) + 1;
  state.calls = (state.calls || 0) + 1;
  save(state);

  const { agent } = getConfig();
  if (agent.dailyUsdLimit > 0 && state.dayUsd >= agent.dailyUsdLimit) {
    logger.warn("spendGuard.daily_usd_limit_reached", {
      dayUsd: state.dayUsd,
      limit: agent.dailyUsdLimit,
    });
  }
  return { cost, dayUsd: state.dayUsd, monthUsd: state.monthUsd };
}

export function spendSnapshot() {
  rollover();
  return {
    day: state.day,
    dayUsd: state.dayUsd,
    dayCalls: state.dayCalls || 0,
    month: state.month,
    monthUsd: state.monthUsd,
    calls: state.calls || 0,
    persistent: persistenceWorks,
  };
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
