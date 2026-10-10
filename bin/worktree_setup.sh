#!/bin/sh
# Make a new worktree checkable and pushable (docs/WORKFLOW.md, Git hygiene): the Elixir deps
# bin/check_all.sh needs, and node_modules wherever a package-lock.json exists.
set -eu
cd "$(dirname "$0")/.."
mise exec -- mix deps.get --check-locked
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
for d in . kernel/ts mobile/app; do
  [ -f "$d/package-lock.json" ] || continue
  sum=$(cksum < "$d/package-lock.json")
  # Main's install was made from this lockfile (marker of bin/lib/serve.sh): link its node_modules, else install.
  if [ "$(cat "$main/$d/node_modules/.loka-lock-cksum" 2> /dev/null)" = "$sum" ]; then
    [ -e "$d/node_modules" ] || ln -s "$(cd "$main/$d" && pwd -P)/node_modules" "$d/node_modules"
  else
    # npm ci through a link would wipe the main checkout's install.
    [ ! -L "$d/node_modules" ] || rm "$d/node_modules"
    (cd "$d" && mise exec -- npm ci) && echo "$sum" > "$d/node_modules/.loka-lock-cksum"
  fi
done
