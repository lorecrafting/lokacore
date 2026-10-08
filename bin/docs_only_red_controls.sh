#!/bin/sh
# Plant commits in a throwaway repo and require the CI scope selector to reject unsafe skips.
set -eu
# A git hook exports GIT_DIR and friends: without this the plants would land in the real repository.
unset $(env | sed -n 's/^\(GIT_[A-Z_]*\)=.*/\1/p')
script=$(cd "$(dirname "$0")" && pwd)/ci_scope.sh
d=$(mktemp -d)
trap 'rm -rf "$d"' EXIT
cd "$d"
git init -q
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t # no git config writes
mkdir -p docs mobile/authority/local-story .beads
mkdir -p kernel/ts/src kernel/ts/test
touch kernel/ts/src/k.ts kernel/ts/test/k.test.ts kernel/ts/test/differential_peer.ts a.md docs/x.md docs/features.json docs/features.gen.md .beads/issues.jsonl mobile/view.tsx mobile/authority/local-story/store.ts
seq 20 > code.ts
git add . && git commit -qm base
c() { git commit -qam "$1" && git rev-parse HEAD; }
base=$(git rev-parse HEAD)
echo 1 >> a.md && echo 1 >> docs/x.md; md=$(c md)
echo 1 >> .beads/issues.jsonl; beads=$(c beads)
echo 1 >> mobile/view.tsx; book=$(c book)
echo 1 >> mobile/authority/local-story/store.ts; authority=$(c authority)
echo 1 >> a.md && echo 1 >> docs/features.json; json=$(c json)
echo 1 >> docs/features.gen.md; git add -A; gen=$(c gen)
git mv code.ts code.md; ren=$(c rename)
echo 1 >> kernel/ts/test/k.test.ts && echo 1 >> a.md; tests=$(c tests)
echo 1 >> kernel/ts/test/differential_peer.ts; peer=$(c peer)
echo 1 >> kernel/ts/src/k.ts; src=$(c src)
git checkout -q -b other "$base"
echo 2 >> a.md; other=$(c other)
git checkout -q -
fail=0
t() { got=$("$script" "$2" "$3" "$4"); [ "$got" = "$1" ] || { echo "FAIL ci_scope $5: want $1, got $got"; fail=1; }; }
t skip "$base" "$md" code "only .md changed"
t skip "$md" "$beads" code "Beads export changed"
t skip "$beads" "$book" code "Book-only change skips kernel jobs"
t run "$beads" "$book" browser "Book-only change runs browser"
t skip "$base" "$beads" browser "metadata skips browser"
# Break: treating local-story save changes as app-only skips broad code checks.
t run "$book" "$authority" code "local-story save change runs code"
t run "$book" "$authority" browser "local-story save change runs browser"
t run "$authority" "$json" code "a .json under docs/ changed"
t run "$base" "$json" code "mixed source and metadata in range"
t run "$json" "$gen" code "a .gen.md changed"
t run "$gen" "$ren" code "a code file renamed to .md"
t run "" "$md" code "no before"
t run "$other" "$md" code "before not an ancestor"
t run "$md" "$md" code "empty diff"
# Break: the pre-push elixir lane skips mix test for a peer Elixir tests run, or for kernel source.
t skip "$ren" "$tests" elixir "only *.test.ts and .md changed"
t run "$ren" "$tests" code "*.test.ts still runs the code lane"
t run "$tests" "$peer" elixir "a kernel/ts/test peer changed"
t run "$peer" "$src" elixir "kernel source changed"
t run "$ren" "$src" elixir "test plus source in range"
# bin/ci_base.sh: a fake gh applies the real jq predicate to controlled job records.
ci=$(dirname "$script")/ci_base.sh
cat > fakegh <<'SH'
#!/bin/sh
n=$(cat "$CNT" 2>/dev/null || echo 0)
echo $((n + 1)) > "$CNT"
[ "$((n + 1))" = "${FAIL_AT-0}" ] && exit 1
case $2 in
  */jobs) case $ANSWER in
    browser) json='{"jobs":[{"name":"browser","conclusion":"success"}]}' ;;
    skipped) json='{"jobs":[{"name":"browser","conclusion":"skipped"}]}' ;;
    failed) json='{"jobs":[{"name":"browser","conclusion":"failure"}]}' ;;
    recorderfailed) json='{"jobs":[{"name":"elixir","conclusion":"success"},{"name":"typescript","conclusion":"success"},{"name":"sim","conclusion":"success"},{"name":"e1-recorder","conclusion":"failure"}]}' ;;
    *) json='{"jobs":[{"name":"elixir","conclusion":"success"},{"name":"typescript","conclusion":"success"},{"name":"sim","conclusion":"success"},{"name":"e1-recorder","conclusion":"success"}]}' ;;
  esac ;;
  *) json='{"workflow_runs":[{"id":7}]}' ;;
esac
printf '%s\n' "$json" | jq -r "$4"
SH
chmod +x fakegh
b() { rm -f cnt; got=$(GH=$PWD/fakegh CNT=$PWD/cnt REPO=o/r FAIL_AT=$2 ANSWER=${5-$3} "$ci" "$ren" "$3"); [ "$got" = "$1" ] || { echo "FAIL ci_base $4: want '$1', got '$got'"; fail=1; }; }
b "$gen" 0 code "code jobs green on parent"
b "" 1 code "error listing runs"
b "" 2 code "error reading jobs"
b "" 0 code "failed recorder is not a green baseline" recorderfailed
b "$gen" 0 browser "browser green on parent"
b "" 2 browser "browser API error"
b "" 0 browser "skipped browser is not a green baseline" skipped
b "" 0 browser "failed browser is not a green baseline" failed
[ "$fail" = 0 ] && echo "ok   ci_scope: metadata and Book lanes, conservative fallback"
exit "$fail"
