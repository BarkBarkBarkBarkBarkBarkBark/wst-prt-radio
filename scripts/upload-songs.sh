#!/usr/bin/env bash
# West Port Radio — bulk-upload audio files to the running API.
#
# Files are streamed to POST /admin/songs/upload, which writes them to the
# server's SONGS_DIR (the persistent /data/songs volume in production). This is
# the recommended way to load tracks onto the Fly volume — no SSH needed.
#
# Usage (from repo root, wst-prt-radio/):
#
#   # Upload everything in ./songs to production
#   ./scripts/upload-songs.sh
#
#   # Upload a specific folder
#   ./scripts/upload-songs.sh ~/Music/westport-set
#
#   # Target a different API (e.g. local dev)
#   API_BASE_URL=http://localhost:3001 ./scripts/upload-songs.sh ./songs
#
#   # If admin auth is re-enabled later, provide credentials to log in first
#   ADMIN_USER=marco ADMIN_PASS=secret ./scripts/upload-songs.sh ./songs
#
# Env:
#   API_BASE_URL   API origin (default: https://wst-prt-radio.fly.dev)
#   ADMIN_USER     optional — admin username for /auth/login
#   ADMIN_PASS     optional — admin password for /auth/login
#   BATCH_SIZE     files per request (default: 10)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="${1:-$ROOT_DIR/songs}"
API_BASE_URL="${API_BASE_URL:-https://wst-prt-radio.fly.dev}"
BATCH_SIZE="${BATCH_SIZE:-10}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi

if ! command -v find >/dev/null 2>&1; then
  echo "find is required." >&2
  exit 1
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Source directory not found: $SRC_DIR" >&2
  exit 1
fi

API_BASE_URL="${API_BASE_URL%/}"

# Collect supported audio files recursively (case-insensitive extensions).
FILES=()
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(find "$SRC_DIR" -type f \( \
  -iname '*.mp3' -o \
  -iname '*.wav' -o \
  -iname '*.ogg' -o \
  -iname '*.oga' -o \
  -iname '*.flac' -o \
  -iname '*.m4a' \
\) -print0 | sort -z)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No audio files found in $SRC_DIR (looked for mp3/wav/ogg/oga/flac/m4a)." >&2
  exit 1
fi

echo "Uploading ${#FILES[@]} file(s) from $SRC_DIR to $API_BASE_URL"

# Optional login (auth is currently open server-side; this is future-proofing).
COOKIE_ARGS=()
if [[ -n "${ADMIN_USER:-}" && -n "${ADMIN_PASS:-}" ]]; then
  COOKIE_JAR="$(mktemp)"
  trap 'rm -f "$COOKIE_JAR"' EXIT
  echo "Logging in as $ADMIN_USER…"
  curl -fsS -c "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
    "$API_BASE_URL/auth/login" >/dev/null
  COOKIE_ARGS=(-b "$COOKIE_JAR")
fi

uploaded=0
failed=0
batch=()

flush_batch() {
  [[ ${#batch[@]} -eq 0 ]] && return 0
  local form=()
  for file in "${batch[@]}"; do
    local rel="${file#$SRC_DIR/}"
    local upload_name="${rel//\// - }"
    form+=(-F "file=@${file};filename=${upload_name}")
  done
  echo "→ uploading batch of ${#batch[@]}…"
  if curl -fsS ${COOKIE_ARGS[@]+"${COOKIE_ARGS[@]}"} "${form[@]}" "$API_BASE_URL/admin/songs/upload" >/dev/null; then
    uploaded=$((uploaded + ${#batch[@]}))
  else
    echo "  ✗ batch failed" >&2
    failed=$((failed + ${#batch[@]}))
  fi
  batch=()
}

for file in "${FILES[@]}"; do
  batch+=("$file")
  if [[ ${#batch[@]} -ge $BATCH_SIZE ]]; then
    flush_batch
  fi
done
flush_batch

echo
echo "Done. Uploaded: $uploaded · Failed: $failed"
if [[ $failed -gt 0 ]]; then
  exit 1
fi
