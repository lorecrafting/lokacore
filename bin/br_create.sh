#!/bin/sh
# `br create` that also clears the local path br writes into source_repo_path (docs/BEADS.md),
# so the export check never refuses the new row. Prints the new id.
#   bin/br_create.sh <br create arguments>
set -eu
id=$(br create --silent "$@")
echo "$id"
br update "$id" --source-repo lokacore --source-repo-path '' > /dev/null
