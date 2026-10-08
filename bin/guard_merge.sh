#!/bin/sh
# Claude PreToolUse(Bash) hook: block a `gh pr merge` (including --auto) run outside
# bin/merge_queue.sh (docs/WORKFLOW.md step 7). Exit 2 blocks; stderr goes to the agent.
# Fail-safe: any command with a `gh` word followed later by `pr` and `merge` words is blocked,
# so a commit message or grep that names the command is blocked too (reword it).
# ponytail: a merge built from variables, an alias or the REST API (`gh api .../merge`) passes;
# it guards against habit, not evasion.
in=$(cat)
cmd=$(printf '%s' "$in" | jq -er '.tool_input.command' 2>/dev/null) || cmd=$in # unparseable: scan raw input
printf '%s' "$cmd" | tr '\n' ' ' |
  grep -Eq '(^|[^[:alnum:]_.-])gh[[:space:]](.*[^[:alnum:]_-])?pr[[:space:]](.*[^[:alnum:]_-])?merge([^[:alnum:]_-]|$)' || exit 0
echo "Blocked: merge only through bin/merge_queue.sh <PR> <sha> (docs/WORKFLOW.md step 7)." >&2
exit 2
