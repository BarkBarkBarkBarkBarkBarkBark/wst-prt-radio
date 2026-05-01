---
layout: default
title: Operational runbook
---

# Runbook

Operational playbook for West Port Radio. Pair this with [`docs/architecture.md`](architecture.md) for the why; this doc is the what-to-type.

## Daily smoke check

```bash
# Liveness + readiness
curl https://wst-prt-radio.fly.dev/health
curl https://wst-prt-radio.fly.dev/ready

# Public station snapshot
curl https://wst-prt-radio.fly.dev/public/status | jq

# Vercel front-end
curl -I https://wst-prt-radio.vercel.app/
```

If `/health` is 200 and `/ready` is 200 with `status: "ready"`, the service is healthy. A 200 on `/health` plus a 503 on `/ready` means the process is up but the SQLite volume is unreachable — page on-call.

## Deploy

### Web (Vercel)

Auto-deploys on push to `main` from `apps/web`. No manual step. Verify on the Vercel dashboard. Roll back via Vercel UI → Deployments → Promote previous.

### API (Fly.io) — manual

```bash
cd wst-prt-radio
fly deploy --config fly.toml
fly status --app wst-prt-radio
fly logs --app wst-prt-radio
```

Required secrets (set once, not on every deploy):

```bash
ADMIN_USERS='marco:<password>,mun:<password>' \
SESSION_SECRET=$(openssl rand -hex 32) \
CORS_ALLOWED_ORIGINS='https://wst-prt-radio.vercel.app' \
./scripts/set-fly-env.sh
```

If the volume doesn't exist yet:

```bash
fly volumes create data --app wst-prt-radio --region iad --size 1
```

### Roll back a Fly release

```bash
fly releases --app wst-prt-radio
fly releases rollback <version> --app wst-prt-radio
```

## Common incidents

### "Stream is stuck on closed"

Symptom: `/public/status` shows `stationState: "closed"` and won't accept new broadcasters.

Resolution:

```bash
# Easiest: log in to /admin and click Open Stream.
# If the admin UI is also broken, do it from the API directly:
curl -X POST https://wst-prt-radio.fly.dev/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"marco","password":"<password>"}' \
  -c cookies.txt
curl -X POST https://wst-prt-radio.fly.dev/admin/open -b cookies.txt
```

If the database itself is wedged (broadcaster_peer_id pinned with no live socket — should not happen post-Phase 2 but sanity check):

```bash
fly ssh console --app wst-prt-radio
sqlite3 /data/wstprtradio.db
> UPDATE stream_state
  SET station_state = 'open', broadcaster_peer_id = NULL, live_session_id = NULL, broadcaster_display_name = NULL, updated_at = datetime('now')
  WHERE id = 'primary';
> .quit
```

### "Boot the bad DJ" from the CLI

```bash
# Authenticate, then kick.
curl -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"marco","password":"<pw>"}' -c cookies.txt
curl -X POST $API/admin/kick -b cookies.txt
# To also block them so they can't immediately rejoin:
curl -X POST $API/admin/block -b cookies.txt
```

The Phase 2 fix in `normalizeState` means even if the kick races a network drop, the slot will free up on the next status read — the broadcaster can't pin the station with a stale peer id.

### "Listeners can't hear live audio on cellular / strict NAT"

Symptom: WebRTC handshake completes (broadcaster sees connection) but listener's amplitude meter stays at 0.

This is the public-Google-STUN-only ceiling. Add a TURN server. Front-end-only change:

1. Sign up for a TURN provider (Twilio, Cloudflare Realtime, coturn on a $5 VPS).
2. Edit [`apps/web/src/lib/AudioProvider.tsx`](../apps/web/src/lib/AudioProvider.tsx) and [`apps/web/src/components/StreamClient.tsx`](../apps/web/src/components/StreamClient.tsx). Replace the existing `rtcConfig`:

```ts
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      urls: ['turn:turn.example.com:3478'],
      username: 'wstprtradio',
      credential: 'shared-secret',
    },
  ],
};
```

3. Vercel auto-redeploys on push. No API change needed.

### "Wipe blocklist"

```bash
curl -X POST $API/admin/clear-blocks -b cookies.txt
```

Or from the admin UI: "Clear Blocklist".

### "Rotate admin passwords"

1. Generate a new `ADMIN_USERS` string.
2. `fly secrets set --app wst-prt-radio ADMIN_USERS='marco:newpw,mun:newpw'`
3. Fly rolls the machine; in-memory hashes refresh. Existing cookies survive (the session secret didn't change). To invalidate all sessions, also rotate `SESSION_SECRET`.

### "Reset the always-on jukebox to track 0"

Restart the API machine. The scheduler is in-memory; a restart resets `trackIndex` to 0 and `startedAt` to `Date.now()`. Listeners will all jump to the new track on the next `station_status`.

```bash
fly machines list --app wst-prt-radio
fly machines restart <id> --app wst-prt-radio
```

### "Verify a fresh deploy is healthy"

```bash
# 1. Liveness + readiness
curl -fsS $API/health && echo OK
curl -fsS $API/ready && echo OK

# 2. Auth happy path
curl -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"marco","password":"<pw>"}' -c c.txt
curl $API/auth/me -b c.txt

# 3. Admin status
curl $API/admin/status -b c.txt | jq .stationState

# 4. Open two browser tabs:
#    tab A: https://wst-prt-radio.vercel.app/        (press Play)
#    tab B: https://wst-prt-radio.vercel.app/stream  (Start, allow mic)
# Listener should hear broadcaster within ~3 seconds.
```

## Logs and observability

```bash
fly logs --app wst-prt-radio              # tail
fly logs --app wst-prt-radio | grep audit # admin actions
```

Audit-log entries also live in SQLite (`audit_log` table) — the last 1000 entries are retained, with hourly trim. To inspect:

```bash
fly ssh console --app wst-prt-radio
sqlite3 /data/wstprtradio.db 'SELECT actor, action, created_at FROM audit_log ORDER BY created_at DESC LIMIT 20;'
```

## CI

Every push and PR runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): typecheck, test, build api, build web. Don't merge red.

## Known limits

- WebRTC is full-mesh from the broadcaster. Practical ceiling is ~10–20 listeners per residential upload. SFU upgrade is a separate project.
- Always-on scheduler resets to track 0 on API restart (it's in-memory). Persisting it in `stream_state` is a small follow-up — see [`claims.yaml#always-on-restart-resets`](claims.yaml).
- Chat is `sessionStorage`-only, single tab. The Postgres/Supabase chat schema is sketched in [`architecture.md`](architecture.md#future-db-schema-postgres--supabase-target) but not implemented.
