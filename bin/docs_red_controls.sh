#!/bin/sh
# Plant a doc citing a missing file, a line past the end (AGENTS.md has fewer than 99999
# lines; its last line passes) and an ambiguous bare name, and require bin/check_docs.exs to
# report each as a stale pointer and exit non-zero. Only the file this script created is removed.
set -eu
cd "$(dirname "$0")/.."
P=$(mktemp "${TMPDIR:-/tmp}/pointers.XXXXXX")
D=$(mktemp -d "${TMPDIR:-/tmp}/anchors.XXXXXX")
trap 'rm -rf "$P" "$D"' EXIT
n=$(wc -l < AGENTS.md | tr -d ' ')
echo "\`docs/no_such_file.ts:3\` \`AGENTS.md:$((n + 1))\` \`session.ts:1\` \`AGENTS.md:$n\`" > "$P"
if out=$(elixir bin/check_docs.exs AGENTS.md "$P" 2>&1); then echo "FAIL: check_docs passed planted pointers"; exit 1; fi
for want in "no_such_file.ts:3 (no such tracked file)" "AGENTS.md:$((n + 1)) (past the end" "session.ts:1 (ambiguous name"; do
  case "$out" in *"$want"*) ;; *) echo "FAIL: missing \"$want\"\n$out"; exit 1;; esac
done
case "$out" in *"AGENTS.md:$n "*) echo "FAIL: last line of AGENTS.md reported\n$out"; exit 1;; esac
echo "ok   docs: stale code pointers"

# Anchors: x.md has a heading, a repeated heading, a heading with link syntax and an <a id> alias.
# b.md (one level down) links to each; the good ones must pass and the bad ones must be reported.
mkdir "$D/sub"
printf '# Ok\n# Dup\n# Dup\n## See [x](y)\n<a id="al"></a>\n' > "$D/x.md"
printf '[g](../x.md#ok) [g](../x.md#dup-1) [g](../x.md#see-x) [g](../x.md#al) [g](#self)\n# Self\n[b](../x.md#nope) [b](../x.md#dup-2) [b](../x.md#al-missing) [b](#no-self)\n' > "$D/sub/b.md"
if out=$(elixir bin/check_docs.exs AGENTS.md "$D/sub/b.md" 2>&1); then echo "FAIL: check_docs passed planted bad anchors"; exit 1; fi
for want in "x.md#nope" "x.md#dup-2" "x.md#al-missing" "b.md: #no-self"; do
  echo "$out" | grep -q "broken anchor.*$want\$" || { echo "FAIL: missing anchor \"$want\"\n$out"; exit 1; }
done
if [ "$(echo "$out" | grep -c '^broken anchor')" != 4 ]; then echo "FAIL: good anchor reported\n$out"; exit 1; fi
echo "ok   docs: broken anchors"

# Review records: a throwaway repo with the real generator. A record the README does not list
# (stale index) must fail; after bin/review_index.sh it passes; a badly named record fails.
R=$(mktemp -d "${TMPDIR:-/tmp}/reviews.XXXXXX")
trap 'rm -rf "$P" "$D" "$R"' EXIT
mkdir -p "$R/bin" "$R/docs/reviews" "$R/docs/decisions"
cp bin/check_docs.exs bin/review_index.sh "$R/bin/"
printf '[a](AGENTS.md) [r](docs/reviews/README.md) [d](docs/decisions/README.md)\n' > "$R/README.md"
printf '# A\n' > "$R/AGENTS.md"
printf '# D\n' > "$R/docs/decisions/README.md"; printf "# M\n" > "$R/docs/decisions/owner-decision-move-forward-2026-10-07.md"; printf -- "- [m](owner-decision-move-forward-2026-10-07.md)\n" >> "$R/docs/decisions/README.md"
printf '# Rec\nVerdict **APPROVE**\n' > "$R/docs/reviews/2026-01-01-x-review.md"
cd "$R"; git init -q; sh bin/review_index.sh
printf '# Rec 2\n' > docs/reviews/2026-01-02-y-review.md
if git add . && elixir bin/check_docs.exs > out 2>&1; then echo "FAIL: stale review index passed"; exit 1; fi
grep -q 'README.md is stale' out || { echo "FAIL: no stale-index message"; cat out; exit 1; }
sh bin/review_index.sh; git add .
elixir bin/check_docs.exs > out 2>&1 || { echo "FAIL: generated review index refused"; cat out; exit 1; }
grep -qxF -- '- [Rec](2026-01-01-x-review.md): **APPROVE**' docs/reviews/README.md || { echo "FAIL: index line"; cat docs/reviews/README.md; exit 1; }
printf '# Bad\n' > docs/reviews/Bad.md; sh bin/review_index.sh
if git add . && elixir bin/check_docs.exs > out 2>&1; then echo "FAIL: badly named review record passed"; exit 1; fi
grep -q 'review record docs/reviews/Bad.md' out || { echo "FAIL: no naming message"; cat out; exit 1; }
echo "ok   docs: generated review index, record names"
