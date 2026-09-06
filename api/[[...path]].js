/**
 * Vercel serverless entry for the backend API.
 *
 * Vercel routes every /api/* request to this catch-all function. It mounts the
 * same Express app used locally (server/src/app.js) — the routes there live
 * under /api, so /api/chat, /api/menu, /api/health etc. all work unchanged.
 *
 * The Anthropic API key and every other secret come from Vercel Environment
 * Variables (Project → Settings → Environment Variables), never from a file in
 * the repo. `.env` is git-ignored and is not uploaded.
 */

import { createApp } from "../server/src/app.js";

const app = createApp();

export default app;
