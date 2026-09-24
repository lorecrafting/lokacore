#!/bin/sh
# Claude Code PostToolUse hook (.claude/settings.json): mix format an edited Elixir file.
# Only files in this repo or its worktrees: mix in another repo would run that repo's mix.exs.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in *.ex|*.exs|*.heex) ;; *) exit 0 ;; esac
common() { cd "$1" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" && pwd -P; }
mine=$(common "$(dirname "$f")")
[ -n "$mine" ] && [ "$mine" = "$(common "$CLAUDE_PROJECT_DIR")" ] || exit 0
cd "$(git -C "$(dirname "$f")" rev-parse --show-toplevel)" && mise exec -- mix format "$f"
