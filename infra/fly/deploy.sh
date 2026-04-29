#!/usr/bin/env bash
set -euo pipefail

echo "Deploying wstprtradio-api to Fly.io..."

# Ensure fly CLI is installed
if ! command -v fly &>/dev/null; then
  echo "Error: fly CLI not found. Install from https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

fly deploy --config infra/fly/fly.toml --remote-only

echo "Deploy complete!"
fly status --app wstprtradio-api
