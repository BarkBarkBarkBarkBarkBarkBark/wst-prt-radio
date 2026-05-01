---
layout: default
title: Fly.io + Vercel Deploy Guide
---

# Fly.io + Vercel

- **Vercel** — Next.js front-end (`apps/web`). **Auto-deploys on push to `main`**.
- **Fly.io** — Fastify API (REST + WebSocket `/signal` + always-on file streaming). **Manual deploy via `fly deploy`**.

There is exactly **one** canonical Fly config: [`fly.toml`](../fly.toml) at the repo root (`wst-prt-radio/fly.toml`). Run `fly deploy` from that directory.

## Vercel

- Project root directory: `apps/web`
- Build / install commands are configured in [`apps/web/vercel.json`](../apps/web/vercel.json).
- Environment variables (all `NEXT_PUBLIC_*` are baked into the client bundle at build time — never put secrets here):
  - `NEXT_PUBLIC_API_BASE_URL` — `https://wst-prt-radio.fly.dev` (or your custom API domain)
  - `NEXT_PUBLIC_PUBLIC_SITE_URL` — your Vercel URL (e.g. `https://wst-prt-radio.vercel.app`)

Roll back via the Vercel dashboard → Deployments → Promote previous.

## Fly.io

```bash
cd wst-prt-radio
fly deploy --config fly.toml
```

The Dockerfile at [`apps/api/Dockerfile`](../apps/api/Dockerfile) is referenced by `fly.toml` and copies the whole monorepo, builds `@wstprtradio/shared` then `@wstprtradio/api`, and serves on port 3001.

### One-time setup

```bash
fly volumes create data --app wst-prt-radio --region iad --size 1
```

The volume mounts at `/data` and stores the SQLite database (`SQLITE_DB_PATH=/data/wstprtradio.db`).

### Required secrets

```bash
ADMIN_USERS='marco:<password>,mun:<password>' \
SESSION_SECRET=$(openssl rand -hex 32) \
CORS_ALLOWED_ORIGINS='https://wst-prt-radio.vercel.app' \
./scripts/set-fly-env.sh
```

The script refuses to run without `ADMIN_USERS`. `SESSION_SECRET` is auto-generated if not provided. The boot-time validation in [`apps/api/src/lib/env.ts`](../apps/api/src/lib/env.ts) refuses to start the API in production without both.

### Health checks

`fly.toml` defines a `[[http_service.checks]]` block that pings `GET /health` every 15 s. `/health` is intentionally cheap (no DB). For a deeper probe use `/ready` (runs `SELECT 1`).

### Cold starts

The Fly config sets `auto_stop_machines = false` and `min_machines_running = 1` because WebRTC peer connections die when the machine sleeps. Don't change this without thinking carefully about cost vs UX.

## WebRTC

No special Fly routes are needed. `/signal` is a WebSocket; audio itself flows browser-to-browser. The web app embeds Google STUN URLs as `iceServers` so most NATs traverse without help. If listeners on cellular / strict NAT fail to connect, see [runbook → "Listeners can't hear live audio on cellular"](runbook.md#listeners-cant-hear-live-audio-on-cellular--strict-nat) for the front-end-only TURN upgrade.
