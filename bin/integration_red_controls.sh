#!/bin/sh
# Run the PM scripts (sync_pr, after_merge, br_create, check_all lock, pre-push lanes, mutate,
# session_status) in throwaway repos with stubs; each case names the break it catches.
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

# --- sync_pr.sh -----------------------------------------------------------------------------
# A bare origin; main adds m2 to the review index (and code in c.txt); branch pr adds its own
# line at the top of the index. Stub `elixir` stands in for the docs checker.
mkdir "$tmp/stub"; printf '#!/bin/sh\nexit "${STUB_DOCS:-0}"\n' > "$tmp/stub/elixir"; chmod +x "$tmp/stub/elixir"
sp() {
  O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"
  git clone -q "$O" . 2>/dev/null; git checkout -qb main
  mkdir -p docs/reviews; printf 'docs/reviews/README.md merge=union\n' > .gitattributes
  printf '# i\n- m1\n' > docs/reviews/README.md; echo base > c.txt
  git add . && git commit -qm base && git push -q origin main
  git checkout -qb pr; printf '# i\n- own\n- m1\n' > docs/reviews/README.md; echo "$1" > c.txt
  git commit -qam pr && git push -q origin pr
  git checkout -q main; printf '# i\n- m1\n- m2\n' > docs/reviews/README.md; echo main > c.txt
  git commit -qam main2 && git push -q origin main; git checkout -q pr
}
sy() { # <case> <want-rc> [docs-rc]
  rc=0; STUB_DOCS=${3:-0} PATH="$tmp/stub:$PATH" capped sh "$bin/sync_pr.sh" pr > "$R.out" 2>&1 || rc=$?
  [ "$rc" = "$2" ] || { bad "sync_pr $1: exit $rc, want $2"; sed 's/^/  /' "$R.out"; }
}
# Break: the index keeps the union-merge order (own line first), or the merge is not pushed.
sp base; sy success 0
[ "$(cat docs/reviews/README.md)" = "$(printf '# i\n- m1\n- m2\n- own')" ] || bad 'sync_pr success: index not exactly main list + own line'
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/pr)" ] && [ "$(git rev-list --parents -1 HEAD | wc -w)" -eq 3 ] || bad "sync_pr success: not a pushed merge commit"
# Break: a code conflict is auto-resolved (-X) or left half-merged instead of refused.
sp other; tip=$(git rev-parse HEAD); sy conflict 1
[ "$(git rev-parse HEAD)" = "$tip" ] && [ -z "$(git status --porcelain)" ] || bad 'sync_pr conflict: HEAD moved or tree dirty'
# Break: a failing docs check still pushes.
sp base; pushed=$(git rev-parse origin/pr); sy docs-fail 1 1
[ "$(git rev-parse origin/pr)" = "$pushed" ] || bad 'sync_pr docs-fail: pushed'
# Break: the rerun sees the local merge, says "already has main" and exits 0 without pushing.
sy rerun 0; git fetch -q origin; [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/pr)" ] || bad 'sync_pr rerun: not pushed'
# --- .githooks/pre-push ----------------------------------------------------------------------
# Real hook and bin/ci_scope.sh, stub check_all.sh that records its arguments; each push is a new
# branch off a pushed main. Break: a *.test.ts-only push runs the full line, or source/peer edits
# get the short lanes.
O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"; git clone -q "$O" . 2>/dev/null
git checkout -qb main; mkdir -p .githooks bin kernel/ts/test; cp "$bin/../.githooks/pre-push" .githooks/; cp "$bin/ci_scope.sh" bin/
printf '#!/bin/sh\necho "lane=$*" > "%s/lane"\n' "$R.d" > bin/check_all.sh; mkdir "$R.d"; chmod +x bin/*.sh .githooks/pre-push
touch a.md kernel/ts/test/k.test.ts kernel/ts/test/differential_peer.ts; git add . && git commit -qm base && git push -q origin main
git config core.hooksPath .githooks
pp() { # <case> <file> <want-args>
  git checkout -q -b "$1" main; echo 1 >> "$2"; git commit -qam "$1"; rm -f "$R.d/lane"
  capped git push -q origin "$1" > /dev/null 2>&1 || bad "pre-push $1: push failed"
  [ "$(cat "$R.d/lane" 2>/dev/null)" = "lane=$3" ] || bad "pre-push $1: $(cat "$R.d/lane" 2>/dev/null), want lane=$3"
}
pp tests kernel/ts/test/k.test.ts --no-mix-test
pp docs a.md --metadata
pp peer kernel/ts/test/differential_peer.ts ''
# Break: a later test-only ref downgrades an earlier full-lane ref in the same push.
for b in p2:kernel/ts/test/differential_peer.ts t2:kernel/ts/test/k.test.ts; do
  git checkout -q -b "${b%%:*}" main; echo 2 >> "${b#*:}"; git commit -qam "$b"
done; rm -f "$R.d/lane"
capped git push -q origin p2 t2 > /dev/null 2>&1 || bad 'pre-push two refs: push failed'
[ "$(cat "$R.d/lane" 2>/dev/null)" = "lane=" ] || bad "pre-push two refs: $(cat "$R.d/lane" 2>/dev/null), want lane="
# --- check_all.sh lock --------------------------------------------------------------------
# Stub mise logs each call. Break: a second run overlaps a live holder instead of waiting, a dead
# holder's lock blocks forever, or the lock outlives the run.
printf '#!/bin/sh\necho "$*" >> "$MISE_LOG"\n' > "$tmp/stub/mise"; chmod +x "$tmp/stub/mise"
R=$(mktemp -d); cd "$R"; git init -q; mkdir bin; cp "$bin/check_all.sh" bin/; touch bin/check_beads_export.py bin/beads_red_controls.sh
lk=$(git rev-parse --absolute-git-dir)/loka-check.lock
ca() { MISE_LOG=$R.log PATH="$tmp/stub:$PATH" capped sh bin/check_all.sh --no-ts; }
sleep 30 & holder=$!; mkdir "$lk"; echo $holder > "$lk/pid"
ca > out 2>&1 & run=$!
sleep 3
grep -q "waiting for $holder" out && [ ! -s "$R.log" ] || { bad 'check_all lock: did not wait for a live holder'; cat out; }
{ kill $holder; wait $holder || true; } 2>/dev/null; wait $run || bad 'check_all lock: run failed after the holder ended'
[ -s "$R.log" ] && [ ! -d "$lk" ] || bad 'check_all lock: no run after the holder ended, or lock left behind'
sh -c 'exit 0' & dead=$!; wait $dead; mkdir "$lk"; echo $dead > "$lk/pid"; : > "$R.log"
ca > out 2>&1 && [ -s "$R.log" ] || { bad 'check_all lock: a dead holder blocked the run'; cat out; }
# --- br_create.sh -----------------------------------------------------------------------
# Stub br logs each call; create prints a new id. Break: the path is not cleared, or on the wrong id.
printf '#!/bin/sh\necho "$*" >> "$BR_LOG"\ncase $1 in create) echo loka-n1 ;; esac\n' > "$tmp/br-create"
mkdir "$tmp/brstub"; mv "$tmp/br-create" "$tmp/brstub/br"; chmod +x "$tmp/brstub/br"
got=$(BR_LOG=$tmp/br.log PATH="$tmp/brstub:$PATH" capped sh "$bin/br_create.sh" -l housekeeping 'A title') || bad 'br_create: failed'
[ "$got" = loka-n1 ] && [ "$(tail -1 "$tmp/br.log")" = 'update loka-n1 --source-repo lokacore --source-repo-path ' ] \
  || { bad "br_create: printed '$got'; br calls:"; cat "$tmp/br.log"; }
# --- after_merge.sh ------------------------------------------------------------------------
# Bare origin; branch pr (worktree, review-7 on its tip) is merged on origin/main by another clone,
# local main is behind with a dirty Beads export. Stub gh reports $PR_STATE; stub br close appends
# to the export. Break: the local export write is lost in the pull, the issue is not closed, the
# worktree or refs survive, nothing is pushed, or a refusal still changes something.
printf '#!/bin/sh\necho "$PR_STATE pr"\n' > "$tmp/brstub/gh"
printf '#!/bin/sh\necho "$*" >> "$BR_LOG"\ncase $1 in close) echo "closed $2" >> .beads/issues.jsonl ;; esac\n' > "$tmp/brstub/br"
chmod +x "$tmp/brstub/gh"
am() { # <case> <want-rc> [subject]
  rc=0; BR_LOG=$R.br PR_STATE=${PR_STATE-MERGED} PATH="$tmp/brstub:$PATH" capped sh "$bin/after_merge.sh" 7 loka-a ${3+"$3"} > "$R.out" 2>&1 || rc=$?
  [ "$rc" = "$2" ] || { bad "after_merge $1: exit $rc, want $2"; sed 's/^/  /' "$R.out"; }
}
amk() {
  O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"; git clone -q "$O" . 2>/dev/null
  git checkout -qb main; mkdir -p .beads docs; echo base > .beads/issues.jsonl; echo r > docs/ROADMAP.md
  git add . && git commit -qm base && git push -q origin main
  git checkout -qb pr; echo feature > f; git add f && git commit -qm pr && git push -q origin pr; git branch review-7
  git checkout -q main; git worktree add -q "$R.wt" pr 2>/dev/null
  M=$(mktemp -d); git clone -q "$O" "$M" 2>/dev/null; (cd "$M" && git merge -q --no-ff origin/pr -m merge && git push -q origin main)
  echo local-write >> .beads/issues.jsonl; : > "$R.br"
}
amk; head=$(git rev-parse HEAD); echo stray > s; am dirty 1; rm s
[ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] && [ -d "$R.wt" ] || bad 'after_merge dirty: changed something'
touch "$R.wt/u"; am dirty-worktree 1; rm "$R.wt/u"
[ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] || bad 'after_merge dirty-worktree: changed something'
PR_STATE=OPEN; am open 1; PR_STATE=MERGED; [ ! -s "$R.br" ] && git rev-parse -q --verify review-7 > /dev/null || bad 'after_merge open: changed something'
echo r2 > docs/ROADMAP.md; am success 0 'ROADMAP status: X merged (#7)'
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && [ "$(git log -1 --format=%s)" = 'ROADMAP status: X merged (#7)' ] \
  && [ -f f ] && [ "$(git show origin/main:docs/ROADMAP.md)" = r2 ] || bad 'after_merge success: main not pulled, committed and pushed'
[ "$(git show origin/main:.beads/issues.jsonl)" = "$(printf 'base\nlocal-write\nclosed loka-a')" ] || { bad 'after_merge success: export lost a write'; git show origin/main:.beads/issues.jsonl; }
grep -qx 'sync --flush-only' "$R.br" && grep -qx 'close loka-a --reason Merged #7' "$R.br" || { bad 'after_merge success: br calls'; cat "$R.br"; }
[ ! -d "$R.wt" ] && ! git rev-parse -q --verify pr > /dev/null && ! git rev-parse -q --verify review-7 > /dev/null \
  && ! git ls-remote --exit-code --heads origin pr > /dev/null || bad 'after_merge success: worktree or refs left'
# --- mutate.sh -----------------------------------------------------------------------------
# a.txt holds x=1 (tested by `grep`) and y=1 (untested). Break: a restore that leaves a mutant in
# place, an apply that silently does nothing (every mutant would read as SURVIVED), a survivor
# reported red, or the narrow command skipped/the full command run when narrow is already red.
mt() { R=$(mktemp -d); cd "$R"; printf 'x=1\ny=1\n' > a.txt; cp a.txt a.orig; T=$(printf '\t'); }
mt
printf 'a.txt\tx=1\tx=2\n a.txt\tn\tn\n' > m.tsv   # second line: file name " a.txt" is unreadable
rc=0; capped sh "$bin/mutate.sh" m.tsv "grep -q '^x=1$' a.txt" > out 2>&1 || rc=$?
[ "$rc" = 1 ] && grep -q '^FAIL' out || bad 'mutate unreadable-file: exit 0 or no FAIL line'
mt
printf 'a.txt\tx=1\tx=2\na.txt\ty=1\ty=2\na.txt\tz=1\tz=2\na.txt\tx=1\tx=3\tfalse\na.txt\tx=1\tx=4\ttrue\na.txt\ty=1\t\t! grep -q ^$ a.txt\n' > m.tsv
rc=0; capped sh "$bin/mutate.sh" m.tsv "grep -q '^x=1$' a.txt" > out 2>&1 || rc=$?
[ "$rc" = 1 ] || bad "mutate sweep: exit $rc, want 1 (apply failure)"
[ "$(cut -f1 out | tr '\n' ,)" = 'red-full,SURVIVED,APPLY-FAIL,red-narrow,red-full,red-narrow,' ] || { bad 'mutate sweep: wrong results'; cat out; }
cmp -s a.txt a.orig || bad 'mutate sweep: file not restored'
# Break: a test command that reads stdin eats the rest of the mutant list (two mutants, one line out).
mt
printf 'a.txt\ty=1\ty=2\na.txt\ty=1\ty=3\n' > m.tsv
rc=0; capped sh "$bin/mutate.sh" m.tsv "cat > /dev/null; grep -q '^x=1$' a.txt" > out 2>&1 || rc=$?
[ "$rc" = 0 ] && [ "$(wc -l < out)" -eq 2 ] || bad "mutate stdin-reader: exit $rc, $(wc -l < out) result lines, want 0 and 2"
mt
printf 'a.txt\ty=1\ty=2\n' > m.tsv
rc=0; capped sh "$bin/mutate.sh" m.tsv "grep -q '^x=1$' a.txt" > out 2>&1 || rc=$?
[ "$rc" = 0 ] || bad "mutate survivor-only: exit $rc, want 0"
# Break: a two-field line (no new text) runs as a silent deletion instead of being refused.
mt
printf 'a.txt\tx=1\n' > m.tsv
rc=0; capped sh "$bin/mutate.sh" m.tsv "grep -q '^x=1$' a.txt" > out 2>&1 || rc=$?
[ "$rc" = 1 ] && grep -q '^FAIL' out && ! grep -q 'red-' out || { bad "mutate two-field: exit $rc, want 1 and a FAIL line"; cat out; }
# Break: the restore check compares only the mutated file, so a test that edits another tracked file passes.
mt; git init -q; git add a.txt a.orig; git commit -qm a
printf 'a.txt\ty=1\ty=2\n' > m.tsv
rc=0; capped sh "$bin/mutate.sh" m.tsv "echo z >> a.orig" > out 2>&1 || rc=$?
[ "$rc" = 1 ] && grep -q 'RESTORE-FAIL' out || { bad "mutate tracked-diff: exit $rc, want 1 and RESTORE-FAIL"; cat out; }
# --- session_status.sh ----------------------------------------------------------------------
# A repo whose origin/main last merge is 2026-10-08T12:00Z; stub br prints $HK, stub gh fails.
# Break: a missing/failing br fails the session start; the retro note fires when a housekeeping
# issue is newer than the last merge, or stays silent when none is; closed issues counted as open.
printf '#!/bin/sh\ncase "$*" in *housekeeping*) cat "$HK" ;; *) exit 1 ;; esac\n' > "$tmp/stub/br"
printf '#!/bin/sh\nexit 1\n' > "$tmp/stub/gh"; chmod +x "$tmp/stub/br" "$tmp/stub/gh"
R=$(mktemp -d); cd "$R"; git init -q -b main; mkdir bin; cp "$bin/session_status.sh" bin/
echo a > a; git add . && git commit -qm base; git checkout -qb x; echo b > a; git commit -qam x; git checkout -q main
GIT_COMMITTER_DATE='2026-10-08T12:00:00+00:00' git merge -q --no-ff x -m merge; git update-ref refs/remotes/origin/main HEAD
ss() { # <case> <issues-json> <must-match> <must-not-match>
  printf '{"issues":%s}' "$2" > hk.json
  rc=0; HK=hk.json PATH="$tmp/stub:$PATH" capped sh bin/session_status.sh > out 2>&1 || rc=$?
  [ "$rc" = 0 ] || bad "session_status $1: exit $rc"
  grep -q "$3" out || { bad "session_status $1: missing '$3'"; sed 's/^/  /' out; }
  if grep -q "$4" out; then bad "session_status $1: unexpected '$4'"; fi
}
new='{"id":"hk-1","title":"Open one","status":"open","created_at":"2026-10-08T13:00:00.5Z"}'
old='{"id":"hk-2","title":"Old closed","status":"closed","created_at":"2026-10-08T11:00:00Z"}'
ss fresh-open "[$new,$old]" 'open housekeeping issues: 1' 'without a retro'
ss stale "[$old]" 'open housekeeping issues: 0' 'hk-2 Old closed'
ss stale-note "[$old]" 'ended without a retro' 'NEVER'
ss none "[]" 'ended without a retro' 'NEVER'
printf 'x' > hk.json; rc=0; HK=hk.json PATH="$tmp/stub:$PATH" capped sh bin/session_status.sh > out 2>&1 || rc=$?
[ "$rc" = 0 ] && grep -q 'queue unavailable' out || bad 'session_status bad-json: failed or no note'
grep -q 'Before you clear: ask the PM for handoff + retro' out || bad 'session_status: no clear reminder'
# Break: a stray worktree, a stash or a merged review ref goes unlisted, the session's own checkout
# or an unmerged review ref is listed.
git branch review-1 x; git checkout -qb y; echo c > a; git commit -qam y; git branch review-2; git checkout -q main
git worktree add -q "$R.wt" y 2>/dev/null; echo d > a; git stash -q
HK=hk.json PATH="$tmp/stub:$PATH" capped sh bin/session_status.sh > out 2>&1 || bad 'session_status leftovers: exit non-zero'
wt=$(cd "$R.wt" && pwd -P)
grep -qxF "worktree $wt" out && grep -qx 'stashes: 1' out && grep -qx 'merged review ref (delete): review-1' out \
  && ! grep -q "worktree $(pwd -P)\$" out && ! grep -q review-2 out || { bad 'session_status leftovers: wrong list'; sed 's/^/  /' out; }
exit $fail
