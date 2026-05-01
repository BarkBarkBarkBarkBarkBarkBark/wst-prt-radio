---
layout: default
title: DNS Checklist — wstprtradio
---

# DNS Checklist — wstprtradio

Before launch, verify all DNS records are correctly configured.

## Required Records

| Record | Type | Value | TTL |
|---|---|---|---|
| `wstprtradio.com` | A | Vercel IP (from Vercel dashboard) | 300 |
| `www.wstprtradio.com` | CNAME | `cname.vercel-dns.com` | 300 |
| `api.wstprtradio.com` | CNAME | `wstprtradio-api.fly.dev` | 300 |
| `radio.wstprtradio.com` | A | AzuraCast server IP | 300 |
| `azura-admin.wstprtradio.com` | A | AzuraCast server IP | 300 |

## Verification Commands

```bash
# Check main site
dig wstprtradio.com A

# Check API
dig api.wstprtradio.com CNAME

# Check radio stream
dig radio.wstprtradio.com A

# Test stream endpoint
curl -I https://radio.wstprtradio.com/radio.mp3

# Test API health
curl https://api.wstprtradio.com/health
```

## SSL Certificates

- **Vercel**: Automatic via Let's Encrypt — no action needed
- **Fly.io**: Automatic via `fly certs add api.wstprtradio.com`
- **AzuraCast**: Use Certbot on the VPS:
  ```bash
  certbot --nginx -d radio.wstprtradio.com -d azura-admin.wstprtradio.com
  ```

## Checklist

- [ ] `wstprtradio.com` resolves to Vercel
- [ ] `www.wstprtradio.com` redirects to apex
- [ ] `api.wstprtradio.com/health` returns `{"status":"ok"}`
- [ ] `radio.wstprtradio.com/radio.mp3` streams audio
- [ ] `azura-admin.wstprtradio.com` loads AzuraCast UI
- [ ] All SSL certs valid and auto-renewing
- [ ] CORS headers correct on API (check with browser DevTools)
