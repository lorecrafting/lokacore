#!/bin/sh
# Host and Node APIs must be type errors in the TS kernel: plant each one and require tsc to fail.
# Then plant a type error in a test file and in play/ and require `npm run typecheck` to fail.
cd "$(dirname "$0")/../kernel/ts"
trap 'rm -f src/red_control.ts test/red_control.ts play/red_control.ts' EXIT
for probe in "fetch('x')" "setTimeout(() => 0, 1)" "process.env" "require('os')" "Buffer.from('x')" "performance.now()"; do
  echo "export const p = $probe;" > src/red_control.ts
  if npx tsc >/dev/null; then echo "tsc accepted $probe in the kernel"; exit 1; fi
done
echo "import 'node:fs';" > src/red_control.ts
if npx tsc >/dev/null; then echo "tsc accepted a node: import in the kernel"; exit 1; fi
echo "ok   kernel tsc rejects host and Node APIs"
rm src/red_control.ts
echo "export const n: number = 'x';" > test/red_control.ts
if npm run typecheck >/dev/null 2>&1; then echo "typecheck accepted a type error in a test file"; exit 1; fi
echo "ok   typecheck covers the tests"
rm test/red_control.ts
echo "export const n: number = 'x';" > play/red_control.ts
if npm run typecheck >/dev/null 2>&1; then echo "typecheck accepted a type error in play/"; exit 1; fi
echo "ok   typecheck covers play/"
