#!/bin/sh
# Run the PM and agent scripts (sync_pr, br_create, after_merge, mutate, session_status, pm_merge, prepush,
# check_impact_fixtures, the agent_load_gate/bash_guard/send_guard hooks, pre-commit, preview_update,
# polish_session, regen_hash_fixture, test_files, wait_ci, merge_pr, beads_checkpoint, ci_fail, new_batch, push_slice) in throwaway repos
# with stubs; each case names the break it catches.
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
# to the export and br sync --merge re-adds the local row (the database's) when the export lacks it.
# Break: the local export write is lost in the pull, the issue is not closed, the worktree or refs
# survive, nothing is pushed, or a refusal still changes something.
printf '#!/bin/sh\necho "$PR_STATE pr"\n' > "$tmp/brstub/gh"
cat > "$tmp/brstub/br" <<'SH'
#!/bin/sh
echo "$*" >> "$BR_LOG"
case $1 in
  close) [ -z "${BR_FAIL-}" ] || { echo 'some other error' >&2; exit 1; }
    if [ -n "${BR_BUSY-}" ] && [ ! -e "$BR_BUSY" ]; then : > "$BR_BUSY"; echo 'Database error: database is busy' >&2; exit 1; fi
    echo "{\"id\":\"closed $2\"}" >> .beads/issues.jsonl ;;
  sync) [ "$2" != --merge ] || grep -q local-write .beads/issues.jsonl || echo '{"id":"local-write"}' >> .beads/issues.jsonl ;;
  show) echo "[{\"status\":\"${ISSUE_STATUS:-open}\"}]" ;;
esac
SH
chmod +x "$tmp/brstub/gh"
am() { # <case> <want-rc> [subject]
  rc=0; BR_LOG=$R.br PR_STATE=${PR_STATE-MERGED} PATH="$tmp/brstub:$PATH" capped sh "$bin/after_merge.sh" 7 loka-a ${3+"$3"} > "$R.out" 2>&1 || rc=$?
  [ "$rc" = "$2" ] || { bad "after_merge $1: exit $rc, want $2"; sed 's/^/  /' "$R.out"; }
}
amk() {
  O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"; git clone -q "$O" . 2>/dev/null
  git checkout -qb main; mkdir -p .beads docs/reviews bin/lib; echo '{"id":"base"}' > .beads/issues.jsonl; echo r > docs/ROADMAP.md
  cp "$bin/review_index.sh" "$bin/check_beads_export.py" bin/; cp "$bin/lib/beads_sync.sh" bin/lib/; sh bin/review_index.sh; [ -z "${STALE-}" ] || sed 's/^info=/exit 9; info=/' "$bin/after_merge.sh" > bin/after_merge.sh
  git add . && git commit -qm base && git push -q origin main
  git checkout -qb pr; echo feature > f; git add f && git commit -qm pr && git push -q origin pr; git branch review-7
  git checkout -q main; git worktree add -q "$R.wt" pr 2>/dev/null
  M=$(mktemp -d); git clone -q "$O" "$M" 2>/dev/null; (cd "$M" && git merge -q --no-ff origin/pr -m merge && { [ -z "${STALE-}" ] || { cp "$bin/after_merge.sh" bin/ && git commit -qam script; }; } && git push -q origin main)
  echo '{"id":"local-write"}' >> .beads/issues.jsonl; : > "$R.br"
}
amk; head=$(git rev-parse HEAD); echo stray >> docs/ROADMAP.md; am dirty 1; git checkout -q docs/ROADMAP.md
[ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] && [ -d "$R.wt" ] || bad 'after_merge dirty: changed something'
touch "$R.wt/u"; am dirty-worktree 1; rm "$R.wt/u"
[ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] || bad 'after_merge dirty-worktree: changed something'
git branch -q -f review-7 HEAD~0 2>/dev/null; git checkout -q review-7; echo rec > rec; git add rec; git commit -qm rec; git checkout -q main
am unmerged-review 1; [ "$(git rev-parse HEAD)" = "$head" ] && [ ! -s "$R.br" ] && [ -d "$R.wt" ] || bad 'after_merge unmerged-review: changed something'
git branch -q -f review-7 pr
PR_STATE=OPEN; am open 1; PR_STATE=MERGED; [ ! -s "$R.br" ] && git rev-parse -q --verify review-7 > /dev/null || bad 'after_merge open: changed something'
echo r2 > docs/ROADMAP.md; echo u > owner.cjs # an untracked owner file must not block (loka-jxwu)
am success 0 'ROADMAP status: X merged (#7)'
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && [ "$(git log -1 --format=%s)" = 'ROADMAP status: X merged (#7)' ] \
  && [ -f f ] && [ "$(git show origin/main:docs/ROADMAP.md)" = r2 ] || bad 'after_merge success: main not pulled, committed and pushed'
[ "$(git show origin/main:.beads/issues.jsonl)" = "$(printf '{"id":"base"}\n{"id":"local-write"}\n{"id":"closed loka-a"}')" ] || { bad 'after_merge success: export lost a write'; git show origin/main:.beads/issues.jsonl; }
grep -qx 'sync --merge' "$R.br" && grep -qx 'close loka-a --reason Merged #7' "$R.br" || { bad 'after_merge success: br calls'; cat "$R.br"; }
[ ! -d "$R.wt" ] && ! git rev-parse -q --verify pr > /dev/null && ! git rev-parse -q --verify review-7 > /dev/null \
  && ! git ls-remote --exit-code --heads origin pr > /dev/null || bad 'after_merge success: worktree or refs left'
# Break: main moved the export too (loka-kovp): the run refuses, or main's row or the local write is lost.
amk; (cd "$M" && echo '{"id":"m"}' >> .beads/issues.jsonl && git commit -qam beads && git push -q origin main)
am export-both 0; git fetch -q origin
[ "$(git show origin/main:.beads/issues.jsonl)" = "$(printf '{"id":"base"}\n{"id":"m"}\n{"id":"local-write"}\n{"id":"closed loka-a"}')" ] \
  || { bad 'after_merge export-both: a row lost'; git show origin/main:.beads/issues.jsonl; }
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
# Break: a rerun (the failed first run already closed the issue) dies at br close, or closes it again.
amk; export ISSUE_STATUS=closed; am rerun-closed 0; unset ISSUE_STATUS; git fetch -q origin
{ [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && ! grep -q '^close' "$R.br"; } || bad 'after_merge rerun-closed: br close called, or main not pushed'
# Break: a busy database at br close stops the run, or is retried without recover, or more than once (loka-8zf5).
amk; export BR_BUSY=$R.busy; am busy-db 0; unset BR_BUSY
[ "$(grep -E '^(close|doctor)' "$R.br" | cut -d' ' -f1 | tr '\n' ' ')" = 'close doctor close ' ] && grep -q 'closed loka-a' .beads/issues.jsonl \
  || { bad 'after_merge busy-db: not recover then one retry'; cat "$R.br"; }
amk; export BR_FAIL=1; am other-br-error 1; unset BR_FAIL; ! grep -q '^doctor' "$R.br" || bad 'after_merge other-br-error: recovered on an unknown error'
# Break: a br write that dirties the export after the commit (stand-in post-commit hook) is left
# uncommitted or unpushed.
amk; printf '#!/bin/sh\n[ -e "%s" ] || { : > "%s"; echo concurrent >> .beads/issues.jsonl; }\n' "$R.once" "$R.once" > .git/hooks/post-commit; chmod +x .git/hooks/post-commit
am concurrent-write 0; git fetch -q origin
[ "$(git show origin/main:.beads/issues.jsonl | tail -1)" = concurrent ] && git diff --quiet || bad 'after_merge concurrent-write: export not committed and pushed'
# Break: an id after the first in a comma list is not closed (loka-4zvw).
amk; rc=0; BR_LOG=$R.br PR_STATE=MERGED PATH="$tmp/brstub:$PATH" capped sh "$bin/after_merge.sh" 7 loka-a,loka-b > "$R.out" 2>&1 || rc=$?
[ "$rc" = 0 ] && grep -qx 'close loka-a --reason Merged #7' "$R.br" && grep -qx 'close loka-b --reason Merged #7' "$R.br" \
  || { bad "after_merge several-ids: exit $rc or an id not closed"; cat "$R.br"; }

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
# Break: MUTATE_REBUILD is not run after the apply (tests that read the derived b.txt pass), a failed
# rebuild is not red, or it is not run after the restore (b.txt keeps the mutant: RESTORE-FAIL).
mt; cp a.txt b.txt; git init -q; git add a.txt b.txt; git commit -qm a
printf 'a.txt\tx=1\tx=2\na.txt\ty=1\ty=9\n' > m.tsv
rc=0; MUTATE_REBUILD='! grep -q y=9 a.txt && cp a.txt b.txt' capped sh "$bin/mutate.sh" m.tsv "grep -q '^x=1$' b.txt" > out 2>&1 || rc=$?
[ "$rc" = 0 ] && [ "$(cut -f1 out | tr '\n' ,)" = 'red-full,red-rebuild,' ] && cmp -s a.txt b.txt || { bad "mutate rebuild: exit $rc, want 0, red-full then red-rebuild"; cat out; }
printf 'a.txt\tx=1\tx=2\n' > m.tsv; rc=0; MUTATE_REBUILD=false capped sh "$bin/mutate.sh" m.tsv true > out 2>&1 || rc=$?
[ "$rc" = 1 ] && grep -q '^red-rebuild RESTORE-FAIL' out || { bad "mutate rebuild-after-restore fails: exit $rc, want 1 and RESTORE-FAIL"; cat out; }
# Break: a sweep stopped mid-mutant restores the source but leaves b.txt built from the mutant.
printf 'a.txt\tx=1\tx=2\tkill $PPID\n' > m.tsv; rc=0; MUTATE_REBUILD='cp a.txt b.txt' capped sh "$bin/mutate.sh" m.tsv true > out 2>&1 || rc=$?
[ "$rc" = 130 ] && grep -q '^x=1$' b.txt || { bad "mutate interrupted: exit $rc, want 130 and b.txt rebuilt from the restored a.txt"; cat out; }
# Break: no time budget (a sweep runs past MUTATE_MINUTES), or a timeboxed sweep exits 0/1 as a clean pass.
mt
printf 'a.txt\tx=1\tx=2\na.txt\ty=1\ty=2\n' > m.tsv
rc=0; MUTATE_MINUTES=0 capped sh "$bin/mutate.sh" m.tsv "touch ran" > out 2>&1 || rc=$?
[ "$rc" = 3 ] && [ "$(cut -f1 out | tr '\n' ,)" = 'TIMEBOX,TIMEBOX,' ] && [ ! -e ran ] && cmp -s a.txt a.orig || { bad "mutate timebox: exit $rc, want 3, two TIMEBOX rows, no test run, file untouched"; cat out; }
# Break: the timebox exit hides a failure (a malformed line plus a timebox exits 3, not 1).
printf 'bad\na.txt\tx=1\tx=2\n' > m.tsv; rc=0; MUTATE_MINUTES=0 capped sh "$bin/mutate.sh" m.tsv true > out 2>&1 || rc=$?
[ "$rc" = 1 ] && [ "$(cut -f1 out | tr '\n' ,)" = 'FAIL,TIMEBOX,' ] || { bad "mutate timebox after failure: exit $rc, want 1 (a failure beats the timebox)"; cat out; }
# Break: a non-integer MUTATE_MINUTES runs no mutant and exits 0 (a silent clean pass), or an empty one is refused.
printf 'a.txt\tx=1\tx=2\n' > m.tsv
for shell in sh bash; do for m in thirty 1.5 -1 ' 5' 08; do
  rc=0; MUTATE_MINUTES=$m capped $shell "$bin/mutate.sh" m.tsv "touch ran" > out 2>&1 || rc=$?
  [ "$rc" = 2 ] && [ ! -e ran ] && grep -q '^usage: MUTATE_MINUTES' out || { bad "mutate MUTATE_MINUTES='$m' under $shell: exit $rc, want 2, a usage line and no mutant run"; cat out; }
done; done
rc=0; MUTATE_MINUTES= capped sh "$bin/mutate.sh" m.tsv true > out 2>&1 || rc=$?
[ "$rc" = 0 ] && grep -q '^SURVIVED' out || { bad "mutate empty MUTATE_MINUTES: exit $rc, want 0 and the default budget"; cat out; }
# --- session_status.sh ----------------------------------------------------------------------
# A repo whose origin/main last merge is 2026-10-08T12:00Z; stub br prints $HK, stub gh fails.
# Break: a missing/failing br fails the session start; the retro note fires when a housekeeping
# issue is newer than the last merge, or stays silent when none is; closed issues counted as open;
# the ready/blocked counts line misreads br's JSON.
printf '#!/bin/sh\ncase "$*" in *housekeeping*) cat "$HK" ;; *"ready --json") echo "[{},{}]" ;; *"blocked --json") echo "{\\"total\\":3}" ;; *) exit 1 ;; esac\n' > "$tmp/stub/br"
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
grep -q 'ready: 2, blocked: 3' out || bad 'session_status: wrong ready/blocked counts'
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
case "$1 $2" in "run list") ;; "run view") eval "json=\${JOBS_$3:-\$JOBS}" ;; "pr list") json=$PRS ;; *) exit 1 ;; esac
case $* in "run list"*ci.yml*) json=$CI ;; "run list"*) json=$E2E ;; esac
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
# --- pm_merge.sh ---------------------------------------------------------------------------
# A batch worktree, a slice and a record branch on a bare origin (stub prepush.sh passes). Stub gh applies the real
# --jq to $CI and $E2E, the run lists of ci.yml and book-e2e.yml (newest first). Break: a merge goes ahead while the newest
# run of either workflow is not a success (failed, cancelled at its timeout, still running, none); a superseded older run blocks.
mkdir -p "$tmp/pmgh"; cat > "$tmp/pmgh/gh" <<'SH'
#!/bin/sh
case $* in *ci.yml*) json=$CI ;; *) json=$E2E ;; esac
a=$*; while [ $# -gt 1 ]; do [ "$1" = --jq ] && q=$2; [ "$1" = --commit ] && c=$2; shift; done
[ "${c-}" = "$EXPECT_SHA" ] || json='[]' # runs exist only for the reviewed sha; no or another --commit finds none
printf '%s\n' "$json" | jq -r "$q"
SH
chmod +x "$tmp/pmgh/gh"
pm() { # <case> <want-rc> <want-output>
  O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"; git clone -q "$O" . 2>/dev/null
  sf=${SLICE_FILE:-s} rf=${REC_FILE:-r}; mkdir -p "$(dirname "$sf")" "$(dirname "$rf")"
  git checkout -qb batch; mkdir bin node_modules; cp "$bin/pm_merge.sh" bin/; printf '#!/bin/sh\necho run >> %s.pp\n' "$R" > bin/prepush.sh; echo base > a; chmod +x bin/prepush.sh
  [ -z "${REC_IN_BASE-}" ] || echo old > "$rf" # the record branch updates an existing record
  pmd=bin; if [ -n "${RESOLVE-}" ]; then # the batch's resolver settles the conflict; main's copy (beside pm_merge.sh, the old $here) refuses
    pmd=$R.m; mkdir "$pmd"; cp "$bin/pm_merge.sh" "$pmd/"; echo 'raise SystemExit(1)' > "$pmd/merge_resolve.py"
    echo 'import os; raise SystemExit(os.system("git checkout --theirs -- . && git add -u"))' > bin/merge_resolve.py
    printf '#!/bin/sh\necho regenerated > a; echo run >> %s.rg; exit %s\n' "$R" "${REGEN_RC:-0}" > bin/regen.sh
  fi
  git add . && git commit -qm base && git push -q origin batch
  git checkout -qb slice; echo "${SLICE_TEXT:-s}" > "$sf"; git add . && git commit -qm slice && git push -q origin slice
  git checkout -q batch; [ -z "${RESOLVE-}" ] || { echo b > "$sf"; git add . && git commit -qm conflict && git push -q origin batch; }
  git checkout -qb rec; echo r > "$rf"; git add . && git commit -qm rec && git push -q origin rec; git checkout -q batch
  mkdir "$R.h"; cp "$bin/../.githooks/pre-push" "$R.h/"; git config core.hooksPath "$R.h" # pm_merge's push runs the real hook
  pre=$(git rev-parse HEAD); rc=0; EXPECT_SHA=$(git rev-parse origin/slice) PATH="$tmp/pmgh:$PATH" capped sh "$pmd/pm_merge.sh" "$R" batch slice rec subj "$(git rev-parse origin/slice)" > "$R.out" 2>&1 || rc=$?
  [ "$rc" = "$2" ] && grep -q "$3" "$R.out" || { bad "pm_merge $1: exit $rc, want $2 with '$3'"; sed 's/^/  /' "$R.out"; }
  if [ "$2" != 0 ]; then [ "$(git rev-parse HEAD)" = "$pre" ] && [ "$(git rev-parse origin/batch)" = "$pre" ] || bad "pm_merge $1: merged or pushed"
    [ -z "$(git status --porcelain --untracked-files=no)" ] || bad "pm_merge $1: left the worktree dirty"; fi
  # Break (loka-36uz): the push's pre-push hook runs prepush.sh again on the head pm_merge just checked.
  if [ "$2" = 0 ]; then [ "$(wc -l < "$R.pp")" -eq 1 ] || bad "pm_merge $1: prepush.sh ran $(wc -l < "$R.pp") times, want 1"; fi
}
ok='[{"conclusion":"success"},{"conclusion":"cancelled"}]'
CI=$ok E2E=$ok pm green 0 '^PUSHED batch'
CI='[{"conclusion":"cancelled"}]' E2E=$ok pm ci-timeout 2 'ci.yml on .* is cancelled'
CI=$ok E2E='[{"conclusion":"failure"}]' pm e2e-red 2 'book-e2e.yml on .* is failure'
CI=$ok E2E='[]' pm e2e-missing 2 'book-e2e.yml on .* is missing'
CI='[{"conclusion":""}]' E2E=$ok pm ci-running 2 'ci.yml on .* is still running'
# Break (loka-1qa2): a protocol schema change merges with no review record added (the generated README does not count), or a record on the record branch is not counted.
CI=$ok E2E=$ok SLICE_FILE=protocol/x.schema.json pm schema-no-record 1 'NO REVIEW RECORD'
CI=$ok E2E=$ok SLICE_FILE=kernel/ts/src/runtime/world.ts SLICE_TEXT="  kernel_api: '1.2'," pm kernel-api-no-record 1 'NO REVIEW RECORD'
CI=$ok E2E=$ok SLICE_FILE=protocol/x.schema.json REC_FILE=docs/reviews/README.md pm schema-readme-only 1 'NO REVIEW RECORD'
CI=$ok E2E=$ok SLICE_FILE=protocol/x.schema.json REC_FILE=docs/reviews/x-review.md pm schema-record 0 '^PUSHED batch'
CI=$ok E2E=$ok SLICE_FILE=protocol/x.schema.json REC_FILE=docs/reviews/x-review.md REC_IN_BASE=1 pm schema-record-updated 0 '^PUSHED batch'
# Break (loka-hhs6): pm_merge runs main's resolver, not the batch's own, or skips bin/regen.sh after a resolved conflict
# (regen's output must land in the pushed merge commit).
CI=$ok E2E=$ok SLICE_FILE=s REC_FILE=r REC_IN_BASE= RESOLVE=1 pm batch-resolver 0 '^PUSHED batch'
[ "$(cat "$R.rg" 2>/dev/null)" = run ] && [ "$(git -C "$R" show origin/batch:a)" = regenerated ] || bad 'pm_merge batch-resolver: regen.sh did not run once into the pushed merge'
# Break: a failed regen.sh merges anyway, or leaves its edits in the worktree (merge --abort keeps them).
CI=$ok E2E=$ok SLICE_FILE=s REC_FILE=r REC_IN_BASE= RESOLVE=1 REGEN_RC=1 pm regen-fails 1 '^CONFLICT'; unset RESOLVE REGEN_RC # bash's sh keeps a function's prefix assignments, dash does not
# --- prepush.sh ----------------------------------------------------------------------------
# A repo whose stub mise logs each check and fails them when STUB_RC=1; origin/main is the base commit.
# Break: two runs share log files, so one reports the other's output (the first log must still read "run-a" after
# run b); a sampler hash change does not add the transcript and Impact story checks, or any other change adds them.
mkdir -p "$tmp/pp"; cat > "$tmp/pp/mise" <<'SH'
#!/bin/sh
shift 2; echo "$*" >> "$PP_LOG"; echo "run-$RUN"
case $* in *regen.sh*) [ -z "${STUB_REGEN-}" ] || echo regenerated > "$STUB_REGEN" ;; esac
exit "${STUB_RC:-0}"
SH
chmod +x "$tmp/pp/mise"
R=$(mktemp -d); cd "$R"; git init -q -b main; mkdir bin protocol protocol/fixtures; cp "$bin/prepush.sh" bin/; echo a > a; git add . && git commit -qm base; git update-ref refs/remotes/origin/main HEAD
pp() { rc=0; PP_LOG=$R.pp RUN=$1 STUB_RC=${2-0} STUB_REGEN=${STUB_REGEN-} PATH="$tmp/pp:$PATH" capped sh bin/prepush.sh > "$R.$1" 2>&1 || rc=$?; }
pp a 1; pp b 1
la=$(sed -n 's/^DOCS_FAIL (\(.*\))$/\1/p' "$R.a"); lb=$(sed -n 's/^DOCS_FAIL (\(.*\))$/\1/p' "$R.b")
[ -n "$la" ] && [ "$la" != "$lb" ] && grep -qx run-a "$la" && grep -qx run-b "$lb" || bad "prepush logs: run a's log is '$la' ($(cat "$la" 2>/dev/null)), run b's '$lb'"
: > "$R.pp"; echo x > a; git commit -qam other; pp c
! grep -q 'transcripts.test.ts' "$R.pp" && ! grep -q IMPACT_STORY "$R.c" || bad 'prepush: transcript or Impact checks ran without a sampler hash change'
echo '{}' > protocol/fixtures/new_sampler_hash.json; git add . && git commit -qm hash; : > "$R.pp"; pp d
grep -q 'test/transcripts.test.ts' "$R.pp" && grep -q '^IMPACT_STORY_' "$R.d" || bad 'prepush: a sampler hash change did not run the transcript and Impact checks'
# Break (loka-8qzi, loka-yz58): the story check is skipped for its inputs, runs for others, or is
# skipped when the branch diff cannot be read (no origin/main).
! grep -q '^STORIES_' "$R.c" || bad 'prepush: the story check ran for an unrelated change'
git update-ref refs/remotes/origin/main HEAD; mkdir -p mobile/app kernel/ts/src; echo x > mobile/app/x; git add . && git commit -qm app; pp e
grep -q '^STORIES_' "$R.e" || bad 'prepush: a mobile/app change did not run the story check'
git update-ref refs/remotes/origin/main HEAD; echo x > kernel/ts/src/x; git add . && git commit -qm src; pp f
grep -q '^STORIES_' "$R.f" || bad 'prepush: a kernel/ts/src change did not run the story check'
git update-ref refs/remotes/origin/main HEAD; mkdir -p mobile/authority; echo x > mobile/authority/x; git add . && git commit -qm auth; pp i
grep -q '^STORIES_' "$R.i" || bad 'prepush: a mobile/authority change did not run the story check'
git update-ref -d refs/remotes/origin/main; pp g
grep -q '^STORIES_' "$R.g" && grep -q '^MIX_FORMAT_' "$R.g" && grep -q '^TYPECHECK_' "$R.g" && grep -q '^PRETTIER_' "$R.g" && ! grep -q '^TRANSCRIPTS_' "$R.g" || bad 'prepush: an unreadable branch diff skipped the gated checks or ran the transcripts'
# Break (loka-ivjq.25): bin/regen.sh rewrites a file and prepush passes, or does not name it; or a file already
# uncommitted before the run, which regen leaves alone, is reported.
echo own > own.txt; STUB_REGEN=a pp j
[ "$rc" = 1 ] && grep -q '^REGEN_DIRTY' "$R.j" && grep -qx '  a' "$R.j" && ! grep -q own.txt "$R.j" || bad "prepush: a regenerated file was not reported, or an untouched one was (exit $rc, want 1): $(cat "$R.j")"
git checkout -q a; rm own.txt
# Break (loka-n0ng): a docs-only change runs the Elixir, TS or prettier checks or skips REGEN or DOCS; a staged .ex
# change skips the Elixir checks or runs the TS ones; a kernel/ts .ts change skips the TS checks or prettier.
git update-ref refs/remotes/origin/main HEAD; mkdir -p docs lib; echo x > docs/x.md; git add . && git commit -qm docs; pp k
grep -q '^REGEN_' "$R.k" && grep -q '^DOCS_' "$R.k" && ! grep -qE '^(EX_SIZE|MIX_FORMAT|CREDO|TS_SIZE|TYPECHECK|PRETTIER)_' "$R.k" || bad "prepush: a docs-only change ran a gated check or skipped REGEN or DOCS: $(cat "$R.k")"
echo x > lib/x.ex; git add lib/x.ex; pp l
grep -q '^EX_SIZE_' "$R.l" && grep -q '^MIX_FORMAT_' "$R.l" && grep -q '^CREDO_' "$R.l" && ! grep -qE '^(TYPECHECK|PRETTIER)_' "$R.l" || bad "prepush: a staged .ex change skipped the Elixir checks or ran the TS ones: $(cat "$R.l")"
git commit -qm ex; git update-ref refs/remotes/origin/main HEAD; echo x > kernel/ts/src/y.ts; git add .; pp m
grep -q '^TS_SIZE_' "$R.m" && grep -q '^TYPECHECK_' "$R.m" && grep -q '^PRETTIER_' "$R.m" && ! grep -q '^MIX_FORMAT_' "$R.m" || bad "prepush: a kernel/ts change skipped the TS checks or prettier, or ran the Elixir ones: $(cat "$R.m")"
git commit -qm ts; git update-ref refs/remotes/origin/main HEAD; echo '{}' > .prettierrc; git add .; : > "$R.pp"; pp n
grep -q 'git ls-files' "$R.pp" || bad "prepush: a Prettier setup change did not check every tracked file: $(cat "$R.pp")"
git commit -qm p; git update-ref refs/remotes/origin/main HEAD; echo x > v.mts; git add .; pp o
grep -q '^TS_SIZE_' "$R.o" || bad "prepush: a .mts change skipped the TS checks: $(cat "$R.o")"
git commit -qm o; git update-ref refs/remotes/origin/main HEAD; mkdir -p protocol; echo '{}' > protocol/x.json; git add .; pp p
grep -q '^COMPILE_' "$R.p" || bad "prepush: a protocol JSON change skipped the Elixir compile that reads it: $(cat "$R.p")"
git commit -qm pj; git update-ref refs/remotes/origin/main HEAD; mkdir -p docs; git mv lib/x.ex docs/moved.md; pp q
grep -q '^EX_SIZE_' "$R.q" || bad "prepush: moving a .ex file out of lib/ skipped the Elixir checks (rename hid the source): $(cat "$R.q")"
# --- ci_changes.sh --------------------------------------------------------------------------
# Break (loka-n0ng): a docs-only branch runs the test jobs or sim/walk; an engine change skips sim/walk; a test-only or
# contract-doc change skips the test jobs; a non-push event, or a branch diff that is empty or cannot be read, skips anything.
R=$(mktemp -d); cd "$R"; git init -q -b main; echo a > a; git add . && git commit -qm base; git update-ref refs/remotes/origin/main HEAD
cc() { # <event> <file> <expected output on one line>
  git checkout -qB t main; mkdir -p "$(dirname "$2")"; echo x > "$2"; git add . && git commit -qm "$2"
  got=$(sh "$bin/ci_changes.sh" "$1" | tr '\n' ' '); [ "$got" = "$3 " ] || bad "ci_changes $1 $2: '$got', want '$3'"
}
cc push docs/x.md 'code=false sim_walk=false'
cc push .beads/issues.jsonl 'code=false sim_walk=false'
cc push lib/x.ex 'code=true sim_walk=true'
cc push kernel/ts/test/x.ts 'code=true sim_walk=false'
cc push kernel/ts/test/sim.test.ts 'code=true sim_walk=true'
cc push mobile/app/src/x.tsx 'code=true sim_walk=true'
cc push kernel/ts/play/obs.ts 'code=true sim_walk=true'
cc push mix.exs 'code=true sim_walk=true'
cc push docs/BOOK-UI-COMPONENTS.md 'code=true sim_walk=false'
for f in cartridges/x/room.md protocol/x.json config/config.exs .github/workflows/ci.yml kernel/ts/src/x.ts \
  kernel/ts/test/read.ts kernel/ts/package.json mix.lock bin/loka bin/ci_changes.sh docs/spec/conformance/x.json; do cc push "$f" 'code=true sim_walk=true'; done
# A move out of a sim/walk path still runs sim/walk (rename detection lists only the destination).
git checkout -qB t main; mkdir -p cartridges docs; echo r > cartridges/r.md; git add . && git commit -qm r; git update-ref refs/remotes/origin/main HEAD
git mv cartridges/r.md docs/r.md && git commit -qm mv; got=$(sh "$bin/ci_changes.sh" push | tr '\n' ' ')
[ "$got" = 'code=true sim_walk=true ' ] || bad "ci_changes: a move out of cartridges/ into docs/ skipped sim/walk: '$got'"; git update-ref refs/remotes/origin/main main
cc push docs/spec/x.md 'code=true sim_walk=false'
cc push docs/contracts.gen.md 'code=true sim_walk=false'
cc schedule docs/y.md 'code=true sim_walk=true'
git checkout -qB t main; got=$(sh "$bin/ci_changes.sh" push | tr '\n' ' '); [ "$got" = 'code=true sim_walk=true ' ] || bad "ci_changes: an empty branch diff skipped jobs: '$got'"
git update-ref -d refs/remotes/origin/main; cc push docs/z.md 'code=true sim_walk=true'
# --- regen.sh -------------------------------------------------------------------------------
# Stub mise logs each generator (mix loka.lint reports one finding); stub regen_hash_fixture.sh turns sha256 old
# into new. Break: a slow generator runs for a diff that misses its inputs or is skipped for one that touches them
# (the story views read the fixture this run rewrites; a lib/ or capability registry change rebuilds every fixture; the containers generator
# runs for its own or its frozen inputs' diff only); a fixture of another cartridge, or a frozen one, is rebuilt, or a `value` one, or one a
# merge took a side of, is not; a transcript pin that is no known answer keeps its stale hash (on any line, each line its own stale pin), or one pinned
# to another known answer of its cartridge is rewritten, or one of a cartridge with no compiled fixture stops regen; a fixed lint finding stays in the baseline; a new finding is pinned instead of failing regen.
mkdir "$tmp/rg"; cat > "$tmp/rg/mise" <<'SH'
#!/bin/sh
shift 2; echo "$*" >> "$RG_LOG"
case $* in *loka.lint*) echo "lint: ${RG_LINT:-finding}" >&2; exit 1 ;; esac
SH
chmod +x "$tmp/rg/mise"
R=$(mktemp -d); cd "$R"; git init -q -b main; mkdir -p bin kernel/ts mobile/app protocol/fixtures cartridges/a/transcripts cartridges/b cartridges/c/transcripts test/loka
cp "$bin/regen.sh" bin/; : > bin/review_index.sh; echo 'print("containers", file=open(__import__("os").environ["RG_LOG"], "a"))' > test/loka/cartridge_containers_hash.py
printf 'echo "$2" >> "$RG_LOG"; perl -pi -e s/old/new/ "$2"\n' > bin/regen_hash_fixture.sh
for c in a b; do printf '{\n  "description": "x",\n  "canonical": "{\\"manifest\\":{\\"id\\":\\"%s\\"}}",\n  "sha256": "old"\n}\n' $c > protocol/fixtures/${c}_hash.json; done
printf '{\n  "description": "x",\n  "value": 1,\n  "canonical": "{\\"manifest\\":{\\"id\\":\\"b\\"}}",\n  "sha256": "old"\n}\n' > protocol/fixtures/v_hash.json
printf '{\n  "description": "x",\n  "canonical": "{\\"manifest\\":{\\"id\\":\\"a\\"}}",\n  "sha256": "kept"\n}\n' > protocol/fixtures/containers_sampler_v1_hash.json; sed s/kept/frozen/ protocol/fixtures/containers_sampler_v1_hash.json > protocol/fixtures/sampler_v1_hash.json; sed s/kept/old/ protocol/fixtures/containers_sampler_v1_hash.json > protocol/fixtures/containers_cartridge_a_hash.json
printf '{"ids":{"content_hash":"stale"}}\n{"ids":{"content_hash":"older"}}\n' > cartridges/a/transcripts/t.jsonl; echo '{"ids":{"content_hash":"kept"}}' > cartridges/a/transcripts/k.jsonl; echo '{"ids":{"content_hash":"stale"}}' > cartridges/c/transcripts/u.jsonl; echo x > cartridges/b/x; printf '# header\ntoolbox_showcase lint: finding\ntoolbox_showcase lint: fixed\n' > test/loka/lint_baseline.txt
git add . && git commit -qm base; git update-ref refs/remotes/origin/main HEAD
rg() { RG_LOG=$R.$1 PATH="$tmp/rg:$PATH" capped sh bin/regen.sh > /dev/null 2>&1 || bad "regen.sh exited non-zero ($1)"; }
echo y > cartridges/a/y; rg a
grep -qx 'protocol/fixtures/a_hash.json' "$R.a" && grep -qx 'protocol/fixtures/containers_cartridge_a_hash.json' "$R.a" && ! grep -qE 'protocol/fixtures/([bv]|containers_sampler)|^containers' "$R.a" && grep -q stories:views "$R.a" && ! grep -q loka.lint "$R.a" \
  || bad "regen: wrong generators for a cartridges/a change: $(tr '\n' ' ' < "$R.a")"
[ "$(grep -c '"new"' cartridges/a/transcripts/t.jsonl)" = 2 ] || bad "regen: a stale transcript pin was kept: $(cat cartridges/a/transcripts/t.jsonl)"
grep -q '"kept"' cartridges/a/transcripts/k.jsonl || bad 'regen: a transcript pinned to a known answer was rewritten'
git add . && git commit -qm a; git update-ref refs/remotes/origin/main HEAD; mkdir lib; echo x > lib/x; rg l
grep -qx 'protocol/fixtures/a_hash.json' "$R.l" && grep -qx 'protocol/fixtures/b_hash.json' "$R.l" || bad "regen: a lib/ change did not rebuild every fixture: $(tr '\n' ' ' < "$R.l")"
git add . && git commit -qm l; git update-ref refs/remotes/origin/main HEAD; echo x > protocol/capability_registry.json; rg r
grep -qx 'protocol/fixtures/a_hash.json' "$R.r" && grep -qx 'protocol/fixtures/b_hash.json' "$R.r" || bad "regen: a capability registry change did not rebuild every fixture: $(tr '\n' ' ' < "$R.r")"
git add . && git commit -qm r; git update-ref refs/remotes/origin/main HEAD; perl -pi -e s/new/old/ protocol/fixtures/v_hash.json; perl -pi -e s/frozen/thawed/ protocol/fixtures/sampler_v1_hash.json; rg f
[ "$(grep fixtures "$R.f")" = protocol/fixtures/v_hash.json ] && grep -qx containers "$R.f" || bad "regen: a fixture a merge took a side of was not rebuilt alone, or a frozen input did not re-derive containers: $(tr '\n' ' ' < "$R.f")"
git update-ref -d refs/remotes/origin/main; rg b
grep -qx 'protocol/fixtures/b_hash.json' "$R.b" && grep -qx 'protocol/fixtures/v_hash.json' "$R.b" && grep -qx containers "$R.b" && ! grep -qE 'sampler_v1' "$R.b" && [ "$(grep -nE '^containers$|containers_cartridge_a' "$R.b" | cut -d: -f2 | tr '\n' ' ')" = 'containers protocol/fixtures/containers_cartridge_a_hash.json ' ] \
  || bad "regen: no diff did not rebuild every compiled fixture and the containers ones, or rebuilt a frozen one, or compiled containers_cartridge_* before the generator: $(tr '\n' ' ' < "$R.b")"
[ "$(cat test/loka/lint_baseline.txt)" = "$(printf '# header\ntoolbox_showcase lint: finding')" ] || bad "regen: lint baseline is: $(cat test/loka/lint_baseline.txt)"
if RG_LINT=new RG_LOG=$R.n PATH="$tmp/rg:$PATH" capped sh bin/regen.sh > /dev/null 2> "$R.n.err" || ! grep -qx 'toolbox_showcase lint: new' "$R.n.err" \
  || grep -q new test/loka/lint_baseline.txt; then bad "regen: a new lint finding was pinned or not named: $(cat "$R.n.err")"; fi
# --- check_impact_fixtures.sh ----------------------------------------------------------------
# Break: the Impact story's pinned list is not compared with the README row (a new fixture only in the README passes).
R=$(mktemp -d); cd "$R"; git init -q -b main; mkdir -p protocol mobile/app/stories
printf '| `cartridge.schema.json` | cartridge | 05 §8 | `a_hash.json`, `b_sampler_hash.json` |\n' > protocol/README.md
printf "export const Impact: Story = {\n  x: ['a_hash.json',\n  'b_sampler_hash.json'],\n};\n" > mobile/app/stories/SystemDataModel.stories.tsx
sh "$bin/check_impact_fixtures.sh" > /dev/null 2>&1 || bad 'check_impact_fixtures: matching lists refused'
sed -i.bak 's/`a_hash.json`, /`a_hash.json`, `c_hash.json`, /' protocol/README.md
if sh "$bin/check_impact_fixtures.sh" > /dev/null 2>&1; then bad 'check_impact_fixtures: a README fixture missing from the story passed'; fi
# --- agent_load_gate.sh --------------------------------------------------------------------
# Stub uptime prints the macOS and the Linux format. Break: 8.00 or more does not refuse, 7.99 refuses, the message omits the load.
mkdir -p "$tmp/up"; printf '#!/bin/sh\necho "$UP"\n' > "$tmp/up/uptime"; chmod +x "$tmp/up/uptime"
lg() { rc=0; UP=$2 PATH="$tmp/up:$PATH" sh "$bin/agent_load_gate.sh" > /dev/null 2> "$tmp/lg.err" || rc=$?; [ "$rc" = "$3" ] || bad "agent_load_gate $1: exit $rc, want $3"; }
lg mac-7.99 '12:00  up 3 days,  2 users,  load averages: 7.99 9.50 9.00' 0
lg mac-15 '12:00  up 3 days,  2 users,  load averages: 15.93 9.50 9.00' 2
grep -q 'load is 15.93' "$tmp/lg.err" || bad 'agent_load_gate: message omits the load'
lg comma-decimal 'load averages: 9,50 9,00 9,00' 0
lg linux-8 ' 12:00:01 up 3 days,  2 users,  load average: 8.00, 9.50, 9.00' 2
# --- bash_guard.py, send_guard.py (Claude Code PreToolUse hooks) ------------------------------------
# Break: a git hook skip (--no-verify, commit -n, setting or exporting LOKA_PREPUSH_OK) or a bare br create passes, the owner marker does not let it through, or a
# command that only mentions the flag in quoted text, a heredoc body, another tool's flag or bin/br_create.sh is refused.
# Break: a force or mirror push, git rebase, pkill/killall, kill fed by pgrep (a pipe or $( ), not after ;), gh run watch,
# gh pr checks --watch, gh workflow run, the full npm test, test:e2e, storybook:smoke, check_all.sh or a worktree outside
# worktrees.noindex (or inside a checkout) passes; its marker (owner's, or LOKA_PM=1) does not let it through;
# a wrapper (timeout, env) or gh's -R hides the command; a worktree path is read as text, not resolved against cwd and -C;
# LOKA_PM=1 unlocks a rebase; or a near miss (pull --rebase, test:files, a file that names the script) is refused.
bg() { # <want-rc> <command> [cwd, default /r/lokacore]
  rc=0; printf '%s' "$2" | python3 -I -c 'import json,sys;print(json.dumps({"cwd":sys.argv[1],"tool_input":{"command":sys.stdin.read()}}))' "${3:-/r/lokacore}" |
    python3 -I "$bin/bash_guard.py" 2> /dev/null || rc=$?
  [ "$rc" = "$1" ] || bad "bash_guard: exit $rc, want $1: $2"
}
bg 2 'git push --no-verify'
bg 2 'cd x && git push origin b --no-verify'
bg 2 'git commit -qn -m x'
bg 2 'echo a
git commit --no-verify -m "two
lines"'
bg 2 'br -q create "x"'
bg 2 'git -C ../wt commit -n -m x'
bg 2 '/usr/bin/git push --no-verify'
bg 2 'git push --no-verify LOKA_OWNER_OK_NO_VERIFY=1'
bg 0 'LOKA_OWNER_OK_NO_VERIFY=1 git push --no-verify'
bg 0 'git commit -m done kernel'
bg 0 'git commit -uno -m x'
bg 0 'git commit -m "refuse --no-verify; br create"'
bg 0 'grep -n -- --no-verify f && git push -n'
bg 0 'bin/br_create.sh -t x && br list --status open'
bg 0 'echo "unclosed'
bg 0 "gh pr comment 1 --body-file - <<'EOF'
git commit -n slips
EOF"
bg 0 "cat > notes.md <<'EOF'
never br create
EOF"
bg 0 "git commit -F - <<'EOF'
skip --no-verify
EOF"
bg 0 'echo br create'
bg 2 'BR_X=1 br create x'
bg 0 'git commit -m T -m "- add new guard"'
bg 0 'git push --no-verbose'
bg 2 'git push origin b \
  --no-verify'
bg 2 'git commit -m x 2>&1 --no-verify'
bg 2 'echo $((1<<2))
git push --no-verify'
bg 2 'git commit --no-verif -m x'
bg 2 'git -c core.hooksPath=/dev/null commit -m x'
bg 2 'LOKA_PREPUSH_OK=abc git push'
bg 2 'export LOKA_PREPUSH_OK=abc; git push'
bg 2 'LOKA_PM=1 env LOKA_PREPUSH_OK=abc git push'
bg 0 'LOKA_OWNER_OK_NO_VERIFY=1 LOKA_PREPUSH_OK=abc git push'
bg 2 'declare -x LOKA_PREPUSH_OK=abc; git push'
bg 0 'bin/pm_merge.sh feat/x && git commit -m "refuse LOKA_PREPUSH_OK=x"'
bg 2 'git commit -mx -n'
bg 2 'git commit -S -n'
bg 0 'git diff -- f'
bg 2 'cat <<END-X
b
END-X
git push --no-verify'
bg 2 "cat > n <<EOF
x
EOF
git push --no-verify"
bg 2 'cat <<< EOF
git push --no-verify'
bg 2 'git push --force-with-lease origin b'
bg 2 'git push -fu origin b'
bg 2 'git push --mirror origin'
bg 2 'git push origin +b'
bg 0 'git push -u origin b'
bg 0 'LOKA_OWNER_OK_NO_VERIFY=1 git push --force'
bg 2 'git -C ../wt rebase main'
bg 2 'LOKA_PM=1 git rebase main'
bg 0 'git pull --rebase'
bg 0 'git rebase --abort'
bg 2 'pkill -f vitest'
bg 2 'killall node'
bg 0 'grep -rn pkill bin && kill 123'
bg 2 'kill $(pgrep -f vitest)'
bg 2 'pgrep -f storybook | xargs kill'
bg 2 'kill "`pgrep -f x`"'
bg 0 'pgrep -f vitest; kill 123'
bg 0 'LOKA_PM=1 kill $(pgrep -f x)'
bg 2 'gh run watch 123'
bg 2 'gh pr checks 484 --watch'
bg 0 'gh pr checks 484'
bg 0 'gh run list --commit abc'
bg 2 'gh -R o/r run watch 1'
bg 2 'gh workflow run ci.yml --ref b'
bg 0 'LOKA_PM=1 gh workflow run ci.yml --ref b'
bg 2 'cd kernel/ts && nice -n 10 npm test'
bg 0 'nice -n 10 npm run test:files -- test/a.test.ts'
bg 0 'LOKA_PM=1 npm test'
bg 2 'timeout 10m npm test'
bg 2 'env CI=1 npm run test:nosim'
bg 2 'npm run test:sim'
bg 2 'npm --prefix mobile/app run test:e2e'
bg 2 'npm run storybook:smoke'
bg 0 'npm run build'
bg 2 'sh bin/check_all.sh'
bg 0 'sed -n 1,20p bin/check_all.sh'
bg 2 'git worktree add -b x ../x main'
bg 0 'git worktree add -b x ../worktrees.noindex/x main'
bg 0 'git worktree add ../x' /r/worktrees.noindex/a
bg 0 'git -C ../worktrees.noindex/a worktree add ../b'
bg 0 'git worktree remove ../x'
bg 0 'git worktree add "$W" b'
bg 0 'LOKA_PM=1 git worktree add ../lokacore-session'
mkdir -p "$tmp/ck/.git"; bg 2 'git worktree add worktrees.noindex/x' "$tmp/ck"; bg 0 'git worktree add ../worktrees.noindex/x' "$tmp/ck"
# Break: a hook-compacted agent (durationMs < 1000) is resumed, a built-in compaction or an unknown agent is refused.
P=$(mktemp -d); mkdir -p "$P/s1/subagents"
cb() { printf '{"type":"system","subtype":"compact_boundary","compactMetadata":{"durationMs":%s}}\n' "$1"; }
{ cb 40000; cb 350; } > "$P/s1/subagents/agent-hook1.jsonl"; { cb 350; cb 48000; } > "$P/s1/subagents/agent-built1.jsonl"
sg() { # <want-rc> <to>
  rc=0; printf '{"tool_input":{"to":"%s"},"transcript_path":"%s/s2.jsonl"}' "$2" "$P" | python3 -I "$bin/send_guard.py" 2> /dev/null || rc=$?
  [ "$rc" = "$1" ] || bad "send_guard: exit $rc, want $1 for $2"
}
sg 2 hook1
sg 0 built1
sg 0 none1
# A guard script missing from the session's checkout lets the call through (python's own exit 2 would block it).
python3 -I -c 'import json,sys
for e in json.load(open(sys.argv[1]))["hooks"]["PreToolUse"]:
    [print(h["command"]) for h in e["hooks"] if "_guard.py" in h["command"]]' "$bin/../.claude/settings.json" > "$tmp/guards" || bad 'settings.json does not parse'
[ "$(wc -l < "$tmp/guards")" -eq 2 ] || bad 'settings.json: want the bash and send guards'
while IFS= read -r c; do echo '{}' | CLAUDE_PROJECT_DIR="$tmp/none" sh -c "$c" 2> /dev/null || bad "guard hook blocks when its script is missing: $c"; done < "$tmp/guards"
# --- .githooks/pre-commit ----------------------------------------------------------------------
# Stub mise runs nothing but fails `elixir bin/contracts.exs --check`. Break: a staged MECHANICS-TOOLBOX.md,
# CHECKS.md, system/mechanics.md or protocol/ file commits though the generated JSON is stale, or an unrelated file pays for the check.
mkdir "$tmp/hk"; printf '#!/bin/sh\ncase $* in *"${HK_FAIL:-contracts.exs}"*) exit 1 ;; esac\nexit 0\n' > "$tmp/hk/mise"; chmod +x "$tmp/hk/mise"
R=$(mktemp -d); cd "$R"; git init -q; mkdir -p docs/system protocol; : > a.txt
hk() { echo 1 >> $1; git add $1; rc=0; HK_FAIL=${2-} PATH="$tmp/hk:$PATH" sh "$bin/../.githooks/pre-commit" > /dev/null 2>&1 || rc=$?; git reset -q; }
for f in docs/MECHANICS-TOOLBOX.md docs/CHECKS.md docs/system/mechanics.md protocol/x.json a.txt; do
  hk $f; case $f in a.txt) want=0 ;; *) want=1 ;; esac
  [ "$rc" = $want ] || bad "pre-commit $f: exit $rc, want $want"
done
# Break (loka-ivjq.27): a staged file over the size limit, or a staged .ex failing Credo, commits; or Credo runs on .exs.
for c in 'x.ts check_ts_size 1' 'x.mjs check_ts_size 1' 'x.exs check_size.exs 1' 'x.ex credo 1' 'x.exs credo 0' 'a.txt check_ 0'; do
  set -- $c; hk $1 $2; [ "$rc" = $3 ] || bad "pre-commit $1 with $2 failing: exit $rc, want $3"
done
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
# Break: update restarts for a change that adds no story or MDX file, leaves a stale Storybook after an added
# or a renamed one, or stops by name; or the session worktree (with or without its own commits) is not brought to origin/main.
echo u1 > a.txt; git add a.txt; git commit -qm plain; git push -q origin main
run polish_session.sh update update-plain 0
[ "$(pid $sbp)" = "$sb" ] && [ "$(git -C "$S" rev-parse HEAD)" = "$(git rev-parse HEAD)" ] || bad 'polish_session update-plain: restarted, or session not at origin/main'
# Break: update leaves Storybook on old node_modules after a lockfile-only change (loka-nxg2).
echo 3 > mobile/app/package-lock.json; git commit -qam lock2; git push -q origin main; : > "$R.mise"
run polish_session.sh update update-lockfile 0
[ "$(pid $sbp)" != "$sb" ] && [ "$(grep 'npm ci' "$R.mise")" = "$S/mobile/app npm ci --no-audit --no-fund" ] \
  || { bad 'polish_session update-lockfile: no npm ci in the session mobile/app, or Storybook not restarted'; cat "$R.mise"; }
sb=$(pid $sbp)
echo s > mobile/app/x.stories.tsx; git add mobile/app/x.stories.tsx; git commit -qm story; git push -q origin main
run polish_session.sh update update-story 0
[ "$(pid $sbp)" != "$sb" ] && [ "$(cwd $sbp)" = "$S/mobile/app" ] && [ -f "$S/mobile/app/x.stories.tsx" ] || bad 'polish_session update-story: Storybook not restarted from the session'
sb=$(pid $sbp); git mv mobile/app/x.stories.tsx mobile/app/y.stories.tsx; git commit -qm rename; git push -q origin main
run polish_session.sh update update-rename 0
[ "$(pid $sbp)" != "$sb" ] && [ "$(cwd $sbp)" = "$S/mobile/app" ] || bad 'polish_session update-rename: Storybook not restarted'
sb=$(pid $sbp); git -C "$S" commit -q --allow-empty -m tweak0; echo s > mobile/app/z.mdx; git add mobile/app/z.mdx; git commit -qm mdx; git push -q origin main
run polish_session.sh update update-diverged 0
[ "$(pid $sbp)" != "$sb" ] && [ -f "$S/mobile/app/z.mdx" ] && git -C "$S" merge-base --is-ancestor origin/main HEAD && [ -n "$(git -C "$S" log origin/main..HEAD --format=%s | grep tweak0)" ] \
  || bad 'polish_session update-diverged: session with its own commit not merged, or Storybook not restarted'
# Break: update starts a Storybook for a session nobody serves. start then serves the session again.
kill "$(pid $sbp)"; i=0; while [ -n "$(pid $sbp)" ] && [ $i -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
echo s > mobile/app/w.stories.tsx; git add mobile/app/w.stories.tsx; git commit -qm unserved; git push -q origin main
run polish_session.sh update update-unserved 0; [ -z "$(pid $sbp)" ] || bad 'polish_session update-unserved: started a Storybook for an unserved session'
# Break: a shell left by serve holds the caller's stdout, so a caller reading a pipe hangs until the server exits (loka-wxu).
rc=0; capped sh -c 'sh "$1" start 2>&1 | cat > "$2"' _ "$R/bin/polish_session.sh" "$R.out" || rc=$?
[ "$rc" = 0 ] || { bad "polish_session start through a pipe: exit $rc, want 0 (142: the pipe stayed open)"; cat "$R.out"; }
sb=$(pid $sbp)
# The preview moves with main and its npm ci (as preview_update would; update-lockfile changed the lockfile), so close's own refresh restarts nothing but Storybook.
git -C "$P" fetch -q origin main; git -C "$P" checkout -q --detach origin/main
mkdir -p "$P/mobile/app/node_modules"; cksum < "$P/mobile/app/package-lock.json" > "$P/mobile/app/node_modules/.loka-lock-cksum"
touch "$S/new-token.ts"; run polish_session.sh close untracked 1; [ "$(pid $sbp)" = "$sb" ] && [ ! -s "$R.gh" ] || bad 'polish_session untracked: changed something'
git -C "$S" add new-token.ts; git -C "$S" commit -qm tweak
touch "$P/x"; run polish_session.sh close dirty-preview 1; rm "$P/x"
[ "$(cwd $sbp)" = "$S/mobile/app" ] || bad 'polish_session close dirty-preview: no Storybook left serving the session'
run polish_session.sh close close 0
git ls-remote --exit-code --heads origin "$day-2" > /dev/null && grep -q '^pr create' "$R.gh" && [ "$(cwd $sbp)" = "$P/mobile/app" ] \
  || { bad 'polish_session close: not pushed, no PR, or the preview not served again'; cat "$R.gh"; }
[ "$(pid $wp)" = "$web" ] && [ "$(pid $ep)" = "$expo" ] || bad 'polish_session close: restarted the web preview or Expo'
run polish_session.sh start after-close 1
# Break: update merges main into a closed session; that merge never reaches its PR and after_merge refuses the worktree.
h=$(git -C "$S" rev-parse HEAD); echo 4 > a.txt; git add a.txt; git commit -qm after-close; git push -q origin main
run polish_session.sh update update-after-close 1; [ "$(git -C "$S" rev-parse HEAD)" = "$h" ] || bad 'polish_session update-after-close: closed session changed'
kill "$(pid $ep)"; i=0; while [ -n "$(pid $ep)" ] && [ $i -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
echo 3 > a.txt; git add a.txt; git commit -qm moved; git push -q origin main
run preview_update.sh '' no-expo 0; [ -z "$(pid $ep)" ] || bad 'preview_update no-expo: started Expo that was not running'
kill "$decoy" 2> /dev/null || bad 'a stop by name killed the decoy on $dp'
fi

# --- regen_hash_fixture.sh -------------------------------------------------------------------------
# A stub artifact whose canonical holds a float written 1.50, non-ASCII text and a list that grew and a new key. Break: the canonical is
# re-encoded instead of copied as bytes (1.50 becomes 1.5), the description is dropped, a sampler's `value` is
# refused, kept stale, moved or re-sorted, a hash that is not the canonical's sha256 or a fixture with other keys is written over.
mkdir "$tmp/rh"; cd "$tmp/rh"; canon='{"a":[{"x":1,"y":2},3],"n":1.50,"s":"Grüße"}'
sha=$(printf %s "$canon" | shasum -a 256 | cut -d' ' -f1)
rh() { # <case> <want-rc> <hash>
  printf '{"cartridge":%s,"content_hash":"%s"}' "$canon" "$3" > art; cp fix fix.before
  rc=0; LOKA_COMPILED=art capped sh "$bin/regen_hash_fixture.sh" . fix > out 2>&1 || rc=$?
  [ "$rc" = "$2" ] || { bad "regen_hash_fixture $1: exit $rc, want $2"; cat out; }
  [ "$2" = 0 ] || cmp -s fix fix.before || bad "regen_hash_fixture $1: refused but changed the fixture"
}
printf '{\n  "description": "d",\n  "canonical": "old",\n  "sha256": "0"\n}\n' > fix; rh ok 0 "$sha"
[ "$(cat fix)" = "$(printf '{\n  "description": "d",\n  "canonical": "%s",\n  "sha256": "%s"\n}' "$(printf %s "$canon" | sed 's/"/\\"/g')" "$sha")" ] \
  || { bad 'regen_hash_fixture ok: fixture not description + canonical bytes + sha256'; cat fix; }
rh wrong-hash 1 "$(printf %s "$sha" | tr 0-9a-f 1-9a-f0)"
printf '{\n  "description": "d",\n  "value": {"s": 0, "a": [{"y": 0, "x": 0}]},\n  "canonical": "old",\n  "sha256": "0"\n}\n' > fix; rh value 0 "$sha"
[ "$(cat fix)" = "$(printf '{\n  "description": "d",\n  "value": {\n    "s": "Grüße",\n    "a": [\n      {\n        "y": 2,\n        "x": 1\n      },\n      3\n    ],\n    "n": 1.5\n  },\n  "canonical": "%s",\n  "sha256": "%s"\n}' "$(printf %s "$canon" | sed 's/"/\\"/g')" "$sha")" ] \
  || { bad 'regen_hash_fixture value: fixture not description + decoded value + canonical bytes + sha256'; cat fix; }
printf '{\n  "description": "d",\n  "canonical": "old",\n  "sha256": "0",\n  "x": 1\n}\n' > fix; rh other-key 1 "$sha"

# --- test_files.sh ---------------------------------------------------------------------------------
# Stub node logs its args. Break: no file, or a glob that matched nothing, reaches node --test (which
# then runs the whole suite), or a named file or a node flag does not.
mkdir -p "$tmp/tf/bin"; cd "$tmp/tf"; : > a.test.ts; printf '#!/bin/sh\necho "$*" >> "$TF_LOG"\n' > bin/node; chmod +x bin/node
tf() { # <case> <want-rc> [files]
  c=$1 w=$2; shift 2; : > log
  rc=0; TEST_REPORTER=spec TF_LOG=$tmp/tf/log PATH="$tmp/tf/bin:$PATH" capped sh "$bin/test_files.sh" "$@" > out 2>&1 || rc=$?
  [ "$rc" = "$w" ] || { bad "test_files $c: exit $rc, want $w"; cat out; }
}
tf none 2; [ ! -s log ] || bad 'test_files none: node ran'
tf unmatched 2 a.test.ts 'test/*.nomatch.ts'; [ ! -s log ] || bad 'test_files unmatched: node ran'
tf one 0 --test-name-pattern=x a.test.ts; [ "$(cat log)" = '--test --test-reporter=spec --test-name-pattern=x a.test.ts' ] || { bad 'test_files one: wrong node args'; cat log; }

# --- wait_ci.sh --------------------------------------------------------------------------------
# Stub gh answers from a list, one line set per call; stub sleep returns at once. Break: the wait ends
# before ci or book-e2e exists (the others done first), or while a run is still in progress; a
# timeout with neither present passes. The stub repeats its last line once the list runs out.
mkdir "$tmp/wc"; printf '#!/bin/sh\nn=$(($(cat "$WC_N" 2>/dev/null || echo 0) + 1)); echo $n > "$WC_N"; sed -n -e "${n}{p;q;}" -e "\\$p" "$WC_RUNS" | tr "|" "\\n"\n' > "$tmp/wc/gh"
printf '#!/bin/sh\n' > "$tmp/wc/sleep"; chmod +x "$tmp/wc/gh" "$tmp/wc/sleep"
printf '%s\n' 'book-e2e:completed:success|graph-diff:completed:success' 'graph-diff:completed:success|ci:completed:success' 'ci:completed:success|book-e2e:in_progress:' \
  'ci:completed:success|book-e2e:completed:success|graph-diff:completed:success' > "$tmp/wc/runs"
rc=0; WC_N=$tmp/wc/n WC_RUNS=$tmp/wc/runs PATH="$tmp/wc:$PATH" capped sh "$bin/wait_ci.sh" abc > "$tmp/wc/out" 2>&1 || rc=$?
[ "$rc" = 0 ] && [ "$(cat "$tmp/wc/n")" = 4 ] || { bad "wait_ci: exit $rc after $(cat "$tmp/wc/n") polls, want 0 after 4"; cat "$tmp/wc/out"; }
echo 'graph-diff:completed:success' > "$tmp/wc/runs"; rm "$tmp/wc/n"; rc=0
WC_N=$tmp/wc/n WC_RUNS=$tmp/wc/runs PATH="$tmp/wc:$PATH" capped sh "$bin/wait_ci.sh" abc > "$tmp/wc/out" 2>&1 || rc=$?
[ "$rc" = 1 ] && [ "$(cat "$tmp/wc/n")" = 40 ] || { bad "wait_ci timeout: exit $rc after $(cat "$tmp/wc/n") polls, want 1 after 40"; cat "$tmp/wc/out"; }

# Break: a branch argument polls a stale or wrong head instead of the fetched origin tip. The script
# runs from a throwaway repo (it cds to its own root) whose origin branch feat/x moved after the clone.
O=$(mktemp -d); git init -q --bare -b main "$O"; W=$(mktemp -d); git clone -q "$O" "$W" 2>/dev/null
(cd "$W" && mkdir bin && cp "$bin/wait_ci.sh" "$bin/ci_fail.sh" bin/ && git add . && git commit -qm base && git push -q origin HEAD:main HEAD:feat/x)
M=$(mktemp -d); git clone -q "$O" "$M" 2>/dev/null; (cd "$M" && git checkout -q feat/x && echo n > n && git add n && git commit -qm tip && git push -q origin feat/x)
tip=$(git -C "$M" rev-parse HEAD)
printf '#!/bin/sh\necho "$*" >> "$WC_ARGS"\nprintf "ci:completed:success\\nbook-e2e:completed:success\\n"\n' > "$tmp/wc/gh"
rc=0; WC_ARGS=$tmp/wc/args PATH="$tmp/wc:$PATH" capped sh "$W/bin/wait_ci.sh" feat/x > "$tmp/wc/out" 2>&1 || rc=$?
[ "$rc" = 0 ] && grep -q -- "--commit $tip" "$tmp/wc/args" || { bad "wait_ci branch: exit $rc, did not poll the origin tip $tip"; cat "$tmp/wc/args" "$tmp/wc/out"; }

# --- merge_pr.sh ---------------------------------------------------------------------------
# Stub gh (pr view prints "$MP_STATE abc123", pr merge exits $MP_MERGE), stub wait_ci.sh (exits $MP_CI)
# and after_merge.sh; every call is logged. Break: a red or unread CI head, a non-OPEN PR, a dirty
# tracked file, a subject with ROADMAP unedited or a non-main checkout still merges; the merge drops --match-head-commit <head>; a
# failed merge still runs the bookkeeping, or a good merge skips it, changes its arguments or skips ci_timing.sh.
mkdir "$tmp/mp"; L=$tmp/mp/log
printf '#!/bin/sh\necho "gh $*" >> "$MP_LOG"\ncase $2 in view) echo "$MP_STATE abc123" ;; merge) exit "$MP_MERGE" ;; esac\n' > "$tmp/mp/gh"; chmod +x "$tmp/mp/gh"
R=$(mktemp -d); cd "$R"; git init -q -b main; mkdir bin; cp "$bin/merge_pr.sh" "$bin/ci_timing.sh" bin/
printf '#!/bin/sh\necho "wait_ci $*" >> "$MP_LOG"; exit "$MP_CI"\n' > bin/wait_ci.sh
printf '#!/bin/sh\necho "after_merge $*" >> "$MP_LOG"\n' > bin/after_merge.sh
echo a > a; mkdir docs; echo r > docs/ROADMAP.md; git add . && git commit -qm base; echo edit >> docs/ROADMAP.md
mp() { # <case> <state> <ci> <merge> <want-rc 0|1> <log-must-match or -> <log-must-not-match>
  : > "$L"; rc=0; MP_LOG=$L MP_STATE=$2 MP_CI=$3 MP_MERGE=$4 GH=$tmp/mp/gh capped sh bin/merge_pr.sh 7 loka-x 'ROADMAP: s' > "$tmp/mp/out" 2>&1 || rc=$?
  [ "$rc" = "$5" ] && { [ "$6" = - ] || grep -q -- "$6" "$L"; } && ! grep -q -- "$7" "$L" || { bad "merge_pr $1: exit $rc"; sed 's/^/  /' "$L" "$tmp/mp/out"; }
}
mp ci-red OPEN 1 0 1 'wait_ci abc123' 'pr merge'
mp merged MERGED 0 0 1 'pr view' 'wait_ci'
mp merge-fails OPEN 0 1 1 'pr merge 7 --merge --match-head-commit abc123' 'after_merge'
mp ok OPEN 0 0 0 'after_merge 7 loka-x ROADMAP: s' 'NEVER'
grep -q 'gh pr merge 7 --merge --match-head-commit abc123' "$L" || bad 'merge_pr ok: merge not pinned to the head'
grep -q 'gh run list' "$L" || bad 'merge_pr ok: ci_timing.sh not run through the stub gh'
echo b > a; mp dirty OPEN 0 0 1 - 'pr '; git checkout -q a
git checkout -qb x; mp not-main OPEN 0 0 1 - 'pr '; git checkout -q main
git checkout -q docs/ROADMAP.md; mp roadmap-unedited OPEN 0 0 1 - 'pr '

# --- beads_checkpoint.sh -------------------------------------------------------------------
# A main clone of a bare origin; stub br's merge appends $BC_ROW (the local write) to the export. Break:
# a machine path, a non-main checkout, an unpushed local commit, another dirty tracked file or a failed
# pull is still committed or pushed; main's export row or the local row is lost; a rejected push exits
# 0 or keeps its commit; the happy path does not reach origin.
printf '#!/bin/sh\n[ "$*" = "sync --merge" ] && echo "$BC_ROW" >> .beads/issues.jsonl\n' > "$tmp/mp/br"; chmod +x "$tmp/mp/br"
O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"; git clone -q "$O" . 2>/dev/null; git checkout -qb main
mkdir -p bin/lib docs .beads; cp "$bin/beads_checkpoint.sh" "$bin/check_beads_export.py" bin/; cp "$bin/lib/beads_sync.sh" bin/lib/; echo h > docs/HANDOFF.md
echo '{"id":"a","title":"one"}' > .beads/issues.jsonl; git add . && git commit -qm base && git push -q origin main
bc() { # <case> <row> <want-rc> <origin-must-hold or ->
  rc=0; BC_ROW=$2 PATH="$tmp/mp:$PATH" capped sh bin/beads_checkpoint.sh > "$tmp/mp/out" 2>&1 || rc=$?
  [ "$rc" = "$3" ] && { [ "$4" = - ] || git --git-dir="$O" show main:.beads/issues.jsonl | grep -q -- "$4"; } || { bad "beads_checkpoint $1: exit $rc"; sed 's/^/  /' "$tmp/mp/out"; }
  git --git-dir="$O" show main:.beads/issues.jsonl | grep -q -e /Users/ -e '"bad"' && bad "beads_checkpoint $1: a refused export reached origin"
  git checkout -q -- .beads/issues.jsonl
}
bc ok '{"id":"c","title":"two"}' 0 '"two"'
bc machine-path '{"id":"a","title":"/Users/x/y"}' 1 -
echo x > docs/x; git add docs/x; bc dirty '{"id":"a","title":"bad"}' 1 -; git reset -q; rm docs/x
git checkout -qb x; bc not-main '{"id":"a","title":"bad"}' 1 -; git checkout -q main
git clone -q "$O" "$R.o" 2>/dev/null; (cd "$R.o" && echo '{"id":"b","title":"main"}' >> .beads/issues.jsonl && git commit -qam m && git push -q origin main)
bc main-changed '{"id":"d","title":"local"}' 0 '"local"'; git --git-dir="$O" show main:.beads/issues.jsonl | grep -q '"main"' || bad 'beads_checkpoint main-changed: main row lost'
echo y > docs/HANDOFF.md; git commit -qam local; bc ahead '{"id":"a","title":"bad"}' 1 -
git --git-dir="$O" log main | grep -q local && bad 'beads_checkpoint ahead: pushed an unpushed local commit'; git reset -q --hard HEAD~1
(cd "$R.o" && git pull -q --ff-only origin main && echo n > docs/n.md && git add docs/n.md && git commit -qm n && git push -q origin main); echo z > docs/n.md; h=$(git rev-parse HEAD)
bc pull-fail '{"id":"a","title":"bad"}' 1 -; [ "$(git rev-parse HEAD)" = "$h" ] || bad 'beads_checkpoint pull-fail: committed after a failed pull'; rm docs/n.md
printf '#!/bin/sh\nexit 1\n' > "$O/hooks/pre-receive"; chmod +x "$O/hooks/pre-receive"
git pull -q --ff-only origin main; h=$(git rev-parse HEAD); echo h2 > docs/HANDOFF.md; rc=0; BC_ROW='{"id":"e","title":"three"}' PATH="$tmp/mp:$PATH" capped sh bin/beads_checkpoint.sh > "$tmp/mp/out" 2>&1 || rc=$?
[ "$rc" = 1 ] && [ "$(git rev-parse HEAD)" = "$h" ] && grep -q three .beads/issues.jsonl && grep -qx h2 docs/HANDOFF.md && grep -q 'rerun bin/beads_checkpoint.sh' "$tmp/mp/out" \
  || { bad "beads_checkpoint push-rejected: exit $rc, commit kept or files lost"; sed 's/^/  /' "$tmp/mp/out"; }
rm "$O/hooks/pre-receive"; git checkout -q -- .beads/issues.jsonl
bc push-rerun '{"id":"e","title":"three"}' 0 '"three"'

# --- ci_fail.sh --------------------------------------------------------------------------------
# Stub gh lists one failed run and serves a log with one failing line among noise. Break: the failing
# line is dropped, noise is printed, a red head exits 0, or a head with no failed run exits non-zero.
printf '#!/bin/sh\ncase $2 in list) [ -n "${CF_NONE-}" ] || echo "11 book-e2e" ;; view) printf "storybook\\trun\\t2026-10-24T19:08:39.39Z FAIL live--nell-shop play: no text\\nstorybook\\trun\\t2026-10-24T19:08:40Z npm warn noise\\n" ;; esac\n' > "$tmp/wc/gh"
rc=0; out=$(PATH="$tmp/wc:$PATH" capped sh "$W/bin/ci_fail.sh" abc 2>&1) || rc=$?
[ "$rc" = 1 ] && [ "$out" = "$(printf '== book-e2e (run 11)\nstorybook: FAIL live--nell-shop play: no text')" ] || bad "ci_fail: exit $rc, output: $out"
rc=0; CF_NONE=1 PATH="$tmp/wc:$PATH" capped sh "$W/bin/ci_fail.sh" abc > /dev/null 2>&1 || rc=$?
[ "$rc" = 0 ] || bad "ci_fail none: exit $rc, want 0"

# --- new_batch.sh --------------------------------------------------------------------------------
# A main checkout cloned from a bare origin; stub worktree_setup.sh records the worktree it set up.
# Break: the worktree is not under worktrees.noindex next to the main checkout, setup skips it, or
# the branch is not pushed with upstream.
O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(cd "$(mktemp -d)" && pwd -P); mkdir "$R/main"; cd "$R/main"
git clone -q "$O" . 2> /dev/null; git checkout -qb main; mkdir bin; cp "$bin/new_batch.sh" bin/
printf '#!/bin/sh
cd "$(dirname "$0")/.." && pwd -P > "$NB_LOG"
' > bin/worktree_setup.sh; chmod +x bin/worktree_setup.sh
git add . && git commit -qm base && git push -q origin main
wt=$R/worktrees.noindex/feat-x; rc=0; NB_LOG=$R/setup capped sh bin/new_batch.sh feat/x > "$R/out" 2>&1 || rc=$?
[ "$rc" = 0 ] && [ "$(cat "$R/setup" 2> /dev/null)" = "$wt" ] && [ "$(git -C "$wt" rev-parse --abbrev-ref '@{u}')" = origin/feat/x ] \
  && [ "$(git ls-remote origin feat/x | cut -f1)" = "$(git -C "$wt" rev-parse HEAD)" ] || { bad "new_batch: exit $rc, worktree, setup or upstream wrong"; cat "$R/out"; }

# --- push_slice.sh ----------------------------------------------------------------------------
# Break: the printed status is a pipe's (tail) instead of git push's, so a rejected push reads as green.
O=$(mktemp -d); git init -q --bare -b main "$O"; R=$(mktemp -d); cd "$R"
git clone -q "$O" . 2>/dev/null; git checkout -qb main; echo 1 > a.txt; git add a.txt; git commit -qm base; git push -q origin main
git checkout -qb slice; echo 2 > a.txt; git commit -qam slice
mkdir "$tmp/ps"; printf '#!/bin/sh\necho "$*" > "$GH_LOG"; echo ci\n' > "$tmp/ps/gh"; chmod +x "$tmp/ps/gh"
out=$(GH_LOG=$R.gh PATH="$tmp/ps:$PATH" sh "$bin/push_slice.sh" "$R" slice) && [ "$(echo "$out" | head -1)" = "PUSH_EXIT=0 $(git rev-parse slice)" ] || bad "push_slice: accepted push: $out"
# Break (loka-ivjq.19): the hosted runs are looked up by a short or wrong sha, or a run's status is misread.
case "$out" in *"ci: started"*"book-e2e: not started"*) ;; *) bad "push_slice: run status lines wrong: $out";; esac
grep -q -- "--commit $(git rev-parse slice) " "$R.gh" || bad "push_slice: gh was not asked for the full pushed sha: $(cat "$R.gh")"
git clone -q "$O" "$R.other" && git -C "$R.other" checkout -q slice && echo 3 > "$R.other/a.txt" && git -C "$R.other" commit -qam other && git -C "$R.other" push -q origin slice
echo 4 > a.txt; git commit -qam diverged
out=$(sh "$bin/push_slice.sh" "$R" slice) && bad "push_slice: a rejected push exited 0: $out"
case "$out" in PUSH_EXIT=0*) bad "push_slice: a rejected push printed PUSH_EXIT=0";; *started*) bad "push_slice: a rejected push reported runs";; PUSH_EXIT=*) ;; *) bad "push_slice: no PUSH_EXIT line: $out";; esac
out=$(sh "$bin/push_slice.sh" "$R" main 2>&1) || true  # the refusal exits 2; set -e must not stop here
case "$out" in *"is not the branch checked out"*) ;; *) bad "push_slice: pushed a branch that is not checked out in the worktree: $out";; esac
# --- .githooks/pre-push, format_on_edit.sh ----------------------------------------------------
# Break (loka-ivjq.19): a new commit whose message names a home or worktree path is pushed; a clean one is refused.
R=$(mktemp -d); cd "$R"; git init -q; mkdir bin; printf '#!/bin/sh\nexit 0\n' > bin/prepush.sh; chmod +x bin/prepush.sh; git add .
z=0000000000000000000000000000000000000000
for m in 'clean 0' 'see /Users/x/f 1' 'in worktrees.noindex/x 1'; do
  git commit -qm "${m% *}" --allow-empty; rc=0
  echo "refs/heads/x $(git rev-parse HEAD) refs/heads/x $z" | sh "$bin/../.githooks/pre-push" > /dev/null 2>&1 || rc=$?
  [ "$rc" = "${m##* }" ] || bad "pre-push: message '${m% *}': exit $rc, want ${m##* }"; git reset -q --hard HEAD~1 2> /dev/null || git update-ref -d HEAD
done
# Break: a new branch first in the push ends the scan, so a later ref's path-naming message is pushed.
git commit -qm clean --allow-empty; a=$(git rev-parse HEAD); git commit -qm 'see /Users/x/f' --allow-empty; rc=0
printf 'refs/heads/a %s refs/heads/a %s\nrefs/heads/b %s refs/heads/b %s\n' "$a" $z "$(git rev-parse HEAD)" $z | sh "$bin/../.githooks/pre-push" > /dev/null 2>&1 || rc=$?
[ "$rc" = 1 ] || bad "pre-push: a second ref's path-naming message: exit $rc, want 1"
# Same break when the earlier refs change code against a known remote sha, or name an unknown one.
git reset -q --hard "$a"; base=$a; echo g > g; git add g; git commit -qm code; c1=$(git rev-parse HEAD)
git commit -qm 'see /Users/x/f' --allow-empty; rc=0
printf 'refs/heads/a %s refs/heads/a %s\nrefs/heads/b %s refs/heads/b 1111111111111111111111111111111111111111\nrefs/heads/c %s refs/heads/c %s\n' "$c1" "$base" "$c1" "$(git rev-parse HEAD)" $z \
  | sh "$bin/../.githooks/pre-push" > /dev/null 2>&1 || rc=$?
[ "$rc" = 1 ] || bad "pre-push: a path-naming message after code and unknown-sha refs: exit $rc, want 1"
# Break (loka-36uz): the hook skips a failing prepush.sh for a sha other than $LOKA_PREPUSH_OK, or for a second ref with one.
git reset -q --hard "$c1"; printf '#!/bin/sh\nexit 1\n' > bin/prepush.sh
for m in "$c1 $c1 0" "$a $c1 1" "$c1 $c1,$a 1"; do
  set -- $m; rc=0
  for s in $(echo "$2" | tr , ' '); do echo "refs/heads/$s $s refs/heads/$s $z"; done | LOKA_PREPUSH_OK=$1 sh "$bin/../.githooks/pre-push" > /dev/null 2>&1 || rc=$?
  [ "$rc" = "$3" ] || bad "pre-push: LOKA_PREPUSH_OK=$1, pushing $2: exit $rc, want $3"
done
# Break (loka-ivjq.27): an edited TypeScript file over the size limit passes the edit hook silently, the check gets
# a path the size script cannot resolve from the repo root, or a non-TypeScript edit runs it.
mkdir "$tmp/fe"; printf '#!/bin/sh\nshift 2; echo "$*" >> "$FE_LOG"; case $* in *check_ts_size*) echo too-long; exit 1 ;; esac\n' > "$tmp/fe/mise"
chmod +x "$tmp/fe/mise"; mkdir sub; : > sub/x.ts; : > sub/x.json
fe() { rc=0; echo "{\"tool_input\":{\"file_path\":\"$R/sub/$1\"}}" | FE_LOG=$R.fe CLAUDE_PROJECT_DIR=$R PATH="$tmp/fe:$PATH" sh "$bin/format_on_edit.sh" > /dev/null 2> "$R.err" || rc=$?; }
fe x.ts; [ "$rc" = 2 ] && grep -q too-long "$R.err" && grep -qx 'node bin/check_ts_size.mjs sub/x.ts' "$R.fe" || bad "format_on_edit: oversize x.ts: exit $rc, log $(cat "$R.fe")"
: > "$R.fe"; fe x.json; [ "$rc" = 0 ] && ! grep -q check_ts_size "$R.fe" || bad "format_on_edit: x.json: exit $rc, log $(cat "$R.fe")"
exit $fail
