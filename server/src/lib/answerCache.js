/**
 * Answer cache — the biggest single cost saver for an FAQ bot.
 *
 * A restaurant chat gets the same handful of questions over and over
 * ("opening hours?", "where are you?", "how much is the karak chai?"). We
 * normalise the question, and if we've answered an identical one recently we
 * return the stored reply for free — no API call.
 *
 * Only single-turn questions are cached (no conversation history), so the
 * cached answer can't depend on earlier context.
 *
 * In-memory, TTL + max-size. For multiple server instances, back this with
 * Redis instead — but even per-instance it cuts cost a lot.
 */

const store = new Map(); // key -> { reply, meta, expires }

function normalise(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeKey(message, model) {
  return `${model}::${normalise(message)}`;
}

export function getCached(message, model) {
  const key = makeKey(message, model);
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return null;
  }
  // refresh recency (LRU-ish)
  store.delete(key);
  store.set(key, hit);
  return { reply: hit.reply, meta: hit.meta };
}

export function setCached(message, model, reply, meta, ttlMs, maxEntries) {
  if (!ttlMs || ttlMs <= 0) return;
  const key = makeKey(message, model);
  store.set(key, { reply, meta, expires: Date.now() + ttlMs });
  // evict oldest if over capacity
  while (store.size > maxEntries) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
}

export function cacheStats() {
  return { size: store.size };
}

export function clearCache() {
  store.clear();
}
