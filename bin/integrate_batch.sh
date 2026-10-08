#!/bin/sh
# Integrate a reviewed batch into the current branch (the E1 integration worktree):
# cherry-pick the review record onto <branch>, merge it --no-ff, run the kernel typecheck,
# the full TS size gate, the E1 tests and the recorder, and require <expected-pending>
# open authored obligations. Toolchain from PATH (run under `mise exec --`).
#   bin/integrate_batch.sh [--push] <branch> <review-sha> <expected-pending>
set -u
push=
[ "${1-}" = --push ] && { push=1; shift; }
[ $# -eq 3 ] || { echo "usage: $0 [--push] <branch> <review-sha> <expected-pending>" >&2; exit 2; }
branch=$1 review=$2 want=$3
artifact=tmp/e1-selected-v042.json # gitignored
artifact_sha=1c53bcd86149ee6087a08f15a5cc625873cc840e4a1769b36df89d03ff581115
rebuild="python3 -c \"import json,sys;f=json.load(open('protocol/fixtures/missing_child_v042_hash.json'));sys.stdout.write('{\\\"cartridge\\\":'+f['canonical']+',\\\"content_hash\\\":\\\"'+f['sha256']+'\\\"}')\" > $artifact"
cd "$(git rev-parse --show-toplevel)" || exit 2
logs=$(mktemp -d "${TMPDIR:-/tmp}/integrate_batch.XXXXXX") || exit 2
echo "logs: $logs"
hint=
die() { echo "integrate_batch: $*" >&2; [ -z "$hint" ] || echo "$hint" >&2; exit 1; }
# Run a step with its output in a log; on failure print the failing lines and stop.
step() {
  name=$1; shift
  "$@" > "$logs/$name.log" 2>&1; rc=$?
  echo "$name: exit $rc"
  [ "$rc" -eq 0 ] && return 0
  { grep -iE 'error|fail|not ok|✖' "$logs/$name.log" || tail -n 20 "$logs/$name.log"; } | head -n 20
  die "$name failed"
}
[ -z "$(git status --porcelain)" ] || die 'working tree not clean'
[ "$(shasum -a 256 < "$artifact" 2>/dev/null | cut -d' ' -f1)" = "$artifact_sha" ] ||
  die "$artifact missing or not sha256 $artifact_sha; rebuild with: $rebuild"
wt=$(git worktree list --porcelain | awk -v b="branch refs/heads/$branch" '/^worktree /{w=substr($0,10)} $0==b{print w}')
if [ -z "$wt" ]; then wt=$logs/branch; step worktree git worktree add "$wt" "$branch"; fi
[ -z "$(git -C "$wt" status --porcelain)" ] || die "$wt not clean"
if git merge-base --is-ancestor "$review" "$branch"; then echo "cherry-pick: $review already on $branch"
else
  git -C "$wt" cherry-pick "$review" > "$logs/cherry-pick.log" 2>&1 ||
    die "cherry-pick of $review onto $branch failed in $wt; left for the PM (log $logs/cherry-pick.log)"
  echo "cherry-pick: exit 0"
fi
git merge --no-ff --no-edit -m "Integrate $branch; $want pending expected" "$branch" > "$logs/merge.log" 2>&1 ||
  die "merge of $branch stopped; tree left for the PM: $(git diff --name-only --diff-filter=U | tr '\n' ' ')"
echo "merge: exit 0, $(git rev-parse --short HEAD)"
hint='HEAD is the unchecked merge; undo with: git reset --hard HEAD^'
step typecheck npm --prefix kernel/ts run typecheck
step size node bin/check_ts_size.mjs
step e1-tests sh -c 'cd kernel/ts && node --test test/e1*.test.ts'
out=$logs/recorder
node kernel/ts/test/e1_cases.ts "$artifact" "$out" > "$logs/recorder.log" 2>&1; rc=$?
echo "recorder: exit $rc"
[ "$rc" -eq 2 ] || { tail -n 20 "$logs/recorder.log"; die "recorder exit $rc, want 2 (pending)"; }
counts=$(node -p 'const r = require(process.argv[1]); [r.receipts.length, r.gaps.authored_obligations.length,
  r.dispositioned_obligations.length, r.witnessed_obligations.length].join(" ")' "$out/report.json") ||
  die "cannot read $out/report.json"
set -- $counts
echo "counts: $1 cases pass, $2 pending, $3 dispositioned, $4 witnessed"
[ "$2" = "$want" ] || die "pending $2, expected $want"
hint=
if [ -n "$push" ]; then
  export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh} -o ServerAliveInterval=30"
  git push origin HEAD > "$logs/push.log" 2>&1 || git push origin HEAD >> "$logs/push.log" 2>&1 ||
    { tail -n 20 "$logs/push.log"; die "all checks passed; only the push failed, twice (log $logs/push.log)"; }
  echo 'push: exit 0'
fi
# -D: the cherry-picked record is not on the branch's upstream, but it is in HEAD.
git merge-base --is-ancestor "$branch" HEAD || die "$branch not in HEAD"
step cleanup sh -c 'git worktree remove "$1" && git branch -D "$2"' - "$wt" "$branch"
