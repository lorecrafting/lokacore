#!/bin/sh
# Bring the owner's preview checkout (LOKA_PREVIEW_DIR, default ~/dev/lokacore-preview, detached HEAD)
# to origin/main and serve it (docs/web-preview.md): Storybook (LOKA_SB_PORT, 6006), the web preview
# (LOKA_PREVIEW_PORT, 19006; Metro LOKA_METRO_PORT, 19007) and Expo LAN (LOKA_EXPO_PORT, 8081) if it
# was running. npm ci only on a lockfile change; a server already serving this unchanged checkout
# keeps running. Refuses while a polish session is served, unless --end-session (bin/polish_session.sh close).
set -eu
me=preview_update
. "$(dirname "$0")/lib/serve.sh"
dir=$(cd "${LOKA_PREVIEW_DIR:-$HOME/dev/lokacore-preview}" && pwd -P) || die 'no preview checkout'
app=$dir/mobile/app
[ -z "$(git -C "$dir" status --porcelain)" ] || die "$dir has local changes; nothing changed"
s=$(cd "$session" 2> /dev/null && pwd -P) && [ "$(served_from "$SB_PORT")" = "$s/mobile/app" ] && [ "${1-}" != --end-session ] \
  && die 'a polish session is being served; end it with bin/polish_session.sh close'
# Every check, the checkout and npm ci run before any server stops, so a failure leaves them serving.
git -C "$dir" fetch -q origin main || die 'fetch failed; nothing changed'
moved=
[ "$(git -C "$dir" rev-parse HEAD)" = "$(git -C "$dir" rev-parse origin/main)" ] || moved=1
git -C "$dir" checkout -q --detach origin/main || die 'checkout failed; no server was stopped'
! stale "$dir" || { moved=1; npm_ci "$dir"; }
expo=$(listener "$EXPO_PORT")
[ -z "$moved" ] || for p in "$SB_PORT" "$LOKA_PREVIEW_PORT" "$LOKA_METRO_PORT" "$EXPO_PORT"; do stop_port "$p"; done
up() { [ -z "$moved" ] && [ "$(served_from "$1")" = "$app" ]; } # this checkout already serves the port
did=
up "$SB_PORT" || { did=1; stop_port "$SB_PORT"; serve_storybook "$dir"; }
up "$LOKA_PREVIEW_PORT" || { did=1; stop_port "$LOKA_PREVIEW_PORT"; stop_port "$LOKA_METRO_PORT"; serve "$LOKA_PREVIEW_PORT" "$app" npm run web:preview; }
[ -z "$expo" ] || up "$EXPO_PORT" || { did=1; stop_port "$EXPO_PORT"; serve "$EXPO_PORT" "$app" npx expo start --lan --port "$EXPO_PORT"; }
echo "$me: serving origin/main $(git -C "$dir" rev-parse --short HEAD)"
[ -n "$did" ] || echo "$me: already serving; nothing restarted"
urls
