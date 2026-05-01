#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${FLY_APP_NAME:-wst-prt-radio}"
STATION_NAME="${STATION_NAME:-West Port Radio}"
CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://wst-prt-radio.vercel.app}"
SQLITE_DB_PATH="${SQLITE_DB_PATH:-/data/wstprtradio.db}"

echo "Setting Fly secrets for $APP_NAME..."
fly secrets set \
  --app "$APP_NAME" \
  APP_ENV="production" \
  SQLITE_DB_PATH="$SQLITE_DB_PATH" \
  CORS_ALLOWED_ORIGINS="$CORS_ALLOWED_ORIGINS" \
  STATION_NAME="$STATION_NAME"

echo
echo "Done."
echo "If you have not created the volume yet, run:"
echo "  fly volumes create data --app $APP_NAME --region iad --size 1"
echo
echo "Then deploy with:"
echo "  fly deploy --app $APP_NAME"