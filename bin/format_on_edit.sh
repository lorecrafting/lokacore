#!/bin/sh
# Claude Code PostToolUse hook (.claude/settings.json): format an edited file with mix format
# (Elixir) or Prettier (TypeScript, JavaScript, JSON; scope in .prettierignore).
# Only files in this repo or its worktrees: mix in another repo would run that repo's mix.exs.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in *.ex|*.exs|*.heex|*.ts|*.tsx|*.mjs|*.js|*.json) ;; *) exit 0 ;; esac
common() { cd "$1" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" && pwd -P; }
mine=$(common "$(dirname "$f")")
[ -n "$mine" ] && [ "$mine" = "$(common "$CLAUDE_PROJECT_DIR")" ] || exit 0
cd "$(git -C "$(dirname "$f")" rev-parse --show-toplevel)" || exit 0
case "$f" in
  *.ex|*.exs|*.heex) mise exec -- mix format "$f" ;;
  *) git check-ignore -q "$f" || mise exec -- node_modules/.bin/prettier --write --log-level warn "$f" ;;
esac
