#!/bin/sh
# One command for the writer: the cartridge watcher, the Book preview and the author panel
# (docs/guides/writing-the-game.md#start-the-tools). Ctrl-C stops all three.
set -eu
# With no cartridge: the one the watcher last opened (the editor's world picker switches it).
[ $# -le 1 ] || { echo "usage: bin/author.sh [cartridges/<name>]" >&2; exit 2; }
cd "$(dirname "$0")/.."
# npm ci when node_modules is missing or older than the lockfile: a stale panel fails to resolve a
# newly added package (rjsf, loka-wfrgk.99). Marker of bin/lib/serve.sh and bin/worktree_setup.sh.
fresh() { [ ! -f "$1/package-lock.json" ] || [ "$(cat "$1/node_modules/.loka-lock-cksum" 2> /dev/null)" = "$(cksum < "$1/package-lock.json")" ]; }
if ! fresh tools/author-panel; then
  (cd tools/author-panel && npm ci --no-audit --no-fund && cksum < package-lock.json > node_modules/.loka-lock-cksum) || exit 1
fi
trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT
# Name a port's holder before starting, rather than let the preview die on EADDRINUSE while the
# watcher and panel keep running with no Book (loka-wfrgk.99).
holder() { lsof -t -iTCP:"$1" -sTCP:LISTEN 2> /dev/null | head -n 1; }
for p in "${LOKA_PREVIEW_PORT:-19006}" "${LOKA_PANEL_PORT:-19009}"; do
  pid=$(holder "$p")
  [ -z "$pid" ] && continue
  echo "Port $p is already taken by PID $pid ($(ps -o comm= -p "$pid" 2> /dev/null || echo 'unknown')):" >&2
  echo "  $(lsof -a -p "$pid" -d cwd -Fn 2> /dev/null | sed -n 's/^n//p')" >&2
  echo 'Stop it (kill it), or pick another port (LOKA_PREVIEW_PORT / LOKA_PANEL_PORT), then rerun.' >&2
  exit 1
done
rm -f "mobile/app/${LOKA_DEV_CARTRIDGE:-.dev-cartridge/current.json}" # a stale artifact would end the wait below at once
mise exec -- bin/loka dev ${1+"$1"} --watch &
watcher=$!
# Metro refuses to start before the first good compile has written the artifact: wait for it, and stop if the watcher dies.
echo "Waiting for the first good compile: the preview and the panel start once it compiles; the watcher's errors print here."
until [ -f "mobile/app/${LOKA_DEV_CARTRIDGE:-.dev-cartridge/current.json}" ]; do
  kill -0 "$watcher" 2>/dev/null || { echo "The watcher stopped before the first good compile: fix what it printed above." >&2; exit 1; }
  sleep 1
done
(cd mobile/app && npm run author) &
(cd tools/author-panel && npm run dev) &
echo "Author panel: http://localhost:${LOKA_PANEL_PORT:-19009}"
wait
