#!/bin/sh
# `br create` that also clears the local path br writes into source_repo_path (docs/BEADS.md),
# so the export check never refuses the new row. Prints the new id.
#   bin/br_create.sh <br create arguments>
set -eu
id=$(br create --silent "$@")
echo "$id"
br update "$id" --source-repo lokacore --source-repo-path '' > /dev/null
# Warn, not refuse: the export check (bin/check_beads_export.py) refuses such a row at commit time.
# Only the new issue's own text fields: show also lists linked issues.
br show "$id" --json | python3 -B -c '
import json, sys
sys.path.insert(0, sys.argv[1])
from check_beads_export import LOCAL_PATH
if any(isinstance(v, str) and LOCAL_PATH.search(v) for v in json.load(sys.stdin)[0].values()):
    print(f"br_create: warning: {sys.argv[2]} text has an absolute or home-relative path; use repo-relative paths and worktree names (docs/WORKFLOW.md step 2)", file=sys.stderr)
' "$(dirname "$0")" "$id" || true
