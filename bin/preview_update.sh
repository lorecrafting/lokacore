#!/bin/sh
# Bring the owner's preview checkout (LOKA_PREVIEW_DIR, default ~/dev/lokacore-preview, detached HEAD)
# to origin/main and serve it (docs/web-preview.md): Storybook (LOKA_SB_PORT, 6006), the web preview
# (LOKA_PREVIEW_PORT, 19006; Metro LOKA_METRO_PORT, 19007) and Expo LAN (LOKA_EXPO_PORT, 8081) if it
# was running. npm ci only on a lockfile change. Already current and served from here: no restart.
set -eu
me=preview_update
. "$(dirname "$0")/lib/serve.sh"
dir=$(cd "${LOKA_PREVIEW_DIR:-$HOME/dev/lokacore-preview}" && pwd -P) || die 'no preview checkout'
app=$dir/mobile/app
[ -z "$(git -C "$dir" status --porcelain)" ] || die "$dir has local changes; nothing changed"
git -C "$dir" fetch -q origin main || die 'fetch failed'
if [ "$(git -C "$dir" rev-parse HEAD)" = "$(git -C "$dir" rev-parse origin/main)" ] \
  && [ "$(served_from "$SB_PORT")" = "$app" ] && [ "$(served_from "$LOKA_PREVIEW_PORT")" = "$app" ]; then
  echo "$me: already serving origin/main $(git -C "$dir" rev-parse --short HEAD); nothing restarted"
  urls; exit 0
fi
expo=$(listener "$EXPO_PORT")
for p in "$SB_PORT" "$LOKA_PREVIEW_PORT" "$LOKA_METRO_PORT" "$EXPO_PORT"; do stop_port "$p"; done
git -C "$dir" checkout -q --detach origin/main
npm_ci "$dir"
serve_storybook "$dir"
serve "$LOKA_PREVIEW_PORT" "$app" npm run web:preview
[ -z "$expo" ] || serve "$EXPO_PORT" "$app" npx expo start --lan --port "$EXPO_PORT"
echo "$me: serving origin/main $(git -C "$dir" rev-parse --short HEAD)"
urls
