#!/bin/sh
# CI path filter (loka-n0ng), the `changes` job of ci.yml and book-e2e.yml: prints `code=<bool>` and
# `sim_walk=<bool>` for $GITHUB_OUTPUT from the head's diff against its merge base with origin/main
# (the whole branch, not the last push: the merge gate reads the head's run).
# code=false: every changed file is prose under docs/ or .beads/ (lint and the docs check still run). Code too: what
# tests, generators or contracts.exs read or check: docs/spec, docs/system, JSON, generated (.gen.) files, and the
# prose the tests read (grep of kernel/ts, mobile/app, test and bin/*.exs for docs/ paths, 2026-10-28).
# sim_walk=true: kernel/ts/src, lib, cartridges, protocol, the sim inputs, the Book app, the Elixir build (mix, config, bin/loka),
# the deps, .github or the filter changed.
# Any event but push, or a diff that cannot be read or is empty: everything runs.
#   bin/ci_changes.sh <github.event_name>   (needs full history: checkout fetch-depth 0)
all() { printf 'code=true\nsim_walk=true\n'; exit 0; }
[ "${1-}" = push ] || all
base=$(git merge-base origin/main HEAD 2>/dev/null) && files=$(git diff --name-only "$base" HEAD) && [ -n "$files" ] || all
has() { printf '%s\n' "$files" | grep -qE "$1" && echo true || echo false; }
echo "code=$(printf '%s\n' "$files" | grep -qvE '^(docs|\.beads)/' && echo true || has '^docs/(spec|system|blocks|archive/(spec|decisions))/|^docs/.*(\.jsonl?$|\.gen\.)|^docs/(BOOK-UI-COMPONENTS|CHECKS|MECHANICS-TOOLBOX|ROADMAP|web-preview)\.md$')"
echo "sim_walk=$(has '^(kernel/ts/(src|play)|lib|cartridges|protocol|mobile/app|config|\.github)/|^kernel/ts/(test/(sim|read)|package)|^mix\.(exs|lock)$|^bin/(loka|ci_changes\.sh)$')"
