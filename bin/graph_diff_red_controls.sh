#!/bin/sh
# bin/graph_diff.py on two planted graphs: each kind of change is reported, a moved line is not.
set -eu
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
node() { printf '{"name":"%s","line":%s,"kind":"%s"}' "$1" "$2" "$3"; }
printf '{"nodes":[%s,%s,%s],"edges":[{"from":"A","to":"B","field":"b"}]}' \
  "$(node A 1 object)" "$(node B 2 id)" "$(node Gone 3 id)" > "$dir/base.json"
printf '{"nodes":[%s,%s,%s],"edges":[{"from":"A","to":"New","field":null}]}' \
  "$(node A 9 object)" "$(node B 2 enum)" "$(node New 4 id)" > "$dir/head.json"
out=$(python3 bin/graph_diff.py "$dir/base.json" "$dir/head.json")
for want in '<!-- system-graph-diff -->' '**Nodes added (1)**' '- `New`' '**Nodes removed (1)**' \
  '- `Gone`' '**Nodes changed (1)**' '- `B`: kind' '- `A` → `New`' '**Edges removed (1)**' \
  '- `A` → `B` (b)'; do
  printf '%s\n' "$out" | grep -qxF -- "$want" || { echo "graph diff control failed: no line '$want'" >&2; exit 1; }
done
if printf '%s\n' "$out" | grep -qF -- '`A`:'; then
  echo 'graph diff control failed: a moved line reported as a change' >&2
  exit 1
fi
out=$(python3 bin/graph_diff.py "$dir/base.json" "$dir/base.json")
printf '%s\n' "$out" | grep -qxF 'No node or edge changes.' || { echo 'graph diff control failed: no-change body' >&2; exit 1; }
