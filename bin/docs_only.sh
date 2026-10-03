#!/bin/sh
# Prints `skip` when every file changed in <base>..<after> is Markdown (not *.gen.md, which the
# elixir drift checks cover), else `run`. CI passes the newest ancestor whose code jobs passed; a
# missing or non-ancestor <base> or an empty diff runs everything. A .json or .jsonl under docs/ is code.
base=${1-} after=${2-HEAD}
if [ -n "$base" ] && git merge-base --is-ancestor "$base" "$after" 2>/dev/null; then
  git diff --name-only --no-renames "$base" "$after" |
    awk '$0 !~ /\.md$/ || $0 ~ /\.gen\.md$/ { bad = 1 } END { exit !(NR && !bad) }' && { echo skip; exit 0; }
fi
echo run
