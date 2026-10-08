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

# Plant two bad anchors (another file's, this file's) and two good ones; only the bad ones may be reported.
printf '# Self heading\n[ok](%s/AGENTS.md#simplicity-every-change-every-agent) [ok2](#self-heading) [bad](%s/AGENTS.md#no-such-heading) [bad2](#no-such-self)\n' "$PWD" "$PWD" > "$D/a.md"
if out=$(elixir bin/check_docs.exs AGENTS.md "$D/a.md" 2>&1); then echo "FAIL: check_docs passed planted bad anchors"; exit 1; fi
for want in "AGENTS.md#no-such-heading" "#no-such-self"; do
  case "$out" in *"broken anchor"*"$want"*) ;; *) echo "FAIL: missing anchor \"$want\"\n$out"; exit 1;; esac
done
case "$out" in *"simplicity-every"*|*"#self-heading"*) echo "FAIL: good anchor reported\n$out"; exit 1;; esac
echo "ok   docs: broken anchors"
