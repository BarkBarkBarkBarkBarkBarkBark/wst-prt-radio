#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/local_deploy.yaml"
API_ENV_FILE="$ROOT_DIR/apps/api/.env"
WEB_ENV_FILE="$ROOT_DIR/apps/web/.env.local"
API_ENV_EXAMPLE="$ROOT_DIR/apps/api/.env.example"
WEB_ENV_EXAMPLE="$ROOT_DIR/apps/web/.env.local.example"

REFRESH_ENV=0
START_SERVICES=1
AZURACAST_HOST=""

log() {
  printf '\033[1;34m==>\033[0m %s\n' "$1"
}

warn() {
  printf '\033[1;33mwarn:\033[0m %s\n' "$1"
}

die() {
  printf '\033[1;31merror:\033[0m %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --refresh-env             overwrite apps/api/.env and apps/web/.env.local
  --azuracast-host <host>   host or LAN IP where AzuraCast is reachable
  --no-start                prepare envs and images, but do not start services
  -h, --help                show this help

This script:
  1. checks Docker and Compose
  2. creates local env files when missing
  3. pulls required images
  4. installs workspace deps in the bootstrap container
  5. starts the API and web services
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

docker_compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

detect_lan_ip() {
  if [[ -n "${AZURACAST_HOST}" ]]; then
    printf '%s\n' "$AZURACAST_HOST"
    return
  fi

  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1; do
      if ip=$(ipconfig getifaddr "$iface" 2>/dev/null) && [[ -n "$ip" ]]; then
        printf '%s\n' "$ip"
        return
      fi
    done
  fi

  if command -v route >/dev/null 2>&1; then
    local iface
    iface=$(route -n get default 2>/dev/null | awk '/interface: / { print $2; exit }')
    if [[ -n "$iface" ]] && command -v ipconfig >/dev/null 2>&1; then
      if ip=$(ipconfig getifaddr "$iface" 2>/dev/null) && [[ -n "$ip" ]]; then
        printf '%s\n' "$ip"
        return
      fi
    fi
  fi

  if command -v hostname >/dev/null 2>&1; then
    if ip=$(hostname -I 2>/dev/null | awk '{ print $1 }') && [[ -n "$ip" ]]; then
      printf '%s\n' "$ip"
      return
    fi
  fi

  printf '127.0.0.1\n'
}

random_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
    return
  fi

  python3 - <<PY
import secrets
print(secrets.token_hex($bytes))
PY
}

random_text_secret() {
  random_hex 24
}

write_api_env() {
  local lan_ip="$1"
  cat > "$API_ENV_FILE" <<EOF
PORT=3001
APP_ENV=development
SESSION_SECRET=$(random_text_secret)
BACKEND_ENCRYPTION_KEY=$(random_hex 32)
SQLITE_DB_PATH=./data/wstprtradio.db
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=change_me_on_first_login
AZURACAST_BASE_URL=http://$lan_ip:8080
AZURACAST_PUBLIC_STREAM_URL=http://$lan_ip:8000/radio.mp3
AZURACAST_PUBLIC_API_URL=http://$lan_ip:8080/api
AZURACAST_API_KEY=
AZURACAST_STATION_ID=1
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_STREAM_API_TOKEN=
CLOUDFLARE_LIVE_INPUT_ID=
DISCORD_WEBHOOK_URL=
EOF
}

write_web_env() {
  local lan_ip="$1"
  cat > "$WEB_ENV_FILE" <<EOF
NEXT_PUBLIC_API_BASE_URL=http://$lan_ip:3001
NEXT_PUBLIC_PUBLIC_SITE_URL=http://$lan_ip:3000
NEXT_PUBLIC_STREAM_URL=http://$lan_ip:8000/radio.mp3
EOF
}

ensure_env_files() {
  local lan_ip="$1"

  [[ -f "$API_ENV_EXAMPLE" ]] || die "missing API env example at $API_ENV_EXAMPLE"
  [[ -f "$WEB_ENV_EXAMPLE" ]] || die "missing web env example at $WEB_ENV_EXAMPLE"

  if [[ "$REFRESH_ENV" -eq 1 || ! -f "$API_ENV_FILE" ]]; then
    log "writing apps/api/.env"
    write_api_env "$lan_ip"
  else
    warn "preserving existing apps/api/.env"
  fi

  if [[ "$REFRESH_ENV" -eq 1 || ! -f "$WEB_ENV_FILE" ]]; then
    log "writing apps/web/.env.local"
    write_web_env "$lan_ip"
  else
    warn "preserving existing apps/web/.env.local"
  fi
}

print_summary() {
  local lan_ip="$1"
  cat <<EOF

Local stack ready.

Services started by this script:
  - web:        http://$lan_ip:3000
  - api:        http://$lan_ip:3001
  - api docs:   http://$lan_ip:3001/docs

Streaming service still required:
  - AzuraCast:  http://$lan_ip:8080 (admin) and http://$lan_ip:8000/radio.mp3 (stream)

To actually send audio from one device to another, you still need one source client:
  - AzuraCast Web DJ
  - BUTT

Useful commands:
  - pnpm local:logs
  - pnpm local:down

Docs:
  - docs/local-network-streaming.md
  - docs/web-dj-guide.md
  - docs/butt-fallback-guide.md
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh-env)
      REFRESH_ENV=1
      shift
      ;;
    --azuracast-host)
      [[ $# -ge 2 ]] || die "--azuracast-host requires a value"
      AZURACAST_HOST="$2"
      shift 2
      ;;
    --no-start)
      START_SERVICES=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

require_command docker
docker compose version >/dev/null 2>&1 || die 'Docker Compose plugin is required'
docker info >/dev/null 2>&1 || die 'Docker daemon is not running'

LAN_IP="$(detect_lan_ip)"

log "using LAN host $LAN_IP"
mkdir -p "$ROOT_DIR/apps/api/data"
ensure_env_files "$LAN_IP"

log "pulling base images"
docker_compose pull

log "installing workspace dependencies in bootstrap container"
docker_compose run --rm bootstrap

if [[ "$START_SERVICES" -eq 1 ]]; then
  log "starting api and web"
  docker_compose up -d api web
  print_summary "$LAN_IP"

  if ! curl -fsSI --max-time 3 "http://$LAN_IP:8000/radio.mp3" >/dev/null 2>&1; then
    warn "AzuraCast stream is not reachable yet at http://$LAN_IP:8000/radio.mp3"
    warn "start AzuraCast separately, then use Web DJ or BUTT as your source client"
  fi
else
  log "preparation complete; services were not started"
fi