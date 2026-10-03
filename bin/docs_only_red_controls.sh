#!/bin/sh
# Plant commits in a throwaway repo and require bin/docs_only.sh to say what is expected.
set -eu
# A git hook exports GIT_DIR and friends: without this the plants would land in the real repository.
unset $(env | sed -n 's/^\(GIT_[A-Z_]*\)=.*/\1/p')
script=$(cd "$(dirname "$0")" && pwd)/docs_only.sh
d=$(mktemp -d)
trap 'rm -rf "$d"' EXIT
cd "$d"
git init -q
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t # no git config writes
mkdir docs
touch a.md docs/x.md docs/features.json docs/features.gen.md
seq 20 > code.ts
git add . && git commit -qm base
c() { git commit -qam "$1" && git rev-parse HEAD; }
base=$(git rev-parse HEAD)
echo 1 >> a.md && echo 1 >> docs/x.md; md=$(c md)
echo 1 >> a.md && echo 1 >> docs/features.json; json=$(c json)
echo 1 >> docs/features.gen.md; git add -A; gen=$(c gen)
git mv code.ts code.md; ren=$(c rename)
git checkout -q -b other "$base"
echo 2 >> a.md; other=$(c other)
git checkout -q -
fail=0
t() { got=$("$script" "$2" "$3"); [ "$got" = "$1" ] || { echo "FAIL docs_only $4: want $1, got $got"; fail=1; }; }
t skip "$base" "$md" "only .md changed"
t run "$md" "$json" "a .json under docs/ changed"
t run "$base" "$json" "md and json in range"
t run "$json" "$gen" "a .gen.md changed"
t run "$gen" "$ren" "a code file renamed to .md"
t run "" "$md" "no before"
t run "$other" "$md" "before not an ancestor"
t run "$md" "$md" "empty diff"
# bin/ci_base.sh: a fake gh answers one run with three green jobs, and fails at call $FAIL_AT.
ci=$(dirname "$script")/ci_base.sh
printf '%s\n' '#!/bin/sh' 'n=$(cat "$CNT" 2>/dev/null || echo 0); echo $((n + 1)) > "$CNT"' \
  '[ "$((n + 1))" = "${FAIL_AT-0}" ] && exit 1' \
  'case $2 in */jobs) echo 3 ;; *) echo 7 ;; esac' > fakegh
chmod +x fakegh
b() { rm -f cnt; got=$(GH=$PWD/fakegh CNT=$PWD/cnt REPO=o/r FAIL_AT=$2 "$ci" "$ren"); [ "$got" = "$1" ] || { echo "FAIL ci_base $3: want '$1', got '$got'"; fail=1; }; }
b "$gen" 0 "no error: the parent"
b "" 1 "error listing runs"
b "" 2 "error reading jobs"
[ "$fail" = 0 ] && echo "ok   docs_only: skip for .md only, run otherwise"
exit "$fail"
