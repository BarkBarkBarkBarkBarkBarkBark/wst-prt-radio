# Fly.io + Vercel Deploy Guide

This repo is set up to deploy as:

- frontend: Vercel
- backend API: Fly.io

The browser live-room feature is peer-to-peer WebRTC audio. That means Fly mostly handles:

- room join / leave
- server-sent events
- signaling messages
- admin API
- SQLite-backed settings and audit data

It does **not** carry the live audio media itself in the current version.

## Recommended production shape

### Vercel

- Project root directory: `apps/web`
- Framework preset: Next.js
- Build settings: use [apps/web/vercel.json](../apps/web/vercel.json)

### Fly.io

- Deploy command should be run from the repo root
- Fly config file: [infra/fly/fly.toml](../infra/fly/fly.toml)
- Dockerfile path inside that config: [apps/api/Dockerfile](../apps/api/Dockerfile)

## What size Fly instance to start with

Start with:

- `shared-cpu-1x`
- `512mb` RAM
- `1` machine

That is a good first size because the API is mainly Fastify + SQLite + SSE signaling.

Move to `1gb` if you expect:

- lots of concurrent open live-room tabs
- many simultaneous SSE clients
- heavier admin usage
- frequent deploy-time OOMs or runtime memory pressure

If this stays mostly in the “small internet radio / open mic” range, `512mb` is a sensible default.

## Fly volume

The API uses SQLite, so you should create a persistent Fly volume before first deploy.

Typical size:

- `1gb` is enough to start

The configured mount target is `/data` and the DB path is `/data/wstprtradio.db`.

## Fly setup steps

From the repo root:

1. create the Fly app
2. create the volume
3. set secrets
4. deploy

Example flow:

```bash
fly launch --no-deploy --copy-config --name your-api-app-name --region iad
fly volumes create wstprtradio_data --region iad --size 1 --app your-api-app-name
FLY_APP_NAME=your-api-app-name bash infra/fly/deploy.sh
```

## Fly secrets to set

Set these on the Fly app:

- `SESSION_SECRET`
- `BACKEND_ENCRYPTION_KEY`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `CORS_ALLOWED_ORIGINS`
- `STREAM_PUBLIC_URL`
- `STREAM_METADATA_PROVIDER`
- `STATIC_NOW_PLAYING_TITLE`
- `STATIC_NOW_PLAYING_ARTIST`
- `STATIC_NOW_PLAYING_ALBUM`
- `LIVE_ROOM_DEFAULT_TITLE`
- `LIVE_ROOM_DEFAULT_ACCESS`
- `LIVE_ROOM_DEFAULT_MODE`
- `LIVE_ROOM_SHARED_PASSPHRASE`
- `LIVE_ROOM_HOST_SECRET`

Optional legacy / video secrets:

- `AZURACAST_BASE_URL`
- `AZURACAST_PUBLIC_STREAM_URL`
- `AZURACAST_PUBLIC_API_URL`
- `AZURACAST_API_KEY`
- `AZURACAST_STATION_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `CLOUDFLARE_LIVE_INPUT_ID`
- `DISCORD_WEBHOOK_URL`

For a standard public deployment with Vercel frontend on `https://wstprtradio.com`, set:

- `CORS_ALLOWED_ORIGINS=https://wstprtradio.com,https://www.wstprtradio.com`

If you serve admin from another web origin, include that too.

## Vercel setup steps

Create a Vercel project pointed at this repo and set:

- Root Directory: `apps/web`

Then add these environment variables:

- `NEXT_PUBLIC_API_BASE_URL=https://your-api-app-name.fly.dev`
- `NEXT_PUBLIC_PUBLIC_SITE_URL=https://your-site-domain.com`
- `NEXT_PUBLIC_STREAM_URL=https://your-stream-domain-or-url`

If you later attach custom domains:

- frontend custom domain on Vercel, e.g. `wstprtradio.com`
- API custom domain on Fly, e.g. `api.wstprtradio.com`

Then update:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_PUBLIC_SITE_URL`
- Fly `CORS_ALLOWED_ORIGINS`

## Which directory to point each platform at

### Fly.io

- run deploys from the repo root
- use `infra/fly/fly.toml`
- do **not** point Fly at `apps/api` directly unless you also rewrite the build config

### Vercel

- set the project root directory to `apps/web`

## Important current limitation

The `/live` browser mic flow currently sends audio directly between browsers with WebRTC.

That means:

- users on the public web can join and hear each other
- Fly only handles signaling
- this does **not** automatically become the Icecast station source

## Internet reliability note

The current client uses a public STUN server only.

That is enough to get many browser-to-browser connections working, but not all of them.

For a more reliable public internet launch, add a TURN service later so users behind stricter NATs can still connect.

If you want browser “Go live” to also feed the station stream, that is a separate bridge step.

## Quick sanity checklist

- Fly `/health` returns `200`
- Fly `/public/live-room` returns JSON
- Vercel site loads
- Vercel frontend can join `/live`
- browser console shows no CORS errors
- if using login/admin, API cookies work over HTTPS