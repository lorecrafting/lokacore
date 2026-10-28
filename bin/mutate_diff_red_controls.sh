#!/bin/sh
# Red controls for bin/mutate_diff.sh in a throwaway repo: a module adds two guards and a constant; its
# test covers one guard only. Break: the untested guard is not a survivor, the tested one is not killed
# with its failing test line, a module no test imports is not NO-TESTS, a
# repeated line is not NOT-UNIQUE, a block guard's negation is not killed, tests red before any
# mutant are not BASELINE-RED, or a mutate-skip line or a number in a string is mutated; a module
# tested one import hop away (TS), through a directory import, or through an xref caller (Elixir, stub
# mise) is NO-TESTS; an `} else if` guard is not negated; a co-located .test. file or Elixir """ prose
# is mutated; two equal operators on a line share a label; or SURVIVED rows do not exit 1.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
bin=$(cd "$(dirname "$0")" && pwd)
R=$(mktemp -d)
trap 'rm -rf "$R"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }
cd "$R"; git init -q -b main; mkdir bin src src/pkg test lib stub; cp "$bin/mutate.sh" "$bin/mutate_diff.sh" bin/
echo '{"type":"module"}' > package.json; echo 'export const x = 1;' > src/gate.ts; git add . && git commit -qm base
cat > src/gate.ts <<'TS'
export const x = 1;
export function gate(n: number): string {
  if (n < 0) return 'negative';
  if (n === 7) return 'seven';
  const limit = 100; // mutate-skip: a label width, not logic
  return n > limit ? 'big' : 'ok';
}
export function sign(n: number): string {
  if (n < 0) {
    return 'minus';
  } else if (n > 5) {
    return 'big';
  }
  return 'plus';
}
TS
echo 'export const broken = (n: number) => n > 1;' > src/broken.ts
printf '%s\n' "import { test } from 'node:test';" "import assert from 'node:assert/strict';" \
  "import { broken } from '../src/broken.ts';" "test('already red', () => assert.equal(broken(0), true));" > test/broken.test.ts
printf '%s\n' 'export const lonely = (a: number) => a >= 3;' "export const label = 'level 2';" 'lonely(1 < 2);' 'lonely(1 < 2);' > src/lonely.ts
cat > test/gate.test.ts <<'TS'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate, sign } from '../src/gate.ts';
test('refuses a negative', () => assert.equal(gate(-1), 'negative'));
test('zero passes', () => assert.equal(gate(0), 'ok'));
test('sign of a negative', () => assert.equal(sign(-1), 'minus'));
test('sign of a big one', () => assert.equal(sign(9), 'big'));
TS
echo 'export const inner = (n: number) => n >= 10;' > src/inner.ts
printf '%s\n' "import { inner } from './inner.ts';" "export const outer = (n: number) => (inner(n) ? 'high' : 'low');" > src/outer.ts
printf '%s\n' "import { test } from 'node:test';" "import assert from 'node:assert/strict';" \
  "import { outer } from '../src/outer.ts';" "test('ten is high', () => assert.equal(outer(10), 'high'));" > test/outer.test.ts
printf '%s\n' 'export type Pos = number;' 'export const pos = (n: number) => n > 0;' > src/pkg/index.ts
printf '%s\n' "import { test } from 'node:test';" "import type { Pos } from '../src/pkg';" "test('typed', () => { const p: Pos = 1; void p; });" > test/pkg.test.ts
echo 'export const near = 1 < 2;' > src/near.test.ts
echo 'export const both = (a: number, b: number) => a < 1 && b < 2;' > src/two.ts
cat > lib/gate.ex <<'EX'
defmodule Gate do
  @moduledoc """
  Refuses n below 0 and at or under -99.
  """
  def check(n) do
    if n < 0 and n > -99 do
      :refused
    end
  end
end
EX
printf '%s\n' 'defmodule Caller do' '  def run(n), do: Gate.check(n)' 'end' > lib/caller.ex
printf '%s\n' 'defmodule CallerTest do' '  use ExUnit.Case' '  test "refuses", do: assert Caller.run(-1) == :refused' 'end' > test/caller_test.exs
cat > stub/mise <<'SH'
#!/bin/sh
# stub `mise exec -- mix ...`: Gate's only caller is Caller; the test fails once lib/gate.ex is mutated
shift 2
case "$2" in
xref) [ "$4" = Gate ] && echo 'lib/caller.ex (runtime)'; exit 0 ;;
test) git show HEAD:lib/gate.ex | cmp -s - lib/gate.ex && exit 0
  printf '  1) test refuses (CallerTest)\n     test/caller_test.exs:3\n'; exit 1 ;;
esac
exit 2
SH
chmod +x stub/mise
git add . && git commit -qm change
rc=0; PATH="$R/stub:$PATH" sh bin/mutate_diff.sh HEAD~1 > out 2>&1 || rc=$?
[ "$rc" = 1 ] || bad "exit $rc with SURVIVED rows, want 1"
row() { grep -F "$1" out | grep -F "$2" | grep -q "^$3	"; }
row 'src/gate.ts:3' '< -> <=' red-narrow && grep -F 'src/gate.ts:3	< -> <=	' out | grep -q 'not ok .* - zero passes' \
  || bad 'tested guard: not killed with its failing test line'
row 'src/gate.ts:3' 'drop if (n < 0)' red-narrow || bad 'tested guard drop: not killed'
row 'src/gate.ts:4' '7 -> 8' SURVIVED && row 'src/gate.ts:4' 'drop if (n === 7)' SURVIVED || bad 'untested guard: not a survivor'
row 'src/gate.ts:9' 'negate n < 0' red-narrow || bad 'tested block guard: negation not killed'
row 'src/broken.ts:1' '> -> >=' BASELINE-RED || bad 'tests red before mutation: not BASELINE-RED'
row 'src/lonely.ts:1' '>= -> >' NO-TESTS || bad 'unimported module: not NO-TESTS'
! grep -q 'src/gate.ts:5' out || bad 'mutate-skip line was mutated'
! grep -q 'src/lonely.ts:2' out || bad 'a number inside a string was mutated'
row 'src/lonely.ts:3' '< -> <=' NOT-UNIQUE || bad 'a repeated line: not NOT-UNIQUE'
row 'src/gate.ts:11' 'negate n > 5' red-narrow || bad 'an } else if guard: negation not killed'
row 'src/inner.ts:1' '>= -> >' red-narrow || bad 'a module tested one import hop away: not run'
row 'src/pkg/index.ts:2' '> -> >=' SURVIVED || bad 'a directory import of pkg/index: its test not found'
! grep -q 'src/near.test.ts' out || bad 'a co-located .test. file was mutated'
row 'src/two.ts:1' '< -> <= #1' NO-TESTS && row 'src/two.ts:1' '< -> <= #2' NO-TESTS || bad 'two < on one line: rows not distinct'
row 'lib/gate.ex:6' 'and -> or' red-narrow && grep -F 'lib/gate.ex:6	and -> or' out | grep -q 'test/caller_test.exs:3' \
  || bad 'Elixir module tested through an xref caller: not killed with its failing test line'
row 'lib/gate.ex:6' 'negate n < 0 and n > -99' red-narrow || bad 'Elixir block guard: negation not killed'
! grep -q 'lib/gate.ex:3' out || bad 'Elixir """ prose was mutated'
head -1 out | grep -q '^mutate_diff: [0-9]* mutants' || bad 'count not printed first'
[ "$fail" = 0 ] && echo "mutate_diff red controls: all pass" || cat out
exit "$fail"
