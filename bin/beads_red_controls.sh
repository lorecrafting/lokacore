#!/bin/sh
# A bad exported path must fail the same checker used by the hook and CI.
set -eu
case_file=$(mktemp)
trap 'rm -f "$case_file"' EXIT
printf '%s\n' '{"id":"loka-example","source_repo_path":null,"description":"docs/ROADMAP.md"}' > "$case_file"
python3 bin/check_beads_export.py "$case_file"
printf '%s\n' '{"id":"loka-example","source_repo_path":"relative/path"}' > "$case_file"
if python3 bin/check_beads_export.py "$case_file" >/dev/null 2>&1; then
  echo 'Beads path control failed: source_repo_path was accepted' >&2
  exit 1
fi
printf '%s\n' '{"id":"loka-example","source_repo_path":null,"description":"/Users/example/secret"}' > "$case_file"
if python3 bin/check_beads_export.py "$case_file" >/dev/null 2>&1; then
  echo 'Beads path control failed: machine path was accepted' >&2
  exit 1
fi
echo 'ok   beads: local export paths refused'
