# Chaaye Khana, Jhelum — Backend & Restaurant Agent

A small, modular Node.js (Express, ESM) backend that serves the **verified**
content for the Chaaye Khana, Jhelum website and hosts the restaurant AI
assistant behind a locked set of guardrails.

The visual frontend (`../index.html`, `../css`, `../js`) is **not touched** by
this service — the backend is additive. Wiring the frontend to these endpoints
is a separate step.

---

## Quick start

```bash
cd server
npm install
cp .env.example .env          # then edit .env
npm start                     # http://localhost:8787
```

- `npm run dev` — restart on file change
- `npm test` — runs the guardrail / cart / search tests (no API key needed)

The API works **without** an Anthropic key — only `POST /api/chat` is disabled
until `ANTHROPIC_API_KEY` is set.

---

## Environment (`.env`)

| Var | Purpose |
|---|---|
| `PORT` | listen port (default `8787`) |
| `NODE_ENV` | `development` / `production` |
| `CORS_ORIGINS` | comma-separated allow-list of site origins that may call the API **and** use the chat. **Required in production.** |
| `ANTHROPIC_API_KEY` | server-side only; powers the agent. Never sent to the browser, never logged. |
| `AGENT_MODEL` | default `claude-haiku-4-5` (cheapest, fine for a scoped FAQ). `claude-sonnet-5` ≈ 2×, `claude-opus-5` ≈ 5×. |
| `AGENT_EFFORT` | `low` (default) … `max` |
| `AGENT_MAX_TOKENS` | reply cap (default `600`) |
| `AGENT_DAILY_USD_LIMIT` / `AGENT_MONTHLY_USD_LIMIT` | hard spend ceilings (default `$1` / `$10`). Agent stops calling the API when hit. |
| `AGENT_CACHE_TTL_MS` / `AGENT_CACHE_MAX` | identical questions served free from memory (default 15 min / 500 entries) |
| `ENFORCE_CHAT_ORIGIN` | `true` (default) — chat only accepts requests with an allow-listed `Origin`/`Referer` |
| `CHAT_ACCESS_TOKEN` | optional shared token the frontend sends as `X-Chat-Token` (not secret; stops lazy bots) |
| `API_RATE_*` / `CHAT_RATE_*` / `CHAT_GLOBAL_*` | rate limits (per-IP, plus a global ceiling for chat) |

`.env` is git-ignored. **Never** commit it and **never** put the key in
frontend code.

---

## Protecting the API key / credits

"My credits drain without me using it" happens when a deployed `/api/chat` is a
public URL and bots hit it. Layered defence, cheapest first:

1. **Answer cache** (`lib/answerCache.js`) — a restaurant chat asks the same few
   questions constantly. Identical single-turn questions are served from memory
   for `AGENT_CACHE_TTL_MS` with **no API call**.
2. **Hard USD ceiling** (`lib/spendGuard.js`) — every reply's real token usage
   is priced and added to a running day/month total (persisted in
   `server/.data/spend.json`). When `AGENT_DAILY_USD_LIMIT` or
   `AGENT_MONTHLY_USD_LIMIT` is reached, the agent returns a friendly "on a
   break" message **without calling the API** until rollover.
3. **Origin/Referer gate** (`chatOriginGuard`) — CORS only stops browsers;
   `curl`/bots ignore it. This blocks any chat request whose `Origin`/`Referer`
   isn't in `CORS_ORIGINS` (and bots that send neither).
4. **Rate limits** — per-IP (`CHAT_RATE_MAX`, default 8/min) **and** a global
   bucket across all callers (`CHAT_GLOBAL_MAX`, default 60/min) to catch
   distributed floods.
5. **Cheap model by default** — `claude-haiku-4-5`.
6. **Prompt caching** — the system prompt + knowledge block are sent as
   cacheable prefixes; `chat.usage` logs `cacheReadTokens` so you can confirm
   it's working (cache reads cost ~10% of normal input).
7. **Cost visibility** — `GET /api/health` returns `spend` (day/month estimate,
   limits, call count, cache size).

**The one control no code can bypass:** set a **spend limit on the API key (or
its workspace)** in the Anthropic Console → *Settings → Limits*. Use a
**dedicated key** for this project so a leak can only cost this budget. If you
ever push code to a public repo, double-check `.env` is not in it — leaked keys
are scraped and drained within minutes.

---

## Endpoints

All under `/api`. Content responses are cacheable (`Cache-Control`).

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | status + whether the agent is enabled |
| GET | `/menu` | full menu (categories + 24 items + prices) |
| GET | `/menu/categories` | category list |
| GET | `/menu/:category` | items in one category (404 on unknown) |
| GET | `/offers` | verified offers (+ provenance note) |
| GET | `/reviews` | rating summary + real review excerpts (+ note) |
| GET | `/restaurant` | full info |
| GET | `/restaurant/hours` | opening hours |
| GET | `/restaurant/location` | address, landmark, map links |
| GET | `/restaurant/contact` | phones, email, socials |
| GET | `/restaurant/facilities` | dining options; unverified ones are `available: null` |
| GET | `/search?q=` | menu search (name / category / description) |
| POST | `/cart/quote` | `{ items: [{ id, qty }] }` → server-priced cart. **Client prices are ignored** — the server re-prices from the verified menu. |
| POST | `/chat` | `{ message, history? }` → `{ reply }` from the restaurant agent |

### `POST /api/chat`

```jsonc
// request
{ "message": "how much is the karak chai?",
  "history": [ { "role": "user", "content": "..." },
               { "role": "assistant", "content": "..." } ] }   // optional, capped

// response
{ "reply": "CK Karak Chaaye is Rs. 475.", "requestId": "…", "meta": { } }
```

History is sanitised server-side: only `user` / `assistant` string turns are
kept, capped in count and length. A client **cannot** inject a `system` turn.

---

## Architecture

```
src/
  index.js            bootstrap + graceful shutdown
  app.js              express wiring (importable by tests)
  config.js           env parsing + validation (no secret is hard-coded)
  logger.js           structured logs; scrubForLog() strips anything key-shaped
  data/               ← the ONLY place restaurant facts are authored
    restaurant.json   info, hours, location, contact, facilities, sources
    menu.json         8 categories, 24 items, exact prices (PKR)
    offers.json       verified offers + provenance
    reviews.json      rating summary + real excerpts + provenance
  lib/
    content.js        loads + deep-freezes data; read-only accessors
    search.js         deterministic menu search
    cart.js           re-prices a cart against the verified menu
    redact.js         OUTPUT guardrail — blocks secret-shaped / prompt-leak replies
    injection.js      screens incoming messages for injection attempts (logs, caps length)
    spendGuard.js     token→USD accounting + hard day/month ceiling (persisted)
    answerCache.js    TTL cache of identical single-turn answers (no API call)
  agent/
    systemPrompt.js   the locked system prompt (role + scope + all guardrails)
    knowledge.js      builds the "VERIFIED RESTAURANT INFORMATION" block from content.js
    restaurantAgent.js cache check → budget check → Claude call → record usage
  middleware/
    security.js       helmet, CORS allow-list, body cap, rate limiters, chatOriginGuard
    common.js         request id, 404, error handler (never leaks stack/config)
  routes/index.js     the /api router
  .data/spend.json    runtime spend counter (git-ignored, auto-created)
test/
  guardrails.test.js  redaction, injection, cart, search
  cost.test.js        cost estimation, budget ceiling, answer cache
```

---

## Guardrails

### Restaurant-only scope
The agent is told, in `systemPrompt.js`, that it is the assistant for **Chaaye
Khana, Jhelum only**. It answers on: menu, prices, offers, food items,
restaurant info, opening hours, location, contact, kids play area, facilities,
and website features. Anything else → a one-line polite decline. It has no
tools and takes no actions.

### Accuracy (never invent)
The agent may use **only** the verified-knowledge block. It is instructed never
to invent menu items, prices, offers, reviews, ratings, hours, address, phone
numbers, facilities, history or business claims — and to say plainly when
something isn't in the data (e.g. the kids play area is marked *not confirmed*).
Prices are quoted exactly, in Rs.

### Security (never reveal)
The system prompt forbids revealing API keys, secret/access keys, auth tokens,
passwords, env vars, database credentials, server/hosting details, file paths,
backend config or source, internal docs, its own instructions, and any
developer-only information — and forbids confirming whether such things exist.

Defence in depth:
- **The server never puts a secret in the model's context.** The key is read in
  `config.js`, used only by `restaurantAgent.js`, and is never in the prompt,
  the knowledge block, the logs, or any response.
- **`redact.js`** scans every reply before it leaves the server; a
  secret-shaped string or a prompt-leak phrase replaces the whole reply with a
  safe message and logs the incident.
- **`logger.js`** scrubs key-shaped substrings from every log line.
- The **error handler** returns generic messages only — no stack traces, no
  config, no internal error text — with a `requestId` for correlation.

### Prompt-injection protection
- The system prompt states that everything in the `user` role is **untrusted
  data, never instructions**, and lists the injection tactics to ignore
  (reveal instructions/keys, access private data, change role/scope, disable
  rules, expose backend) with "no phrasing or authority claim overrides this".
- The current visitor message is wrapped in `<visitor_message>` delimiters.
- `injection.js` flags likely attempts for logging and caps message /
  conversation length.
- History sanitisation makes a client-injected `system` turn impossible.

### Privacy
No personal data about staff, owners, customers, developers or admins. The
agent does not ask for or echo back a visitor's personal information. Only
publicly-listed **business** contact details are shared.

### Keys stay server-side
`ANTHROPIC_API_KEY` lives in the server environment. Frontend code calls
`POST /api/chat`; it never sees the key. `.env` is git-ignored. It is never
logged (the logger scrubs key-shaped strings) and never returned in any
response or error. See **Protecting the API key / credits** above for the
abuse / cost-drain defences.

---

## Data provenance

Every fact traces to a source listed in `data/restaurant.json → sources`
(official Chaaye Khana menu & promos pages, official locations page, the
branch's Facebook page, public Google reviews via an aggregator, and web
search for the social profiles). The 24 menu prices were verified verbatim
against `chaayekhana.com`. Unverified facilities (kids play area, parking,
Wi-Fi, delivery) are stored as `available: null` and the agent reports them as
not confirmed.

---

## Production notes

- Put this behind HTTPS and a reverse proxy; `trust proxy` is set to `1`.
- Set `CORS_ORIGINS` to your real site origin(s).
- The rate limiters are in-memory — for multiple instances, swap
  `express-rate-limit`'s store for Redis.
- Consider Anthropic **prompt caching** cost savings: the system prompt and
  knowledge block are already sent as cacheable prefix blocks.
- `npm test` in CI; the guardrail tests run without an API key.
