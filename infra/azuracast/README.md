# AzuraCast Setup

## Overview

wstprtradio uses AzuraCast as the radio backend for AutoDJ and live audio streaming.

## Recommended Install

Deploy AzuraCast via Docker on a VPS (2 vCPU, 2GB RAM minimum):

```bash
mkdir -p /var/azuracast
cd /var/azuracast
curl -fsSL https://raw.githubusercontent.com/AzuraCast/AzuraCast/main/docker.sh > docker.sh
chmod +x docker.sh
./docker.sh install
```

## Configuration

1. Create a station named `wstprtradio` (Station ID 1 by default)
2. Generate an API key in AzuraCast admin → API Keys
3. Configure the public stream URL: `https://radio.wstprtradio.com/radio.mp3`
4. Enable Web DJ in the station settings
5. Set up Liquidsoap / Icecast for streaming

## API Keys

Set `AZURACAST_API_KEY` in `apps/api/.env` with your generated API key.

## Webhooks

Configure AzuraCast to POST to `https://api.wstprtradio.com/webhooks/azuracast` on now-playing updates.
