#!/bin/sh
# bin/prose_lint.py on test/fixtures/prose_lint: each section prints its expected line; a bad alternate key exits 2.
set -eu
dir=test/fixtures/prose_lint
out=$(python3 bin/prose_lint.py "$dir")
for want in "cartridge: $dir (5 keys, 2 with alternates)" 'shared opener "dust": solo.a, solo.b' \
  'one alternate: solo.a' 'shared opener "you": walk.a, walk.b' 'sentence words solo: n=2 mean=2.0 sd=1.0' \
  'sentence words walk: n=4 mean=2.5 sd=0.5' 'reading grade (Flesch-Kincaid): -1.2'; do
  printf '%s\n' "$out" | grep -qxF -- "$want" || { echo "prose lint control failed: no line '$want'" >&2; exit 1; }
done
if printf '%s\n' "$out" | grep -qF 'one alternate: walk.a'; then
  echo 'prose lint control failed: two alternates reported as one' >&2
  exit 1
fi
bad=$(mktemp -d)
trap 'rm -rf "$bad"' EXIT
cp "$dir/text.json" "$bad/"
printf '{"alternates": {"walk.a": ["missing"]}}' > "$bad/cartridge.json"
rc=0
python3 bin/prose_lint.py "$bad" 2>/dev/null || rc=$?
[ "$rc" = 2 ] || { echo "prose lint control failed: bad alternate exited $rc, want 2" >&2; exit 1; }
