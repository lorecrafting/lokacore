#!/bin/sh
# Claude Stop hook: warn (never block) about worktrees with uncommitted changes. Always exits 0.
d=$(git -C "${CLAUDE_PROJECT_DIR:-.}" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' |
  while IFS= read -r w; do [ -n "$(git -C "$w" status --porcelain 2>/dev/null | grep -v " .beads/issues.jsonl$" | head -n 1)" ] && printf ' %s' "${w##*/}"; done)
[ -n "$d" ] && jq -nc --arg m "Worktrees with uncommitted changes:$d" '{systemMessage: $m}' 2>/dev/null
exit 0
