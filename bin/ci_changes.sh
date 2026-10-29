#!/bin/sh
# CI path filter (loka-n0ng), the `changes` job of ci.yml and book-e2e.yml: prints `code=<bool>` and
# `sim_walk=<bool>` for $GITHUB_OUTPUT from the head's diff against its merge base with origin/main
# (the whole branch, not the last push: the merge gate reads the head's run).
# code=false: every changed file is prose under docs/ or .beads/ (lint and the docs check still run);
# docs/spec/, docs/system/ and JSON under docs/ count as code, since tests and contracts.exs read them.
# sim_walk=true: kernel/ts/src, lib, cartridges, protocol or the filter itself changed.
# Any event but push, or a diff that cannot be read or is empty: everything runs.
#   bin/ci_changes.sh <github.event_name>   (needs full history: checkout fetch-depth 0)
all() { printf 'code=true\nsim_walk=true\n'; exit 0; }
[ "${1-}" = push ] || all
base=$(git merge-base origin/main HEAD 2>/dev/null) && files=$(git diff --name-only "$base" HEAD) && [ -n "$files" ] || all
has() { printf '%s\n' "$files" | grep -qE "$1" && echo true || echo false; }
echo "code=$(printf '%s\n' "$files" | grep -qvE '^(docs|\.beads)/' && echo true || has '^docs/(spec|system)/|^docs/.*\.jsonl?$')"
echo "sim_walk=$(has '^(kernel/ts/src|lib|cartridges|protocol)/|^\.github/workflows/(ci|book-e2e)\.yml$|^bin/ci_changes\.sh$')"
