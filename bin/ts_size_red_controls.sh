#!/bin/sh
# Plant TypeScript size cases in fresh directories and require bin/check_ts_size.mjs, run on
# exactly those files, to report exactly the expected lines: one line over each limit fails,
# exactly at it passes; markers at 1.5x pass, and over it, without a reason, not needed or
# not attached fail. Only the directories this script created are removed.
set -eu
cd "$(dirname "$0")/.."
L= T=
trap 'rm -rf "$L" "$T"' EXIT
L=$(mktemp -d kernel/ts/src/red_size.XXXXXX)
T=$(mktemp -d kernel/ts/test/red_size.XXXXXX)
mkdir "$L/test" "$L/__tests__" "$L/x.gen.d" "$L/ios"
x() { for i in $(seq "$1"); do echo '//'; done; }
# file marker line 1, function marker line 6, `function f` of $3 lines at line 7, $4 lines total
m() { echo "$1"; x 4; echo "$2"; echo 'export function f() {'; x $(($3 - 2)); echo '}'; x $(($4 - $3 - 6)); }
x 301 > "$L/big.ts"
{ echo 'export function ok() {'; x 38; echo '}'; x 260; } > "$L/ok.ts"
{ echo 'export const f = () => {'; x 39; echo '};'; } > "$L/fn.tsx"
{ echo 'export function g() {'; x 39; echo '}'; } > "$L/script.mjs"
x 301 > "$L/test/helper.ts"
x 500 > "$L/__tests__/ok.ts"
x 500 > "$L/colocated.test.tsx"
x 400 > "$L/skip.gen.ts"
x 301 > "$L/x.gen.d/big.ts"
{ echo 'export function h() {'; x 39; echo '}'; x 460; } > "$T/helper.ts"
x 301 > "$L/ios/Big.tsx"
x 301 > "$L/big.mts"
{ x 4; echo '// size: allow 50, early'; echo 'export function f() {'; x 39; echo '}'; } > "$L/m_early_fn.ts"
m '// size: allow 450, table' '// size: allow 60, match' 60 450 > "$L/m_ceiling.ts"
m '// size: allow 460, table' '// size: allow 61, match' 61 460 > "$L/m_over.ts"
m '// size: allow 350' '// size: allow 45,' 45 350 > "$L/m_reasonless.ts"
m '// size: allow 350, stale' '// size: allow 50, stale' 40 300 > "$L/m_unneeded.ts"
{ x 4; echo '// size: allow 400, late'; x 345; } > "$L/m_line5.ts"
{ x 5; echo '// size: allow 400, late'; x 344; } > "$L/m_line6.ts"
{ x 6; echo '// size: allow 60, old'; echo '/** doc */'; echo 'export function f() {}'; } > "$L/m_stale.ts"
expected="$L/big.ts:1: file, 301 lines, limit 300
$L/fn.tsx:1: function f, 41 lines, limit 40
$L/script.mjs:1: function g, 41 lines, limit 40
$L/test/helper.ts:1: file, 301 lines, limit 300
$L/x.gen.d/big.ts:1: file, 301 lines, limit 300
$T/helper.ts:1: file, 501 lines, limit 500
$L/ios/Big.tsx:1: file, 301 lines, limit 300
$L/big.mts:1: file, 301 lines, limit 300
$L/m_early_fn.ts:5: size marker not needed, 46 lines
$L/m_early_fn.ts:6: function f, 41 lines, limit 40
$L/m_ceiling.ts:1: info: size: allow 450, table
$L/m_ceiling.ts:6: info: size: allow 60, match
$L/m_over.ts:1: size marker 460 over 1.5x
$L/m_over.ts:1: file, 460 lines, limit 300
$L/m_over.ts:6: size marker 61 over 1.5x
$L/m_over.ts:7: function f, 61 lines, limit 40
$L/m_reasonless.ts:1: size marker needs N and a reason
$L/m_reasonless.ts:1: file, 350 lines, limit 300
$L/m_reasonless.ts:6: size marker needs N and a reason
$L/m_reasonless.ts:7: function f, 45 lines, limit 40
$L/m_unneeded.ts:1: size marker not needed, 300 lines
$L/m_unneeded.ts:6: size marker not needed, 40 lines
$L/m_line5.ts:5: info: size: allow 400, late
$L/m_line6.ts:1: file, 350 lines, limit 300
$L/m_line6.ts:6: size marker not attached to a file header or function
$L/m_stale.ts:7: size marker not attached to a file header or function"
status=0
out=$(node bin/check_ts_size.mjs $(find "$L" "$T" -type f)) || status=$?
got=$(printf '%s\n' "$out" | LC_ALL=C sort)
want=$(printf '%s\n' "$expected" | LC_ALL=C sort)
# The no-argument scan (what CI runs) must find a planted file too.
scan_status=0
scan=$(node bin/check_ts_size.mjs) || scan_status=$?
if [ "$status" -ne 0 ] && [ "$got" = "$want" ] && [ "$scan_status" -ne 0 ] &&
  printf '%s\n' "$scan" | grep -qxF "$L/big.ts:1: file, 301 lines, limit 300"; then
  echo "ok   ts size: limits and allow markers"
else
  printf 'FAIL ts size: exit %s, expected\n%s\ngot\n%s\n' "$status" "$want" "$got"
  printf 'no-argument scan: exit %s\n%s\n' "$scan_status" "$scan"
  exit 1
fi
