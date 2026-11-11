#!/bin/sh
# Push a slice branch and report the push's own status (loka-ujau): `echo $?` after `| tail` is tail's.
# Usage: bin/push_slice.sh <worktree> <branch>
# Runs in <worktree> (the pre-push hook checks the repo it runs in, and the shell resets to the main
# checkout between calls). Output goes to a per-run log (mktemp). Prints one line
# `PUSH_EXIT=<n> <sha>`, the log path and, after a push, whether ci and book-e2e started. Exit status = git push's (prepush runs inside it).
set -u
[ $# = 2 ] || { echo "usage: bin/push_slice.sh <worktree> <branch>" >&2; exit 2; }
bin=$(cd "$(dirname "$0")" && pwd)
[ "$(git -C "$1" branch --show-current)" = "$2" ] || { echo "push_slice: $2 is not the branch checked out in $1" >&2; exit 2; }
log=$(mktemp "${TMPDIR:-/tmp}/push_slice.XXXXXX") || exit 2
# The unit files this diff touches, before the push (loka-4ks2l: one missing ROUTES row cost #707 four
# days of red CI). A red touched file refuses the push; `bin/prepush.sh` keeps to static checks, since
# the hook runs for any push and some of these files take a minute. Its output goes to the log, so the
# PUSH_EXIT line stays first.
if ! "$bin/related_tests.sh" "$1" "$(git -C "$1" rev-parse "$2")" >"$log" 2>&1; then
  echo 'push_slice: the unit files this branch touches are red; fix them and push again' >&2
  cat "$log" >&2
  echo 'PUSH_EXIT=1 '$(git -C "$1" rev-parse "$2")
  exit 1
fi
# -u: a branch made tracking origin/main would otherwise pull --rebase from main (loka-aeju).
git -C "$1" push -u origin "$2" >"$log" 2>&1
n=$?
echo "PUSH_EXIT=$n $(git -C "$1" rev-parse "$2" 2>/dev/null)"
echo "log: $log"
[ $n = 0 ] || tail -n 5 "$log"
# The pushed head's hosted runs (ci.yml, book-e2e.yml); one may start up to ~2 minutes late.
if [ $n = 0 ]; then
  runs=$(cd "$1" && gh run list --commit "$(git rev-parse "$2")" --json workflowName --jq '.[].workflowName')
  for w in ci book-e2e; do printf '%s\n' "$runs" | grep -qx "$w" && echo "$w: started" || echo "$w: not started"; done
fi
exit $n
