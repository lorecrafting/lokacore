#!/bin/sh
# The full local check line (docs/CHECKS.md): everything CI runs except `mix hex.audit`,
# which needs the network. Toolchain from mise.toml.
# --metadata runs docs and tracker guards for a verified metadata or Book-only push.
# --no-ts remains available for a focused local Elixir run.
set -e
cd "$(dirname "$0")/.."
export MIX_ENV=test
# The dot reporter keeps the node test output to a line; failures still print in full.
export TEST_REPORTER=dot
m() { mise exec -- "$@"; }
# A full pass on a clean tree is recorded so pre-push can skip rerunning it unchanged.
tree() { [ -z "$(git status --porcelain --untracked-files=all)" ] && git rev-parse HEAD^{tree}; }
start=$(tree || true)
if [ "${1-}" = --metadata ]; then
  m elixir bin/check_docs.exs
  m bin/docs_red_controls.sh
  python3 bin/check_beads_export.py
  sh bin/beads_red_controls.sh
  exit 0
fi
m mix deps.get --check-locked
m mix format --check-formatted
m mix compile --warnings-as-errors
m elixir bin/contracts.exs --check
m elixir bin/features.exs --check
m mix xref graph --format cycles --fail-above 0
m mix xref graph --label compile-connected --fail-above 0
m mix test
m mix credo --strict
m elixir bin/check_size.exs
m elixir bin/red_controls.exs
m ast-grep test --skip-snapshot-tests --filter '^(elixir-kernel-pure|ts-.*)$'
m ast-grep scan --error --filter '^(elixir-kernel-pure|ts-.*)$' lib/loka/core kernel/ts/src
m bin/lint_red_controls.sh --core-only
m bin/docs_only_red_controls.sh
m bin/integration_red_controls.sh
m elixir bin/check_docs.exs
m bin/docs_red_controls.sh
python3 bin/check_beads_export.py
sh bin/beads_red_controls.sh
[ "${1-}" = --no-ts ] && exit 0
for d in . kernel/ts; do
  [ -d $d/node_modules ] || { echo "$d not checked: run (cd $d && mise exec -- npm ci)"; exit 1; }
done
(cd kernel/ts && m npm run typecheck && m npm test)
m bin/kernel_red_controls.sh
m node bin/check_ts_size.mjs
m bin/ts_size_red_controls.sh
git ls-files -z '*.ts' '*.tsx' '*.mjs' '*.js' '*.json' ':(exclude)mobile/**' | xargs -0 mise exec -- node_modules/.bin/prettier --check
[ -n "$start" ] && [ "$(tree || true)" = "$start" ] && echo "$start" > "$(git rev-parse --git-path loka-checked-tree)"
true
