---
layout: default
title: Go live from the browser
---

# Go live from the browser

West Port Radio uses **WebRTC** from the **`/stream`** page (no external “Web DJ” product).

1. Open the site’s **`/stream`** route.
2. Tap **Start** and allow microphone access.
3. Listeners who have the main page open (Play enabled) hear you when the station shows **live**.

Signaling runs over `wss://<API>/signal`; audio is peer-to-peer after the handshake. For strict NATs you may later add TURN credentials in the web app’s `RTCPeerConnection` config — not on the Fastify server.
