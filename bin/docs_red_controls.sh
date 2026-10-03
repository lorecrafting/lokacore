#!/bin/sh
# Plant a doc citing a missing file, a line past the end (AGENTS.md has fewer than 99999
# lines; its last line passes) and an ambiguous bare name, and require bin/check_docs.exs to
# report each as a stale pointer and exit non-zero. Only the file this script created is removed.
set -eu
cd "$(dirname "$0")/.."
P=$(mktemp "${TMPDIR:-/tmp}/pointers.XXXXXX")
trap 'rm -f "$P"' EXIT
n=$(wc -l < AGENTS.md | tr -d ' ')
echo "\`docs/no_such_file.ts:3\` \`AGENTS.md:$((n + 1))\` \`session.ts:1\` \`AGENTS.md:$n\`" > "$P"
if out=$(elixir bin/check_docs.exs AGENTS.md "$P" 2>&1); then echo "FAIL: check_docs passed planted pointers"; exit 1; fi
for want in "no_such_file.ts:3 (no such tracked file)" "AGENTS.md:$((n + 1)) (past the end" "session.ts:1 (ambiguous name"; do
  case "$out" in *"$want"*) ;; *) echo "FAIL: missing \"$want\"\n$out"; exit 1;; esac
done
case "$out" in *"AGENTS.md:$n "*) echo "FAIL: last line of AGENTS.md reported\n$out"; exit 1;; esac
echo "ok   docs: stale code pointers"
