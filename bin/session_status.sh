#!/bin/sh
# SessionStart context: live tracker and PR state, so no memory file has to copy it.
# Read-only; a missing tool or network prints a note instead of failing the session.
cd "$(dirname "$0")/.." || exit 0
if command -v br >/dev/null 2>&1; then
  echo "## Beads ($(br where 2>/dev/null | head -1 | sed "s|$HOME|~|"))"
  br list --status in_progress 2>/dev/null
  br ready 2>/dev/null | head -15
  br blocked 2>/dev/null | head -15
else
  echo "br not installed: see docs/BEADS.md"
fi
echo "## Open PRs"
gh pr list --limit 10 2>/dev/null || echo "gh unavailable"
echo "## Housekeeping queue"
# One br query (open ids/titles and the newest created_at) and one git query; failure prints a note.
hk=
if command -v br >/dev/null 2>&1; then
  hk=$(br list -l housekeeping --status all --json 2>/dev/null | python3 -I -c '
import json, sys
issues = json.load(sys.stdin)["issues"]
open_ = [i for i in issues if i["status"] != "closed"]
print("open housekeeping issues: %d" % len(open_))
for i in open_:
    print("  %s %s" % (i["id"], i["title"]))
print("newest=" + max([i["created_at"][:19] for i in issues] or [""]))
' 2>/dev/null)
fi
if [ -z "$hk" ]; then
  echo "housekeeping queue unavailable (br or json error)"
else
  printf '%s\n' "$hk" | grep -v '^newest='
  newest=$(printf '%s\n' "$hk" | sed -n 's/^newest=//p')
  merged=$(TZ=UTC git log -1 --merges --date=format-local:%Y-%m-%dT%H:%M:%S --format=%cd origin/main 2>/dev/null)
  if [ -n "$merged" ] && [ "$(printf '%s\n%s\n' "$newest" "$merged" | sort | tail -1)" = "$merged" ] && [ "$newest" != "$merged" ]; then
    echo "last session may have ended without a retro: write one from merged PRs, review records and CI since then"
  fi
fi
echo "Before you clear: ask the PM for handoff + retro"
echo "## Local leftovers"
# Linked worktrees other than this one (the main checkout is never listed), stashes and review-<N> refs already in origin/main (local git only, no network).
git worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | tail -n +2 | grep -vxF "$(pwd -P)" | sed "s|^$HOME|~|; s/^/worktree /"
echo "stashes: $(git stash list 2>/dev/null | wc -l | tr -d ' ')"
git branch --list 'review-*' --merged origin/main 2>/dev/null | sed 's/^[* +]*/merged review ref (delete): /'
echo "## Beads/PR drift"
tmp=$(mktemp -d) && trap 'rm -rf "$tmp"' EXIT
if command -v br >/dev/null 2>&1 && br list --status all --json > "$tmp/issues" 2>/dev/null \
  && gh pr list --state open --limit 200 --json number --jq '.[] | "\(.number) OPEN"' > "$tmp/states" 2>/dev/null; then
  none=none
  for n in $(python3 bin/beads_pr_drift.py --in-progress-prs "$tmp/issues"); do
    gh pr view "$n" --json number,state --jq '"\(.number) \(.state)"' >> "$tmp/states" 2>/dev/null \
      || { echo "drift check incomplete: PR #$n state unavailable"; none=; }
  done
  drift=$(python3 bin/beads_pr_drift.py "$tmp/issues" "$tmp/states") || drift="drift check failed"
  [ -z "$drift$none" ] || echo "${drift:-$none}"
else
  echo "drift check skipped: br or gh unavailable"
fi
exit 0
