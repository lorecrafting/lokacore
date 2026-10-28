#!/bin/sh
# Claude Code PostToolUse hook (.claude/settings.json): format an edited file with mix format
# (Elixir) or Prettier (TypeScript, JavaScript, JSON; scope in .prettierignore), then check an
# edited TypeScript file's size (bin/check_ts_size.mjs).
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
# Size limits on an edited TypeScript file; exit 2 shows the breach to the agent.
case "$f" in
  *.ts|*.tsx|*.mjs) out=$(mise exec -- node bin/check_ts_size.mjs "$(cd "$(dirname "$f")" && git rev-parse --show-prefix)$(basename "$f")" 2>&1) || { echo "$out" >&2; exit 2; } ;;
esac
