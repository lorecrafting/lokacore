#!/bin/sh
# bin/merge_resolve.py (bin/pm_merge.sh) resolves a mechanics.md tail, a kernel_api line and a
# generated-file conflict, and leaves a conflict in a TypeScript source unresolved.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
src=$(cd "$(dirname "$0")/.." && pwd)
t=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$t"' EXIT
export MISE_TRUSTED_CONFIG_PATHS="$t/r"
git clone -q --shared "$src" "$t/r"
cd "$t/r"
cp "$src/bin/merge_resolve.py" bin/ # the working copy under test
g() { git -c user.name=t -c user.email=t@t -c merge.conflictStyle=merge "$@"; }
fail() { echo "merge_resolve control failed: $*" >&2; exit 1; }
m=docs/system/mechanics.md w=kernel/ts/src/runtime/world.ts s=docs/system-graph.gen.json f=kernel/ts/src/runtime/fresh.ts
base=$(git rev-parse HEAD)
side() { # <branch> <section> <kernel_api>
  g checkout -q -b "$1" "$base"
  printf '\n## %s\n\n%s text\n' "$2" "$2" >> $m
  perl -pi -e "s/kernel_api: '[0-9.]+'/kernel_api: '$3'/" $w
  echo "$1" > $s
  g commit -qam "$1"
}
side a A 1.9
side b B 1.10
{ git show "$base:$m"; printf '\n## A\n\nA text\n\n## B\n\nB text\n'; } > "$t/expected.md"
g checkout -q a
g merge -q b >/dev/null 2>&1 && fail 'the sides did not conflict'
python3 bin/merge_resolve.py >/dev/null || fail 'additive conflicts not resolved'
cmp -s $m "$t/expected.md" || fail 'mechanics.md tail is not ours then theirs'
grep -q "kernel_api: '1.10'," $w || fail 'kernel_api is not the higher version'
mise exec -- elixir bin/contracts.exs --check >/dev/null || fail "$s not regenerated"
[ -z "$(git diff --name-only --diff-filter=U)" ] || fail 'a file is left unmerged'
g merge --abort
g checkout -q -b c "$base" && echo '// c' > $f && g commit -qam c
g checkout -q -b d "$base" && echo '// d' > $f && g commit -qam d
g merge -q c >/dev/null 2>&1 && fail 'the sides did not conflict'
python3 bin/merge_resolve.py >/dev/null && fail "a conflict in $f was resolved"
[ "$(git diff --name-only --diff-filter=U)" = $f ] || fail "$f is not left unmerged"
echo 'merge_resolve controls: ok'
