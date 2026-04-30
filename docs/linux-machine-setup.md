# Linux Machine Setup — Generic Stream Host + Monorepo

This guide is for the case where a Linux machine should host your stream backend and you will operate it over SSH.

## What services you need

For the shortest path to broadcasting from one device and listening on another, you need these services:

| Service | Needed | Why |
|---|---|---|
| Docker Engine + Compose | yes | runs the repo containers |
| Icecast-compatible stream backend | yes | actual audio delivery |
| Fastify API | yes | station state, admin API, now playing, audit |
| Next.js web | yes | listener UI and admin UI |
| Tailscale | optional but recommended | easier private admin access across machines |
| AzuraCast | optional / vestigial | only if you revive legacy Web DJ + metadata |
| Cloudflare Stream | not needed for first local success | only needed for live video fanout |

## What runs where

### Linux machine

- Icecast-compatible stream backend
- repo Docker services from [local_deploy.yaml](../local_deploy.yaml): API and web
- optional Tailscale

### Source device

- BUTT, OBS, Mixxx, or Liquidsoap sending audio to your stream backend

### Listener device

- browser pointed at `http://LINUX_MACHINE_IP:3000`

## One-command prep script

After cloning the repo on the Linux machine:

```bash
bash scripts/install-linux-machine.sh --role all
```

That script will:

1. install base apt packages
2. install Docker if missing
3. optionally install Tailscale
4. optionally run the legacy AzuraCast installer
5. write LAN-friendly env files for the repo
6. pull the Node images for the monorepo
7. install workspace dependencies in Docker
8. start the API and web services

## Common variants

Install everything including Tailscale:

```bash
bash scripts/install-linux-machine.sh --role all --install-tailscale
```

Only install legacy AzuraCast:

```bash
bash scripts/install-linux-machine.sh --role azuracast
```

Only run the repo services after AzuraCast is already installed:

```bash
bash scripts/install-linux-machine.sh --role monorepo --refresh-env
```

## After the script finishes

You still need to bring up a stream backend and confirm the listener URL works.

If you revive AzuraCast later, then do the old UI steps and fill in the `AZURACAST_*` variables manually.

Restart the API after env changes:

```bash
docker compose -f local_deploy.yaml restart api
```

## Primary env model

The app now assumes:

- browser-facing and API-facing playback uses `STREAM_PUBLIC_URL`
- browser playback uses `NEXT_PUBLIC_STREAM_URL`
- metadata is static unless you explicitly re-enable legacy AzuraCast polling

## Ports to expect

| Port | Service |
|---|---|
| `3000` | Next.js web |
| `3001` | Fastify API |
| `8000` | Icecast/stream listener URL |
| `8080` | optional legacy AzuraCast admin/API |

## First success checklist

To prove the setup works, verify these in order:

1. `http://LINUX_MACHINE_IP:3001/health` returns JSON
2. `http://LINUX_MACHINE_IP:3001/docs` loads API docs
3. `http://LINUX_MACHINE_IP:3000` loads the web app
4. the stream URL `http://LINUX_MACHINE_IP:8000/radio.mp3` plays directly
5. BUTT, OBS, Mixxx, or Liquidsoap can send audio
6. another device on the LAN can listen via the web app

## Over SSH tips

Useful commands after login:

```bash
docker compose -f local_deploy.yaml ps
docker compose -f local_deploy.yaml logs -f api web
docker compose -f local_deploy.yaml restart api web
```

For AzuraCast itself, manage it from `/opt/azuracast` using its official tooling.