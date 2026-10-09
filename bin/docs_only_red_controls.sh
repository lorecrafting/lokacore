#!/bin/sh
# Plant commits in a throwaway repo and require the CI scope selector to reject unsafe skips.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
script=$(cd "$(dirname "$0")" && pwd)/ci_scope.sh
d=$(mktemp -d)
trap 'rm -rf "$d"' EXIT
cd "$d"
git init -q
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t # no git config writes
mkdir -p docs mobile/authority/local-story mobile/app/book mobile/app/plugins mobile/app/tests .beads
mkdir -p kernel/ts/src kernel/ts/test mobile/packages/game-view
touch kernel/ts/src/k.ts kernel/ts/test/k.test.ts kernel/ts/test/differential_peer.ts a.md docs/x.md docs/features.json docs/features.gen.md .beads/issues.jsonl mobile/app/plugins/p.js mobile/app/tests/steps.ts mobile/app/App.tsx mobile/app/book/Page.tsx mobile/app/book/model.ts mobile/authority/local-story/store.ts mobile/app/package.json mobile/packages/game-view/session.ts
seq 20 > code.ts
git add . && git commit -qm base
c() { git commit -qam "$1" && git rev-parse HEAD; }
base=$(git rev-parse HEAD)
echo 1 >> a.md && echo 1 >> docs/x.md; md=$(c md)
echo 1 >> .beads/issues.jsonl; beads=$(c beads)
echo 1 >> mobile/app/plugins/p.js; book=$(c book)
echo 1 >> mobile/authority/local-story/store.ts; authority=$(c authority)
echo 1 >> mobile/app/book/model.ts; model=$(c model)
echo 1 >> mobile/app/book/Page.tsx; page=$(c page)
echo 1 >> mobile/app/App.tsx; app=$(c app)
echo 1 >> mobile/app/tests/steps.ts; steps=$(c steps)
echo 1 >> a.md && echo 1 >> docs/features.json; json=$(c json)
echo 1 >> docs/features.gen.md; git add -A; gen=$(c gen)
git mv code.ts code.md; ren=$(c rename)
echo 1 >> kernel/ts/test/k.test.ts && echo 1 >> a.md; tests=$(c tests)
echo 1 >> kernel/ts/test/differential_peer.ts; peer=$(c peer)
echo 1 >> kernel/ts/src/k.ts; src=$(c src)
echo 1 >> mobile/app/package.json; pkg=$(c pkg)
echo 1 >> mobile/packages/game-view/session.ts; gv=$(c gv)
git checkout -q -b other "$base"
echo 2 >> a.md; other=$(c other)
git checkout -q -
fail=0
t() { got=$("$script" "$2" "$3" "$4"); [ "$got" = "$1" ] || { echo "FAIL ci_scope $5: want $1, got $got"; fail=1; }; }
t skip "$base" "$md" code "only .md changed"
t skip "$md" "$beads" code "Beads export changed"
t skip "$beads" "$book" code "app plugin-only change skips kernel jobs"
t run "$beads" "$book" browser "app plugin-only change runs browser"
t skip "$base" "$beads" browser "metadata skips browser"
# Break: treating local-story save changes as app-only skips broad code checks.
t run "$book" "$authority" code "local-story save change runs code"
t run "$book" "$authority" browser "local-story save change runs browser"
# Break: Book model/presenter (imported by kernel tests) classified as app-only skips typescript.
t run "$authority" "$model" code "Book model.ts change runs code"
t run "$model" "$page" code "Book .tsx change runs code"
t run "$page" "$app" code "App.tsx (run by chapter.test.ts) runs code"
t run "$app" "$steps" code "e2e helper tests/steps.ts runs code (size gate)"
t run "$authority" "$json" code "a .json under docs/ changed"
t run "$base" "$json" code "mixed source and metadata in range"
t run "$json" "$gen" code "a .gen.md changed"
t run "$gen" "$ren" code "a code file renamed to .md"
t run "" "$md" code "no before"
t run "$other" "$md" code "before not an ancestor"
t run "$md" "$md" code "empty diff"
# Break: a classifier error (awk exits 2) reads as skip.
mkdir fakebin; printf '#!/bin/sh\nexit 2\n' > fakebin/awk; chmod +x fakebin/awk
got=$(PATH="$PWD/fakebin:$PATH" "$script" "$base" "$md" code); [ "$got" = run ] || { echo "FAIL ci_scope classifier error: want run, got $got"; fail=1; }
# Break: the pre-push elixir lane skips mix test for a peer Elixir tests run, or for kernel source.
t skip "$ren" "$tests" elixir "only *.test.ts and .md changed"
t run "$ren" "$tests" code "*.test.ts still runs the code lane"
t run "$tests" "$peer" elixir "a kernel/ts/test peer changed"
t run "$peer" "$src" elixir "kernel source changed"
t run "$ren" "$src" elixir "test plus source in range"
# Break: the pre-push Storybook smoke skips a Book change or runs for a kernel-only one.
t run "$model" "$page" storybook "Book .tsx change runs Storybook smoke"
t skip "$peer" "$src" storybook "kernel-only change skips Storybook smoke"
t run "$src" "$pkg" storybook "app package.json change runs Storybook smoke"
t run "$pkg" "$gv" storybook "game-view change runs Storybook smoke"
[ "$fail" = 0 ] && echo "ok   ci_scope: metadata and Book lanes, conservative fallback"
exit "$fail"
