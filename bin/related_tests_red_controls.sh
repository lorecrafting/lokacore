#!/bin/sh
# Red controls for bin/related_tests.sh: a throwaway git repo with a stub `node` on PATH, no real test
# runs (loka-4ks2l). Only checks the selection and the exit status; the run itself is a real node.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
bin=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }
git init -q "$tmp/r" && cd "$tmp/r"
mkdir -p kernel/ts/test kernel/ts/play kernel/ts/node_modules
printf '#!/bin/sh\nexit 0\n' > kernel/ts/node_modules/.keep
# The stub fails only the test named in $RED, so the selection is what the control checks, not node.
mkdir -p "$tmp/stub"
printf '#!/bin/sh\nfor a; do [ "$a" = "$RED" ] && exit 1; done\nexit 0\n' > "$tmp/stub/node"
chmod +x "$tmp/stub/node"
printf 'x\n' > kernel/ts/play/write.ts
printf 'x\n' > kernel/ts/test/write.test.ts
# Names the source by path, as editor_routes.test.ts names write.ts: caught without an import.
printf "readFileSync('kernel/ts/play/write.ts')\n" > kernel/ts/test/editor_routes.test.ts
printf 'x\n' > kernel/ts/test/card.test.ts
git add -A . && git -c user.name=t -c user.email=t@t commit -qm base
# The script diffs from origin/main, as a branch of the real repo does.
git update-ref refs/remotes/origin/main HEAD
git checkout -q -b work
printf 'y\n' > kernel/ts/play/write.ts
git -c user.name=t -c user.email=t@t commit -qam "a route with no ROUTES row"
# Break 1: the file that names the changed source is not run, so a route with no row passes (PR #707).
out=$(RED=test/none PATH="$tmp/stub:$PATH" sh "$bin/related_tests.sh" . 2>&1) || bad "green run exit: $out"
printf '%s\n' "$out" | grep -q 'test/editor_routes.test.ts' || { bad 'the test naming the source is not selected'; printf '%s\n' "$out"; }
printf '%s\n' "$out" | grep -qx RELATED_TESTS_ok || { bad 'not ok with a stub node that passes'; printf '%s\n' "$out"; }
# Break 2: red does not dock the push.
out=$(RED=test/editor_routes.test.ts PATH="$tmp/stub:$PATH" sh "$bin/related_tests.sh" . 2>&1) && bad 'a red file exited 0'
printf '%s\n' "$out" | grep -q 'FAIL test/editor_routes.test.ts' || { bad 'a red file is not named FAIL'; printf '%s\n' "$out"; }
printf '%s\n' "$out" | grep -qx RELATED_TESTS_fail || { bad 'no RELATED_TESTS_fail'; printf '%s\n' "$out"; }
# Break 3: a diff that touches no kernel/ts file runs nothing (the whole suite is CI's job).
git update-ref refs/remotes/origin/main HEAD
printf 'z\n' > docs-note.md
git add -A . && git -c user.name=t -c user.email=t@t commit -qm docs
out=$(sh "$bin/related_tests.sh" . 2>&1) || bad "no-kernel-diff exit: $out"
printf '%s\n' "$out" | grep -qx RELATED_TESTS_none || { bad 'a docs-only diff did not report none'; printf '%s\n' "$out"; }
# Break 4: a worktree with no node_modules pretends to have run the tests.
rm -rf kernel/ts/node_modules
printf 'zz\n' > kernel/ts/play/write.ts
git -c user.name=t -c user.email=t@t commit -qam "source change"
out=$(sh "$bin/related_tests.sh" . 2>&1) || bad "skip exit: $out"
printf '%s\n' "$out" | grep -qx RELATED_TESTS_skip_no_node_modules || { bad 'a worktree without node_modules did not skip'; printf '%s\n' "$out"; }
[ "$fail" = 0 ] && echo "related_tests red controls: all pass"
exit "$fail"
