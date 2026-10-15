#!/bin/sh
# The static checks of hosted CI (.github/workflows/ci.yml) that are cheap locally, fastest to fail
# first; no test suite. Run before every push; bin/pm_merge.sh runs it after a merge. Checks the repo
# it is run from. One line per check (NAME_OK or NAME_FAIL <log>); exit 1 if any check failed.
# Commit first: the size checks read tracked files.
#   bin/prepush.sh
cd "$(git rev-parse --show-toplevel)" || exit 2
export MIX_ENV=test
logs=$(mktemp -d "${TMPDIR:-/tmp}/prepush.XXXXXX") || exit 2 # per run: parallel runs must not overwrite each other
fail=0
run() { # <name> <command...>
  n=$1; shift
  if nice -n 10 mise exec -- "$@" >"$logs/pm_$n.out" 2>&1; then echo "${n}_OK"; else echo "${n}_FAIL ($logs/pm_$n.out)"; fail=1; fi
}
run TS_SIZE node bin/check_ts_size.mjs
run EX_SIZE elixir bin/check_size.exs
run PRETTIER sh -c "git ls-files -z '*.ts' '*.tsx' '*.mjs' '*.js' '*.json' ':(exclude)mobile/**' | xargs -0 node_modules/.bin/prettier --check"
run CONTRACTS elixir bin/contracts.exs --check
run FEATURES elixir bin/features.exs --check
run TYPECHECK sh -c 'cd kernel/ts && npm run -s typecheck'
run MOBILE_TSC sh -c 'cd mobile/app && node_modules/.bin/tsc --noEmit -p .'
run MIX_FORMAT mix format --check-formatted
run COMPILE mix compile --warnings-as-errors
run XREF sh -c 'mix xref graph --format cycles --fail-above 0 && mix xref graph --label compile-connected --fail-above 0'
run CREDO mix credo --strict
run DOCS elixir bin/check_docs.exs
# A sampler hash change breaks the transcript known answers and the Impact story's fixture list (loka-j6qd).
if git diff --name-only origin/main...HEAD 2>/dev/null | grep -q '^protocol/fixtures/.*_sampler_hash\.json$'; then
  run TRANSCRIPTS sh -c 'cd kernel/ts && node --test --test-reporter=dot test/transcripts.test.ts'
  run IMPACT_STORY sh bin/check_impact_fixtures.sh
fi
exit $fail
