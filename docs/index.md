---
layout: default
title: West Port Radio — Documentation
---

# West Port Radio Docs

> 88.9 FM · Kansas City, Missouri · Pirate Radio

This site documents the technical stack, deployment process, and operational guides for **West Port Radio** — a live WebRTC radio station with an always-on jukebox fallback.

---

## For humans

| Guide | Description |
|---|---|
| [Stream Architecture](architecture) | How the whole system fits together — signal server, WebRTC, always-on jukebox |
| [Web DJ Guide](web-dj-guide) | How to broadcast live from your browser |
| [Musician Guide](musician-guide) | Submitting music for the always-on playlist |
| [OBS Profile Guide](obs-profile-guide) | Broadcasting with OBS Studio |
| [BUTT Fallback Guide](butt-fallback-guide) | Using BUTT as an Icecast fallback stream |
| [Icecast Fallback Guide](icecast-fallback-guide) | Running a local Icecast relay |
| [Fly + Vercel Deploy](fly-vercel-deploy) | Deploying the API to Fly.io and the web to Vercel |
| [Linux Machine Setup](linux-machine-setup) | Setting up a Linux broadcast machine |
| [Local Network Streaming](local-network-streaming) | Streaming on a local LAN |
| [DNS Checklist](dns-checklist) | Custom domain DNS setup |

## For AI agents

Start with [`architecture.md`](architecture) for a complete map of the codebase, signal protocol, state machine, shared types, and deployment commands.

The [API Reference](api-reference) documents every HTTP and WebSocket endpoint.

### Quick orientation

- **Signal server** — `apps/api/src/services/liveRoomService.ts`
- **Global audio context** — `apps/web/src/lib/AudioProvider.tsx`
- **Shared types** — `packages/shared/src/types/`
- **Always-on jukebox** — `apps/api/src/services/autoplayService.ts`
- **Player UI** — `apps/web/src/components/PlayerBar.tsx`
- **Deploy** — `fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --remote-only`

---

## Stack

| Layer | Technology |
|---|---|
| Front-end | Next.js 15 (App Router), Tailwind CSS, React |
| API / Signal | Fastify, WebSockets, SQLite (better-sqlite3) |
| Audio | WebRTC (peer-to-peer live), `<audio>` (always-on fallback) |
| Hosting | Vercel (web), Fly.io (API) |
| Package manager | pnpm workspaces |
