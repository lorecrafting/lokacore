#!/bin/sh
# CI timing at merge time (docs/PM.md, Loop step 7; bin/merge_pr.sh prints it): cancelled jobs (name,
# seconds) of <sha>'s runs and of the last 3 nightly runs per workflow, the sim legs of <sha>'s and of
# the newest nightly ci run, and each sim leg's median over the last 5 green nightly runs. Moved out of
# bin/session_status.sh to keep the SessionStart hook short (loka-95f7). Read-only; gh failing prints
# nothing; always exits 0.
#   bin/ci_timing.sh <sha>
[ $# -eq 1 ] || { echo "usage: $0 <sha>" >&2; exit 2; }
# A job cancelled at its timeout is red (docs/PM.md, Loop step 7); cancelled jobs of <sha> (all runs) and the nightly runs print as "name duration".
cancelled() { # <label> <gh run list args...>
  l=$1; shift
  for id in $(gh run list "$@" --json databaseId,conclusion --jq '.[]|select(.conclusion=="cancelled")|.databaseId' 2>/dev/null); do
    gh run view "$id" --json jobs --jq '.jobs[]|select(.conclusion=="cancelled")|"cancelled job: \(.name) \((.completedAt|fromdate)-(.startedAt|fromdate))s"' 2>/dev/null | sed "s|^|$l run $id: |"
  done
}
# Each sim job leg's duration (limit 600 s) of the newest ci run (nothing while it runs), to catch a perf slowdown before it times out (loka-60rs).
simtime() { # <label> <gh run list args...>
  l=$1; shift
  id=$(gh run list "$@" --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null) || return 0
  [ -z "$id" ] || gh run view "$id" --json jobs --jq '.jobs[]|select((.name|startswith("sim (")) and (.conclusion|length)>0)|"\(.name) job \(.conclusion) \((.completedAt|fromdate)-(.startedAt|fromdate))s"' 2>/dev/null | sed "s|^|$l: |"
}
l="PR head $(printf %.8s "$1")"; cancelled "$l" --commit "$1"; simtime "$l" --commit "$1"
for wf in ci.yml book-e2e.yml; do cancelled "$wf nightly" --workflow "$wf" --branch main --event schedule --limit 3; done
simtime "ci.yml nightly" --branch main --event schedule
# Runners are two-speed (loka-9nd4): judge a sim time against the median of the last 5 green nightly legs, not one run.
# The views run in parallel: one after another they add ~7 s to the 30 s hook.
for id in $(gh run list --workflow ci.yml --branch main --event schedule --status success --limit 5 --json databaseId --jq '.[].databaseId' 2>/dev/null); do
  gh run view "$id" --json jobs --jq '.jobs[]|select((.name|startswith("sim (")) and .conclusion == "success")|"\(.name)\t\((.completedAt|fromdate)-(.startedAt|fromdate))"' 2>/dev/null &
done | python3 -I -c '
import statistics, sys
legs = {}
for line in sys.stdin:
    name, secs = line.rstrip("\n").split("\t")
    legs.setdefault(name, []).append(int(secs))
for name, secs in sorted(legs.items()):
    print("ci.yml nightly median: %s %ds over %d runs" % (name, statistics.median(secs), len(secs)))
'
exit 0
