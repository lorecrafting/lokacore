#!/bin/sh
# The full check line (docs/CHECKS.md) for a local run that mirrors hosted CI, minus `mix hex.audit`
# (needs the network), the 10,000-sequence simulator and the e1-recorder job. Hosted CI on the pushed
# head is the gate (docs/decisions/owner-decision-two-lane-ci-2026-10-09.md); on the owner's M1 run
# only focused checks. Toolchain from mise.toml. --no-ts remains available for a focused Elixir run.
set -e
cd "$(dirname "$0")/.."
export MIX_ENV=test
# The dot reporter keeps the node test output to a line; failures still print in full.
export TEST_REPORTER=dot
# The last line is the verdict: `check_all: PASS` or `check_all: FAIL <step>`.
# The step goes through a file because some steps run in subshells.
stepf=$(mktemp)
step() { echo "$*" > "$stepf"; }
verdict() { [ $1 = 0 ] && echo "check_all: PASS" || echo "check_all: FAIL $(cat "$stepf")"; rm -f "$stepf"; }
trap 'verdict $?' EXIT
m() { step "$@"; mise exec -- "$@"; }
# Every lint rule over the whole tree (pre-commit sees only staged files); first, as it needs no deps.
m ast-grep scan --error . mobile/app/.storybook # hidden directories are skipped unless named
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
m ast-grep test --skip-snapshot-tests
m bin/lint_red_controls.sh --core-only
m bin/integration_red_controls.sh
m elixir bin/check_docs.exs
m bin/docs_red_controls.sh
m python3 bin/check_beads_export.py
m sh bin/beads_red_controls.sh
m sh bin/graph_diff_red_controls.sh
m sh bin/orphans_red_controls.sh
m sh bin/worktree_setup_red_controls.sh
[ "${1-}" = --no-ts ] && exit 0
for d in . kernel/ts mobile/app; do
  step "$d node_modules"; [ -d $d/node_modules ] || { echo "$d not checked: run (cd $d && mise exec -- npm ci)"; exit 1; }
done
(cd kernel/ts && m npm run typecheck && m npm test)
(cd mobile/app && m npm test)
m bin/kernel_red_controls.sh
m node bin/check_ts_size.mjs
m bin/ts_size_red_controls.sh
step prettier
git ls-files -z '*.ts' '*.tsx' '*.mjs' '*.js' '*.json' ':(exclude)mobile/**' | xargs -0 mise exec -- node_modules/.bin/prettier --check
