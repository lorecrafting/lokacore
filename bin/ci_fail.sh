#!/bin/sh
# Print the failing lines (at most 40 per run) of every failed workflow run on <sha> or <branch>
# (its current origin head, fetched first), so a red run is triaged without reading its log.
#   bin/ci_fail.sh <sha|branch>
# Exit 0 when no run on that head failed, 1 when one did, 2 on a bad argument or fetch.
[ $# = 1 ] || { echo "usage: $0 <sha|branch>" >&2; exit 2; }
sha=$1; cd "$(dirname "$0")/.." || exit 2
case $sha in *[!0-9a-f]*) git fetch -q origin "$sha" && sha=$(git rev-parse FETCH_HEAD) || { echo "ci_fail: cannot fetch $1" >&2; exit 2; } ;; esac
ids=$(gh run list --commit "$sha" --json databaseId,name,conclusion -q '.[] | select(.conclusion == "failure") | "\(.databaseId) \(.name)"')
[ -n "$ids" ] || { echo "ci_fail: no failed run on $sha"; exit 0; }
echo "$ids" | while read -r id name; do
  echo "== $name (run $id)"
  # Log lines are "job<TAB>step<TAB>timestamp text"; keep the job and the text.
  gh run view "$id" --log-failed | grep -E 'FAIL|✖|✘|not ok|##\[error\]|Error:|AssertionError|expected' \
    | awk -F '\t' '{ sub(/^[0-9T:.Z-]+ /, "", $3); print $1 ": " $3 }' | head -40
done
exit 1
