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

# Review records: a throwaway repo whose docs/reviews/README.md links no record. An unlinked
# well-named record must pass (no index); a badly named one must fail.
R=$(mktemp -d "${TMPDIR:-/tmp}/reviews.XXXXXX")
trap 'rm -rf "$P" "$D" "$R"' EXIT
mkdir -p "$R/bin" "$R/docs/reviews" "$R/docs/decisions"
cp bin/check_docs.exs "$R/bin/"
printf '[a](AGENTS.md) [r](docs/reviews/README.md) [d](docs/decisions/README.md)\n' > "$R/README.md"
printf '# A\n' > "$R/AGENTS.md"
printf '# R\n' > "$R/docs/reviews/README.md"
printf '# D\n' > "$R/docs/decisions/README.md"
printf '# Rec\n[a](../../AGENTS.md)\n' > "$R/docs/reviews/2026-01-01-x-review.md"
(cd "$R" && git init -q && git add . && elixir bin/check_docs.exs > out 2>&1) || { echo "FAIL: unlinked review record refused"; cat "$R/out"; exit 1; }
printf '# Bad\n' > "$R/docs/reviews/Bad.md"
if (cd "$R" && git add . && elixir bin/check_docs.exs > out 2>&1); then echo "FAIL: badly named review record passed"; exit 1; fi
grep -q 'review record docs/reviews/Bad.md' "$R/out" || { echo "FAIL: no naming message"; cat "$R/out"; exit 1; }
echo "ok   docs: review records found without an index, named by date"
