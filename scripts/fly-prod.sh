#!/usr/bin/env bash
# West Port Radio — Fly.io production secrets + image deploy
#
# From repo root (wst-prt-radio/):
#
#   # 1. Set secrets + build and push a new image + restart machines
#   ADMIN_USERS='marco:YOUR_PASS,mun:OTHER_PASS' ./scripts/fly-prod.sh
#
#   # Optional: pin session secret (otherwise auto-generated on secrets step)
#   SESSION_SECRET=$(openssl rand -hex 32) ADMIN_USERS='...' ./scripts/fly-prod.sh
#
#   # Optional overrides
#   FLY_APP_NAME=wst-prt-radio \
#   CORS_ALLOWED_ORIGINS='https://your.vercel.app' \
#   ADMIN_USERS='...' ./scripts/fly-prod.sh
#
#   # Subcommands
#   ADMIN_USERS='...' ./scripts/fly-prod.sh secrets   # fly secrets set only
#   ./scripts/fly-prod.sh deploy                     # fly deploy only (image push)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

APP="${FLY_APP_NAME:-wst-prt-radio}"
SUB="${1:-all}"

case "$SUB" in
  -h|--help)
    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  secrets|deploy|all) ;;
  *)
    echo "usage: $0 [secrets|deploy|all]" >&2
    exit 2
    ;;
esac

if [[ "$SUB" == "secrets" || "$SUB" == "all" ]]; then
  ADMIN_USERS="${ADMIN_USERS:-}"
  if [[ -z "$ADMIN_USERS" ]]; then
    echo "Set ADMIN_USERS, e.g. ADMIN_USERS='marco:secret,mun:other' $0" >&2
    exit 1
  fi
  SESSION_SECRET="${SESSION_SECRET:-}"
  if [[ -z "$SESSION_SECRET" ]]; then
    if command -v openssl >/dev/null 2>&1; then
      SESSION_SECRET="$(openssl rand -hex 32)"
      echo "Generated SESSION_SECRET (save it if you need stable sessions across secret rotations)."
    else
      echo "Install openssl or set SESSION_SECRET=..." >&2
      exit 1
    fi
  fi

  STATION_NAME="${STATION_NAME:-West Port Radio}"
  CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://wst-prt-radio.vercel.app}"
  SQLITE_DB_PATH="${SQLITE_DB_PATH:-/data/wstprtradio.db}"

  echo "fly secrets set --app $APP ..."
  fly secrets set \
    --app "$APP" \
    APP_ENV="production" \
    SQLITE_DB_PATH="$SQLITE_DB_PATH" \
    CORS_ALLOWED_ORIGINS="$CORS_ALLOWED_ORIGINS" \
    STATION_NAME="$STATION_NAME" \
    ADMIN_USERS="$ADMIN_USERS" \
    SESSION_SECRET="$SESSION_SECRET"

  echo "Secrets updated. (Fly will restart the app.)"
fi

if [[ "$SUB" == "deploy" || "$SUB" == "all" ]]; then
  echo "fly deploy --app $APP --config fly.toml ..."
  fly deploy --app "$APP" --config fly.toml --remote-only
  echo "Deploy done."
fi
