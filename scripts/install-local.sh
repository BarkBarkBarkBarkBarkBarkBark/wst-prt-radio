#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/local_deploy.yaml"
STACK_ENV_FILE="$ROOT_DIR/local_deploy.env"
API_ENV_FILE="$ROOT_DIR/apps/api/.env"
WEB_ENV_FILE="$ROOT_DIR/apps/web/.env.local"
API_ENV_EXAMPLE="$ROOT_DIR/apps/api/.env.example"
WEB_ENV_EXAMPLE="$ROOT_DIR/apps/web/.env.local.example"
STACK_ENV_EXAMPLE="$ROOT_DIR/local_deploy.env.example"

REFRESH_ENV=0
START_SERVICES=1
STREAM_HOST=""
AUTO_OPEN=1

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
  --refresh-stack-env       overwrite local_deploy.env
  --stream-host <host>      host or LAN IP where the Icecast-compatible stream is reachable
  --azuracast-host <host>   legacy alias for --stream-host
  --no-start                prepare envs and images, but do not start services
  --no-open                 do not open local UIs automatically after startup
  -h, --help                show this help

This script:
  1. checks Docker and Compose
  2. creates local env files and Icecast credentials when missing
  3. pulls/builds required images
  4. installs workspace deps in the bootstrap container
  5. starts Icecast, the jukebox, the API, and the web UI
EOF
}

REFRESH_STACK_ENV=0

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

docker_compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

detect_lan_ip() {
  if [[ -n "${STREAM_HOST}" ]]; then
    printf '%s\n' "$STREAM_HOST"
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

write_stack_env() {
  local lan_ip="$1"
  cat > "$STACK_ENV_FILE" <<EOF
ICECAST_SOURCE_PASSWORD=$(random_text_secret)
ICECAST_ADMIN_PASSWORD=$(random_text_secret)
ICECAST_RELAY_PASSWORD=$(random_text_secret)
ICECAST_HOSTNAME=$lan_ip
ICECAST_PORT=8000
ICECAST_ADMIN_EMAIL=local@wstprtradio.test
ICECAST_LOCATION=West Port Radio Local Dev
JUKEBOX_ICECAST_HOST=icecast
JUKEBOX_ICECAST_PORT=8000
JUKEBOX_MOUNT=/radio.mp3
JUKEBOX_NAME=West Port Radio Jukebox
JUKEBOX_DESCRIPTION=West Port Radio local MP3 jukebox
JUKEBOX_GENRE=Eclectic
JUKEBOX_MEDIA_DIR=/music
JUKEBOX_PLAYLIST_MODE=randomize
EOF
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
STREAM_PUBLIC_URL=http://$lan_ip:8000/radio.mp3
STREAM_METADATA_PROVIDER=static
STATIC_NOW_PLAYING_TITLE=West Port Radio
STATIC_NOW_PLAYING_ARTIST=Icecast Stream
STATIC_NOW_PLAYING_ALBUM=
AZURACAST_BASE_URL=
AZURACAST_PUBLIC_STREAM_URL=
AZURACAST_PUBLIC_API_URL=
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
  [[ -f "$STACK_ENV_EXAMPLE" ]] || die "missing stack env example at $STACK_ENV_EXAMPLE"

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

  if [[ "$REFRESH_STACK_ENV" -eq 1 || ! -f "$STACK_ENV_FILE" ]]; then
    log "writing local_deploy.env"
    write_stack_env "$lan_ip"
  else
    warn "preserving existing local_deploy.env"
  fi
}

get_stack_value() {
  local key="$1"
  local value
  value=$(grep -E "^${key}=" "$STACK_ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true)
  printf '%s\n' "$value"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-20}"
  local delay="${4:-2}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      log "$label is ready at $url"
      return 0
    fi
    sleep "$delay"
  done

  warn "$label did not become ready at $url"
  return 1
}

open_local_ui() {
  [[ "$AUTO_OPEN" -eq 1 ]] || return 0
  [[ "$(uname -s)" == "Darwin" ]] || return 0
  command -v open >/dev/null 2>&1 || return 0

  open "http://localhost:3000" >/dev/null 2>&1 || true
  open "http://localhost:3001/docs" >/dev/null 2>&1 || true
  open "http://localhost:8000" >/dev/null 2>&1 || true
}

print_summary() {
  local lan_ip="$1"
  local source_password="$2"
  local admin_password="$3"
  cat <<EOF

Local stack ready.

Services started by this script:
  - icecast:    http://$lan_ip:8000
  - jukebox:    local MP3 library feeder -> /radio.mp3
  - web:        http://$lan_ip:3000
  - api:        http://$lan_ip:3001
  - api docs:   http://$lan_ip:3001/docs

Stream endpoints:
  - listener URL:  http://$lan_ip:8000/radio.mp3
  - admin UI:      http://$lan_ip:8000/admin/
  - media folder:  $ROOT_DIR/media/library

To actually send audio from one device to another, use one source client:
  - BUTT
  - OBS / Mixxx / Liquidsoap

Jukebox behavior:
  - the `jukebox` container watches `media/library`
  - added MP3 files are picked up automatically
  - stop the `jukebox` service if you want a live encoder to own `/radio.mp3`

Icecast source settings:
  - host:          $lan_ip
  - port:          8000
  - mount:         /radio.mp3
  - source user:   source
  - source pass:   $source_password
  - admin user:    admin
  - admin pass:    $admin_password

Useful commands:
  - pnpm local:logs
  - pnpm local:down

Docs:
  - docs/local-network-streaming.md
  - docs/icecast-fallback-guide.md
  - docs/butt-fallback-guide.md
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh-env)
      REFRESH_ENV=1
      shift
      ;;
    --refresh-stack-env)
      REFRESH_STACK_ENV=1
      shift
      ;;
    --stream-host)
      [[ $# -ge 2 ]] || die "--stream-host requires a value"
      STREAM_HOST="$2"
      shift 2
      ;;
    --azuracast-host)
      [[ $# -ge 2 ]] || die "--azuracast-host requires a value"
      STREAM_HOST="$2"
      shift 2
      ;;
    --no-start)
      START_SERVICES=0
      shift
      ;;
    --no-open)
      AUTO_OPEN=0
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
mkdir -p "$ROOT_DIR/media/library"
ensure_env_files "$LAN_IP"

log "pulling base images"
docker_compose pull bootstrap api web

log "building local Icecast and jukebox images"
docker_compose build icecast jukebox

log "installing workspace dependencies in bootstrap container"
docker_compose run --rm bootstrap

if [[ "$START_SERVICES" -eq 1 ]]; then
  log "starting icecast, jukebox, api, and web"
  docker_compose up -d icecast jukebox api web

  wait_for_http "http://localhost:8000/" 'Icecast' || true
  wait_for_http "http://localhost:3001/health" 'API' || true
  wait_for_http "http://localhost:3000/" 'Web UI' || true

  print_summary "$LAN_IP" "$(get_stack_value ICECAST_SOURCE_PASSWORD)" "$(get_stack_value ICECAST_ADMIN_PASSWORD)"
  open_local_ui
else
  log "preparation complete; services were not started"
fi