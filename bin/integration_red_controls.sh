#!/bin/sh
# Run the PM scripts (sync_pr, after_merge, br_create, check_all lock, pre-push lanes, mutate,
# session_status) in throwaway repos with stubs; each case names the break it catches.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
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
# A bare origin; main adds record m2 (and code in c.txt); branch pr adds record own; each side
# regenerates the review index, so README.md conflicts. Stub `elixir` stands in for the docs checker.
mkdir "$tmp/stub"; printf '#!/bin/sh\nexit "${STUB_DOCS:-0}"\n' > "$tmp/stub/elixir"; chmod +x "$tmp/stub/elixir"
sp() {
  O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"
  git clone -q "$O" . 2>/dev/null; git checkout -qb main
  mkdir -p bin docs/reviews; cp "$bin/review_index.sh" bin/; sh bin/review_index.sh; echo base > c.txt
  git add . && git commit -qm base && git push -q origin main
  git checkout -qb pr; echo '# Own' > docs/reviews/2026-01-01-own-review.md; sh bin/review_index.sh; echo "$1" > c.txt
  git add . && git commit -qm pr && git push -q origin pr
  git checkout -q main; echo '# M2' > docs/reviews/2026-01-02-m2-review.md; sh bin/review_index.sh; echo main > c.txt
  git add . && git commit -qm main2 && git push -q origin main; git checkout -q pr
}
sy() { # <case> <want-rc> [docs-rc]
  rc=0; STUB_DOCS=${3:-0} PATH="$tmp/stub:$PATH" capped sh "$bin/sync_pr.sh" pr > "$R.out" 2>&1 || rc=$?
  [ "$rc" = "$2" ] || { bad "sync_pr $1: exit $rc, want $2"; sed 's/^/  /' "$R.out"; }
}
# Break: the index conflict is refused instead of regenerated, or the merge is not pushed.
sp base; sy success 0
sh bin/review_index.sh --check && grep -q 'own-review' docs/reviews/README.md && grep -q 'm2-review' docs/reviews/README.md || bad 'sync_pr success: index not regenerated with both records'
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
git checkout -qb main; mkdir -p .githooks bin kernel/ts/test mobile/app/book; cp "$bin/../.githooks/pre-push" .githooks/; cp "$bin/ci_scope.sh" "$bin/check_lock.sh" bin/
printf '#!/bin/sh\necho "lane=$*" > "%s/lane"\n' "$R.d" > bin/check_all.sh; mkdir "$R.d"; chmod +x bin/*.sh .githooks/pre-push
touch a.md kernel/ts/test/k.test.ts kernel/ts/test/differential_peer.ts mobile/app/book/p.tsx; git add . && git commit -qm base && git push -q origin main
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
# Break: a Book change skips the Storybook smoke, a non-Book change runs it, or it runs outside the
# check_all lock (stub mise logs each call and whether the lock is held).
mkdir -p "$R.d/bin"; printf '#!/bin/sh\necho "$(basename "$PWD") $* $(test -d %s/.git/loka-check.lock && echo locked)" >> "%s/smoke"\n' "$R" "$R.d" > "$R.d/bin/mise"; chmod +x "$R.d/bin/mise"
PATH="$R.d/bin:$PATH" pp book mobile/app/book/p.tsx ''
PATH="$R.d/bin:$PATH" pp docs2 a.md --metadata
[ "$(cat "$R.d/smoke" 2>/dev/null)" = "app exec -- npm run storybook:smoke locked" ] || bad "pre-push smoke: got '$(cat "$R.d/smoke" 2>/dev/null)', want one run for the Book push"
# Break: a toolbox/* push runs checks, or a push of toolbox/* plus another branch skips them.
git checkout -q -b toolbox/x main; echo 4 >> a.md; git commit -qam tb; rm -f "$R.d/lane"
capped git push origin toolbox/x 2>&1 | grep -q 'hosted CI is the gate' || bad 'pre-push toolbox: hook did not announce the skip'
[ ! -e "$R.d/lane" ] || bad 'pre-push toolbox: checks ran'
git checkout -q -b mixed main; echo 3 >> a.md; git commit -qam mixed; rm -f "$R.d/lane"
capped git push -q origin mixed toolbox/x:refs/heads/toolbox/y > /dev/null 2>&1 || bad 'pre-push mixed: push failed'
[ "$(cat "$R.d/lane" 2>/dev/null)" = "lane=--metadata" ] || bad 'pre-push mixed: checks skipped'
# Break: a dirty tracked file is pushed after checks of a tree nobody committed; an untracked file blocks.
git checkout -q -b dirty main; echo 1 >> a.md; git commit -qam dirty; echo 2 >> a.md; rm -f "$R.d/lane"
if capped git push -q origin dirty > /dev/null 2>&1; then bad 'pre-push dirty: pushed with a modified tracked file'; fi
[ ! -e "$R.d/lane" ] || bad 'pre-push dirty: checks ran'
git checkout -q a.md; touch untracked.tmp
capped git push -q origin dirty > /dev/null 2>&1 || bad 'pre-push untracked: an untracked file blocked the push'
rm -f untracked.tmp
# --- check_all.sh lock --------------------------------------------------------------------
# Stub mise logs each call. Break: a second run overlaps a live holder instead of waiting, a dead
# holder's lock blocks forever, or the lock outlives the run.
printf '#!/bin/sh\necho "$*" >> "$MISE_LOG"\n' > "$tmp/stub/mise"; chmod +x "$tmp/stub/mise"
R=$(mktemp -d); cd "$R"; git init -q; mkdir bin; cp "$bin/check_all.sh" "$bin/check_lock.sh" bin/; touch bin/check_beads_export.py bin/beads_red_controls.sh
lk=$(git rev-parse --absolute-git-dir)/loka-check.lock
ca() { MISE_LOG=$R.log PATH="$tmp/stub:$PATH" capped sh bin/check_all.sh --no-ts; }
sleep 30 & holder=$!; mkdir "$lk"; echo $holder > "$lk/pid"
ca > out 2>&1 & run=$!
i=0; until grep -q waiting out || [ $i -ge 40 ]; do sleep 0.5; i=$((i + 1)); done; sleep 1
grep -q "waiting for $holder" out && [ ! -s "$R.log" ] || { bad 'check_all lock: did not wait for a live holder'; cat out; }
{ kill $holder; wait $holder || true; } 2>/dev/null; wait $run || bad 'check_all lock: run failed after the holder ended'
[ -s "$R.log" ] && [ ! -d "$lk" ] || bad 'check_all lock: no run after the holder ended, or lock left behind'
sh -c 'exit 0' & dead=$!; wait $dead; mkdir "$lk"; echo $dead > "$lk/pid"; : > "$R.log"
ca > out 2>&1 && [ -s "$R.log" ] || { bad 'check_all lock: a dead holder blocked the run'; cat out; }
# Break: a partial (--no-mix-test) pass records the tree as checked, so a later full-lane push of
# the same tree skips mix test at pre-push. A full pass on the same clean tree must record it.
R=$(mktemp -d); cd "$R"; git init -q; mkdir -p bin kernel/ts/node_modules mobile/app/node_modules node_modules
cp "$bin/check_all.sh" "$bin/check_lock.sh" bin/; touch bin/check_beads_export.py bin/beads_red_controls.sh; git add . && git commit -qm t
rec=$(git rev-parse --git-path loka-checked-tree)
MISE_LOG=$R.log PATH="$tmp/stub:$PATH" capped sh bin/check_all.sh --no-mix-test > "$R.out" 2>&1 || bad 'check_all record: --no-mix-test run failed'
[ ! -f "$rec" ] || bad 'check_all record: a --no-mix-test pass recorded the tree'
MISE_LOG=$R.log PATH="$tmp/stub:$PATH" capped sh bin/check_all.sh > "$R.out" 2>&1 || bad 'check_all record: full run failed'
[ "$(cat "$rec" 2>/dev/null)" = "$(git rev-parse HEAD^{tree})" ] || bad 'check_all record: a full pass did not record the tree'
# --- br_create.sh -----------------------------------------------------------------------
# Stub br logs each call; create prints a new id, show prints $SHOW. Break: the path is not cleared,
# or on the wrong id; a local path in the new row is not warned about, refuses the create, or a
# linked issue's path is blamed on the new row.
printf '#!/bin/sh\necho "$*" >> "$BR_LOG"\ncase $1 in create) echo loka-n1 ;; show) echo "$SHOW" ;; esac\n' > "$tmp/br-create"
mkdir "$tmp/brstub"; mv "$tmp/br-create" "$tmp/brstub/br"; chmod +x "$tmp/brstub/br"
for show in '[{"notes":"see bin/x.sh","dependents":[{"title":"/Users/x"}]}]' '[{"notes":"see ~/dev/x"}]'; do
  : > "$tmp/br.log"
  got=$(SHOW=$show BR_LOG=$tmp/br.log PATH="$tmp/brstub:$PATH" capped sh "$bin/br_create.sh" -l housekeeping 'A title' 2> "$tmp/br.err") || bad "br_create: failed on $show"
  [ "$got" = loka-n1 ] && [ "$(tail -2 "$tmp/br.log" | tr '\n' '|')" = 'update loka-n1 --source-repo lokacore --source-repo-path |show loka-n1 --json|' ] \
    || { bad "br_create: printed '$got'; br calls:"; cat "$tmp/br.log"; }
  case $show in *'~/'*) grep -q 'loka-n1 text has an absolute or home-relative path' "$tmp/br.err" || bad 'br_create: no local-path warning' ;;
    *) [ ! -s "$tmp/br.err" ] || { bad 'br_create: warned on a repo-relative path'; cat "$tmp/br.err"; } ;; esac
done
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
  git checkout -qb main; mkdir -p .beads docs/reviews bin; echo base > .beads/issues.jsonl; echo r > docs/ROADMAP.md
  cp "$bin/review_index.sh" bin/; sh bin/review_index.sh; [ -z "${STALE-}" ] || sed 's/^info=/exit 9; info=/' "$bin/after_merge.sh" > bin/after_merge.sh
  git add . && git commit -qm base && git push -q origin main
  git checkout -qb pr; echo feature > f; git add f && git commit -qm pr && git push -q origin pr; git branch review-7
  git checkout -q main; git worktree add -q "$R.wt" pr 2>/dev/null
  M=$(mktemp -d); git clone -q "$O" "$M" 2>/dev/null; (cd "$M" && git merge -q --no-ff origin/pr -m merge && { [ -z "${STALE-}" ] || { cp "$bin/after_merge.sh" bin/ && git commit -qam script; }; } && git push -q origin main)
  echo local-write >> .beads/issues.jsonl; : > "$R.br"
}
amk; head=$(git rev-parse HEAD); echo stray > s; am dirty 1; rm s
[ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] && [ -d "$R.wt" ] || bad 'after_merge dirty: changed something'
touch "$R.wt/u"; am dirty-worktree 1; rm "$R.wt/u"
[ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] || bad 'after_merge dirty-worktree: changed something'
git branch -q -f review-7 HEAD~0 2>/dev/null; git checkout -q review-7; echo rec > rec; git add rec; git commit -qm rec; git checkout -q main
am unmerged-review 1; [ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] && [ -d "$R.wt" ] || bad 'after_merge unmerged-review: changed something'
git branch -q -f review-7 pr
(cd "$M" && echo m >> .beads/issues.jsonl && git commit -qam beads && git push -q origin main)
am export-both 1; [ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] || bad 'after_merge export-both: changed something'
(cd "$M" && git revert --no-edit HEAD > /dev/null && git push -q origin main)
PR_STATE=OPEN; am open 1; PR_STATE=MERGED; [ ! -s "$R.br" ] && git rev-parse -q --verify review-7 > /dev/null || bad 'after_merge open: changed something'
echo r2 > docs/ROADMAP.md; am success 0 'ROADMAP status: X merged (#7)'
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && [ "$(git log -1 --format=%s)" = 'ROADMAP status: X merged (#7)' ] \
  && [ -f f ] && [ "$(git show origin/main:docs/ROADMAP.md)" = r2 ] || bad 'after_merge success: main not pulled, committed and pushed'
[ "$(git show origin/main:.beads/issues.jsonl)" = "$(printf 'base\nlocal-write\nclosed loka-a')" ] || { bad 'after_merge success: export lost a write'; git show origin/main:.beads/issues.jsonl; }
grep -qx 'sync --flush-only' "$R.br" && grep -qx 'close loka-a --reason Merged #7' "$R.br" || { bad 'after_merge success: br calls'; cat "$R.br"; }
[ ! -d "$R.wt" ] && ! git rev-parse -q --verify pr > /dev/null && ! git rev-parse -q --verify review-7 > /dev/null \
  && ! git ls-remote --exit-code --heads origin pr > /dev/null || bad 'after_merge success: worktree or refs left'
# Break: a commit pushed to the PR branch after the merge is deleted with the remote branch.
amk; head=$(git rev-parse HEAD)
(cd "$M" && git checkout -q -b pr origin/pr && echo late > late && git add late && git commit -qm late && git push -q origin pr)
am remote-ahead 1; [ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] && git ls-remote --exit-code --heads origin pr > /dev/null || bad 'after_merge remote-ahead: changed something'
# Break: a record cherry-picked onto the PR branch (step 5, so review-7 itself never reaches main) is
# refused, or its deletion fails after the pull and close.
amk; git checkout -q review-7; echo rec > rec; git add rec; git commit -qm rec; git checkout -q main
(cd "$M" && git checkout -q -b pr2 origin/pr && echo rec > rec && git add rec && git commit -qm picked && git push -q origin pr2:pr \
  && git checkout -q main && git merge -q --no-ff pr2 -m merge2 && git push -q origin main)
am cherry-picked 0
! git rev-parse -q --verify review-7 > /dev/null && grep -qx 'close loka-a --reason Merged #7' "$R.br" || bad 'after_merge cherry-picked: review-7 left or issue not closed'
# Break: a merge on review-7 whose resolution main lacks is invisible to git cherry and deleted.
amk; head=$(git rev-parse HEAD); git checkout -q review-7; git fetch -q origin; git merge -q --no-ff origin/main -m mrg
echo extra > extra; git add extra; git commit -q --amend -m mrg; git checkout -q main
am merge-in-review 1; [ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] && git rev-parse -q --verify review-7 > /dev/null || bad 'after_merge merge-in-review: changed something'
# Break: a checkout whose own after_merge.sh is behind main runs the old copy (here it exits 9 before doing anything).
STALE=1 amk; unset STALE; rc=0; BR_LOG=$R.br PR_STATE=MERGED PATH="$tmp/brstub:$PATH" capped sh bin/after_merge.sh 7 loka-a > "$R.out" 2>&1 || rc=$?
git fetch -q origin; [ "$rc" = 0 ] && grep -qx 'close loka-a --reason Merged #7' "$R.br" && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
  || { bad "after_merge stale-script: exit $rc, old copy ran or main not pulled"; sed 's/^/  /' "$R.out"; }
# Break: a br write that dirties the export after the commit makes the pre-push hook refuse (stand-in hooks).
amk; printf '#!/bin/sh\n[ -e "%s" ] || { : > "%s"; echo concurrent >> .beads/issues.jsonl; }\n' "$R.once" "$R.once" > .git/hooks/post-commit
printf '#!/bin/sh\ngrep -q "^refs/heads/main " || exit 0\ngit diff --quiet || { echo "pre-push: commit or stash tracked changes first" >&2; exit 1; }\n' > .git/hooks/pre-push; chmod +x .git/hooks/post-commit .git/hooks/pre-push
am concurrent-write 0; git fetch -q origin
[ "$(git show origin/main:.beads/issues.jsonl | tail -1)" = concurrent ] && git diff --quiet || bad 'after_merge concurrent-write: export not committed and pushed'
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
printf 'a.txt\ty=1\ty=3\n' >> m.tsv
rc=0; capped sh "$bin/mutate.sh" m.tsv "echo z > a.orig" > out 2>&1 || rc=$?
[ "$rc" = 1 ] && [ "$(grep -c 'RESTORE-FAIL' out)" = 1 ] || { bad "mutate tracked-diff: exit $rc, want 1 and one RESTORE-FAIL (the mutant that drifted)"; cat out; }
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
HK=hk.json PATH="$tmp/stub:$PATH" capped sh "$R.wt/bin/session_status.sh" > out 2>&1 || true
if grep -q '^worktree' out; then bad 'session_status leftovers: main checkout listed from a linked worktree'; fi
# Break: a red nightly prints nothing or reads as green, a running one reads as red, a missing one
# prints a blank. A stub gh applies the real --jq to controlled `run list` records; other calls fail.
mkdir -p "$tmp/gh"; cat > "$tmp/gh/gh" <<'SH'
#!/bin/sh
[ "$1 $2" = "run list" ] || exit 1
case $* in *ci.yml*) json=$CI ;; *) json=$E2E ;; esac
while [ $# -gt 1 ]; do [ "$1" = --jq ] && q=$2; shift; done
printf '%s\n' "$json" | jq -r "$q"
SH
chmod +x "$tmp/gh/gh"
CI='[{"conclusion":"failure","status":"completed","headSha":"abcdef0123","url":"u1"}]' E2E='[]' \
  HK=hk.json PATH="$tmp/gh:$tmp/stub:$PATH" capped sh bin/session_status.sh > out 2>&1 || true
grep -qx 'ci.yml failure abcdef01 u1 (red: fix first)' out && grep -qx 'book-e2e.yml no scheduled run yet' out \
  || { bad 'session_status nightly: red or missing run misreported'; sed -n '/Nightly/,/Housekeeping/p' out; }
CI='[{"conclusion":"","status":"in_progress","headSha":"abcdef0123","url":"u1"}]' E2E='[]' \
  HK=hk.json PATH="$tmp/gh:$tmp/stub:$PATH" capped sh bin/session_status.sh > out 2>&1 || true
grep -qx 'ci.yml in_progress abcdef01 u1' out || bad 'session_status nightly: running run misreported'
# --- preview_update.sh, polish_session.sh ----------------------------------------------------------
# Bare origin with three lockfiles; the preview is a detached clone; ports 7006/7019/7020/7081, never
# the owner's. Stub mise logs each call and turns a server command into a listener that keeps its
# argv, so a decoy "storybook" on 7099 dies if a script stops processes by name. Breaks: a process
# found by name is killed, a lockfile compare is dropped (ci every time), a second run restarts,
# a dirty preview or session is changed, preview_update takes a served session, close does not push,
# open the PR or serve the preview again, close restarts more than Storybook, a closed session restarts,
# a failed close leaves no Storybook, Expo starts though it was not running.
# Plant the by-name break as `pkill -f loka-stub`: a bare `pkill -f storybook` kills the owner's Storybook.
mkdir "$tmp/srv"
cat > "$tmp/srv/mise" <<'SH'
#!/bin/sh
shift; [ "$1" = -- ] && shift
echo "$(pwd -P) $*" >> "$MISE_LOG"
case $* in
  *storybook* | *expo*) for a; do port=$a; done ;;
  *web:preview*) port=$LOKA_PREVIEW_PORT ;;
  'npm ci'*) mkdir -p node_modules; exit 0 ;;
  *) exit 0 ;;
esac
exec perl -MIO::Socket::INET -e 'my $s = IO::Socket::INET->new(LocalAddr => "127.0.0.1", LocalPort => shift, Listen => 1, ReuseAddr => 1) or die "listen: $!"; sleep 120' "$port" loka-stub "$@"
SH
printf '#!/bin/sh\necho "$*" >> "$GH_LOG"\n[ "$1 $2" != "pr create" ] || echo https://pr/1\n' > "$tmp/srv/gh"
chmod +x "$tmp/srv/mise" "$tmp/srv/gh"
export LOKA_SB_PORT=7006 LOKA_PREVIEW_PORT=7019 LOKA_METRO_PORT=7020 LOKA_EXPO_PORT=7081 PATH="$tmp/srv:$PATH"
sbp=$LOKA_SB_PORT wp=$LOKA_PREVIEW_PORT ep=$LOKA_EXPO_PORT dp=7099
busy=; for p in $sbp $wp $LOKA_METRO_PORT $ep $dp; do [ -z "$(lsof -t -iTCP:$p -sTCP:LISTEN)" ] || busy="$busy $p"; done
# Never stop a server this harness did not start (an agent's own Storybook may sit on $sbp).
if [ -n "$busy" ]; then bad "ports$busy busy: preview cases skipped"; else
trap 'for p in $sbp $wp $LOKA_METRO_PORT $ep $dp; do kill $(lsof -t -iTCP:$p -sTCP:LISTEN) 2> /dev/null || true; done; rm -rf "$tmp"' EXIT
pid() { lsof -t -iTCP:"$1" -sTCP:LISTEN | head -n 1; }
cwd() { lsof -a -p "$(pid "$1")" -d cwd -Fn | sed -n 's/^n//p'; }
O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"; git clone -q "$O" . 2> /dev/null; git checkout -qb main
mkdir -p bin/lib kernel/ts mobile/app; cp "$bin/preview_update.sh" "$bin/polish_session.sh" bin/; cp "$bin/lib/serve.sh" bin/lib/
for d in . kernel/ts mobile/app; do echo 1 > $d/package-lock.json; done; echo node_modules > .gitignore
git add . && git commit -qm base && git push -q origin main
P=$(mktemp -d); git clone -q "$O" "$P" 2> /dev/null; git -C "$P" checkout -q --detach; P=$(cd "$P" && pwd -P)
export MISE_LOG=$R.mise GH_LOG=$R.gh LOKA_PREVIEW_DIR=$P LOKA_SESSION_DIR=$R.session; : > "$R.mise"; : > "$R.gh"
(cd "$tmp" && mise exec -- npm run storybook -- -p $dp &); (cd "$tmp" && mise exec -- npx expo start --lan --port $ep &)
sleep 1; decoy=$(pid $dp); expo=$(pid $ep)
run() { # <script> <arg|""> <case> <want-rc>
  rc=0; capped sh "$R/bin/$1" ${2:+"$2"} > "$R.out" 2>&1 || rc=$?
  [ "$rc" = "$4" ] || { bad "$1 $3: exit $rc, want $4"; cat "$R.out" || true; }
}
run preview_update.sh '' first 0
[ "$(cwd $sbp)" = "$P/mobile/app" ] && [ "$(cwd $wp)" = "$P/mobile/app" ] && [ -n "$(pid $ep)" ] && [ "$(pid $ep)" != "$expo" ] \
  && [ "$(grep -c 'npm ci' "$R.mise")" = 3 ] || { bad 'preview_update first: not served from the preview, Expo not restarted, or not 3 ci'; cat "$R.mise"; }
sb=$(pid $sbp); : > "$R.mise"; run preview_update.sh '' again 0
[ "$(pid $sbp)" = "$sb" ] && [ ! -s "$R.mise" ] && grep -q 'already serving' "$R.out" || bad 'preview_update again: restarted or reinstalled'
touch "$P/x"; run preview_update.sh '' dirty 1; rm "$P/x"; [ "$(pid $sbp)" = "$sb" ] || bad 'preview_update dirty: stopped a server'
echo 2 > mobile/app/package-lock.json; git commit -qam lock; git push -q origin main
run preview_update.sh '' lockfile 0
[ "$(git -C "$P" rev-parse HEAD)" = "$(git rev-parse HEAD)" ] && [ "$(grep 'npm ci' "$R.mise")" = "$P/mobile/app npm ci --no-audit --no-fund" ] \
  || { bad 'preview_update lockfile: not at origin/main, or ci outside mobile/app'; cat "$R.mise"; }
day=polish/session-$(date +%F); git push -q origin "main:refs/heads/$day"
web=$(pid $wp); expo=$(pid $ep); run polish_session.sh start start 0; S=$(cd "$R.session" 2> /dev/null && pwd -P) || S=$R.session
[ "$(cwd $sbp)" = "$S/mobile/app" ] && [ "$(git -C "$S" branch --show-current)" = "$day-2" ] && grep -q 'mix deps.get' "$R.mise" \
  || bad 'polish_session start: not served from the session, wrong branch, or no deps'
sb=$(pid $sbp); run polish_session.sh start start-again 0
[ "$(pid $sbp)" = "$sb" ] && grep -q 'already serving' "$R.out" || bad 'polish_session start-again: restarted'
run preview_update.sh '' during-session 1; [ "$(pid $sbp)" = "$sb" ] || bad 'preview_update during-session: took the session Storybook'
touch "$S/new-token.ts"; run polish_session.sh close untracked 1; [ "$(pid $sbp)" = "$sb" ] && [ ! -s "$R.gh" ] || bad 'polish_session untracked: changed something'
git -C "$S" add new-token.ts; git -C "$S" commit -qm tweak
touch "$P/x"; run polish_session.sh close dirty-preview 1; rm "$P/x"
[ "$(cwd $sbp)" = "$S/mobile/app" ] || bad 'polish_session close dirty-preview: no Storybook left serving the session'
run polish_session.sh close close 0
git ls-remote --exit-code --heads origin "$day-2" > /dev/null && grep -q '^pr create' "$R.gh" && [ "$(cwd $sbp)" = "$P/mobile/app" ] \
  || { bad 'polish_session close: not pushed, no PR, or the preview not served again'; cat "$R.gh"; }
[ "$(pid $wp)" = "$web" ] && [ "$(pid $ep)" = "$expo" ] || bad 'polish_session close: restarted the web preview or Expo'
run polish_session.sh start after-close 1
kill "$(pid $ep)"; i=0; while [ -n "$(pid $ep)" ] && [ $i -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
echo 3 > a.txt; git add a.txt; git commit -qm moved; git push -q origin main
run preview_update.sh '' no-expo 0; [ -z "$(pid $ep)" ] || bad 'preview_update no-expo: started Expo that was not running'
kill "$decoy" 2> /dev/null || bad 'a stop by name killed the decoy on $dp'
fi
exit $fail
