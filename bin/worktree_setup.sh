#!/bin/sh
# Make a new worktree checkable and pushable (docs/WORKFLOW.md, Git hygiene): the Elixir deps
# bin/check_all.sh needs, and node_modules wherever a package-lock.json exists.
set -eu
cd "$(dirname "$0")/.."
mise exec -- mix deps.get --check-locked
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
for d in $(git ls-files package-lock.json '*/package-lock.json' | sed 's|/*package-lock.json$||; s|^$|.|'); do
  sum=$(cksum < "$d/package-lock.json")
  # Main's install was made from this lockfile (marker of bin/lib/serve.sh) and main's lockfile still is
  # that one (a stray npm install in main changes both, not the marker; loka-0ljs): clone, else install.
  # An APFS clone (cp -c), not a link: Metro serves worker and lazy bundles by path under the worktree.
  if [ "$(cat "$main/$d/node_modules/.loka-lock-cksum" 2> /dev/null)" = "$sum" ] && [ "$(cksum < "$main/$d/package-lock.json")" = "$sum" ]; then
    # Re-clone an older worktree's link or a stale clone; a partial clone stays in .tmp.
    if [ -L "$d/node_modules" ] || [ "$(cat "$d/node_modules/.loka-lock-cksum" 2> /dev/null)" != "$sum" ]; then
      rm -rf "$d/node_modules" "$d/node_modules.tmp"
      cp -cR "$main/$d/node_modules" "$d/node_modules.tmp" || { rm -rf "$d/node_modules.tmp"; echo "worktree_setup: cloning $main/$d/node_modules failed" >&2; exit 1; }
      rm -rf "$d/node_modules.tmp/.cache" # main's build caches, e.g. Storybook's test results
      mv "$d/node_modules.tmp" "$d/node_modules"
    fi
  else
    # npm ci through an older worktree's link would wipe the main checkout's install.
    [ ! -L "$d/node_modules" ] || rm "$d/node_modules"
    (cd "$d" && mise exec -- npm ci) && echo "$sum" > "$d/node_modules/.loka-lock-cksum"
  fi
done

# Name what a worktree still lacks (loka-za8br: an empty or half-cloned node_modules made every
# developer re-install by hand and read Metro's 'Unable to resolve expo' instead of a real fault).
# A warning, not a failure: deps may be absent on a host without Hex access, and _build is built by
# the first `mix compile`.
missing=
for d in $(git ls-files package-lock.json '*/package-lock.json' | sed 's|/*package-lock.json$||; s|^$|.|'); do
  [ -x "$d/node_modules/.bin/prettier" ] || [ "$d" != . ] || missing="$missing $d/node_modules/.bin/prettier"
  [ -d "$d/node_modules" ] || missing="$missing $d/node_modules"
done
[ -d deps ] || missing="$missing deps"
[ -z "$missing" ] || echo "worktree_setup: still missing:$missing (re-run, or install by hand)" >&2
exit 0
