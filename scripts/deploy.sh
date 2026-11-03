#!/usr/bin/env bash
# Publish site/ to https://mcchord.net/patterns/ (static files only).
# Touches nothing outside the destination directory. Override with
# DEPLOY_HOST, DEPLOY_PATH and DEPLOY_URL to publish somewhere else.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/site/"
HOST="${DEPLOY_HOST:-mcchord.net}"
DEST="${DEPLOY_PATH:-/var/www/mcchord.net/patterns/}"
URL="${DEPLOY_URL:-https://mcchord.net/patterns/}"

[[ -f "$SRC/index.html" && -f "$SRC/js/core.js" ]] || { echo "missing site files in $SRC" >&2; exit 1; }

ssh "$HOST" "mkdir -p '$DEST'"
rsync -rlt --delete --chmod=D755,F644 --exclude '.DS_Store' --exclude 'sheet.html' "$SRC" "$HOST:$DEST"

for path in "" js/app.js js/core.js js/patterns.js css/style.css favicon.svg og.png; do
  printf '%s  %s\n' "$(curl -fsS -o /dev/null -w '%{http_code}' "$URL$path")" "$URL$path"
done
