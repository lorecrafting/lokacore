#!/bin/sh
# The full local check line (docs/CHECKS.md): everything CI runs except `mix hex.audit`,
# which needs the network. Toolchain from mise.toml.
# --metadata runs docs and tracker guards for a verified metadata or Book-only push.
# --no-ts remains available for a focused local Elixir run.
# --no-mix-test skips mix test and credo for a push whose code changes are only *.test.ts files.
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
# One heavy run at a time across worktrees (pre-push execs this script): a second run waits.
lock=$(git rev-parse --git-common-dir)/loka-check.lock
until mkdir "$lock" 2>/dev/null; do
  pid=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -z "$pid" ] || kill -0 "$pid" 2>/dev/null; then
    [ "$pid" = "${said-x}" ] || { echo "check_all: waiting for ${pid:-a starting run} (another check run holds $lock)"; said=$pid; }
    sleep 2
  else
    rm -rf "$lock" # its holder died without cleanup
  fi
done
# ponytail: a run killed between mkdir and this write leaves a pid-less lock; remove it by hand.
echo $$ > "$lock/pid"
trap 'rm -rf "$lock"' EXIT
trap 'exit 130' INT TERM
m mix deps.get --check-locked
m mix format --check-formatted
m mix compile --warnings-as-errors
m elixir bin/contracts.exs --check
m elixir bin/features.exs --check
m mix xref graph --format cycles --fail-above 0
m mix xref graph --label compile-connected --fail-above 0
[ "${1-}" = --no-mix-test ] || m mix test
[ "${1-}" = --no-mix-test ] || m mix credo --strict
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
[ -z "${1-}" ] && [ -n "$start" ] && [ "$(tree || true)" = "$start" ] && echo "$start" > "$(git rev-parse --git-path loka-checked-tree)"
true
