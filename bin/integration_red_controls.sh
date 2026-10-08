#!/bin/sh
# Run bin/merge_queue.sh against a stub `gh` (real jq) and bin/integrate_batch.sh in throwaway
# repos with stub checks; each case names the break it catches.
set -eu
# A git hook exports GIT_DIR and friends: without this the fixtures would land in the real repository.
unset $(env | sed -n 's/^\(GIT_[A-Z_]*\)=.*/\1/p')
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
bin=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export TMPDIR="$tmp"
fail=0
bad() { echo "FAIL $*"; fail=1; }
# A hang is killed by the alarm (exit 142) instead of passing as "no merge".
capped() { perl -e 'alarm shift; exec @ARGV' 20 "$@"; }

# --- merge_queue.sh -------------------------------------------------------------------------
mkdir "$tmp/stub"
A=0123456789abcdef0123456789abcdef01234567
cat > "$tmp/stub/gh" <<'EOF'
#!/bin/sh
# Serves the next line of $Q/heads or $Q/checks (the last line repeats) through the real jq.
echo "$*" >> "$Q/calls"
q=; prev=; for a; do [ "$prev" = -q ] && q=$a; prev=$a; done
next() { n=$(($(cat "$Q/$1.n" 2>/dev/null || echo 0) + 1)); echo $n > "$Q/$1.n"; sed -n "${n}p;\$p" "$Q/$1" | head -n 1; }
case "$1 $2 $*" in
  'pr view'*) h=$(next heads); echo "$h" > "$Q/head"; echo "{\"headRefOid\":\"$h\"}" | jq -r "$q" ;;
  *--watch*) exit "$(next watch_rc)" ;;
  'pr checks'*)
    # Until the head reaches the target, gh reports the previous head's failed run.
    if [ "$(cat "$Q/head" 2>/dev/null)" = 0123456789abcdef0123456789abcdef01234567 ]; then rows=$(next checks); else rows='[{"name":"changes","bucket":"fail"}]'; fi
    echo "$rows" | jq -r "$q"
    case "$rows" in *pending*) exit 8 ;; esac ;;
  'pr merge'* | 'run rerun'*) ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$tmp/stub/gh"
P='{"name":"changes","bucket":"pass"}' W='{"name":"changes","bucket":"pending"}'
S='{"name":"changes","bucket":"skipping"}' F='{"name":"changes","bucket":"fail"}'
L='{"name":"lint","bucket":"skipping"}'
C='{"name":"changes","bucket":"cancel","link":"https://github.com/o/r/actions/runs/42/job/1"}'
E='{"name":"e2e","bucket":"cancel","link":"https://github.com/o/r/actions/runs/43/job/2"}'
# mq <case> <want-rc> <watch-rcs> <heads> <checks rows...>
mq() {
  name=$1 want=$2 watch=$3 heads=$4; shift 4
  Q=$(mktemp -d); export Q
  printf '%s\n' $heads > "$Q/heads"; printf '%s\n' "$@" > "$Q/checks"; printf '%s\n' $watch > "$Q/watch_rc"
  rc=0; PATH="$tmp/stub:$PATH" MERGE_QUEUE_POLL=0 capped sh "$bin/merge_queue.sh" 7 "$A" > /dev/null 2>&1 || rc=$?
  [ "$rc" = "$want" ] || bad "merge_queue $name: exit $rc, want $want"
  merged=$(grep -c '^pr merge' "$Q/calls" || true)
  if [ "$want" = 0 ]; then
    grep -qx "pr merge 7 --merge --match-head-commit $A" "$Q/calls" || bad "merge_queue $name: no exact-head merge"
  elif [ "$merged" != 0 ]; then bad "merge_queue $name: merged"; fi
}
# Break: a draft's skipped rows pass the gate (or loop forever).
mq draft 1 0 "$A" "[$S,$L,$S]"
# Break: a failing `changes` row is not a stop.
mq fail 1 0 "$A" "[$P,$F]"
# Break: one passing `changes` row is enough, so book-e2e registering late is never awaited.
mq late-row 0 0 "$A" "[$P]" "[$P,$W]" "[$L,$P,$P]"
[ "$(grep -c '^pr checks 7 --json' "$Q/calls")" = 3 ] || bad 'merge_queue late-row: merged before pass,pass'
# Break: no head wait, so the previous head's checks decide.
mq head-late 0 0 "old old $A" "[$P,$P]"
[ "$(grep -c '^pr view' "$Q/calls")" = 3 ] || bad 'merge_queue head-late: did not wait for the head'
# Break: the merge ignores the watch result.
mq watch-fails 1 1 "$A" "[$P,$P]"
# Break: a cancelled run (push-then-ready race) refuses instead of one rerun, or the stale
# cancelled row read right after the rerun counts as a second cancel. Rows: gate, rerun ids,
# stale, pending, pass.
mq cancel-once 0 0 "$A" "[$C,$P]" "[$C,$P]" "[$C,$P]" "[$W,$P]" "[$P,$P]"
[ "$(grep -c '^run rerun 42$' "$Q/calls")" = 1 ] || bad 'merge_queue cancel-once: did not rerun run 42 once'
# Break: the watch failing on a cancelled job is final, or the rerun picks the wrong run.
mq watch-cancel 0 "1 0" "$A" "[$P,$P]" "[$P,$P,$E]" "[$P,$P,$E]" "[$P,$P]"
grep -qx 'run rerun 43' "$Q/calls" || bad 'merge_queue watch-cancel: did not rerun run 43'
# Break: reruns repeat forever instead of refusing a second cancel.
mq cancel-twice 1 0 "$A" "[$C,$P]" "[$C,$P]" "[$W,$P]" "[$C,$P]"
# Break: a failed job beside a cancelled one (fail-fast) is rerun instead of refused, at the
# gate or after the watch.
mq fail-cancel-gate 1 0 "$A" "[$F,$C]"
grep -q '^run rerun' "$Q/calls" && bad 'merge_queue fail-cancel-gate: reran'
mq fail-cancel-watch 1 1 "$A" "[$P,$P]" "[$P,$P,$F,$E]"
grep -q '^run rerun' "$Q/calls" && bad 'merge_queue fail-cancel-watch: reran'
# Break: a cancelled row with no Actions run to rerun waits forever instead of refusing.
mq cancel-no-run 1 0 "$A" '[{"name":"changes","bucket":"cancel"},'"$P]"
# Break: one rerunnable cancel next to an unrerunnable one waits forever on the latter.
mq cancel-mixed 1 0 "$A" "[$C,"'{"name":"x","bucket":"cancel"}]'
# Break: an empty read after the rerun (a gh error) ends the wait, so the stale row refuses.
mq cancel-gh-error 0 0 "$A" "[$C,$P]" "[$C,$P]" "" "[$C,$P]" "[$W,$P]" "[$P,$P]"
# Break: a short SHA never equals gh's full head, so the queue waits forever.
rc=0; PATH="$tmp/stub:$PATH" capped sh "$bin/merge_queue.sh" 7 01234567 > /dev/null 2>&1 || rc=$?
[ "$rc" = 2 ] || bad "merge_queue short-sha: exit $rc, want 2"

# --- guard_merge.sh (Claude PreToolUse hook) -------------------------------------------------
# Break: a direct, --auto, compound-command or flag-separated merge passes, malformed input
# fails open, or the queue or another `pr` subcommand is blocked. guard <want-rc> <payload>
guard() { rc=0; printf '%s' "$2" | sh "$bin/guard_merge.sh" 2> /dev/null || rc=$?; [ "$rc" = "$1" ] || bad "guard_merge: exit $rc, want $1: $2"; }
guard 2 '{"tool_input":{"command":"cd x && gh pr merge 1 --auto"}}'
guard 2 '{"tool_input":{"command":"gh pr merge 1'
guard 2 '{"tool_input":{"command":"for p in 1 2; do\n/usr/bin/gh pr -R o/r merge $p; done"}}'
guard 0 "{\"tool_input\":{\"command\":\"bin/merge_queue.sh 1 $A\"}}"
guard 0 '{"tool_input":{"command":"gh pr view 1 --json merged,mergeable"}}'

# --- integrate_batch.sh ---------------------------------------------------------------------
# A repo on branch int with stub checks at the paths the script calls; batch adds g.txt and
# the review commit (on rv) adds a review record on top of batch.
python3 -c "import json,sys;f=json.load(open('$bin/../protocol/fixtures/missing_child_v042_hash.json'));sys.stdout.write('{\"cartridge\":'+f['canonical']+',\"content_hash\":\"'+f['sha256']+'\"}')" > "$tmp/v042.json"
mk() {
  R=$(mktemp -d); cd "$R"
  git init -q -b int
  mkdir -p kernel/ts/test bin tmp docs/reviews
  echo /tmp/ > .gitignore
  cp "$tmp/v042.json" tmp/e1-selected-v042.json
  echo '{"scripts":{"typecheck":"node -e 0"}}' > kernel/ts/package.json
  echo "import test from 'node:test'; test('e1', () => {});" > kernel/ts/test/e1.test.ts
  cat > bin/check_ts_size.mjs <<'EOF'
// Stub size gate: with no paths it checks every tracked file; a marked file is too long.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2);
const files = args.length ? args : execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const big = files.filter((f) => readFileSync(f, 'utf8').includes('OVER' + 'SIZE'));
for (const f of big) console.log(`${f}:1: file, 999 lines, limit 300`);
process.exit(big.length ? 1 : 0);
EOF
  cat > kernel/ts/test/e1_cases.ts <<'EOF'
// Stub recorder: needs a new outdir; reports STUB_PENDING open obligations.
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[3];
mkdirSync(out);
const gaps = { authored_obligations: Array(Number(process.env.STUB_PENDING)).fill('p') };
const report = { receipts: [1, 2], gaps, dispositioned_obligations: [1], witnessed_obligations: [1, 2, 3] };
writeFileSync(`${out}/report.json`, JSON.stringify(report));
console.log('pending: stub');
process.exit(Number(process.env.STUB_RC));
EOF
  echo base > f.txt
  git add . && git commit -qm base
  git checkout -qb batch && echo batch > g.txt && git add g.txt && git commit -qm 'batch work'
  git checkout -qb rv && echo ok > docs/reviews/r.md && git add docs && git commit -qm 'Review batch: APPROVE'
  review=$(git rev-parse HEAD)
  git checkout -q int
  # A pushed batch branch tracks its remote, which lacks the cherry-picked record.
  git remote add origin "$R.none" && git update-ref refs/remotes/origin/batch batch && git branch -qu origin/batch batch
}
# ib <case> <want-rc> <pending> <recorder-rc> [expected-pending, default 3]
ib() {
  rc=0; STUB_PENDING=$3 STUB_RC=$4 capped sh "$bin/integrate_batch.sh" batch "$review" "${5:-3}" > "$R.out" 2>&1 || rc=$?
  [ "$rc" = "$2" ] || { bad "integrate_batch $1: exit $rc, want $2"; sed 's/^/  /' "$R.out"; }
}
# Break: no --no-ff (fast-forward), a lost review record, or a kept source branch.
mk; base=$(git rev-parse HEAD)
ib success 0 3 2
[ "$(git rev-parse HEAD^1)" = "$base" ] && [ "$(git log -1 --format=%s HEAD^2)" = 'Review batch: APPROVE' ] &&
  [ "$(git rev-parse HEAD^2^)" = "$(git rev-parse rv^)" ] || bad 'integrate_batch success: not a --no-ff merge of batch plus the record'
git rev-parse -q --verify batch > /dev/null && bad 'integrate_batch success: batch branch kept'
# Break: a developer worktree with uncommitted edits is integrated without them (cleanup fails late).
mk; tip=$(git rev-parse HEAD); git worktree add -q "$R.wt" batch && echo edit > "$R.wt/g.txt"
ib dirty-worktree 1 3 2
[ "$(git rev-parse HEAD)" = "$tip" ] || bad 'integrate_batch dirty-worktree: merged'
# Break: a dirty integration tree is merged and checked as if committed.
mk; tip=$(git rev-parse HEAD); echo dirty > f.txt
ib dirty-tree 1 3 2
[ "$(git rev-parse HEAD)" = "$tip" ] || bad 'integrate_batch dirty-tree: merged'
# Break: the recorder runs on another candidate than v042.
mk; echo '{}' > tmp/e1-selected-v042.json
ib wrong-artifact 1 3 2
# Break: the pending count is printed but not compared.
mk; ib count-mismatch 1 4 2
# Break: recorder exit 1 (a failed case) is accepted; only exit 2 means pending.
mk; ib recorder-fails 1 3 1
# Break: at zero expected pending, exit 2 (an open family gap) is accepted, or pass (0) refused.
mk; ib zero-pass 0 0 0 0
mk; ib zero-gap 1 0 2 0
# Break: the merge auto-resolves a conflict (-X ours/theirs) instead of stopping.
mk; echo other > g.txt && git add g.txt && git commit -qm 'int g'; tip=$(git rev-parse HEAD)
ib conflict 1 3 2
[ "$(git rev-parse HEAD)" = "$tip" ] || bad 'integrate_batch conflict: HEAD moved'
git rev-parse -q --verify MERGE_HEAD > /dev/null || bad 'integrate_batch conflict: merge state not left for the PM'
# Break: the size gate checks only changed files, missing an oversized file the batch did not touch.
mk; echo '// OVERSIZE' > old.ts && git add old.ts && git commit -qm 'int old.ts'
ib size-gate 1 3 2
exit $fail
