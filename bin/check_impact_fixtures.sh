#!/bin/sh
# The SystemDataModel Impact story pins the fixture links of cartridge.schema.json, which come from its
# row in protocol/README.md; the two lists must match in order (a new fixture row broke hosted book-e2e).
cd "$(git rev-parse --show-toplevel)" || exit 2
row=$(grep '^| `cartridge.schema.json`' protocol/README.md | grep -o '`[a-z_0-9]*\.json`' | tr -d '`')
story=$(sed -n '/^export const Impact/,/^};/p' mobile/app/stories/SystemDataModel.stories.tsx | grep -o "'[a-z_0-9]*\.json'" | tr -d "'")
[ -n "$row" ] && [ "$row" = "$story" ] || { echo "Impact story list differs from the README row:"; echo "$row" | sed 's/^/  README: /'; echo "$story" | sed 's/^/  story:  /'; exit 1; }
