# Linux Machine Setup — AzuraCast + Monorepo

This guide is for the case where AzuraCast should live on a Linux machine and you will operate it over SSH.

## What services you need

For the shortest path to broadcasting from one device and listening on another, you need these services:

| Service | Needed | Why |
|---|---|---|
| Docker Engine + Compose | yes | runs the repo containers and AzuraCast installer |
| AzuraCast | yes | actual radio backend, Web DJ, Icecast stream |
| Fastify API | yes | station state, admin API, now playing, audit |
| Next.js web | yes | listener UI and admin UI |
| Tailscale | optional but recommended | easier private admin access across machines |
| Cloudflare Stream | not needed for first local success | only needed for live video fanout |

## What runs where

### Linux machine

- AzuraCast
- repo Docker services from [local_deploy.yaml](../local_deploy.yaml): API and web
- optional Tailscale

### Source device

- browser using AzuraCast Web DJ, or
- BUTT sending audio to AzuraCast

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
4. run the official AzuraCast installer
5. write LAN-friendly env files for the repo
6. pull the Node images for the monorepo
7. install workspace dependencies in Docker
8. start the API and web services

## Common variants

Install everything including Tailscale:

```bash
bash scripts/install-linux-machine.sh --role all --install-tailscale
```

Only install AzuraCast:

```bash
bash scripts/install-linux-machine.sh --role azuracast
```

Only run the repo services after AzuraCast is already installed:

```bash
bash scripts/install-linux-machine.sh --role monorepo --refresh-env
```

## After the script finishes

You still need to do a few AzuraCast UI steps manually:

1. open `http://LINUX_MACHINE_IP:8080`
2. create the station
3. enable Web DJ
4. generate an AzuraCast API key
5. paste the key into [apps/api/.env](../apps/api/.env)
6. restart the API:

```bash
docker compose -f local_deploy.yaml restart api
```

## Why the API env uses `host.docker.internal`

On Linux, AzuraCast is installed directly on the host, while the API runs in Docker.

The API must poll AzuraCast's `/api` endpoint from inside its container. To make that reliable, [local_deploy.yaml](../local_deploy.yaml) maps `host.docker.internal` to the Docker host gateway for the API container.

That means:

- browser-facing URLs use the Linux machine's LAN IP
- internal API-to-AzuraCast polling uses `http://host.docker.internal:8080/api`

## Ports to expect

| Port | Service |
|---|---|
| `3000` | Next.js web |
| `3001` | Fastify API |
| `8000` | Icecast/stream listener URL |
| `8080` | AzuraCast admin and public API |

## First success checklist

To prove the setup works, verify these in order:

1. `http://LINUX_MACHINE_IP:8080` loads AzuraCast
2. `http://LINUX_MACHINE_IP:3001/health` returns JSON
3. `http://LINUX_MACHINE_IP:3001/docs` loads API docs
4. `http://LINUX_MACHINE_IP:3000` loads the web app
5. the stream URL `http://LINUX_MACHINE_IP:8000/radio.mp3` plays directly
6. Web DJ or BUTT can send audio
7. another device on the LAN can listen via the web app

## Over SSH tips

Useful commands after login:

```bash
docker compose -f local_deploy.yaml ps
docker compose -f local_deploy.yaml logs -f api web
docker compose -f local_deploy.yaml restart api web
```

For AzuraCast itself, manage it from `/opt/azuracast` using its official tooling.