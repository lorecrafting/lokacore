#!/bin/sh
# `br create` that also clears the local path br writes into source_repo_path (docs/BEADS.md),
# so the export check never refuses the new row. Prints the new id.
#   bin/br_create.sh <br create arguments>
set -eu
id=$(br create --silent "$@")
echo "$id"
br update "$id" --source-repo lokacore --source-repo-path '' > /dev/null
# Warn, not refuse: the export check (bin/check_beads_export.py) refuses such a row at commit time.
br show "$id" --json | python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); from check_beads_export import LOCAL_PATH; sys.exit(bool(LOCAL_PATH.search(sys.stdin.read())))' "$(dirname "$0")" \
  || echo "br_create: warning: $id text has an absolute or home-relative path; use repo-relative paths and worktree names (docs/WORKFLOW.md step 2)" >&2
