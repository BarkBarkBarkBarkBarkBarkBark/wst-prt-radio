---
layout: default
title: API Reference — wstprtradio
---

# API Reference — wstprtradio

This repo uses a Fastify API in [apps/api](../apps/api) as the control plane for the station.

## Live docs

When the API is running locally, browse:

- [http://localhost:3001/docs](http://localhost:3001/docs)

That UI is backed by [apps/api/openapi.yaml](../apps/api/openapi.yaml), which is intended to stay readable in GitHub and easy to update during the early build-out phase.

## What the API is responsible for

- session-based admin authentication
- current station mode (`autodj`, `live_audio`, `live_video`, `degraded`)
- destination management for Cloudflare Stream fanout
- station settings storage
- audit logging
- webhook intake from vestigial AzuraCast and Cloudflare Stream integrations

## Public endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | basic health and timestamp |
| `GET` | `/public/status` | derived station mode + now playing + live session |
| `GET` | `/public/now-playing` | current now-playing payload; static fallback when AzuraCast is absent |
| `GET` | `/public/live-session` | current active live video session or `null` |

## Auth endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/login` | creates a cookie-backed session |
| `POST` | `/auth/logout` | clears the session |

## Admin endpoints

These require the session cookie set by `POST /auth/login`.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/admin/me` | current authenticated user |
| `GET` | `/admin/dashboard` | mode + now playing + recent audit summary |
| `GET` | `/admin/station/status` | current source-provider status + Cloudflare status |
| `POST` | `/admin/live/audio/open-web-dj-link` | returns legacy AzuraCast Web DJ URL when configured |
| `POST` | `/admin/live/video/session` | creates a pending live video session |
| `POST` | `/admin/live/video/end` | closes the latest pending or active session |
| `GET` | `/admin/destinations` | list destinations |
| `POST` | `/admin/destinations` | create destination |
| `PATCH` | `/admin/destinations/:id` | update destination |
| `DELETE` | `/admin/destinations/:id` | delete destination |
| `POST` | `/admin/destinations/:id/test` | test Cloudflare output creation |
| `GET` | `/admin/settings` | read persisted station settings |
| `PATCH` | `/admin/settings` | upsert station settings |
| `GET` | `/admin/audit` | paginated audit log |

## Webhooks

| Method | Path | Source |
|---|---|---|
| `POST` | `/webhooks/cloudflare-stream` | Cloudflare Stream |
| `POST` | `/webhooks/azuracast` | AzuraCast |

## Operational notes

### Session model

The API uses server-side sessions via `@fastify/session`. In local development the cookie is non-secure; in production it becomes secure automatically.

### Primary stream model

The primary runtime assumption is now a generic Icecast-compatible stream URL plus static fallback metadata. AzuraCast is optional and vestigial.

### Audit logging

Audit writes are centralized in [apps/api/src/lib/audit.ts](../apps/api/src/lib/audit.ts). Early-stage route work should use that helper instead of writing directly to `audit_log`.

### OpenAPI maintenance

During this early stage, the best low-debt path is:

1. keep [apps/api/openapi.yaml](../apps/api/openapi.yaml) concise
2. keep route behavior simple
3. update the spec only when routes change meaningfully

That keeps `/docs` useful without forcing a large schema framework too early.

## Troubleshooting

### `/docs` does not load

- confirm the API started successfully
- confirm port `3001` is exposed and not already taken
- confirm `@fastify/swagger` and `@fastify/swagger-ui` are installed in the API workspace

### `/public/now-playing` looks generic or static

- that is expected in the default setup
- check `STREAM_PUBLIC_URL`
- customize `STATIC_NOW_PLAYING_TITLE` and `STATIC_NOW_PLAYING_ARTIST` if needed
- only configure `AZURACAST_*` if you intentionally want the legacy integration back

### Admin routes return `401`

- log in first via `/auth/login`
- confirm the browser is sending cookies
- if testing from another device on your LAN, confirm the API CORS rules allow that origin
