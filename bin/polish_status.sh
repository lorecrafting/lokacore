#!/bin/sh
# Append one status line to the served worktree's .polish/status.jsonl, which the Polish panel
# shows (docs/web-preview.md, Polish queue). The served worktree is found by Storybook's port
# (LOKA_SB_PORT, 6006); LOKA_POLISH_DIR overrides the directory (tests).
#   bin/polish_status.sh <pick id> working|done|stopped [model] [summary] [sha]
#   bin/polish_status.sh <pick id> moved <beads id> [reason]
#   bin/polish_status.sh suggest-close "<reason>"
#   bin/polish_status.sh log "<text>"     a PM progress line (routed, waiting)
#   bin/polish_status.sh dir             prints the queue directory (for /polish-intake)
set -eu
me=polish_status
. "$(dirname "$0")/lib/serve.sh"
usage="usage: $0 <id> working|done|stopped [model] [summary] [sha] | <id> moved <beads id> [reason] | suggest-close <reason> | log <text> | dir"
if [ -z "${LOKA_POLISH_DIR-}" ]; then
  app=$(served_from "$SB_PORT"); [ -n "$app" ] || die "no Storybook on port $SB_PORT"
  LOKA_POLISH_DIR=$(cd "$app/../.." && pwd)/.polish
fi
[ "${1-}" != dir ] || { echo "$LOKA_POLISH_DIR"; exit 0; }
case "${1-}:${2-}:${3-}" in
  suggest-close:?*:*|log:?*:*) ;;
  ?*:moved:?*) ;;
  ?*:working:*|?*:done:*|?*:stopped:*) ;;
  *) echo "$usage" >&2; exit 2 ;;
esac
mkdir -p "$LOKA_POLISH_DIR"
python3 -c '
import json, sys, time
a = sys.argv[1:]
arg = lambda i: a[i] if len(a) > i and a[i] else None  # unknowns stay null
line = {"time": int(time.time() * 1000)}
if a[0] == "suggest-close":
    line.update(type="suggest-close", reason=a[1])
elif a[0] == "log":
    line.update(type="log", text=a[1])
elif a[1] == "moved":
    line.update(id=a[0], state="moved", beads=a[2], summary=arg(3))
else:
    line.update(id=a[0], state=a[1], model=arg(2), summary=arg(3), sha=arg(4))
print(json.dumps(line))
' "$@" >> "$LOKA_POLISH_DIR/status.jsonl"
