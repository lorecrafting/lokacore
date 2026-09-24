#!/bin/sh
# Host and Node APIs must be type errors in the TS kernel: plant each one and require tsc to fail.
cd "$(dirname "$0")/../kernel/ts"
trap 'rm -f src/red_control.ts' EXIT
for probe in "fetch('x')" "setTimeout(() => 0, 1)" "process.env" "require('os')" "Buffer.from('x')" "performance.now()"; do
  echo "export const p = $probe;" > src/red_control.ts
  if npx tsc >/dev/null; then echo "tsc accepted $probe in the kernel"; exit 1; fi
done
echo "import 'node:fs';" > src/red_control.ts
if npx tsc >/dev/null; then echo "tsc accepted a node: import in the kernel"; exit 1; fi
echo "ok   kernel tsc rejects host and Node APIs"
