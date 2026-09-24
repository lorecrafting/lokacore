#!/bin/sh
# The full local check line (AGENTS.md, Checks). Toolchain from mise.toml.
# --no-kernel skips kernel/ts (pre-push passes it when kernel/ts is unchanged).
set -e
cd "$(dirname "$0")/.."
m() { mise exec -- "$@"; }
m mix format --check-formatted
m mix compile --warnings-as-errors
m mix xref graph --format cycles --fail-above 0
m mix xref graph --label compile-connected --fail-above 0
m mix test
m elixir bin/red_controls.exs
m ast-grep test --skip-snapshot-tests
m ast-grep scan --error
m bin/lint_red_controls.sh
m elixir bin/check_docs.exs
[ "${1-}" = --no-kernel ] && exit 0
if [ ! -d kernel/ts/node_modules ]; then
  echo "kernel/ts not checked: run (cd kernel/ts && mise exec -- npm ci)"
  exit 1
fi
cd kernel/ts && m npm run typecheck && m npm test
