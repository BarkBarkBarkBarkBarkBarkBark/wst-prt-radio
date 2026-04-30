#!/usr/bin/env bash
set -euo pipefail

: "${ICECAST_SOURCE_PASSWORD:?ICECAST_SOURCE_PASSWORD is required}"
: "${JUKEBOX_ICECAST_HOST:=icecast}"
: "${JUKEBOX_ICECAST_PORT:=8000}"
: "${JUKEBOX_MOUNT:=/radio.mp3}"
: "${JUKEBOX_NAME:=West Port Radio Jukebox}"
: "${JUKEBOX_DESCRIPTION:=West Port Radio local MP3 jukebox}"
: "${JUKEBOX_GENRE:=Eclectic}"
: "${JUKEBOX_MEDIA_DIR:=/music}"
: "${JUKEBOX_PLAYLIST_MODE:=randomize}"

export ICECAST_SOURCE_PASSWORD
export JUKEBOX_ICECAST_HOST
export JUKEBOX_ICECAST_PORT
export JUKEBOX_MOUNT
export JUKEBOX_NAME
export JUKEBOX_DESCRIPTION
export JUKEBOX_GENRE
export JUKEBOX_MEDIA_DIR
export JUKEBOX_PLAYLIST_MODE

mkdir -p /tmp/liquidsoap
envsubst < /etc/liquidsoap/radio.liq.template > /tmp/liquidsoap/radio.liq

exec liquidsoap /tmp/liquidsoap/radio.liq
