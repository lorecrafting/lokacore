#!/bin/sh
# Wait (max ~40 min) until every hosted workflow on <sha> has completed; print one line per workflow.
sha=$1; cd "$(dirname "$0")/.." || exit 2
for i in $(seq 1 40); do
  out=$(gh run list --commit "$sha" --json name,status,conclusion -q '.[] | "\(.name):\(.status):\(.conclusion)"' 2>/dev/null)
  [ "$(echo "$out" | grep -c .)" -ge 2 ] && ! echo "$out" | grep -qv ':completed:' && break
  sleep 60
done
echo "$sha"; echo "$out"
echo "$out" | grep -qv ':completed:success' && exit 1 || exit 0
