#!/bin/sh
# Red controls for bin/mutate_diff.sh in a throwaway repo: a module adds two guards and a constant; its
# test covers one guard only. Break: the untested guard is not a survivor, the tested one is not killed
# with its failing test line, a module no test imports is not NO-TESTS, a
# repeated line is not NOT-UNIQUE, or a mutate-skip line or a number in a string is mutated.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
bin=$(cd "$(dirname "$0")" && pwd)
R=$(mktemp -d)
trap 'rm -rf "$R"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }
cd "$R"; git init -q -b main; mkdir bin src test; cp "$bin/mutate.sh" "$bin/mutate_diff.sh" bin/
echo '{"type":"module"}' > package.json; echo 'export const x = 1;' > src/gate.ts; git add . && git commit -qm base
cat > src/gate.ts <<'TS'
export const x = 1;
export function gate(n: number): string {
  if (n < 0) return 'negative';
  if (n === 7) return 'seven';
  const limit = 100; // mutate-skip: a label width, not logic
  return n > limit ? 'big' : 'ok';
}
TS
printf '%s\n' 'export const lonely = (a: number) => a >= 3;' "export const label = 'level 2';" 'lonely(1 < 2);' 'lonely(1 < 2);' > src/lonely.ts
cat > test/gate.test.ts <<'TS'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate } from '../src/gate.ts';
test('refuses a negative', () => assert.equal(gate(-1), 'negative'));
test('zero passes', () => assert.equal(gate(0), 'ok'));
TS
git add . && git commit -qm change
sh bin/mutate_diff.sh HEAD~1 > out 2>&1 || bad "exit $?"
row() { grep -F "$1" out | grep -F "$2" | grep -q "^$3	"; }
row 'src/gate.ts:3' '< -> <=' red-narrow && grep -F 'src/gate.ts:3	< -> <=' out | grep -q 'not ok .* - zero passes' \
  || bad 'tested guard: not killed with its failing test line'
row 'src/gate.ts:3' 'drop if (n < 0)' red-narrow || bad 'tested guard drop: not killed'
row 'src/gate.ts:4' '7 -> 8' SURVIVED && row 'src/gate.ts:4' 'drop if (n === 7)' SURVIVED || bad 'untested guard: not a survivor'
row 'src/lonely.ts:1' '>= -> >' NO-TESTS || bad 'unimported module: not NO-TESTS'
! grep -q 'src/gate.ts:5' out || bad 'mutate-skip line was mutated'
! grep -q 'src/lonely.ts:2' out || bad 'a number inside a string was mutated'
row 'src/lonely.ts:3' '< -> <=' NOT-UNIQUE || bad 'a repeated line: not NOT-UNIQUE'
head -1 out | grep -q '^mutate_diff: [0-9]* mutants' || bad 'count not printed first'
[ "$fail" = 0 ] && echo "mutate_diff red controls: all pass" || cat out
exit "$fail"
