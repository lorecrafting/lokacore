#!/bin/sh
# Append one status line to the served worktree's .polish/status.jsonl, which the Polish panel
# shows (docs/web-preview.md, Polish queue). The served worktree is found by Storybook's port
# (LOKA_SB_PORT, 6006); LOKA_POLISH_DIR overrides the directory (tests).
#   bin/polish_status.sh <pick id> working|done|stopped [model] [summary] [sha]
#   bin/polish_status.sh <pick id> moved <beads id> [reason]
#   bin/polish_status.sh suggest-close "<reason>"
set -eu
me=polish_status
. "$(dirname "$0")/lib/serve.sh"
[ $# -ge 2 ] || { echo "usage: $0 <id> <state> [model] [summary] [sha] | suggest-close <reason>" >&2; exit 2; }
if [ -z "${LOKA_POLISH_DIR-}" ]; then
  app=$(served_from "$SB_PORT"); [ -n "$app" ] || die "no Storybook on port $SB_PORT"
  LOKA_POLISH_DIR=$app/../../.polish
fi
mkdir -p "$LOKA_POLISH_DIR"
python3 -c '
import json, sys, time
a = sys.argv[1:]
arg = lambda i: a[i] if len(a) > i and a[i] else None  # unknowns stay null
line = {"time": int(time.time() * 1000)}
if a[0] == "suggest-close":
    line.update(type="suggest-close", reason=a[1])
elif a[1] == "moved":
    line.update(id=a[0], state="moved", beads=a[2], summary=arg(3))
elif a[1] in ("working", "done", "stopped"):
    line.update(id=a[0], state=a[1], model=arg(2), summary=arg(3), sha=arg(4))
else:
    sys.exit(f"polish_status: unknown state {a[1]}")
print(json.dumps(line))
' "$@" >> "$LOKA_POLISH_DIR/status.jsonl"
