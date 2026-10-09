#!/bin/sh
# Make a new worktree checkable and pushable (docs/WORKFLOW.md, Git hygiene): the Elixir deps
# bin/check_all.sh needs, and node_modules wherever a package-lock.json exists.
set -eu
cd "$(dirname "$0")/.."
mise exec -- mix deps.get
for d in . kernel/ts mobile/app; do
  if [ -f "$d/package-lock.json" ]; then (cd "$d" && mise exec -- npm ci); fi
done
