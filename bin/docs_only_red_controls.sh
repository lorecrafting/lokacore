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
git config user.email t@t && git config user.name t
mkdir docs
touch a.md docs/x.md docs/features.json
git add . && git commit -qm base
c() { git commit -qam "$1" && git rev-parse HEAD; }
base=$(git rev-parse HEAD)
echo 1 >> a.md && echo 1 >> docs/x.md; md=$(c md)
echo 1 >> a.md && echo 1 >> docs/features.json; json=$(c json)
git checkout -q -b other "$base"
echo 2 >> a.md; other=$(c other)
git checkout -q -
fail=0
t() { got=$("$script" "$2" "$3"); [ "$got" = "$1" ] || { echo "FAIL docs_only $4: want $1, got $got"; fail=1; }; }
t skip "$base" "$md" "only .md changed"
t run "$md" "$json" "a .json under docs/ changed"
t run "$base" "$json" "md and json in range"
t run "" "$md" "no before"
t run "$other" "$md" "before not an ancestor"
t run "$md" "$md" "empty diff"
[ "$fail" = 0 ] && echo "ok   docs_only: skip for .md only, run otherwise"
exit "$fail"
