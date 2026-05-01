#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/local_deploy.yaml"
API_ENV_FILE="$ROOT_DIR/apps/api/.env"
WEB_ENV_FILE="$ROOT_DIR/apps/web/.env.local"

REFRESH_ENV=0
INSTALL_TAILSCALE=0
SKIP_MONOREPO_START=0
LAN_IP_OVERRIDE=""

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
  --refresh-env                     rewrite apps/api/.env and apps/web/.env.local
  --install-tailscale               install tailscale on the Linux machine
  --skip-monorepo-start             do not start api/web after bootstrap
  --lan-ip <ip>                     force the host/LAN IP used in generated env files
  -h, --help                        show this help

Expected use over SSH:
  1. clone the repo on the Linux machine
  2. cd into the repo
  3. run this script

Examples:
  bash scripts/install-linux-machine.sh --install-tailscale
  bash scripts/install-linux-machine.sh --refresh-env --lan-ip 192.168.1.50
EOF
}

SUDO=""
if [[ "${EUID}" -ne 0 ]]; then
  SUDO="sudo"
fi

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] || die 'this script is intended for Linux hosts'
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

docker_compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

detect_lan_ip() {
  if [[ -n "$LAN_IP_OVERRIDE" ]]; then
    printf '%s\n' "$LAN_IP_OVERRIDE"
    return
  fi

  if command -v hostname >/dev/null 2>&1; then
    if ip=$(hostname -I 2>/dev/null | awk '{ print $1 }') && [[ -n "$ip" ]]; then
      printf '%s\n' "$ip"
      return
    fi
  fi

  if command -v ip >/dev/null 2>&1; then
    if ip=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ { for (i=1; i<=NF; i++) if ($i == "src") { print $(i+1); exit } }') && [[ -n "$ip" ]]; then
      printf '%s\n' "$ip"
      return
    fi
  fi

  printf '127.0.0.1\n'
}

install_apt_prereqs() {
  require_command apt-get
  log 'installing base packages'
  $SUDO apt-get update
  $SUDO apt-get install -y ca-certificates curl git jq gnupg lsb-release
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log 'docker already installed'
  else
    log 'installing docker via official convenience script'
    curl -fsSL https://get.docker.com | $SUDO sh
  fi

  $SUDO systemctl enable --now docker

  if [[ -n "$SUDO" && -n "${SUDO_USER:-}" ]]; then
    $SUDO usermod -aG docker "$SUDO_USER" || true
  fi

  docker compose version >/dev/null 2>&1 || die 'docker compose plugin is required but unavailable after install'
}

install_tailscale() {
  if command -v tailscale >/dev/null 2>&1; then
    log 'tailscale already installed'
    return
  fi

  log 'installing tailscale'
  curl -fsSL https://tailscale.com/install.sh | $SUDO sh
  $SUDO systemctl enable --now tailscaled
  warn 'finish tailscale setup manually with: sudo tailscale up'
}

write_api_env() {
  local lan_ip="$1"
  cat > "$API_ENV_FILE" <<EOF
PORT=3001
APP_ENV=development
CORS_ALLOWED_ORIGINS=http://$lan_ip:3000,http://localhost:3000
SQLITE_DB_PATH=./data/wstprtradio.db
STATION_NAME=West Port Radio
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

  mkdir -p "$ROOT_DIR/apps/api/data"

  if [[ "$REFRESH_ENV" -eq 1 || ! -f "$API_ENV_FILE" ]]; then
    log 'writing apps/api/.env'
    write_api_env "$lan_ip"
  else
    warn 'preserving existing apps/api/.env'
  fi

  if [[ "$REFRESH_ENV" -eq 1 || ! -f "$WEB_ENV_FILE" ]]; then
    log 'writing apps/web/.env.local'
    write_web_env "$lan_ip"
  else
    warn 'preserving existing apps/web/.env.local'
  fi
}

start_monorepo() {
  log 'pulling node images'
  docker_compose pull

  log 'installing workspace dependencies in bootstrap container'
  docker_compose run --rm bootstrap

  if [[ "$SKIP_MONOREPO_START" -eq 1 ]]; then
    warn 'skipping api/web start by request'
    return
  fi

  log 'starting api and web containers'
  docker_compose up -d api web
}

print_summary() {
  local lan_ip="$1"
  cat <<EOF

Linux machine preparation complete.

Services in this architecture:
  - Public stream on Linux:   http://$lan_ip:8000/radio.mp3
  - Fastify API via Docker:   http://$lan_ip:3001
  - API docs:                 http://$lan_ip:3001/docs
  - Next.js web via Docker:   http://$lan_ip:3000

What you still need to do manually:
  1. bring up Icecast or another compatible stream source (compose stack includes icecast when using local_deploy)
  2. confirm http://$lan_ip:8000/radio.mp3 plays directly when icecast is running
  3. optional: broadcast live from /stream (browser mic → WebRTC listeners)

Optional:
  - finish tailscale setup with: sudo tailscale up

Docs:
  - docs/linux-machine-setup.md
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
    --install-tailscale)
      INSTALL_TAILSCALE=1
      shift
      ;;
    --skip-monorepo-start)
      SKIP_MONOREPO_START=1
      shift
      ;;
    --lan-ip)
      [[ $# -ge 2 ]] || die '--lan-ip requires a value'
      LAN_IP_OVERRIDE="$2"
      shift 2
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

require_linux
install_apt_prereqs
install_docker

if [[ "$INSTALL_TAILSCALE" -eq 1 ]]; then
  install_tailscale
fi

LAN_IP="$(detect_lan_ip)"
log "using host IP $LAN_IP"

ensure_env_files "$LAN_IP"
start_monorepo

print_summary "$LAN_IP"