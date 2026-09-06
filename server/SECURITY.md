# Protecting your Anthropic API key & credits

Two different problems, both covered:

- **Key leak** — someone gets the actual key string. Fixed in code: the key
  never touches the browser, the logs, an error message, or any response, and
  `.env` is git-ignored.
- **Credit drain** — the key never leaks, but bots spam your public `/api/chat`
  and run up a bill. Fixed with the layers below.

---

## Deploy checklist — do these in order

### 1. Anthropic Console (the cap nothing can bypass)

- [ ] Create a **new API key used only for this project** (Console → API Keys).
      If it ever leaks, only this budget is exposed.
- [ ] Set a **spend limit** on that key's workspace (Console → Settings →
      Limits). Pick a number you're OK losing, e.g. **$10 / month**. This is
      enforced by Anthropic — no bug in this repo can exceed it.
- [ ] Turn on **usage email alerts** if available.

### 2. Where you host the backend

The in-app spend counter and rate limiters keep state **in the running
process**. That means:

| Host type | Counter / rate limits | What to do |
|---|---|---|
| **Long-running process** — Railway, Render, Fly.io, a VPS, `docker run` | ✅ work fully | nothing extra |
| **Serverless functions** — Vercel / Netlify functions, Lambda | ⚠️ reset on every cold start (best-effort only) | rely on the Console spend limit (step 1); or run the backend on a long-running host instead; or add a Redis-backed counter |

> `GET /api/health` → `spend.counterPersistent: true/false` tells you which
> case you're in. The startup log prints it too.

**Recommendation:** deploy the *frontend* anywhere (it's static), and deploy
the *backend* on Railway or Render (both have free tiers and keep the process
alive).

### 3. Environment variables on the host

- [ ] Set `ANTHROPIC_API_KEY` in the **host's dashboard / secrets manager** —
      never in a file you commit.
- [ ] Set `CORS_ORIGINS` to your real site origin(s) only, e.g.
      `https://chaaye-khana-jhelum.vercel.app`. No trailing slash, no `*`.
- [ ] Set `NODE_ENV=production`.
- [ ] Keep the ceilings on (defaults are `AGENT_DAILY_USD_LIMIT=1`,
      `AGENT_MONTHLY_USD_LIMIT=10`, `AGENT_MAX_CALLS_PER_DAY=1500`). Lower them
      if you want.
- [ ] Leave `ENFORCE_CHAT_ORIGIN=true`.

### 4. Wiring the frontend

- [ ] The website calls **`POST /api/chat` on your backend only**. It must
      **never** call `api.anthropic.com` directly and must **never** contain
      the key. (The current static chat widget has no key and no backend call —
      it's safe as-is.)
- [ ] If you add `CHAT_ACCESS_TOKEN`, put the same value in the frontend and
      send it as the `X-Chat-Token` header. It's not a secret (it ships in the
      page) but it filters out lazy bots.

### 5. Never commit a key

- [ ] `.env` and `server/.data/` are git-ignored — keep it that way.
- [ ] Before any `git push`, run: `git grep -n "sk-ant-" $(git rev-parse HEAD)`
      — it should only match the `xxxx` placeholder and the redaction regexes.
- [ ] If a key is ever exposed anywhere: **revoke it in the Console
      immediately** and issue a new one.

---

## What the code does for you (already on)

| Layer | File | Effect |
|---|---|---|
| Key isolation | `config.js`, `restaurantAgent.js` | key only in server env; never in prompt, logs, responses, or errors |
| Output scrub | `lib/redact.js` | any reply containing a key/secret/prompt-leak is replaced with a safe message |
| Log scrub | `logger.js` | `sk-ant-…` and `token=`/`password=` patterns stripped from every log line |
| Answer cache | `lib/answerCache.js` | identical questions served free for 15 min — no API call |
| USD ceiling | `lib/spendGuard.js` | stops calling the API at the day/month $ limit |
| Call ceiling | `lib/spendGuard.js` | absolute cap on calls/day — holds even if pricing is wrong |
| Origin gate | `middleware/security.js` | `/api/chat` rejects requests without an allow-listed `Origin`/`Referer` (blocks `curl`/bots) |
| Rate limits | `middleware/security.js` | per-IP (8/min) **and** global (60/min) for chat |
| Cheap model | default | `claude-haiku-4-5` |
| Prompt caching | `restaurantAgent.js` | system prompt + knowledge sent as cacheable prefix (~90% cheaper input on repeat) |
| Visibility | `GET /api/health` | live spend estimate, limits, call counts, cache size |

You can watch spend live with:

```bash
curl https://your-backend.example/api/health
```
