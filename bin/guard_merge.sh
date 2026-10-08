#!/bin/sh
# Claude PreToolUse(Bash) hook: block a `gh pr merge` (including --auto) run outside
# bin/merge_queue.sh (docs/WORKFLOW.md step 7). Exit 2 blocks; stderr goes to the agent.
# ponytail: matches gh in command position only, so `env gh`, `xargs gh` or `sh -c "gh ..."`
# pass; it guards against habit, not evasion.
in=$(cat)
if cmd=$(printf '%s' "$in" | jq -er '.tool_input.command' 2>/dev/null); then
  re='(^|[;&|(`])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*gh[[:space:]]+pr[[:space:]]+merge'
else
  cmd=$in re='gh[[:space:]]+pr[[:space:]]+merge' # unparseable input fails closed
fi
printf '%s\n' "$cmd" | grep -Eq "$re" || exit 0
echo "Blocked: merge only through bin/merge_queue.sh <PR> <sha> (docs/WORKFLOW.md step 7)." >&2
exit 2
