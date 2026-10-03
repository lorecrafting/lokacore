#!/bin/sh
# Prints `skip` when every file changed in <before>..<after> is a Markdown file, else `run` (CI
# uses it to skip the code jobs on a docs-only push). A missing or non-ancestor <before> (first
# push, force push) or an empty diff runs everything. A .json, .gen.* or .jsonl under docs/ is code.
before=${1-} after=${2-HEAD}
if [ -n "$before" ] && git merge-base --is-ancestor "$before" "$after" 2>/dev/null; then
  git diff --name-only --no-renames "$before" "$after" |
    awk '$0 !~ /\.md$/ { bad = 1 } END { exit !(NR && !bad) }' && { echo skip; exit 0; }
fi
echo run
