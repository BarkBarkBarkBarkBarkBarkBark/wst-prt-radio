---
layout: default
title: API reference
---

# API reference (canonical)

Base URL: your Fly app (e.g. `https://wst-prt-radio.fly.dev`) or `http://localhost:3001`.

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/health` | `{ status, timestamp, station }` |
| `GET` | `/public/status` | Station + listener count + broadcaster slot |
| `GET` | `/public/autoplay` | Jukebox playlist JSON |
| `GET` | `/public/autoplay/files/:filename` | Audio stream |
| `POST` | `/public/autoplay/next` | Advance jukebox (broadcasts over `/signal`) |
| `GET` | `/docs` | Swagger UI |
| WebSocket | `/signal` | See `packages/shared/src/types/liveRoom.ts` |

Admin (open in local-first deployments):

| Method | Path |
|--------|------|
| `GET` | `/admin/status` |
| `POST` | `/admin/open` |
| `POST` | `/admin/close` |
| `POST` | `/admin/kick` |
| `POST` | `/admin/block` |
| `POST` | `/admin/clear-blocks` |

There are **no** AzuraCast or Cloudflare webhooks in this codebase — older docs that mention them are obsolete.
