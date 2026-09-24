#!/bin/sh
# Plant TypeScript size violations and require bin/check_ts_size.mjs to report exactly them:
# one line over each limit fails, exactly at the limit passes; allow markers at the 1.5x
# ceiling pass, and over it, without a reason, or not needed fail. Plants are always removed.
set -u
cd "$(dirname "$0")/.."
s=kernel/ts/src/red_size
trap 'rm -rf kernel/ts/src/red_size_* kernel/ts/test/red_size.test.ts mobile/features/story/red_size_fn.tsx mobile/features/story/__tests__' EXIT
x() { for i in $(seq "$1"); do echo '//'; done; }
# file marker line 1, function marker line 2, `function f` of $3 lines at line 3, $4 lines total
m() { echo "$1"; echo "$2"; echo 'export function f() {'; x $(($3 - 2)); echo '}'; x $(($4 - $3 - 2)); }
x 301 > ${s}_big.ts
{ echo 'export function ok() {'; x 38; echo '}'; x 260; } > ${s}_ok.ts
{ echo 'export const f = () => {'; x 39; echo '};'; } > mobile/features/story/red_size_fn.tsx
x 501 > kernel/ts/test/red_size.test.ts
mkdir mobile/features/story/__tests__ && x 500 > mobile/features/story/__tests__/red_size_ok.test.ts
m '// size: allow 450, table' '// size: allow 60, match' 60 450 > ${s}_m_ceiling.ts
m '// size: allow 460, table' '// size: allow 61, match' 61 460 > ${s}_m_over.ts
m '// size: allow 350' '// size: allow 45,' 45 350 > ${s}_m_reasonless.ts
m '// size: allow 350, stale' '// size: allow 50, stale' 40 300 > ${s}_m_unneeded.ts
m '' '// size: allow 50, match' 50 100 > ${s}_m_fn_only.ts
expected="${s}_big.ts:1: file, 301 lines, limit 300
${s}_m_ceiling.ts:1: info: size: allow 450, table
${s}_m_ceiling.ts:2: info: size: allow 60, match
${s}_m_fn_only.ts:2: info: size: allow 50, match
${s}_m_over.ts:1: size marker 460 over the 1.5x ceiling
${s}_m_over.ts:1: file, 460 lines, limit 300
${s}_m_over.ts:2: size marker 61 over the 1.5x ceiling
${s}_m_over.ts:3: function f, 61 lines, limit 40
${s}_m_reasonless.ts:1: size marker without a reason
${s}_m_reasonless.ts:1: file, 350 lines, limit 300
${s}_m_reasonless.ts:2: size marker without a reason
${s}_m_reasonless.ts:3: function f, 45 lines, limit 40
${s}_m_unneeded.ts:1: size marker not needed (350, stale), 300 lines
${s}_m_unneeded.ts:2: size marker not needed (50, stale), 40 lines
kernel/ts/test/red_size.test.ts:1: file, 501 lines, limit 500
mobile/features/story/red_size_fn.tsx:1: function f, 41 lines, limit 40"
out=$(node bin/check_ts_size.mjs) && { echo "FAIL ts size: check passed planted violations"; exit 1; }
[ "$out" = "$expected" ] || { printf 'FAIL ts size: expected\n%s\ngot\n%s\n' "$expected" "$out"; exit 1; }
echo "ok   ts size: limits and allow markers"
