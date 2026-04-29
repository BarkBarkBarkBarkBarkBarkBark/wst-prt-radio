# Vercel Environment Variables

Set these in the Vercel project settings for the `wstprtradio-web` project.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | Full URL to the API (e.g. `https://api.wstprtradio.com`) |
| `NEXT_PUBLIC_PUBLIC_SITE_URL` | ✅ | Public site URL (e.g. `https://wstprtradio.com`) |

## Setting via CLI

```bash
vercel env add NEXT_PUBLIC_API_BASE_URL production
vercel env add NEXT_PUBLIC_PUBLIC_SITE_URL production
```
