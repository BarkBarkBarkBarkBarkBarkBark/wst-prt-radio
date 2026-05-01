---
layout: default
title: DNS Checklist — West Port Radio
---

# DNS checklist

## Typical records

| Record | Type | Value |
|--------|------|--------|
| Apex / `www` | per Vercel | Vercel dashboard |
| API | CNAME | `your-app.fly.dev` |
| Stream (optional) | A / CNAME | wherever **`STREAM_PUBLIC_URL`** or Icecast lives |

Live browser audio uses **WebRTC** via your API’s **`/signal`** — no extra DNS for that beyond the API hostname.

## Checks

```bash
dig +short api.example.com
curl -fsS https://api.example.com/health
```

Ensure **`CORS_ALLOWED_ORIGINS`** on Fly lists your exact web origin(s).
