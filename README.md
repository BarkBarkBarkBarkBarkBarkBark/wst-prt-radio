# wstprtradio

An always-on internet radio station with a public listener experience, browser-based live broadcasting, multicast video fanout, and a no-terminal admin control panel.

---

## What this is

wstprtradio is a full-stack TypeScript monorepo that wires together three services:

| Layer | Service | Hosted on |
|---|---|---|
| Station backend | AzuraCast (AutoDJ + live takeover) | Dedicated VM |
| Control backend | Fastify REST API + SQLite | Fly.io |
| Frontend | Next.js App Router (public site + admin UI) | Vercel |

Listeners visit **wstprtradio.com** and always hear something. When a DJ goes live, the site shows a live badge automatically and the station switches modes. When the DJ disconnects, AutoDJ resumes — no operator action required.

---

## Domains

| Purpose | Domain |
|---|---|
| Public site | wstprtradio.com |
| Admin UI | admin.wstprtradio.com |
| API | api.wstprtradio.com |
| Radio stream | radio.wstprtradio.com |
| AzuraCast admin | azura-admin.wstprtradio.com |

---

## Monorepo layout

```
apps/
  web/          Next.js 14 App Router — public site + admin UI (Vercel)
  api/          Fastify REST API — auth, state, destinations, webhooks (Fly.io)

packages/
  shared/       TypeScript types, Zod schemas, state enums
  ui/           Shared Tailwind/Radix UI components

infra/
  fly/          fly.toml, deploy helpers
  vercel/       vercel.json, env docs
  azuracast/    Deployment checklist, nginx proxy example

docs/
  musician-guide.md       One-page guide for non-technical hosts
  web-dj-guide.md         How to go live from the browser
  butt-fallback-guide.md  Using BUTT as a fallback encoder
  obs-profile-guide.md    OBS setup for video events
  dns-checklist.md        DNS records checklist
```

---

## Station modes

The API derives one of four modes from the upstream services and exposes it on `/public/status`:

```
autodj      ← normal state; AzuraCast plays the playlist
live_audio  ← a DJ connected via Web DJ or BUTT
live_video  ← OBS connected to Cloudflare Stream + an active live session
degraded    ← upstream provider unreachable or required config missing
```

Mode transitions are automatic. The frontend polls `/public/status` every few seconds and updates the UI accordingly.

---

## Public site features

- Persistent audio player (AzuraCast stream URL, survives page navigation)
- Now Playing card (track, artist, album art)
- Live badge when a DJ or video event is active
- Listener count
- Recent tracks list
- Live event hero when a video event is active
- Graceful fallback to audio-only if video is unavailable

---

## Admin features (no terminal required)

| Feature | Where |
|---|---|
| Station status dashboard | /admin |
| One-click Open Web DJ | /admin/live |
| Create + end live video sessions | /admin/live |
| View OBS ingest URL and stream key | /admin/live |
| Add/edit/enable/disable/test destinations | /admin/destinations |
| Edit AzuraCast + Cloudflare settings | /admin/settings |
| Audit trail | /admin/audit |

---

## Live video destinations

| Destination | Status |
|---|---|
| Twitch | ✅ Supported |
| Instagram | ✅ Supported |
| Custom RTMP | ✅ Supported |
| Custom SRT | ✅ Supported |
| TikTok | ⚠️ Experimental — requires manual credential setup |
| Discord | 🔔 Go-live notification only — not a media output |

All supported destinations fan out through Cloudflare Stream outputs.

---

## Getting started (development)

### Prerequisites

- Node.js 20+
- pnpm 9+
- An AzuraCast instance (or a public one for testing)
- A Cloudflare account with Stream enabled

### Install dependencies

```bash
pnpm install
```

### Configure environment

```bash
# API
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — see the env vars section below

# Web
cp apps/web/.env.local.example apps/web/.env.local
# Edit apps/web/.env.local
```

### Run locally

```bash
# Start the API (port 3001)
pnpm --filter api dev

# Start the web app (port 3000)
pnpm --filter web dev
```

---

## Environment variables

### API (`apps/api/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default 3001) | API listen port |
| `APP_ENV` | Yes | `production` or `development` |
| `SESSION_SECRET` | Yes ⚠️ | Random string, min 32 chars |
| `BACKEND_ENCRYPTION_KEY` | Yes ⚠️ | 32-byte hex string for AES-256-GCM |
| `SQLITE_DB_PATH` | Yes | Absolute path to SQLite file |
| `ADMIN_SEED_EMAIL` | Yes | Bootstrap admin email |
| `ADMIN_SEED_PASSWORD` | Yes ⚠️ | Bootstrap admin password (change after first login) |
| `AZURACAST_BASE_URL` | Yes | e.g. `https://azura-admin.wstprtradio.com` |
| `AZURACAST_PUBLIC_STREAM_URL` | Yes | e.g. `https://radio.wstprtradio.com/radio.mp3` |
| `AZURACAST_PUBLIC_API_URL` | Yes | e.g. `https://radio.wstprtradio.com/api` |
| `AZURACAST_API_KEY` | Yes ⚠️ | AzuraCast API key |
| `AZURACAST_STATION_ID` | No (default `1`) | AzuraCast station numeric ID — check your station URL |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `CLOUDFLARE_STREAM_API_TOKEN` | Yes ⚠️ | Cloudflare Stream API token |
| `CLOUDFLARE_LIVE_INPUT_ID` | Yes | Cloudflare live input ID |
| `DISCORD_WEBHOOK_URL` | No | Discord go-live notification webhook |

### Web (`apps/web/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | URL of the Fly.io API, e.g. `https://api.wstprtradio.com` |
| `NEXT_PUBLIC_PUBLIC_SITE_URL` | Yes | Public site URL, e.g. `https://wstprtradio.com` |

> **Never expose API secrets to the browser or public bundle.**

---

## API reference

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/public/status` | Current station mode + now-playing + live session |
| `GET` | `/public/now-playing` | Now playing metadata |
| `GET` | `/public/live-session` | Active live session or null |

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Email + password → session cookie |
| `POST` | `/auth/logout` | Clear session |

### Admin (session required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/me` | Current authenticated user |
| `GET` | `/admin/dashboard` | Aggregated station state |
| `GET` | `/admin/station/status` | Detailed station status |
| `POST` | `/admin/live/audio/open-web-dj-link` | Get Web DJ deep link |
| `POST` | `/admin/live/video/session` | Create a live video session |
| `POST` | `/admin/live/video/end` | End the active live video session |
| `GET/POST` | `/admin/destinations` | List / create destinations |
| `PATCH` | `/admin/destinations/:id` | Update a destination |
| `POST` | `/admin/destinations/:id/test` | Test destination connectivity |
| `DELETE` | `/admin/destinations/:id` | Delete a destination |
| `GET/PATCH` | `/admin/settings` | Station settings |
| `GET` | `/admin/audit` | Audit log |

### Webhooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhooks/cloudflare-stream` | Cloudflare Stream live events |
| `POST` | `/webhooks/azuracast` | AzuraCast events |

---

## Deployment

### Fly.io (API)

```bash
# Create the app and volume
fly apps create wstprtradio-api
fly volumes create wstprtradio_data --size 1 --region iad

# Set secrets
fly secrets set \
  SESSION_SECRET="…" \
  BACKEND_ENCRYPTION_KEY="…" \
  ADMIN_SEED_PASSWORD="…" \
  AZURACAST_API_KEY="…" \
  CLOUDFLARE_STREAM_API_TOKEN="…"

# Deploy
fly deploy
```

See `infra/fly/fly.toml` for the full config.

### Vercel (Frontend)

1. Import the repository in Vercel
2. Set the root directory to `apps/web`
3. Add `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_PUBLIC_SITE_URL` env vars
4. Attach `wstprtradio.com` and `admin.wstprtradio.com` domains

See `infra/vercel/ENV_DOCS.md` for full env docs.

### AzuraCast (Station backend)

Deploy AzuraCast on a dedicated VM using Docker Compose. See `infra/azuracast/README.md` for the full checklist.

Key steps:
1. Create a station with AutoDJ enabled
2. Upload playlist media
3. Enable the Live Streamers feature
4. Create a Web DJ-capable operator account
5. Point `radio.wstprtradio.com` at the public stream mount

### Cloudflare Stream

1. Create one live input in the Cloudflare dashboard
2. Store the live input ID in the API settings (`/admin/settings`)
3. Enable webhook notifications → `POST https://api.wstprtradio.com/webhooks/cloudflare-stream`
4. Add destination outputs from the admin UI (`/admin/destinations`)

---

## Operator workflows

### Going live with Web DJ (browser only)

1. Log in at admin.wstprtradio.com
2. Click **Open Web DJ** on the Live page
3. Browser opens AzuraCast Web DJ — broadcast from there
4. Public site shows live badge automatically
5. Close the Web DJ tab → station returns to AutoDJ

### Going live with BUTT (fallback)

See [docs/butt-fallback-guide.md](docs/butt-fallback-guide.md).

### Starting a live video event (OBS)

1. Log in at admin.wstprtradio.com
2. Go to the Live page → **Create Live Video Session**
3. Copy the RTMPS ingest URL and stream key
4. Paste into your preconfigured OBS profile → start streaming
5. Public site switches to live video hero automatically
6. Click **End Session** in the admin UI when done

---

## Security

- Passwords hashed with **argon2id**
- Provider secrets encrypted at rest with **AES-256-GCM**
- Sessions stored in **httpOnly secure cookies**
- CORS restricted to `wstprtradio.com` and `admin.wstprtradio.com`
- Rate limiting on auth, admin mutation, and webhook endpoints

---

## Architecture reference

See [manifest.yaml](manifest.yaml) for the full machine-readable spec including the state machine, database schema, destination policy, and implementation order.

