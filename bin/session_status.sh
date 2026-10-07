#!/bin/sh
# SessionStart context: live tracker and PR state, so no memory file has to copy it.
# Read-only; a missing tool or network prints a note instead of failing the session.
cd "$(dirname "$0")/.." || exit 0
if command -v br >/dev/null 2>&1; then
  echo "## Beads ($(br where 2>/dev/null | head -1))"
  br list --status in_progress 2>/dev/null
  br ready 2>/dev/null | head -15
  br blocked 2>/dev/null | head -15
else
  echo "br not installed: see docs/WORKFLOW.md#beads-rust"
fi
echo "## Open PRs"
gh pr list --limit 10 2>/dev/null || echo "gh unavailable"
exit 0
