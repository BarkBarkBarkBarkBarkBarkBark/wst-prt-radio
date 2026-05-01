---
layout: default
title: Icecast fallback guide
---

# Icecast + jukebox (Docker)

For LAN or ops who want a classic **`/radio.mp3`** mount alongside the Next/Fastify stack:

```bash
pnpm local:install
```

That brings up Icecast, the bundled jukebox, API, and web UI (`scripts/install-local.sh`).

Drop MP3s in **`media/library`** so Liquidsoap feeds Icecast.

The **canonical listener path** in this repo is still **`AudioProvider`**: autoplay files from the API plus WebRTC live audio — Icecast is optional infrastructure for encoding / external listeners.
