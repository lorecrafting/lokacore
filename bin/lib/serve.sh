# Sourced by bin/preview_update.sh and bin/polish_session.sh (set $me first): serve the owner's
# Storybook, web preview and Expo by port (docs/web-preview.md). Stops only the PIDs listening on
# those ports, never by name (loka-hg7). Ports are overridable so tests never touch the owner's.
SB_PORT=${LOKA_SB_PORT:-6006} EXPO_PORT=${LOKA_EXPO_PORT:-8081}
export LOKA_PREVIEW_PORT="${LOKA_PREVIEW_PORT:-19006}" LOKA_METRO_PORT="${LOKA_METRO_PORT:-19007}"
die() { echo "$me: $*" >&2; exit 1; }
listener() { lsof -t -iTCP:"$1" -sTCP:LISTEN 2> /dev/null || true; }
served_from() { # <port> -> the listening process's working directory
  p=$(listener "$1" | head -n 1)
  [ -z "$p" ] || lsof -a -p "$p" -d cwd -Fn 2> /dev/null | sed -n 's/^n//p'
}
wait_port() { # <port> up|down, at most 120 s
  i=0
  while [ $i -lt 240 ]; do
    if [ -n "$(listener "$1")" ]; then [ "$2" = down ] || return 0; else [ "$2" = up ] || return 0; fi
    sleep 0.5; i=$((i + 1))
  done
  die "port $1 still not $2 after 120 s${3:+; log: $3}"
}
stop_port() { p=$(listener "$1"); [ -z "$p" ] || { kill $p; wait_port "$1" down; }; }
serve() { # <port> <dir> <command...>: start detached in <dir>, wait until it listens
  port=$1 log=${TMPDIR:-/tmp}/loka-serve-$1.log
  (cd "$2" && shift 2 && nohup mise exec -- "$@" > "$log" 2>&1 < /dev/null &)
  wait_port "$port" up "$log"
}
serve_storybook() { serve "$SB_PORT" "$1/mobile/app" npm run storybook -- -p "$SB_PORT"; }
npm_ci() { # <checkout>: npm ci only where package-lock.json changed since the last ci there
  for d in "$1" "$1/kernel/ts" "$1/mobile/app"; do
    [ -f "$d/package-lock.json" ] || continue
    want=$(cksum < "$d/package-lock.json")
    [ "$(cat "$d/node_modules/.loka-lock-cksum" 2> /dev/null)" != "$want" ] || continue
    (cd "$d" && mise exec -- npm ci --no-audit --no-fund) || die "npm ci failed in $d"
    echo "$want" > "$d/node_modules/.loka-lock-cksum"
  done
}
urls() {
  echo "Storybook:   http://localhost:$SB_PORT (serving $(served_from "$SB_PORT"))"
  echo "Web preview: http://localhost:$LOKA_PREVIEW_PORT"
  [ -z "$(listener "$EXPO_PORT")" ] || echo "Expo (LAN):  port $EXPO_PORT"
}
