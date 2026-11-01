#!/bin/sh
# bin/author.sh stops with a message when the watcher dies before the first good compile, even when a
# stale artifact is lying about: each case below breaks one way it would hang or start the tools.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/bin" "$root/stub" "$root/tools/author-panel/node_modules"
cp "$here/author.sh" "$root/bin/author.sh"
printf '#!/bin/sh\nexit 3\n' > "$root/stub/mise"
chmod +x "$root/stub/mise"
export LOKA_DEV_CARTRIDGE=artifact.json
expect() { # label, status (or any nonzero: the exit trap's kill 0 can end it as 143), text
  [ "$got_status" != 0 ] && { [ "$2" = any ] || [ "$got_status" = "$2" ]; } && grep -q "$3" "$root/err" ||
    { echo "author control failed ($1): status $got_status, wanted $2 with '$3'" >&2; cat "$root/err" >&2; exit 1; }
}
# Its exit trap runs `kill 0`: a group of its own keeps this script out of it.
run() {
  got_status=0
  { PATH="$root/stub:$PATH" perl -e 'setpgrp; exec @ARGV' sh "$root/bin/author.sh" "$@" > /dev/null 2> "$root/err"; } 2> /dev/null || got_status=$?
}

run
expect "no argument" 2 "usage: bin/author.sh"
run cartridges/x
expect "watcher dies" any "The watcher stopped before the first good compile"
mkdir -p "$root/mobile/app" && echo '{}' > "$root/mobile/app/artifact.json"
run cartridges/x
expect "stale artifact" any "The watcher stopped before the first good compile"
