#!/bin/sh
# Merge a reviewed slice and its review record into a batch worktree, run the post-merge checks
# (including only the tests the merge touched), and push the batch if everything passes.
# Usage: pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch> "<subject>" <reviewed-sha>
# Prints one line per step; logs go to $TMPDIR/pm_<check>.out. Exit 0 = pushed; any failure resets
# the worktree to its start head, so a rerun re-checks the whole slice.
# ponytail: runs only the test files the merge touched; hosted CI on the batch head runs the rest.
set -u
wt=$1 batch=$2 slice=${3#origin/} rec=$4 subj=$5 sha=$6
cd "$wt" || exit 2
tr="Co-Authored-By: ${COAUTHOR:-Claude Opus 5.5} <noreply@anthropic.com>"
git fetch -q origin || exit 2
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "DIRTY worktree"; exit 2; }
[ "$(git rev-parse --abbrev-ref HEAD)" = "$batch" ] || { echo "NOT ON $batch"; exit 2; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$batch")" ] || { echo "NOT LEVEL with origin/$batch"; exit 2; }
[ "$(git rev-parse "origin/$slice")" = "$(git rev-parse "$sha")" ] || { echo "origin/$slice is not the reviewed head $sha"; exit 2; }
pre=$(git rev-parse HEAD)

merge() { # <ref> <message>
  if git merge --no-ff -q "$1" -m "$2" -m "$tr" >/dev/null 2>&1; then echo "MERGED $1"; return 0; fi
  c=$(git diff --name-only --diff-filter=U)
  # Conflicts only under docs/reviews/ (the generated index, or a record a slice branch also carries):
  # the incoming review record wins, then the index is regenerated.
  if [ -n "$c" ] && [ -z "$(echo "$c" | grep -v '^docs/reviews/')" ]; then
    echo "$c" | xargs git checkout -q --theirs -- && sh bin/review_index.sh >/dev/null 2>&1 &&
      git add docs/reviews/ && git commit -q --no-edit >/dev/null 2>&1 &&
      { echo "MERGED $1 (review index regenerated)"; return 0; }
  fi
  echo "CONFLICT $1: $(echo $c)"; git merge --abort 2>/dev/null; return 1
}
merge "$sha" "Merge $slice: $subj" || exit 1
merge "$rec" "Merge review record for $subj" || { git reset -q --hard "$pre"; exit 1; }

fail=0
run() { # <name> <command...>
  n=$1; shift
  if "$@" >"${TMPDIR:-/tmp}/pm_$n.out" 2>&1; then echo "${n}_OK"; else echo "${n}_FAIL (\$TMPDIR/pm_$n.out)"; fail=1; fi
}
ch=$(git diff --name-only --diff-filter=d "$pre" HEAD)
ts=$(echo "$ch" | sed -n 's#^kernel/ts/\(test/.*\.test\.ts\)$#\1#p' | tr '\n' ' ')
ex=$(echo "$ch" | grep -E '^test/.*_test\.exs$' | tr '\n' ' ')
run TYPECHECK sh -c 'cd kernel/ts && nice -n 10 mise exec -- npm run -s typecheck'
run PRETTIER sh -c "git ls-files -z '*.ts' '*.tsx' '*.mjs' '*.js' '*.json' ':(exclude)mobile/**' | xargs -0 nice -n 10 mise exec -- node_modules/.bin/prettier --check"
run CONTRACTS mise exec -- elixir bin/contracts.exs --check
run TS_SIZE mise exec -- node bin/check_ts_size.mjs
run EX_SIZE mise exec -- elixir bin/check_size.exs
if echo "$ch" | grep -qE '^(lib|test)/.*\.exs?$'; then
  run MIX_FORMAT mise exec -- mix format --check-formatted
  run COMPILE mise exec -- mix compile --warnings-as-errors
  run CREDO mise exec -- mix credo --strict
fi
[ -n "$ts" ] && run TS_TESTS sh -c "cd kernel/ts && nice -n 10 mise exec -- node --test --test-reporter=dot $ts"
[ -n "$ex" ] && run EX_TESTS sh -c "nice -n 10 mise exec -- mix test $ex"
[ "$fail" = 0 ] || { echo "NOT PUSHED; reset to pre-merge $pre"; git reset -q --hard "$pre"; exit 1; }
git push -q origin "HEAD:$batch" && echo "PUSHED $batch $(git rev-parse HEAD)" ||
  { echo "PUSH FAILED; reset to pre-merge $pre"; git reset -q --hard "$pre"; exit 1; }
