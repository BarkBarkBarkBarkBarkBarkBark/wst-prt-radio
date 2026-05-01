---
layout: default
title: Local Network Streaming Guide — wstprtradio
---

# Local Network Streaming Guide — wstprtradio

This is the shortest path to the thing that matters most right now: **send a stream from one device and hear it on another device on your local network**.

## Topology

Keep the monorepo identical everywhere, but give each location a job:

| Location | Role |
|---|---|
| local dev machine | active development, UI work, LAN demos |
| Fly.io machine | control-plane API |
| AWS or dedicated VM | radio backend / Icecast / broadcast ingress |

For local development, it is perfectly fine to run all pieces from one machine first.

## Recommended early-stage local setup

## Fastest setup

From the repo root, run:

```bash
pnpm local:install
```

That will prepare env files, generate Icecast credentials, pull/build the container images used by local development, install workspace dependencies in Docker, and start Icecast, the jukebox, the API, and the web services.

If you want the env files regenerated for a different LAN IP, run:

```bash
pnpm local:install -- --refresh-env --refresh-stack-env
```

After startup, the script prints the Icecast source credentials for a mount at `/radio.mp3`.

It also creates `media/library`, which is watched by the local jukebox container. Put MP3 files there to start automatic playback.

### On the main dev machine

Run:

- Next.js web app on port `3000`
- Fastify API on port `3001`
- Icecast or another compatible source on the same machine or another machine on the same LAN

### On the second device

Open the site in a browser using the dev machine's LAN IP:

- `http://YOUR_LAN_IP:3000`

The web app should then fetch metadata from:

- `http://YOUR_LAN_IP:3001`

And play audio from:

- `http://YOUR_LAN_IP:8000/radio.mp3`

## Prerequisites

### Required

- Node.js `20+`
- `pnpm`
- Docker Desktop or Docker Engine
- a LAN IP you can reach from another device

### Streaming tools

Pick one of these to originate the audio stream:

- **BUTT** for a lightweight encoder from a mic, mixer, or DAW
- **OBS / Mixxx / Liquidsoap** for richer live or jukebox setups

Relevant repo docs:

- [docs/web-dj-guide.md](./web-dj-guide.md)
- [docs/butt-fallback-guide.md](./butt-fallback-guide.md)

## Step 1 — Install repo dependencies

From the repo root:

1. install dependencies
2. build the shared package once

If you want to use the helper compose file, see [local_deploy.yaml](../local_deploy.yaml). If you prefer the least moving parts, run the Node processes directly on the host.

## Step 2 — Create local env files

### API env

Copy `apps/api/.env.example` to `apps/api/.env` and use local or LAN-accessible values.

Suggested early-stage values:

- `APP_ENV=development`
- `PORT=3001`
- `SQLITE_DB_PATH=./data/wstprtradio.db`
- `STREAM_PUBLIC_URL=http://YOUR_STREAM_HOST:8000/radio.mp3`
- `STREAM_METADATA_PROVIDER=static`
- `STATIC_NOW_PLAYING_TITLE=West Port Radio`
- `STATIC_NOW_PLAYING_ARTIST=Icecast Stream`

Generate secrets locally:

- `SESSION_SECRET`: any random 32+ char string
- `BACKEND_ENCRYPTION_KEY`: `openssl rand -hex 32`

Also create the data folder before first boot:

- `apps/api/data`

### Web env

Copy `apps/web/.env.local.example` to `apps/web/.env.local`.

Suggested LAN-friendly values:

- `NEXT_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3001`
- `NEXT_PUBLIC_PUBLIC_SITE_URL=http://YOUR_LAN_IP:3000`
- `NEXT_PUBLIC_STREAM_URL=http://YOUR_LAN_IP:8000/radio.mp3`

## Step 3 — Start your stream backend

The primary path is now a generic Icecast-compatible stream. For practical purposes that means:

1. start Icecast on any reachable host
2. confirm the listener URL plays directly in a browser
3. use BUTT, OBS, Mixxx, or Liquidsoap as the encoder/source

## Step 4 — Start the monorepo

Run the repo root dev command.

Important implementation detail already handled in code:

- the API listens on `0.0.0.0`
- the web dev server now listens on `0.0.0.0`
- development CORS now allows `localhost`, `.local`, and private LAN IP origins

That means another device on the same network can hit your dev machine directly.

## Step 5 — Send audio from one device

### Option A: BUTT

1. install BUTT from [danielnoethen.de/butt](https://danielnoethen.de/butt/)
2. configure the server as IceCast
3. point it at the host running Icecast (see `pnpm local:install` / `local_deploy.yaml`)
4. use the **source password** printed in the installer output or `local_deploy.env`
5. start streaming

### Option B: Other encoders

OBS, Mixxx, and Liquidsoap also work as long as they can push to your Icecast-compatible endpoint.

## Step 6 — Listen on another device

On device B, open:

- `http://YOUR_LAN_IP:3000`

Press play. The audio element should use `NEXT_PUBLIC_STREAM_URL`, which is the most reliable early-stage setup.

## Quick troubleshooting

### The site loads on the second device, but audio will not play

- confirm `NEXT_PUBLIC_STREAM_URL` points to the correct LAN host and port
- open the stream URL directly in the second device browser
- confirm firewall rules allow port `8000`
- confirm your stream backend is actually receiving source audio

### The site loads, but metadata is missing

- confirm `STREAM_PUBLIC_URL` is correct
- check `/public/now-playing` on the API directly
- if you want richer metadata, move from static mode to a custom metadata path later

### The admin UI works on the main machine but not the second device

- confirm `NEXT_PUBLIC_API_BASE_URL` uses the LAN IP, not `localhost`
- confirm the API is reachable at `http://YOUR_LAN_IP:3001/health`
- confirm both devices are on the same subnet

### Login works locally but not from another device

- confirm the second device is using the same API origin as configured in `NEXT_PUBLIC_API_BASE_URL`
- confirm browser cookies are enabled
- confirm the request origin is a private LAN IP or `.local` hostname

## Why this setup reduces technical debt

- one repo everywhere
- one simple API docs entrypoint at `/docs`
- minimal custom orchestration
- the stream backend is decoupled from the app layer
- local network support is handled by envs, host binding, and CORS rather than one-off hacks

When the time comes to split roles across Fly.io and AWS, this local setup maps cleanly:

- the Fastify API moves to Fly.io
- Icecast or another stream backend stays on AWS or another persistent VM
- the web app can stay on Vercel or run locally for design work
