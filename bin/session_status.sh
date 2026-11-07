#!/bin/sh
# SessionStart context: only what the next action depends on; empty sections print nothing.
# `--full` adds the old detail (compaction mode, housekeeping list, every worktree, green CI, drift "none").
# Read-only; a missing tool or network prints a note instead of failing the session. Slow calls are
# capped (perl alarm; macOS has no `timeout`) and run in parallel, each section into a file, printed in order.
cd "$(dirname "$0")/.." || exit 0
full=; [ "$1" = --full ] && full=1
cap() { perl -e 'alarm shift; exec @ARGV' 6 "$@"; }
tmp=$(mktemp -d) && trap 'rm -rf "$tmp"' EXIT
have_br=; command -v br >/dev/null 2>&1 && have_br=1
# --no-auto-import: a plain br imports main's export over rows a refused Beads sync left open (bin/lib/beads_sync.sh).
brq() { cap br --no-auto-import "$@" 2>/dev/null; }

beads() {
  if [ -z "$have_br" ]; then echo "br not installed: see docs/BEADS.md"; return; fi
  brq list --status in_progress
  r=$(brq ready --json | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))' 2>/dev/null)
  b=$(brq blocked --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["total"])' 2>/dev/null)
  echo "ready: ${r:-?}, blocked: ${b:-?} (lists: br ready, br blocked)"
}

orphans() { o=$(sh bin/orphans.sh 2>/dev/null); [ -z "$o" ] || printf 'Orphaned busy processes (check, then stop by PID):\n%s\n' "$o"; }

prs() { # open PRs, then Beads/PR drift from the same list
  if ! cap gh pr list --state open --limit 200 --json number,title,headRefName,isDraft \
    --jq '.[] | "\(.number)\t\(if .isDraft then "DRAFT" else "OPEN" end)\t\(.title[:90])\t\(.headRefName)"' > "$tmp/prs.tsv" 2>/dev/null; then
    echo "gh unavailable: open PRs and drift not checked"; return
  fi
  [ ! -s "$tmp/prs.tsv" ] || { echo "Open PRs:"; if [ -n "$full" ]; then cat "$tmp/prs.tsv"; else head -10 "$tmp/prs.tsv"; fi; }
  n=$(wc -l < "$tmp/prs.tsv"); [ -n "$full" ] || [ "$n" -le 10 ] || echo "... and $((n - 10)) more (gh pr list)"
  if [ -z "$have_br" ] || ! brq list --status all --json > "$tmp/issues"; then echo "drift check skipped: br unavailable"; return; fi
  awk -F'\t' '{print $1, "OPEN"}' "$tmp/prs.tsv" > "$tmp/states"
  for n in $(python3 bin/beads_pr_drift.py --in-progress-prs "$tmp/issues"); do
    ( cap gh pr view "$n" --json number,state --jq '"\(.number) \(.state)"' > "$tmp/v$n" 2>/dev/null \
      || echo "drift check incomplete: PR #$n state unavailable" > "$tmp/e$n" ) &
  done
  wait; cat "$tmp"/v[0-9]* >> "$tmp/states" 2>/dev/null; inc=$(cat "$tmp"/e[0-9]* 2>/dev/null); [ -z "$inc" ] || echo "$inc"
  drift=$(python3 bin/beads_pr_drift.py "$tmp/issues" "$tmp/states") || drift="drift check failed"
  [ -z "$drift" ] || printf '%s\n' "$drift"
  [ -z "$full" ] || [ -n "$drift$inc" ] || echo "no drift"
}

nightly() { # a red nightly is the session's first job (docs/decisions/owner-decision-preproduction-gate-2026-10-08.md)
  for wf in ci.yml book-e2e.yml; do
    ( run=$(cap gh run list --workflow "$wf" --branch main --event schedule --limit 1 --json conclusion,status,headSha,url \
        --jq '.[] | "\(if .status == "completed" then .conclusion else .status end) \(.headSha[:8]) \(.url)"' 2>/dev/null) || { echo "nightly $wf: check unavailable"; exit 0; }
      case $run in success*|in_progress*|queued*|waiting*|pending*|requested*) [ -z "$full" ] || echo "nightly $wf $run" ;;
        "") [ -z "$full" ] || echo "nightly $wf no scheduled run yet" ;; *) echo "nightly $wf $run (red: fix first)" ;; esac ) > "$tmp/n$wf" &
  done
  wait; cat "$tmp"/n*
}

housekeeping() { # one br query (open ids/titles and the newest created_at) and one git query
  hk=; [ -z "$have_br" ] || hk=$(brq list -l housekeeping --status all --json | python3 -I -c '
import json, sys
issues = json.load(sys.stdin)["issues"]
open_ = [i for i in issues if i["status"] != "closed"]
print("housekeeping: %d open (br list -l housekeeping)" % len(open_))
for i in open_:
    print("  %s %s" % (i["id"], i["title"]))
print("newest=" + max([i["created_at"][:19] for i in issues] or [""]))
' 2>/dev/null)
  if [ -z "$hk" ]; then echo "housekeeping queue unavailable (br or json error)"; return; fi
  # the first line is the count, the rest the list: the list prints only with --full
  { printf '%s\n' "$hk" | sed -n 1p | grep -v ': 0 open'; [ -z "$full" ] || printf '%s\n' "$hk" | sed '1d' | grep -v '^newest='; }
  newest=$(printf '%s\n' "$hk" | sed -n 's/^newest=//p')
  merged=$(TZ=UTC git log -1 --merges --date=format-local:%Y-%m-%dT%H:%M:%S --format=%cd origin/main 2>/dev/null)
  if [ -n "$merged" ] && [ "$(printf '%s\n%s\n' "$newest" "$merged" | sort | tail -1)" = "$merged" ] && [ "$newest" != "$merged" ]; then
    echo "last session may have ended without a retro: write one from merged PRs, review records and CI since then"
  fi
}

leftovers() { # linked worktrees already merged into origin/main or prunable, stashes, merged review-<N> refs (local git only)
  self=$(pwd -P); head=$(git rev-parse origin/main 2>/dev/null); tab=$(printf '\t')
  git worktree list --porcelain 2>/dev/null | awk 'BEGIN{RS="";FS="\n"} NR>1 {
    p=$1; sub(/^worktree /,"",p); h=""; pr=0
    for(i=2;i<=NF;i++){ if($i~/^HEAD /) h=substr($i,6); if($i~/^prunable/) pr=1 }
    print p "\t" h "\t" pr }' | while IFS=$tab read -r p h pr; do
    [ "$p" != "$self" ] || continue
    if [ "$pr" = 1 ]; then why=" (prunable)"
    elif [ -n "$h" ] && [ "$h" != "$head" ] && git merge-base --is-ancestor "$h" origin/main 2>/dev/null; then why=" (HEAD in main; check for work)"
    elif [ -n "$full" ]; then why=
    else continue; fi
    echo "worktree $p$why" | sed "s|^worktree $HOME|worktree ~|"
  done
  n=$(git stash list 2>/dev/null | wc -l | tr -d ' '); [ "$n" = 0 ] || echo "stashes: $n"
  git branch --list 'review-*' --merged origin/main 2>/dev/null | sed 's/^[* +]*/merged review ref (delete): /'
}

compaction() { # newest subagent compact_boundary; durationMs < 1000 = hook (loka-oy8i; bin/send_guard.py enforces it)
  # Project dir name: repo path with / and . replaced by - (Claude Code's rule). Prints no paths.
  pd="$HOME/.claude/projects/$(git rev-parse --git-common-dir | xargs -I{} sh -c 'cd "{}/.." && pwd -P' | tr '/.' '--')"
  # Newest 100 transcripts only: grepping all of them takes ~10 s.
  f=$(ls -t "$pd"/*/subagents/*.jsonl 2>/dev/null | head -100 | xargs grep -l '"subtype":"compact_boundary"' 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
  if [ -z "$f" ]; then echo "compaction: none seen"; return; fi
  grep '"subtype":"compact_boundary"' "$f" | tail -1 | python3 -I -c '
import json, sys, time
from datetime import datetime
e = json.loads(sys.stdin.readline())
d = e["compactMetadata"]["durationMs"]
age = int((time.time() - datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")).timestamp()) / 60)
print("compaction: built-in (%d s, %d min ago)" % (d / 1000, age) if d >= 1000 else "compaction: HOOK? (~%d ms, %d min ago) - stop spawning" % (d, age))
' 2>/dev/null || echo "compaction: unreadable"
}

jobs="beads orphans prs nightly housekeeping leftovers"; [ -z "$full" ] || jobs="compaction $jobs"
for j in $jobs; do $j > "$tmp/out.$j" 2>&1 & done
wait
for j in $jobs; do cat "$tmp/out.$j"; done
echo "Before you clear: ask the PM for handoff + retro"
exit 0
