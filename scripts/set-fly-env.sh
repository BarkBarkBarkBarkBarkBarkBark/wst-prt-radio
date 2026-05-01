#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${FLY_APP_NAME:-wst-prt-radio}"
STATION_NAME="${STATION_NAME:-West Port Radio}"
CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://wst-prt-radio.vercel.app}"
SQLITE_DB_PATH="${SQLITE_DB_PATH:-/data/wstprtradio.db}"

if [[ -z "${ADMIN_USERS:-}" ]]; then
  echo "Refusing to deploy without ADMIN_USERS." >&2
  echo "Set it like:" >&2
  echo "  ADMIN_USERS='marco:supersecret,mun:alsosecret' $0" >&2
  exit 1
fi

if [[ -z "${SESSION_SECRET:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    SESSION_SECRET=$(openssl rand -hex 32)
    echo "Generated SESSION_SECRET (save it if you want sticky sessions across deploys)."
  else
    echo "openssl not found and SESSION_SECRET not set. Aborting." >&2
    exit 1
  fi
fi

echo "Setting Fly secrets for $APP_NAME..."
fly secrets set \
  --app "$APP_NAME" \
  APP_ENV="production" \
  SQLITE_DB_PATH="$SQLITE_DB_PATH" \
  CORS_ALLOWED_ORIGINS="$CORS_ALLOWED_ORIGINS" \
  STATION_NAME="$STATION_NAME" \
  ADMIN_USERS="$ADMIN_USERS" \
  SESSION_SECRET="$SESSION_SECRET"

echo
echo "Done."
echo "If you have not created the volume yet, run:"
echo "  fly volumes create data --app $APP_NAME --region iad --size 1"
echo
echo "Then deploy with:"
echo "  fly deploy --app $APP_NAME"
