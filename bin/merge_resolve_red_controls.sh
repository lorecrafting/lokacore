#!/bin/sh
# bin/merge_resolve.py (bin/pm_merge.sh) resolves a mechanics.md tail (a section both sides appended
# kept once), a kernel_api line and a generated-file conflict (a hash fixture included), and leaves unresolved: a tail that
# repeats a `## ` heading or gives one heading two bodies, a conflict in the middle of mechanics.md, a review record that differs
# beyond whitespace, an edit of the last mechanics.md line, a conflict in a TypeScript source and one in a hand-kept hash fixture.
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
m=docs/system/mechanics.md w=kernel/ts/src/runtime/world.ts s=docs/system-graph.gen.json hf=protocol/fixtures/cartridge_gate_hash.json f=kernel/ts/src/runtime/fresh.ts
base=$(git rev-parse HEAD)
side() { # <branch> <section> <kernel_api>
  g checkout -q -b "$1" "$base"
  printf '\n## Shared\n\nshared line\n\n## %s\n\n%s text\n' "$2" "$2" >> $m
  perl -pi -e "s/kernel_api: '[0-9.]+'/kernel_api: '$3'/" $w
  echo "$1" > $s
  echo "{\"side\": \"$1\"}" > $hf
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
[ "$(cat $hf)" = '{"side": "b"}' ] || fail "$hf (a regenerated family) is not theirs"
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
base_md=$t/base.md; git show "$base:$m" > "$base_md"
pair dup 's/\z/\n## X\n\nx\n\n## Dup\n\nd\n/' 's/\z/\n## Dup\n\ne\n/'
left 'a repeated heading' $m
h=$(grep -m1 '^## ' "$base_md" | head -1)
pair early "s/\\z/\\n$h\\n\\nx\\n/" 's/\z/\n## Y\n\ny\n/'
left 'a heading repeated from earlier in the file' $m
pair body 's/\z/\n## Same\n\nd\n/' 's/\z/\n## Same\n\ne\n/'
left 'one heading with two bodies' $m
pair mid 's/\n/\nmid one\n/' 's/\n/\nmid two\n/'
left 'a conflict in the middle of mechanics.md' $m
r=docs/reviews/zz-record.md ws=docs/reviews/zz-spaces.md fold=docs/reviews/zz-fold.md
for i in 1 2; do g checkout -q -b "rev$i" "$base"; echo "verdict $i" > $r; printf 'same%*s text\n' $i '' > $ws; if [ $i = 1 ]; then printf '# T\nbody\n' > $fold; else printf '# T body\n' > $fold; fi; git add $r $ws $fold; g commit -qm "rev$i"; done
g merge -q rev1 >/dev/null 2>&1 && fail 'the review records did not conflict'
left 'a review record' "$fold $r $ws"
[ "$out" = "unresolved: $fold $r" ] || fail "$ws (whitespace only) not taken: $out"
edit() { g checkout -q -b "$1" "$base" && echo "// $1" > $f && perl -0pi -e "s/[^\n]*\n\z/$1\n/" $m && g commit -qam "$1"; }
edit c
edit d
g merge -q c >/dev/null 2>&1 && fail 'the sides did not conflict'
python3 "$src/bin/merge_resolve.py" >/dev/null && fail "an edit of $m or a conflict in $f was resolved"
[ "$(git diff --name-only --diff-filter=U | tr '\n' ' ')" = "$m $f " ] || fail "$m and $f are not left unmerged"
g merge --abort
for k in capability_lock sampler_v010; do # kept by hand, frozen: theirs would silently drop ours; one merge each, as one left file keeps the other
  hk=protocol/fixtures/${k}_hash.json
  for i in 1 2; do g checkout -q -b "$k$i" "$base"; echo "{\"side\": $i}" > $hk; g commit -qam "$k$i"; done
  g merge -q ${k}1 >/dev/null 2>&1 && fail "$hk did not conflict"
  left "a hand-kept or frozen hash fixture" $hk
done
# Both sides add at one spot (a section, a table row): ours then theirs, the result valid.
ap() { # <name> <file> <perl edit of the file for side 1> <for side 2>: merges two branches from base, expecting a conflict
  for i in 1 2; do eval "e=\$$((i + 2))"; g checkout -q -b "$1$i" "$base"; perl -0pi -e "$e" "$2"; g commit -qam "$1$i"; done
  if g merge -q "${1}1" >/dev/null 2>&1; then fail "$1: the sides did not conflict"; fi
}
unions() { # <name> <file> <expected file>: the resolver resolves and the file equals the expected one
  python3 "$src/bin/merge_resolve.py" >/dev/null || fail "$1: not resolved"
  cmp -s "$2" "$3" || fail "$1: $2 is not ours then theirs"
  g merge --abort
}
ap sect $m 's/\n## /\n## Mid A\n\nA text\n\n## /' 's/\n## /\n## Mid B\n\nB text\n\n## /'
git show "$base:$m" | perl -0pe 's/\n## /\n## Mid B\n\nB text\n\n## Mid A\n\nA text\n\n## /' > "$t/expected.md"
unions 'two sections at one spot' $m "$t/expected.md"
tb=docs/MECHANICS-TOOLBOX.md
ap rows $tb 's/(\n\| 1 \|[^\n]*\n)/$1| ZA | M9 | row a | x | S | – | x | x | open |\n/' 's/(\n\| 1 \|[^\n]*\n)/$1| ZB | M9 | row b | x | S | – | x | x | open |\n/'
git show "$base:$tb" | perl -0pe 's/(\n\| 1 \|[^\n]*\n)/$1| ZB | M9 | row b | x | S | – | x | x | open |\n| ZA | M9 | row a | x | S | – | x | x | open |\n/' > "$t/expected.tb"
unions 'two table rows at one spot' $tb "$t/expected.tb"
ap inner $m 's/(\n## [^\n]*\n\n)/$1## Mid A\n\nA text\n\n/' 's/(\n## [^\n]*\n\n)/$1## Mid B\n\nB text\n\n/'
left 'two sections inside another section' $m
ap rowid $tb 's/(\n\| 1 \|[^\n]*\n)/$1| ZZ | M9 | row a | x | S | – | x | x | open |\n/' 's/(\n\| 1 \|[^\n]*\n)/$1| ZZ | M9 | row b | x | S | – | x | x | open |\n/'
left 'one row id on both sides' $tb
ap lvl $m 's/\n## /\n## Mid A\n\nA text\n\n## /' 's/\n## /\n### Mid B\n\nB text\n\n## /'
left 'a ### section beside a ## section' $m
ap lvl2 $m 's/\n## /\n### Mid B\n\nB text\n\n## Mid A\n\nA text\n\n## /' 's/\n## /\n### Mid C\n\nC text\n\n## /'
left 'a ### then a ## section beside a ### section' $m
ap shape $tb 's/(\n\| 1 \|[^\n]*\n)/$1|ZA| row a\n/' 's/(\n\| 1 \|[^\n]*\n)/$1| ZB | M9 | row b | x | S | – | x | x | open |\n/'
left 'a line that is not a table row' $tb
echo 'merge_resolve controls: ok'
