/**
 * Prompt-injection heuristics for incoming chat messages.
 *
 * This does NOT block requests — the model's system prompt is the real
 * defence. What this does:
 *   1. Cap message length and conversation length (cheap DoS protection).
 *   2. Detect obvious injection / jailbreak / secret-extraction attempts so
 *      they can be logged and so an extra reminder line can be appended to
 *      the model input.
 *
 * The agent is instructed to treat everything in the `user` role as data,
 * never as instructions, so a missed pattern here is not a security hole —
 * it just means we don't get the telemetry.
 */

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_MESSAGES = 20;

const INJECTION_PATTERNS = [
  /ignore (?:all |any |your )?(?:previous |prior |above )?(?:instructions|rules|prompt)/i,
  /disregard (?:the |all |your )?(?:above|previous|system)/i,
  /you are (?:now|actually) (?:a|an|not)\b/i,
  /(?:new|updated|revised) (?:system )?(?:instructions|rules|prompt)\s*[:\-]/i,
  /\bdeveloper mode\b/i,
  /\bDAN\b|\bjailbreak\b/i,
  /pretend (?:to be|you are|that)/i,
  /(?:reveal|show|print|repeat|leak|expose|output|give me) (?:me )?(?:your |the )?(?:system prompt|initial prompt|instructions|prompt|rules)/i,
  /(?:what|show me) (?:is|are) your (?:system prompt|instructions|rules|guardrails)/i,
  /(?:api|secret|access|auth(?:entication)?)[ _-]?(?:key|token|secret|credential)/i,
  /\.env\b|environment variable|process\.env/i,
  /database (?:credential|password|connection|url|uri)/i,
  /(?:disable|turn off|bypass|remove|forget) (?:your |the |all )?(?:safety|security|guardrail|rule|filter)/i,
  /\bsystem prompt\b/i,
  /\bBEGIN SYSTEM PROMPT\b/i,
  /act as (?:a |an )?(?!(?:chaaye|chai)\b)/i,
];

/**
 * @param {string} message
 * @returns {{ suspicious: boolean, matched: string[] }}
 */
export function screenMessage(message) {
  const value = String(message ?? "");
  const matched = [];
  for (const re of INJECTION_PATTERNS) {
    if (re.test(value)) matched.push(re.source.slice(0, 48));
  }
  return { suspicious: matched.length > 0, matched };
}
