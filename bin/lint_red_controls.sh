#!/bin/sh
# Plant one violation per ast-grep rule at the real paths and require `ast-grep scan` to
# report every rule. `ast-grep test` proves the rule logic; this proves the `files:` globs.
set -u
cd "$(dirname "$0")/.."
case "${1-}" in '') core_only=0 ;; --core-only) core_only=1 ;; *) echo "unknown option: $1" >&2; exit 2 ;; esac
# Mobile plants are .tsx and the kernel plant is .ts, so both file types are proven covered.
planted="lib/loka/core/red_control.ex kernel/ts/src/red_control.ts kernel/ts/src/foundation/red_control.ts"
[ "$core_only" -eq 1 ] || planted="$planted mobile/packages/ui/red_control.tsx mobile/features/story/red_control.tsx mobile/features/realm/red_control.tsx mobile/authority/local-story/red_control.ts mobile/app/book/red_control.tsx"
mkdir -p lib/loka/core
cp kernel/ts/src/runtime/world.ts kernel/ts/src/runtime/world.ts.red
cp kernel/ts/src/mechanics/movement/rule.ts kernel/ts/src/mechanics/movement/rule.ts.red
[ "$core_only" -eq 1 ] || cp mobile/packages/game-view/session.ts mobile/packages/game-view/session.ts.red
cleanup() {
  rm -f $planted
  rmdir lib/loka/core 2>/dev/null
  mv kernel/ts/src/runtime/world.ts.red kernel/ts/src/runtime/world.ts
  mv kernel/ts/src/mechanics/movement/rule.ts.red kernel/ts/src/mechanics/movement/rule.ts
  [ "$core_only" -eq 1 ] || mv mobile/packages/game-view/session.ts.red mobile/packages/game-view/session.ts
}
trap cleanup EXIT
echo 'defmodule Loka.Core.RedControl do def x, do: File.read!("x") end' > lib/loka/core/red_control.ex
printf 'export const t = Date.now();\nexport const decide = () => 0;\n' > kernel/ts/src/red_control.ts
# Astra's A2 counterexamples too: an aliased Object.assign, Function I/O, JSON.parse any.
printf "import { readFileSync } from 'node:fs';\nexport const f = (w) => { w.state.clock = 1; };\nconst { assign } = Object;\nFunction('x')();\nconst p = JSON.parse('{}');\n" >> kernel/ts/src/mechanics/movement/rule.ts
# Foundation must not import the runtime, even as types.
printf "import type { World } from '../runtime/decision.ts';\n" > kernel/ts/src/foundation/red_control.ts
# Review F2: an inline rule registered in RULES.
sed -i.bak 's/  movement: movement.decide,/  movement: (w) => w,/' kernel/ts/src/runtime/world.ts && rm kernel/ts/src/runtime/world.ts.bak
# The shared and realm plants are a template-literal require and a require.resolve only, so their
# rules are reported only if module-specifier sees those forms.
if [ "$core_only" -eq 0 ]; then
echo "const a = require(\`../../authority/local-story\`);" > mobile/packages/ui/red_control.tsx
printf "const b = () => import('../realm');\nimport { k } from '../../../kernel/ts/src';\nexport const P = () => <>{k}</>;\n" > mobile/features/story/red_control.tsx
echo "require.resolve('../story');" > mobile/features/realm/red_control.tsx
# The presenter split: a display line in the authority; the renderer reaching the authority and a phone
# API; session.ts importing an engine (its backup is restored on exit).
printf '%s\n' "export const said = 'You are too tired.';" 'export const go = `Go ${d}`;' "export const f = (s) => s; f('You are too tired.');" "export const g = formatter.runSync('You are too tired.');" > mobile/authority/local-story/red_control.ts
printf "import { openGame } from '../../authority/local-story/session.ts';\nimport Storage from 'expo-sqlite/kv-store';\nimport * as RN from 'react-native';\nimport { default as D } from 'react-native';\nimport c from './metro.config.js';\nimport { phone } from './App.tsx';\nexport const S = [openGame, Storage, RN, D, c, phone];\n" > mobile/app/book/red_control.tsx
# A raw colour and font size in a Book component.
echo "export const raw = { color: '#7b2d20', fontSize: 17 };" >> mobile/app/book/red_control.tsx
echo "import type { World } from '../../../kernel/ts/src/index.ts';" >> mobile/packages/game-view/session.ts
fi
if [ "$core_only" -eq 1 ]; then
  out=$(ast-grep scan --error --filter '^(elixir-kernel-pure|ts-.*)$' lib/loka/core kernel/ts/src 2>&1)
else
  out=$(ast-grep scan --error 2>&1)
fi
status=0
for rule in $(ls lint/rules | sed 's/\.yml$//'); do
  [ "$core_only" -eq 0 ] || { case "$rule" in mobile-*) continue ;; esac; }
  if printf '%s' "$out" | grep -q "error\[$rule\]"; then echo "ok   $rule"; else echo "FAIL $rule not reported"; status=1; fi
done
exit $status
