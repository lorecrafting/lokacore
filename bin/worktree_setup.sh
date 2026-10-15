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
  # Main's install was made from this lockfile (marker of bin/lib/serve.sh): clone its node_modules, else install.
  # An APFS clone (cp -c), not a link: Metro serves worker and lazy bundles by path under the worktree.
  if [ "$(cat "$main/$d/node_modules/.loka-lock-cksum" 2> /dev/null)" = "$sum" ]; then
    # Re-clone an older worktree's link or a stale clone; a partial clone stays in .tmp.
    if [ -L "$d/node_modules" ] || [ "$(cat "$d/node_modules/.loka-lock-cksum" 2> /dev/null)" != "$sum" ]; then
      rm -rf "$d/node_modules" "$d/node_modules.tmp"
      cp -cR "$main/$d/node_modules" "$d/node_modules.tmp" && mv "$d/node_modules.tmp" "$d/node_modules"
    fi
  else
    # npm ci through an older worktree's link would wipe the main checkout's install.
    [ ! -L "$d/node_modules" ] || rm "$d/node_modules"
    (cd "$d" && mise exec -- npm ci) && echo "$sum" > "$d/node_modules/.loka-lock-cksum"
  fi
done
