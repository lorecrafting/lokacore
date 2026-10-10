#!/bin/sh
# Make a new worktree checkable and pushable (docs/WORKFLOW.md, Git hygiene): the Elixir deps
# bin/check_all.sh needs, and node_modules wherever a package-lock.json exists.
set -eu
cd "$(dirname "$0")/.."
mise exec -- mix deps.get --check-locked
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
for d in . kernel/ts mobile/app; do
  [ -f "$d/package-lock.json" ] || continue
  # Same lockfile as the main checkout: link its node_modules (npm ci through a link would wipe it), else install.
  if [ -d "$main/$d/node_modules" ] && cmp -s "$d/package-lock.json" "$main/$d/package-lock.json"; then
    [ -e "$d/node_modules" ] || ln -s "$main/$d/node_modules" "$d/node_modules"
  else (cd "$d" && mise exec -- npm ci); fi
done
