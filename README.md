# West Port Radio (`wst-prt-radio`)

Always-on jukebox + **browser WebRTC live audio**. One broadcaster at a time; everyone else listens on the site. Fastify holds SQLite state, relays signaling over **`/signal`**, and serves synchronized fallback tracks when nobody is live.

## Stack

| Piece | Role |
|---|---|
| **Next.js** (`apps/web`) | UI, player, `/stream` broadcaster |
| **Fastify** (`apps/api`) | REST + WebSocket signaling + autoplay scheduler |
| **SQLite** | Station / sessions (Fly volume in prod) |

Optional extras in Docker (`local_deploy.yaml`): Icecast + jukebox for a classic MP3 mount — not required if you only use in-repo autoplay + WebRTC.

## Repo layout

```
apps/web     Next.js
apps/api     Fastify
packages/shared   shared TS types
infra/fly, infra/vercel   deploy notes
```

## Run locally

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
# Point NEXT_PUBLIC_API_BASE_URL at your API (e.g. http://localhost:3001)
pnpm dev
```

- **Listen**: open the site, press Play — connects to `GET /public/autoplay` + `ws …/signal`.
- **Go live**: open **`/stream`**, allow mic, Start — listeners on `station_status` attach via WebRTC.

## Deploy API (Fly.io)

From repo root (adjust app name / `fly.toml` as needed):

```bash
fly deploy
```

Set **`CORS_ALLOWED_ORIGINS`** to your real web origin(s), comma-separated.

## Deploy web (Vercel)

Root directory **`apps/web`**. Env:

- `NEXT_PUBLIC_API_BASE_URL` — `https://your-api.fly.dev`
- `NEXT_PUBLIC_PUBLIC_SITE_URL` — public site URL

## WebRTC note

Browsers use **ICE** internally for peer connections. This codebase keeps it simple: **public Google STUN** is baked into the web bundle so you don’t configure anything server-side for NAT traversal. If some listeners still can’t hear live audio on cellular / strict networks, add a hosted **TURN** service later and extend `RTCPeerConnection` `iceServers` in the web app — there is no separate “ICE API” on the Fly service.

## API docs

Interactive: run the API and open **`/docs`** (served from `apps/api/openapi.yaml`).
