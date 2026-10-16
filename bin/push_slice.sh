#!/bin/sh
# Push a slice branch and report the push's own status (loka-ujau): `echo $?` after `| tail` is tail's.
# Usage: bin/push_slice.sh <worktree> <branch>
# Runs in <worktree> (the pre-push hook checks the repo it runs in, and the shell resets to the main
# checkout between calls). Output goes to a per-run log (mktemp). Prints one line
# `PUSH_EXIT=<n> <sha>` and the log path. Exit status = git push's (prepush runs inside it).
set -u
[ $# = 2 ] || { echo "usage: bin/push_slice.sh <worktree> <branch>" >&2; exit 2; }
[ "$(git -C "$1" branch --show-current)" = "$2" ] || { echo "push_slice: $2 is not the branch checked out in $1" >&2; exit 2; }
log=$(mktemp "${TMPDIR:-/tmp}/push_slice.XXXXXX") || exit 2
git -C "$1" push origin "$2" >"$log" 2>&1
n=$?
echo "PUSH_EXIT=$n $(git -C "$1" rev-parse "$2" 2>/dev/null)"
echo "log: $log"
[ $n = 0 ] || tail -n 5 "$log"
exit $n
