#!/bin/sh
# PreToolUse hook on Agent (.claude/settings.json): refuse a spawn while the 1-minute load is 8 or more
# (docs/WORKFLOW.md load gate); an unparseable load (a comma-decimal locale) lets the spawn through. Exit 2 blocks the tool call and shows stderr to the agent.
load=$(uptime | sed 's/.*load averages*: *//' | awk '{sub(/,$/, "", $1); print $1}')
if awk -v l="$load" 'BEGIN { exit !(l ~ /^[0-9]+(\.[0-9]+)?$/ && l + 0 >= 8) }'; then
  echo "Agent spawn refused: 1-minute load is $load (limit 8). Wait for running tests to finish, then retry." >&2
  exit 2
fi
