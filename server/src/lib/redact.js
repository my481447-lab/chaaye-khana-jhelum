/**
 * Output guardrail — last line of defence.
 *
 * Before ANY agent reply is sent to a client it passes through here. If the
 * text contains something that looks like a secret (API key, token, private
 * key block, connection string, .env dump), the whole reply is replaced with
 * a safe canned message and the incident is flagged for logging.
 *
 * This is defence-in-depth: the system prompt already forbids revealing
 * secrets, and the server never puts secrets in the model's context in the
 * first place. This function assumes both of those could still fail.
 */

const SECRET_SIGNATURES = [
  /sk-ant-[a-z0-9-]{20,}/i, // Anthropic API key
  /sk-ant-admin\d{2}-[a-z0-9_-]{20,}/i, // Anthropic admin key
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /-----BEGIN[ A-Z]*PRIVATE KEY-----/, // PEM private key
  /\bghp_[A-Za-z0-9]{30,}\b/, // GitHub token
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack token
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s"']*:[^\s"'@]*@/i, // db URL with creds
  /\b(?:process\.env|import\.meta\.env)\.[A-Z0-9_]+/, // env var references
  /\bANTHROPIC_API_KEY\b/,
];

// Phrases that would indicate the model is leaking its own instructions or
// internal wiring. Matched case-insensitively.
const INTERNAL_LEAK_SIGNATURES = [
  /here (?:is|are) my (?:system )?(?:prompt|instructions)/i,
  /my system prompt (?:is|says|reads)/i,
  /\bBEGIN SYSTEM PROMPT\b/i,
];

export const SAFE_FALLBACK =
  "Sorry, I can't share that. I can help with the Chaaye Khana, Jhelum menu, " +
  "prices, offers, opening hours, location, contact details and website " +
  "features — what would you like to know?";

/**
 * @param {string} text raw model output
 * @returns {{ text: string, blocked: boolean, reason?: string }}
 */
export function redactAgentOutput(text) {
  const value = String(text ?? "");

  for (const re of SECRET_SIGNATURES) {
    if (re.test(value)) {
      return { text: SAFE_FALLBACK, blocked: true, reason: "secret-signature" };
    }
  }
  for (const re of INTERNAL_LEAK_SIGNATURES) {
    if (re.test(value)) {
      return { text: SAFE_FALLBACK, blocked: true, reason: "internal-leak" };
    }
  }
  return { text: value, blocked: false };
}
