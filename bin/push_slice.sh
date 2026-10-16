#!/bin/sh
# Push a slice branch and report the push's own status (loka-ujau): `echo $?` after `| tail` is tail's.
# Usage: bin/push_slice.sh <branch>
# Output goes to a per-run log (mktemp, so no other agent's file is reused). Prints one line
# `PUSH_EXIT=<n> <sha>` and the log path. Exit status = git push's (prepush runs inside it).
set -u
[ $# = 1 ] || { echo "usage: bin/push_slice.sh <branch>" >&2; exit 2; }
log=$(mktemp "${TMPDIR:-/tmp}/push_slice.XXXXXX") || exit 2
git push origin "$1" >"$log" 2>&1
n=$?
echo "PUSH_EXIT=$n $(git rev-parse "$1" 2>/dev/null)"
echo "log: $log"
[ $n = 0 ] || tail -n 5 "$log"
exit $n
