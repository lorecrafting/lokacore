#!/bin/sh
# The full local check line (AGENTS.md, Checks): everything CI runs except `mix hex.audit`,
# which needs the network. Toolchain from mise.toml.
# --no-ts skips the TypeScript checks (pre-push passes it when kernel/ts and mobile/ are unchanged).
set -e
cd "$(dirname "$0")/.."
export MIX_ENV=test
m() { mise exec -- "$@"; }
m mix deps.get --check-locked
m mix format --check-formatted
m mix compile --warnings-as-errors
m elixir bin/contracts.exs --check
m mix xref graph --format cycles --fail-above 0
m mix xref graph --label compile-connected --fail-above 0
m mix test
m elixir bin/red_controls.exs
m ast-grep test --skip-snapshot-tests
m ast-grep scan --error
m bin/lint_red_controls.sh
m elixir bin/check_docs.exs
[ "${1-}" = --no-ts ] && exit 0
for d in kernel/ts mobile/app; do
  [ -d $d/node_modules ] || { echo "$d not checked: run (cd $d && mise exec -- npm ci)"; exit 1; }
done
(cd kernel/ts && m npm run typecheck && m npm test)
m bin/kernel_red_controls.sh
cd mobile/app && m npx tsc --noEmit
