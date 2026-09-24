#!/bin/sh
# Plant one violation per ast-grep rule at the real paths and require `ast-grep scan` to
# report every rule. `ast-grep test` proves the rule logic; this proves the `files:` globs.
set -u
cd "$(dirname "$0")/.."
# Mobile plants are .tsx and the kernel plant is .ts, so both file types are proven covered.
planted="lib/loka/core/red_control.ex kernel/ts/src/red_control.ts mobile/packages/ui/red_control.tsx
mobile/features/story/red_control.tsx mobile/features/realm/red_control.tsx"
mkdir -p lib/loka/core
trap 'rm -f $planted; rmdir lib/loka/core 2>/dev/null' EXIT
echo 'defmodule Loka.Core.RedControl do def x, do: File.read!("x") end' > lib/loka/core/red_control.ex
echo 'export const t = Date.now();' > kernel/ts/src/red_control.ts
echo "import { a } from '../../authority/local-story';" > mobile/packages/ui/red_control.tsx
printf "const b = () => import('../realm');\nimport { k } from '../../../kernel/ts/src';\nexport const P = () => <>{k}</>;\n" > mobile/features/story/red_control.tsx
echo "import { c } from '../story';" > mobile/features/realm/red_control.tsx
out=$(ast-grep scan --error 2>&1)
status=0
for rule in $(ls lint/rules | sed 's/\.yml$//'); do
  if printf '%s' "$out" | grep -q "error\[$rule\]"; then echo "ok   $rule"; else echo "FAIL $rule not reported"; status=1; fi
done
exit $status
