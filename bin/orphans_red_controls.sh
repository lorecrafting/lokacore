#!/bin/sh
# bin/orphans.sh lists only a busy, old orphan: each skipped line below breaks one of its conditions.
set -eu
f=$(mktemp)
trap 'rm -f "$f"' EXIT
cat > "$f" <<'PS'
101 1 1-04:00:00 100.0 python -
102 1 02:00:00 55.0 node build.js
103 2 05:00:00 90.0 python child.py
104 1 00:30:00 90.0 python young.py
105 1 05:00:00 3.0 python idle.py
106 1 05:00:00 90.0 /usr/libexec/daemond
107 1 05:00:00 90.0 node storybook dev
108 1 05:00:00 90.0 node mobile/app/node_modules/expo/jest.js
PS
got=$(sh "$(dirname "$0")/orphans.sh" "$f" | cut -d' ' -f1 | tr '\n' ' ')
[ "$got" = "101 102 108 " ] || { echo "orphans control failed: listed '$got', expected '101 102 108 '" >&2; exit 1; }
