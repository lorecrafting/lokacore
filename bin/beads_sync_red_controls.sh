#!/bin/sh
# Real-br controls for bin/lib/beads_sync.sh (loka-ivjq.28), the Beads step of bin/after_merge.sh and
# bin/beads_checkpoint.sh. A bare origin; clone M stands for main (makes rows a, b, c, pushes); clone A is
# the integration checkout (.githooks active, loka.beads.integrationRoot set) and edits a's title to
# one-local. Each case names the break it catches; expected values are the literals set up here.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
command -v br > /dev/null || { echo 'beads_sync_red_controls: br is not on PATH' >&2; exit 1; }
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
bin=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
bad() { echo "FAIL $*"; fail=1; }
nb() { br --no-auto-import "$@"; } # a plain br command would import main's export over A's rows
row() { nb show "$1" --json | python3 -c 'import json,sys; r=json.load(sys.stdin)[0]; print(r["title"], r["priority"])'; }
has() { grep -q "\"title\":\"$1\"" "$A/.beads/issues.jsonl" || { bad "$2: export lacks $1"; }; }
mk() { # fresh origin, M and A; A's database imported and flushed (the merge base), then a edited
  cd "$tmp" && rm -rf O M A && git init -q --bare -b main O && git clone -q O M 2>/dev/null && cd M && git checkout -qb main
  mkdir -p bin && cp -R "$bin/../.githooks" . && cp "$bin/beads_after_git.py" bin/
  br init --prefix t > /dev/null; a=$(br create --silent one); b=$(br create --silent two); c=$(br create --silent three)
  br sync --flush-only > /dev/null; git add . && git commit -qm base && git push -q origin main
  cd "$tmp" && git clone -q O A 2>/dev/null && cd A && git config core.hooksPath .githooks && git config loka.beads.integrationRoot "$(pwd -P)"
  br sync --import-only > /dev/null && br sync --flush-only > /dev/null; A=$tmp/A
  br update "$a" --title one-local ${1-} > /dev/null
}
push_m() { (cd "$tmp/M" && "$@" > /dev/null && git commit -qam m && git push -q origin main); }
sync() { # <case> <want-rc>: run beads_sync in A; $0 is this script so the lib finds bin/
  rc=0; (cd "$A" && sh -c 'die() { echo "$*" >&2; exit 1; }; . "$(dirname "$0")/lib/beads_sync.sh"; beads_sync' "$bin/x") > "$tmp/out" 2>&1 || rc=$?
  [ "$rc" = "$2" ] || { bad "$1: exit $rc, want $2"; sed 's/^/  /' "$tmp/out"; }
}

# Common case. Break: main's moved export makes the step refuse, or a row from either side is lost.
mk; push_m sh -c "br update $b --title two-main && br create --silent four"
sync common 0
for t in one-local two-main three four; do has "$t" common; done
[ "$(cd "$A" && git status --porcelain)" = ' M .beads/issues.jsonl' ] || bad 'common: more than the export dirty'
# (a) Died after the sync (nothing committed), rerun with main unchanged. Break: HEAD's older export is
# swapped in front of the base the first merge advanced, so the rerun refuses with AmbiguousBase.
cp "$A"/.beads/issues.jsonl "$tmp/first"
sync rerun 0
cmp -s "$A"/.beads/issues.jsonl "$tmp/first" && ! grep -q AmbiguousBase "$tmp/out" || bad 'rerun: export changed or AmbiguousBase'

# (b) Same row edited on both sides. Break: the step overwrites one side (--force-db, or the post-merge
# hook importing main's row first), or writes before refusing, or the printed steps lose a row.
mk; push_m sh -c "br update $a --priority 0 && br update $b --title two-main"
base=$(cksum < "$A"/.beads/beads.base.jsonl)
sync same-row 1
grep -q "$a: BothModified" "$tmp/out" && grep -q 'refused: main is fast-forwarded' "$tmp/out" || { bad 'same-row: no row id or message'; cat "$tmp/out"; }
[ "$(row "$a")" = 'one-local 2' ] || bad "same-row: database row a is $(row "$a")"
[ "$(cksum < "$A"/.beads/beads.base.jsonl)" = "$base" ] || bad 'same-row: base changed'
[ "$(cd "$A" && git rev-parse HEAD)" = "$(cd "$A" && git rev-parse origin/main)" ] || bad 'same-row: main not fast-forwarded'
# Follow the printed steps literally: compare, keep this checkout's rows, rerun.
(cd "$A" && eval "$(sed -n "s/^Compare a row: \([^;]*\);.*/\1/p" "$tmp/out" | sed "s/<id>/$a/")" > /dev/null && br sync --merge --force-db > /dev/null)
sync same-row-rerun 0
[ "$(row "$a")" = 'one-local 2' ] && [ "$(row "$b")" = 'two-main 2' ] || bad "same-row after --force-db: a=$(row "$a") b=$(row "$b")"
has one-local same-row-rerun; has two-main same-row-rerun

# (c) The database never imported main's last pull (the hook refused: a was edited without a flush), then
# main moved again. Break: the base is rebuilt from HEAD's export, which drops main's two-main.
mk --no-auto-flush; push_m br update "$b" --title two-main
(cd "$A" && git pull -q --ff-only origin main) > "$tmp/hook" 2>&1
grep -q 'unexported local changes' "$tmp/hook" || { bad 'base: the hook imported (setup)'; cat "$tmp/hook"; }
push_m br update "$c" --title three-main
sync base 0
for t in one-local two-main three-main; do has "$t" base; done
exit $fail
