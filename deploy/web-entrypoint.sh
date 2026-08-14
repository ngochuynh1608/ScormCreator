#!/bin/sh
set -e
DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR/projects" "$DATA_DIR/jobs"
# Volume mounts are often root-owned; web runs as uid 1001 (nextjs).
chown -R nextjs:nodejs "$DATA_DIR" || true
exec setpriv --reuid=nextjs --regid=nodejs --init-groups -- "$@"
