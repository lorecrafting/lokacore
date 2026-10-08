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
  echo "br not installed: see docs/WORKFLOW.md#beads-rust"
fi
echo "## Open PRs"
gh pr list --limit 10 2>/dev/null || echo "gh unavailable"
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
