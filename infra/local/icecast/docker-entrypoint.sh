#!/usr/bin/env bash
set -euo pipefail

: "${ICECAST_SOURCE_PASSWORD:?ICECAST_SOURCE_PASSWORD is required}"
: "${ICECAST_ADMIN_PASSWORD:?ICECAST_ADMIN_PASSWORD is required}"
: "${ICECAST_RELAY_PASSWORD:?ICECAST_RELAY_PASSWORD is required}"
: "${ICECAST_HOSTNAME:=localhost}"
: "${ICECAST_ADMIN_EMAIL:=local@wstprtradio.test}"
: "${ICECAST_LOCATION:=West Port Radio Local Dev}"
: "${ICECAST_PORT:=8000}"

mkdir -p /var/log/icecast /var/cache/icecast /var/lib/icecast
chown -R icecast2:icecast /var/log/icecast /var/cache/icecast /var/lib/icecast

envsubst < /etc/icecast2/icecast.xml.template > /etc/icecast2/icecast.xml
chown icecast2:icecast /etc/icecast2/icecast.xml

exec su -s /bin/sh -c 'icecast2 -c /etc/icecast2/icecast.xml -n' icecast2