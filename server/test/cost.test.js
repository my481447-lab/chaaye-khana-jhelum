/**
 * Tests for the cost-protection pieces: cost estimation, budget ceiling,
 * and the answer cache.
 *
 * Run:  npm test    (from server/)
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { estimateCostUSD } from "../src/lib/spendGuard.js";
import {
  getCached,
  setCached,
  makeKey,
  clearCache,
  cacheStats,
} from "../src/lib/answerCache.js";

/* ---------- cost estimation ---------- */

test("cost: Haiku rates ($1 in / $5 out per 1M)", () => {
  const usd = estimateCostUSD("claude-haiku-4-5", {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
  });
  assert.equal(usd, 6); // 1 + 5
});

test("cost: cache reads are ~10% of input cost", () => {
  const usd = estimateCostUSD("claude-haiku-4-5", {
    input_tokens: 0,
    cache_read_input_tokens: 1_000_000,
    output_tokens: 0,
  });
  assert.equal(Math.round(usd * 100) / 100, 0.1);
});

test("cost: unknown model falls back to the conservative (Opus) rate", () => {
  const usd = estimateCostUSD("some-future-model", { input_tokens: 1_000_000 });
  assert.equal(usd, 5);
});

test("cost: a typical short FAQ answer is a fraction of a cent", () => {
  // ~1.5k input (mostly cached), ~120 output on Haiku
  const usd = estimateCostUSD("claude-haiku-4-5", {
    input_tokens: 200,
    cache_read_input_tokens: 1_300,
    output_tokens: 120,
  });
  assert.ok(usd < 0.001, `expected < $0.001, got ${usd}`);
});

/* ---------- answer cache ---------- */

test("cache: normalises the question (case / punctuation / spacing)", () => {
  assert.equal(
    makeKey("What are your HOURS??", "m"),
    makeKey("  what   are your hours ", "m"),
  );
});

test("cache: stores and returns a reply within TTL", () => {
  clearCache();
  setCached("opening hours?", "m", "8am to midnight", { model: "m" }, 60_000, 100);
  const hit = getCached("Opening Hours?", "m");
  assert.equal(hit.reply, "8am to midnight");
});

test("cache: expires after TTL", async () => {
  clearCache();
  setCached("q", "m", "a", {}, 5, 100);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(getCached("q", "m"), null);
});

test("cache: is keyed by model", () => {
  clearCache();
  setCached("q", "haiku", "cheap", {}, 60_000, 100);
  assert.equal(getCached("q", "opus"), null);
});

test("cache: evicts oldest entries past the max size", () => {
  clearCache();
  for (let i = 0; i < 10; i++) setCached("q" + i, "m", "a", {}, 60_000, 5);
  assert.ok(cacheStats().size <= 5);
  assert.equal(getCached("q0", "m"), null); // oldest gone
  assert.ok(getCached("q9", "m")); // newest kept
});

test("cache: ttl of 0 disables caching", () => {
  clearCache();
  setCached("q", "m", "a", {}, 0, 100);
  assert.equal(getCached("q", "m"), null);
});
