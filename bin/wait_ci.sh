#!/bin/sh
# Wait (max ~40 min) until ci and book-e2e exist on <sha> and every workflow there has completed;
# print one line per workflow; exit 0 only when all succeeded.
sha=$1; cd "$(dirname "$0")/.." || exit 2
for i in $(seq 1 40); do
  out=$(gh run list --commit "$sha" --json name,status,conclusion -q '.[] | "\(.name):\(.status):\(.conclusion)"' 2>/dev/null)
  # Both gating workflows must exist: graph-diff or mobile alone can finish first (loka-514z).
  echo "$out" | grep -q '^ci:' && echo "$out" | grep -q '^book-e2e:' && ! echo "$out" | grep -qv ':completed:' && break
  sleep 60
done
echo "$sha"; echo "$out"
echo "$out" | grep -qv ':completed:success' && exit 1 || exit 0
