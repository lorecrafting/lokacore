#!/bin/sh
# bin/merge_resolve.py (bin/pm_merge.sh) resolves a mechanics.md tail (a section both sides appended
# kept once), a kernel_api line and a generated-file conflict, and leaves unresolved: a tail that
# repeats a `## ` heading, a conflict in the middle of mechanics.md, a review record that differs
# beyond whitespace, an edit of the last mechanics.md line and a conflict in a TypeScript source.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
src=$(cd "$(dirname "$0")/.." && pwd)
t=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$t"' EXIT
export MISE_TRUSTED_CONFIG_PATHS="$t/r"
git clone -q --shared "$src" "$t/r"
cd "$t/r"
g() { git -c user.name=t -c user.email=t@t -c merge.conflictStyle=diff3 "$@"; }
fail() { echo "merge_resolve control failed: $*" >&2; exit 1; }
m=docs/system/mechanics.md w=kernel/ts/src/runtime/world.ts s=docs/system-graph.gen.json f=kernel/ts/src/runtime/fresh.ts
base=$(git rev-parse HEAD)
side() { # <branch> <section> <kernel_api>
  g checkout -q -b "$1" "$base"
  printf '\n## Shared\n\nshared line\n\n## %s\n\n%s text\n' "$2" "$2" >> $m
  perl -pi -e "s/kernel_api: '[0-9.]+'/kernel_api: '$3'/" $w
  echo "$1" > $s
  g commit -qam "$1"
}
side a A 1.9
side b B 1.10
{ git show "$base:$m"; printf '\n## Shared\n\nshared line\n\n## A\n\nA text\n\n## B\n\nB text\n'; } > "$t/expected.md"
g checkout -q a
g merge -q b >/dev/null 2>&1 && fail 'the sides did not conflict'
python3 "$src/bin/merge_resolve.py" >/dev/null || fail 'additive conflicts not resolved'
cmp -s $m "$t/expected.md" || fail 'mechanics.md tail is not ours then theirs'
grep -q "kernel_api: '1.10'," $w || fail 'kernel_api is not the higher version'
mise exec -- elixir bin/contracts.exs --check >/dev/null || fail "$s not regenerated"
[ -z "$(git diff --name-only --diff-filter=U)" ] || fail 'a file is left unmerged'
g merge --abort
pair() { # <name> <perl edit of mechanics.md for side 1> <for side 2>: merges two branches from base
  for i in 1 2; do eval "e=\$$((i + 1))"; g checkout -q -b "$1$i" "$base"; perl -0pi -e "$e" $m; g commit -qam "$1$i"; done
  if g merge -q "${1}1" >/dev/null 2>&1; then fail "$1: the sides did not conflict"; fi
}
left() { # <name> <expected unmerged files>: the resolver exits 1 and leaves exactly those
  out=$(python3 "$src/bin/merge_resolve.py") && fail "$1: resolved"
  [ "$(git diff --name-only --diff-filter=U | tr '\n' ' ')" = "$2 " ] || fail "$1: not left unmerged: $2"
  g merge --abort
}
pair dup 's/\z/\n## X\n\nx\n\n## Dup\n\nd\n/' 's/\z/\n## Dup\n\ne\n/'
left 'a repeated heading' $m
pair mid 's/\n/\nmid one\n/' 's/\n/\nmid two\n/'
left 'a conflict in the middle of mechanics.md' $m
r=docs/reviews/zz-record.md ws=docs/reviews/zz-spaces.md
for i in 1 2; do g checkout -q -b "rev$i" "$base"; echo "verdict $i" > $r; printf 'same%*s text\n' $i '' > $ws; git add $r $ws; g commit -qm "rev$i"; done
g merge -q rev1 >/dev/null 2>&1 && fail 'the review records did not conflict'
left 'a review record' "$r $ws"
[ "$out" = "unresolved: $r" ] || fail "$ws (whitespace only) not taken: $out"
edit() { g checkout -q -b "$1" "$base" && echo "// $1" > $f && perl -0pi -e "s/[^\n]*\n\z/$1\n/" $m && g commit -qam "$1"; }
edit c
edit d
g merge -q c >/dev/null 2>&1 && fail 'the sides did not conflict'
python3 "$src/bin/merge_resolve.py" >/dev/null && fail "an edit of $m or a conflict in $f was resolved"
[ "$(git diff --name-only --diff-filter=U | tr '\n' ' ')" = "$m $f " ] || fail "$m and $f are not left unmerged"
echo 'merge_resolve controls: ok'
