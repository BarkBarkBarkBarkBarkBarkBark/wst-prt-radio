---
layout: default
title: Stream Architecture
---

# West Port Radio — Stream Architecture

> **Last updated:** 2026-05-01  
> **Status:** Production (Fly.io API · Vercel Web)

---

## Overview

West Port Radio is a pirate-radio–style single-broadcaster WebRTC station.  
One person broadcasts live at a time; everyone else listens. When no one is broadcasting, an always-on jukebox plays synchronized music for all connected listeners.

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (Vercel · wst-prt-radio.vercel.app)                   │
│                                                                │
│  AudioProvider (React context)                                 │
│    ├─ WebSocket → /signal  (live signalling)                   │
│    ├─ WebRTC   → broadcaster (live audio peer-to-peer)         │
│    └─ <audio>  → /public/autoplay/files/:file (always-on)      │
└────────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS / WSS
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  Fastify API (Fly.io · wst-prt-radio.fly.dev)                  │
│  PORT 8080  ·  SQLite on /data (persistent Fly volume)         │
│                                                                │
│  Routes                                                        │
│    GET  /health               → { status, station }           │
│    GET  /public/status        → StationStatus                 │
│    GET  /public/autoplay      → AlwaysOnPlaylist              │
│    GET  /public/autoplay/files/:file → audio stream           │
│    POST /public/autoplay/next → advance + broadcast AOS       │
│    WS   /signal               → SignalServer (WS hub)         │
│    GET  /admin/status         → AdminStatus  (auth required)  │
│    POST /admin/*              → admin actions (auth required)  │
└────────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Location | Purpose |
|---|---|---|
| `@wstprtradio/shared` | `packages/shared` | Shared TypeScript types; must be built before other packages |
| `@wstprtradio/web` | `apps/web` | Next.js 15 App Router front-end |
| `@wstprtradio/api` | `apps/api` | Fastify signal server + REST API |

---

## Signal Server (`/signal` WebSocket)

All real-time coordination goes through a single persistent WebSocket endpoint.

### Connection lifecycle

1. Client opens `wss://wst-prt-radio.fly.dev/signal`
2. Client sends `join_as_listener` **or** `join_as_broadcaster` with its `peerId`
3. Server registers the connection and immediately sends a `station_status` message
4. Server broadcasts `station_status` to **all** connected clients on any state change

### Client → Server messages (`SignalClientMessage`)

| Type | Payload | Description |
|---|---|---|
| `join_as_listener` | `{ peerId }` | Register as a passive listener |
| `join_as_broadcaster` | `{ peerId, displayName? }` | Claim the broadcaster slot |
| `sdp_offer` | `{ peerId, targetPeerId, sdp }` | WebRTC offer relay |
| `sdp_answer` | `{ peerId, targetPeerId, sdp }` | WebRTC answer relay |
| `ice_candidate` | `{ peerId, targetPeerId, candidate }` | ICE relay |
| `leave` | `{ peerId }` | Graceful disconnect |

### Server → Client messages (`SignalServerMessage`)

| Type | Payload | Description |
|---|---|---|
| `station_status` | `StationStatus` + `alwaysOnState?` | Broadcast on every state change |
| `broadcaster_accepted` | `{ liveSessionId }` | Sent to the new broadcaster |
| `broadcaster_rejected` | `{ reason }` | Station closed / blocked / full |
| `listener_accepted` | — | Sent to confirmed listeners |
| `peer_offer` | `{ fromPeerId, sdp }` | Relayed WebRTC offer |
| `peer_answer` | `{ fromPeerId, sdp }` | Relayed WebRTC answer |
| `ice_candidate` | `{ fromPeerId, candidate }` | Relayed ICE candidate |
| `force_disconnect` | `{ reason }` | Kick / block |

---

## Station State Machine

Stored in SQLite table `stream_state` (single row `id = 'primary'`).

```
         admin: open_station
  ┌──────────────────────────┐
  │                          │
  ▼                          │
OPEN  ──broadcaster joins──► LIVE ──broadcaster leaves──► OPEN
  │                                                         ▲
  │ admin: close_station                                    │
  ▼                                                         │
CLOSED                                                       │
  │                                                         │
  │ admin: open_station ─────────────────────────────────────┘
  │
  ▼
BLOCKED  (station blocked by admin, all connections rejected)
```

`normalizeState()` runs on every status read: if the DB says `live` but no broadcaster is connected in-memory, it automatically transitions to `open` and ends the dangling session.

---

## Always-On Jukebox

When no broadcaster is live, listeners hear a synchronized jukebox.

### Server side (`autoplayService.ts`)

- Scans `songs/` directory on the Fly volume for audio files (`.mp3`, `.ogg`, `.m4a`, `.flac`, `.wav`)
- Maintains in-memory `schedulerState: { trackIndex, startedAt: unixMs }`
- `getAlwaysOnState()` exposes the current index + timestamp
- `advanceAlwaysOnTrack()` moves to the next track and resets `startedAt`
- State is **in-memory** — resets to track 0 on server restart

### Client side (`AudioProvider.tsx`)

- On `station_status` WS message: receives `alwaysOnState = { trackIndex, startedAt }`
- Computes `seekSecs = (Date.now() - startedAt) / 1000`
- Seeks the `<audio>` element to that offset on `loadedmetadata`
- All listeners are therefore synchronized to within ~1 s of each other
- When a track ends, client POSTs `POST /public/autoplay/next` — server advances its scheduler and broadcasts the new state to every connected listener via WS

---

## Audio Flow

### Live broadcast

```
Broadcaster mic
  └─► getUserMedia()
       └─► RTCPeerConnection (offer/answer via /signal WS)
            └─► Listener's <audio> element (direct P2P)
```

### Always-on fallback

```
Fly volume (songs/)
  └─► GET /public/autoplay/files/:filename  (HTTP audio stream)
       └─► <audio> element (seeked to synchronized offset)
```

---

## Shared Types (`@wstprtradio/shared`)

Key interfaces in `packages/shared/src/types/`:

```ts
// station.ts
interface StationStatus {
  stationState: 'closed' | 'open' | 'live' | 'blocked' | 'degraded';
  liveSessionId: string | null;
  listenerCount: number;
  broadcasterPresent: boolean;
  broadcasterPeerId: string | null;
  broadcasterDisplayName: string | null;
  updatedAt: string;
  alwaysOnState?: AlwaysOnState;   // present when no broadcaster
}

interface AlwaysOnState {
  trackIndex: number;   // index into AlwaysOnPlaylist.tracks
  startedAt: number;    // unix ms when this track started
}

interface AdminStatus extends StationStatus {
  broadcasterStatus: BroadcasterStatus | null;
  currentBroadcaster: BroadcasterStatus | null;
  listenerPeerIds: string[];
  recentAudit: AuditLogEntry[];
  blockedPeerCount: number;
}
```

> **Important:** Whenever `packages/shared/src` types change, run `pnpm --filter @wstprtradio/shared build` before building other packages.

---

## Deployment

### Web (Vercel)

- Auto-deploys on push to `main`
- Environment variables set in Vercel dashboard (see `infra/vercel/ENV_DOCS.md`)
- `NEXT_PUBLIC_API_URL` must point to the Fly API (`https://wst-prt-radio.fly.dev`)

### API (Fly.io)

```bash
# From workspace root:
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --remote-only
```

Config file: [`apps/api/fly.toml`](../apps/api/fly.toml)

Key env vars (set in `fly.toml [env]` or via `fly secrets set`):

| Variable | Value | Description |
|---|---|---|
| `PORT` | `8080` | Must match `http_service.internal_port` in fly.toml |
| `APP_ENV` | `production` | |
| `SQLITE_DB_PATH` | `/data/wstprtradio.db` | Fly persistent volume |
| `ADMIN_KEY` | _(secret)_ | Bearer token for `/admin/*` routes |
| `CORS_ALLOWED_ORIGINS` | `https://wst-prt-radio.vercel.app` | |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Stream page shows CLOSED / can't connect | API not responding (503) | Check `fly status --app wst-prt-radio` and logs |
| API 503 "not listening on 0.0.0.0:8080" | `PORT` env mismatch | Ensure `PORT=8080` in `fly.toml [env]` |
| Start button spins forever | WS connection to `/signal` failing | Check browser network tab for WS handshake errors |
| Admin shows OPEN but stream shows CLOSED | Initial HTTP fetch to `/public/status` failed | Check API health at `/health` |
| Always-on tracks out of sync | Server restarted (in-memory state reset) | Client will re-sync on next `station_status` WS message |
| Songs not playing | `songs/` dir empty on Fly volume | SSH into machine and add audio files |

---

## File Map (for AI agents)

```
apps/
  api/
    src/
      index.ts                  ← Fastify bootstrap, port binding
      server.ts                 ← Plugin registration
      lib/
        env.ts                  ← Zod env validation (PORT, SQLITE_DB_PATH, …)
      services/
        liveRoomService.ts      ← WebSocket hub, state machine, broadcaster/listener logic
        autoplayService.ts      ← Always-on jukebox scheduler
      routes/
        health.ts               ← GET /health
        signal.ts               ← WS /signal
        public/
          autoplay.ts           ← GET+POST /public/autoplay/*
  web/
    src/
      lib/
        AudioProvider.tsx       ← Global audio context (WS + WebRTC + fallback audio)
        api.ts                  ← apiFetch(), getSignalUrl()
      components/
        PlayerBar.tsx           ← Fixed bottom player UI
        StreamClient.tsx        ← Broadcaster page UI
        AdminConsole.tsx        ← Admin dashboard
packages/
  shared/
    src/
      types/
        station.ts              ← StationStatus, AdminStatus, AlwaysOnState
        liveRoom.ts             ← SignalClientMessage, SignalServerMessage
```
