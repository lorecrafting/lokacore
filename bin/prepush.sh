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
# Generated files: bin/regen.sh must leave the tree as it found it (uncommitted edits keep their content).
snap() { git status --porcelain --untracked-files=all | cut -c4- | while IFS= read -r f; do echo "$f $(git hash-object "$f" 2>/dev/null)"; done; }
snap >"$logs/before"
run REGEN sh bin/regen.sh
stale=$(snap | grep -vxFf "$logs/before" | cut -d' ' -f1)
if [ -n "$stale" ]; then echo "REGEN_DIRTY (bin/regen.sh rewrote these; commit them):"; printf '  %s\n' $stale; fail=1; fi
run TYPECHECK sh -c 'cd kernel/ts && npm run -s typecheck'
run MOBILE_TSC sh -c 'cd mobile/app && node_modules/.bin/tsc --noEmit -p .'
run MIX_FORMAT mix format --check-formatted
run COMPILE mix compile --warnings-as-errors
run XREF sh -c 'mix xref graph --format cycles --fail-above 0 && mix xref graph --label compile-connected --fail-above 0'
run CREDO mix credo --strict
run DOCS elixir bin/check_docs.exs
# Checks keyed to what the branch changed; when the diff fails, STORIES runs anyway
# (docs/state-sections.gen.json needs no check: regen rewrites it, so REGEN_DIRTY catches a stale one).
changed=$(git diff --name-only origin/main...HEAD 2>/dev/null) || changed=ALL
touched() { [ "$changed" = ALL ] || printf '%s\n' "$changed" | grep -qE "$1"; }
# Story views, saves and CSF meta indexing (#431); hosted mobile runs it too (loka-8qzi, loka-yz58).
if touched '^(mobile/|kernel/ts/src/|protocol/)'; then
  run STORIES sh -c 'cd mobile/app && node --test --test-reporter=dot stories.test.ts'
fi
# A sampler hash change breaks the transcript known answers and the Impact story's fixture list (loka-j6qd).
if [ "$changed" != ALL ] && touched '^protocol/fixtures/.*_sampler_hash\.json$'; then
  run TRANSCRIPTS sh -c 'cd kernel/ts && node --test --test-reporter=dot test/transcripts.test.ts'
  run IMPACT_STORY sh bin/check_impact_fixtures.sh
fi
exit $fail
