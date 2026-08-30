/**
 * Minimal structured logger.
 *
 * Guardrail: `scrubForLog()` strips anything that looks like a secret before it
 * can reach stdout/stderr — API keys, bearer tokens, `key=`/`password=` pairs.
 * Never log raw request bodies or environment values.
 */

const SECRET_PATTERNS = [
  /sk-ant-[a-z0-9-]+/gi,
  /sk-ant-admin[0-9]{2}-[a-z0-9_-]+/gi,
  /bearer\s+[a-z0-9._-]+/gi,
  /\b(api[_-]?key|secret|token|password|passwd|pwd|authorization)\b\s*[:=]\s*\S+/gi,
];

export function scrubForLog(value) {
  let str = typeof value === "string" ? value : safeStringify(value);
  for (const re of SECRET_PATTERNS) str = str.replace(re, "[redacted]");
  return str;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function emit(level, msg, meta) {
  const line = {
    t: new Date().toISOString(),
    level,
    msg: scrubForLog(msg),
  };
  if (meta && typeof meta === "object") {
    for (const [k, v] of Object.entries(meta)) {
      line[k] = typeof v === "string" ? scrubForLog(v) : v;
    }
  }
  const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
  out.write(JSON.stringify(line) + "\n");
}

export const logger = {
  info: (msg, meta) => emit("info", msg, meta),
  warn: (msg, meta) => emit("warn", msg, meta),
  error: (msg, meta) => emit("error", msg, meta),
};
