#!/bin/sh
# Queue a reviewed PR's merge (docs/WORKFLOW.md step 7): wait for head <sha>, then for both
# `changes` rows to pass on it, then for every started check; merge only that exact head.
# A cancelled run on <sha> (a push-then-ready race) is rerun once; a second cancel refuses.
set -u
[ $# -eq 2 ] || { echo "usage: $0 <PR> <sha>" >&2; exit 2; }
pr=$1 sha=$2 poll=${MERGE_QUEUE_POLL:-5} reran=
# gh reports the full head SHA; a short one would wait forever.
echo "$sha" | grep -qxE '[0-9a-f]{40}' || { echo "merge_queue: <sha> must be the full 40-hex SHA" >&2; exit 2; }
checks() { gh pr checks "$pr" --json name,bucket,link -q "$1"; }
buckets() { checks '[.[]|select(.name=="changes").bucket]|join(",")'; }
rerun() {
  [ -z "$reran" ] || { echo "merge_queue: a run on $sha was cancelled again; not merging" >&2; exit 1; }
  reran=1
  for id in $(checks '[.[]|select(.bucket=="cancel").link|capture("runs/(?<id>[0-9]+)").id]|unique|.[]'); do
    gh run rerun "$id" || exit 1
  done
  # The stale cancelled rows linger until the rerun registers.
  while checks '[.[].bucket]|join(",")' | grep -q cancel; do sleep "$poll"; done
}
until [ "$(gh pr view "$pr" --json headRefOid -q .headRefOid)" = "$sha" ]; do sleep "$poll"; done
while :; do
  until s=$(buckets)
    case "$s" in pass,pass | *fail* | *skipping* | *cancel*) true ;; *) false ;; esac
  do sleep "$poll"; done
  case "$s" in
    *fail* | *skipping*) echo "merge_queue: changes rows read '$s'; not merging" >&2; exit 1 ;;
    *cancel*) rerun; continue ;;
  esac
  gh pr checks "$pr" --watch --fail-fast && exec gh pr merge "$pr" --merge --match-head-commit "$sha"
  all=$(checks '[.[].bucket]|join(",")')
  case "$all" in *fail*) ;; *cancel*) rerun; continue ;; esac
  echo "merge_queue: checks read '$all'; not merging" >&2; exit 1
done
