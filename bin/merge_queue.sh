#!/bin/sh
# Queue a reviewed PR's merge (docs/WORKFLOW.md step 7): wait for head <sha>, then for both
# `changes` rows to pass on it, then for every started check; merge only that exact head.
set -u
[ $# -eq 2 ] || { echo "usage: $0 <PR> <sha>" >&2; exit 2; }
pr=$1 sha=$2 poll=${MERGE_QUEUE_POLL:-5}
until [ "$(gh pr view "$pr" --json headRefOid -q .headRefOid)" = "$sha" ]; do sleep "$poll"; done
until s=$(gh pr checks "$pr" --json name,bucket -q '[.[]|select(.name=="changes").bucket]|join(",")')
  case "$s" in pass,pass | *fail* | *skipping* | *cancel*) true ;; *) false ;; esac
do sleep "$poll"; done
[ "$s" = pass,pass ] || { echo "merge_queue: changes rows read '$s'; not merging" >&2; exit 1; }
gh pr checks "$pr" --watch --fail-fast && gh pr merge "$pr" --merge --match-head-commit "$sha"
