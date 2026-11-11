#!/bin/sh
# The kernel/ts unit files a diff touches, run before a push instead of after a CI round trip
# (loka-4ks2l: PR #707 sat four days on editor_routes.test.ts, which the slice never ran because the
# brief listed only the new module's tests). A test counts when the diff changed it, when it names a
# changed source (`editor_routes.test.ts` reads `write.ts` by path, so no import), or by its twin name.
# Usage: bin/related_tests.sh <worktree> [<commit>]   (default HEAD, diffed from merge-base origin/main)
# Prints one `<seconds>s [FAIL|SLOW] <path>` line per file, then
# RELATED_TESTS_none|skip_no_node_modules|ok|fail. Exit 1 only on red. A worktree without
# kernel/ts/node_modules skips the run: setup costs more than the CI it saves.
# A file gets RELATED_TESTS_CAP (default 60) seconds: over it, the file prints SLOW and does not dock the
# push, because `editor_crud.test.ts` compiles the whole registry (164 s) and a gate people work around
# catches nothing. CI's `npm run test:nosim` runs every file whatever this says.
set -u
[ $# -ge 1 ] && [ $# -le 2 ] || { echo "usage: $0 <worktree> [<commit>]" >&2; exit 2; }
cd "$1" || exit 2
rev=$(git rev-parse --verify --quiet "${2-HEAD}") || { echo "related_tests: no such commit: ${2-HEAD}" >&2; exit 2; }
base=$(git merge-base origin/main "$rev" 2>/dev/null) || { echo RELATED_TESTS_none; exit 0; }
files=$(git diff --no-renames --name-only "$base" "$rev" | grep -E '^kernel/ts/' || true)
[ -n "$files" ] || { echo RELATED_TESTS_none; exit 0; }
list=$(mktemp "${TMPDIR:-/tmp}/related_tests.list.XXXXXX") || exit 2
for f in $files; do
  name=$(basename "$f" .ts)
  # The test beside the source: kernel/ts/play/scene_structure.ts -> kernel/ts/test/scene_structure.test.ts
  [ -f "kernel/ts/test/$name.test.ts" ] && printf '%s\n' "kernel/ts/test/$name.test.ts" >>"$list"
  # Tests that name the file. With the extension, so an import path or a read path counts and a bare
  # word in prose does not; `write.ts` is named by nine files, which is the honest cost of the gate.
  grep -lF "$name.ts" kernel/ts/test/*.test.ts 2>/dev/null >>"$list" || true
done
[ -s "$list" ] || { rm -f "$list"; echo RELATED_TESTS_none; exit 0; }
tests=$(sort -u "$list" | tr '\n' ' ')
rm -f "$list"
[ -d kernel/ts/node_modules ] || { echo RELATED_TESTS_skip_no_node_modules; exit 0; }
cap=${RELATED_TESTS_CAP:-60}
red=
for t in $tests; do
  s=$(date +%s)
  rel=${t#kernel/ts/}
  # awk's exit status is 0 on ok, 1 on red, 2 when perl's alarm killed node at the cap.
  st=$(cd kernel/ts && perl -e 'alarm $ARGV[0]; exec @ARGV[1..$#ARGV]' "$cap" node --test --test-reporter=dot "$rel" >/dev/null 2>&1; echo $?)
  if [ "$st" = 0 ]; then	printf '%ss %s\n' "$(( $(date +%s) - s ))" "$rel"
  elif [ "$st" = 2 ] || [ "$st" = 142 ]; then printf '%ss SLOW %s\n' "$(( $(date +%s) - s ))" "$rel"
  else printf '%ss FAIL %s\n' "$(( $(date +%s) - s ))" "$rel"; red=1
  fi
done
[ -z "$red" ] && echo RELATED_TESTS_ok || { echo RELATED_TESTS_fail; exit 1; }
