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
# Checks keyed to what the branch changed, committed or not, against its merge base with origin/main
# (loka-n0ng); when the diff fails, every gated check runs.
base=$(git merge-base origin/main HEAD 2>/dev/null) && changed=$(git diff --name-only "$base") || changed=ALL
touched() { [ "$changed" = ALL ] || printf '%s\n' "$changed" | grep -qE "$1"; }
ex='\.exs?$|(^|/)mix\.lock$|^protocol/|composition-profile\.json$' ts='\.([cm]?ts|tsx|mjs)$|^(kernel/ts|mobile|cartridges|protocol)/.*\.json$|^package(-lock)?\.json$'
touched "$ts" && run TS_SIZE node bin/check_ts_size.mjs
touched "$ex" && run EX_SIZE elixir bin/check_size.exs
# Prettier on the changed non-mobile files only; all tracked ones when its setup changed or the diff fails.
pretty="git diff -z --name-only --diff-filter=d $base --"; touched '^(\.prettier|package(-lock)?\.json$)' && pretty='git ls-files -z'
pretty="$pretty '*.ts' '*.tsx' '*.mjs' '*.js' '*.json' ':(exclude)mobile/**'"
[ -n "$(sh -c "$pretty" | tr -d '\0')" ] && run PRETTIER sh -c "$pretty | xargs -0 node_modules/.bin/prettier --check"
# Generated files: bin/regen.sh must leave the tree as it found it (uncommitted edits keep their content).
snap() { git status --porcelain --untracked-files=all | cut -c4- | while IFS= read -r f; do echo "$f $(git hash-object "$f" 2>/dev/null)"; done; }
snap >"$logs/before"
run REGEN sh bin/regen.sh
stale=$(snap | grep -vxFf "$logs/before" | cut -d' ' -f1)
if [ -n "$stale" ]; then echo "REGEN_DIRTY (bin/regen.sh rewrote these; commit them):"; printf '  %s\n' $stale; fail=1; fi
if touched "$ts"; then
  run TYPECHECK sh -c 'cd kernel/ts && npm run -s typecheck'
  run MOBILE_TSC sh -c 'cd mobile/app && node_modules/.bin/tsc --noEmit -p .'
fi
if touched "$ex"; then
  run MIX_FORMAT mix format --check-formatted
  run COMPILE mix compile --warnings-as-errors
  run XREF sh -c 'mix xref graph --format cycles --fail-above 0 && mix xref graph --label compile-connected --fail-above 0'
  run CREDO mix credo --strict
fi
run DOCS elixir bin/check_docs.exs
# (docs/state-sections.gen.json needs no check: regen rewrites it, so REGEN_DIRTY catches a stale one).
# Story views, saves and CSF meta indexing (#431); hosted mobile runs it too (loka-8qzi, loka-yz58).
if touched '^(mobile/|kernel/ts/src/|protocol/)'; then
  run STORIES sh -c 'cd mobile/app && node --test --test-reporter=dot stories.test.ts'
fi
# A sampler hash change breaks the transcript known answers and the Impact story's fixture list (loka-j6qd).
if [ "$changed" != ALL ] && touched '^protocol/fixtures/.*_sampler_hash\.json$'; then
  run TRANSCRIPTS sh -c 'cd kernel/ts && node --test --test-reporter=dot test/transcripts.test.ts'
  run IMPACT_STORY sh bin/check_impact_fixtures.sh
fi
# worktree_setup.sh clones with macOS cp -c, so hosted CI (ubuntu) cannot run its red control.
if touched '^bin/worktree_setup'; then
  run WORKTREE_SETUP sh bin/worktree_setup_red_controls.sh
fi
exit $fail
