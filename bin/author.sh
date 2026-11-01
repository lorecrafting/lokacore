#!/bin/sh
# One command for the writer: the cartridge watcher, the Book preview and the author panel
# (docs/guides/writing-the-game.md#start-the-tools). Ctrl-C stops all three.
set -eu
[ $# -eq 1 ] || { echo "usage: bin/author.sh cartridges/<name>" >&2; exit 2; }
cd "$(dirname "$0")/.."
[ -d tools/author-panel/node_modules ] || (cd tools/author-panel && npm ci --no-audit --no-fund)
trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT
rm -f "mobile/app/${LOKA_DEV_CARTRIDGE:-.dev-cartridge/current.json}" # a stale artifact would end the wait below at once
mise exec -- bin/loka dev "$1" --watch &
watcher=$!
# Metro refuses to start before the first good compile has written the artifact: wait for it, and stop if the watcher dies.
until [ -f "mobile/app/${LOKA_DEV_CARTRIDGE:-.dev-cartridge/current.json}" ]; do
  kill -0 "$watcher" 2>/dev/null || { echo "The watcher stopped before the first good compile: fix what it printed above." >&2; exit 1; }
  sleep 1
done
(cd mobile/app && npm run author) &
(cd tools/author-panel && npm run dev) &
echo "Author panel: http://localhost:${LOKA_PANEL_PORT:-19009}"
wait
