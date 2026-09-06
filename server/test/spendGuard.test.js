/**
 * Budget-ceiling tests. This file sets env BEFORE importing the modules,
 * because config + spendGuard read their values at import time. `node --test`
 * runs each test file in its own process, so this is isolated.
 */

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const STORE = path.join(tmpdir(), `ck-spend-test-${process.pid}.json`);

process.env.SPEND_STORE_PATH = STORE;
process.env.AGENT_DAILY_USD_LIMIT = "0.01";
process.env.AGENT_MONTHLY_USD_LIMIT = "1";
process.env.AGENT_MAX_CALLS_PER_DAY = "3";

const { checkBudget, recordUsage, spendSnapshot, persistenceHealthy } =
  await import("../src/lib/spendGuard.js");

before(() => {
  try {
    rmSync(STORE, { force: true });
  } catch {
    /* ignore */
  }
});

test("budget: allows calls under the ceiling", () => {
  assert.equal(checkBudget().ok, true);
});

test("budget: persistence is healthy when the store path is writable", () => {
  assert.equal(persistenceHealthy(), true);
});

test("budget: blocks once the daily USD limit is exceeded", () => {
  // one big call: ~0.02 USD on Haiku (20k output tokens)
  recordUsage("claude-haiku-4-5", { input_tokens: 0, output_tokens: 20_000 });
  const b = checkBudget();
  assert.equal(b.ok, false);
  assert.equal(b.reason, "daily-usd-limit");
});

test("budget: snapshot reflects the spend and call count", () => {
  const s = spendSnapshot();
  assert.ok(s.dayUsd > 0);
  assert.equal(s.dayCalls, 1);
  assert.equal(s.persistent, true);
});
