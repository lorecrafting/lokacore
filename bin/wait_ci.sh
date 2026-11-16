#!/bin/sh
# Wait (max ~40 min) until ci and book-e2e exist on <sha> and every workflow there has completed;
# print one line per workflow; exit 0 only when all succeeded. For a branch head: ci and book-e2e
# skip pushes to main. A <branch> instead of a sha waits on its current origin head (fetched first):
# positional, not `--branch`.
sha=$1 done=; cd "$(dirname "$0")/.." || exit 2
case $sha in *[!0-9a-f]*) git fetch -q origin "$sha" && sha=$(git rev-parse FETCH_HEAD) || { echo "wait_ci: cannot fetch $1" >&2; exit 2; } ;; esac
# `gh run list --commit` matches only the full 40-character sha and returns nothing for a short one,
# which read as "no runs yet" and timed out after 40 min on a green head (three times, 2026-11-12).
# Best effort: a name git cannot resolve is passed through unchanged, so the caller sees gh's answer.
sha=$(git rev-parse "$sha" 2>/dev/null || echo "$sha")
# `WAIT_CI_ATTEMPTS` (default 40, one a minute) bounds the wait; a red control sets it to 1.
for i in $(seq 1 "${WAIT_CI_ATTEMPTS:-40}"); do
  out=$(gh run list --commit "$sha" --json name,status,conclusion -q '.[] | "\(.name):\(.status):\(.conclusion)"' 2>/dev/null)
  # Both gating workflows must exist: graph-diff or mobile alone can finish first (loka-514z).
  echo "$out" | grep -q '^ci:' && echo "$out" | grep -q '^book-e2e:' && ! echo "$out" | grep -qv ':completed:' && { done=1; break; }
  sleep 60
done
echo "$sha"; echo "$out"
# No runs at all is a different failure from a slow one, and saying "timed out" sent three green heads
# back to be re-checked by hand: name it.
[ -n "$out" ] || { echo "wait_ci: no runs found for $sha" >&2; exit 1; }
[ -n "$done" ] || { echo "wait_ci: timed out before ci and book-e2e both completed" >&2; exit 1; }
echo "$out" | grep -qv ':completed:success' && exit 1 || exit 0
