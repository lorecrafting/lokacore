#!/bin/sh
# Prints the newest ancestor of <head> (30 at most) with a CI run whose elixir, typescript and sim
# jobs all succeeded, or nothing; any API error stops the search with nothing (CI then runs
# everything). $GH is the gh command (red controls plant a fake); $REPO is owner/name.
# No `set -e`: it is off inside a function called after `||`, so each call is checked.
GH=${GH:-gh}
search() {
  commits=$(git rev-list -n 30 "$1^") || return 1
  for c in $commits; do
    ids=$($GH api "repos/$REPO/actions/runs?head_sha=$c" --jq '.workflow_runs[].id') || return 1
    for id in $ids; do
      n=$($GH api "repos/$REPO/actions/runs/$id/jobs" --jq '[.jobs[] | select(.conclusion == "success" and (.name | IN("elixir", "typescript", "sim")))] | length') || return 1
      [ "$n" = 3 ] && { echo "$c"; return 0; }
    done
  done
}
search "$1" 2>/dev/null || echo
