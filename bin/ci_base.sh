#!/bin/sh
# Prints the newest ancestor of <head> (30 at most) with a CI run whose selected
# jobs all succeeded, or nothing; any API error stops the search with nothing (CI then runs
# everything). $GH is the gh command (red controls plant a fake); $REPO is owner/name.
# No `set -e`: it is off inside a function called after `||`, so each call is checked.
GH=${GH:-gh}
case ${2-code} in
  code) jobs='[.jobs[] | select(.conclusion == "success" and (.name | IN("elixir", "typescript", "sim", "e1-recorder")))] | length'; count=4 ;;
  browser) jobs='[.jobs[] | select(.conclusion == "success" and .name == "browser")] | length'; count=1 ;;
  *) exit 1 ;;
esac
search() {
  commits=$(git rev-list -n 30 "$1^") || return 1
  for c in $commits; do
    ids=$($GH api "repos/$REPO/actions/runs?head_sha=$c" --jq '.workflow_runs[].id') || return 1
    for id in $ids; do
      n=$($GH api "repos/$REPO/actions/runs/$id/jobs" --jq "$jobs") || return 1
      [ "$n" = "$count" ] && { echo "$c"; return 0; }
    done
  done
}
search "$1" 2>/dev/null || echo
