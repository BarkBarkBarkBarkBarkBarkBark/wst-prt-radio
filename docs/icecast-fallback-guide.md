# Icecast Fallback Guide — wstprtradio

AzuraCast is now treated as vestigial. The simplest supported path is a direct Icecast-compatible stream.

For the fastest local setup, use [scripts/install-local.sh](../scripts/install-local.sh) via:

```bash
pnpm local:install
```

That boots a local Icecast server in Docker and prints the source credentials you need.

It also starts a local jukebox container that watches `media/library` and pushes your MP3 collection into Icecast.

## What this buys you

- browser playback works immediately
- the API can return stable fallback metadata
- the web app no longer blocks on AzuraCast
- you can build either a live stream or a simple jukebox around Icecast

## Minimum setup

You need:

- an Icecast server
- one source client, such as BUTT, OBS, Mixxx, or Liquidsoap
- the stream URL in `STREAM_PUBLIC_URL` and `NEXT_PUBLIC_STREAM_URL`

Typical listener URL:

- `http://YOUR_HOST:8000/radio.mp3`

Typical admin URL:

- `http://YOUR_HOST:8000/admin/`

## API env

In [apps/api/.env.example](../apps/api/.env.example), the important variables are:

- `STREAM_PUBLIC_URL`
- `STREAM_METADATA_PROVIDER=static`
- `STATIC_NOW_PLAYING_TITLE`
- `STATIC_NOW_PLAYING_ARTIST`

Leave the `AZURACAST_*` variables blank unless you deliberately revive the legacy integration.

## Web env

In [apps/web/.env.local.example](../apps/web/.env.local.example):

- `NEXT_PUBLIC_STREAM_URL=http://YOUR_HOST:8000/radio.mp3`

## Jukebox path

If you want a jukebox instead of a live input:

1. drop MP3 files into `media/library`
2. let the bundled Liquidsoap jukebox feed Icecast automatically
3. keep the API in static metadata mode at first
4. later, add a tiny metadata endpoint if you want track titles to update dynamically

If you want to use your own jukebox source instead:

1. stop the bundled `jukebox` service
2. use Liquidsoap or another source client to feed Icecast
3. keep the API in static metadata mode at first
4. later, add a tiny metadata endpoint if you want track titles to update dynamically

## Live source path

If you want live streaming:

1. run Icecast
2. point BUTT or OBS at the source port/password
3. play audio in the web app from the listener URL

## Current repo behavior

Without AzuraCast:

- `/public/now-playing` returns fallback metadata instead of `503`
- admin settings mark AzuraCast as vestigial
- the legacy Web DJ button returns a helpful error unless explicitly configured

That is intentional. The app should remain useful even when AzuraCast is absent.