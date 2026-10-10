#!/bin/sh
# bin/worktree_setup.sh links main's node_modules for a matching lockfile and never runs npm ci through that link.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
src=$(cd "$(dirname "$0")" && pwd)
t=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$t"' EXIT
mkdir "$t/stub" "$t/main"
# Stub mise: `npm ci` marks a wipe when node_modules is still a link, else installs.
printf '%s\n' '#!/bin/sh' 'case "$*" in *npm*) [ ! -L node_modules ] || touch node_modules/WIPED; rm -f node_modules; mkdir node_modules;; esac' > "$t/stub/mise"
chmod +x "$t/stub/mise"
cd "$t/main"
git init -q . && mkdir bin node_modules && cp "$src/worktree_setup.sh" bin/
echo node_modules > .gitignore; echo A > package-lock.json && cksum < package-lock.json > node_modules/.loka-lock-cksum
git add -A . && git -c user.name=t -c user.email=t@t commit -qm init
git worktree add -q "$t/wt" -b wt
cd "$t/wt"
PATH="$t/stub:$PATH" sh bin/worktree_setup.sh
[ "$(readlink node_modules)" = "$t/main/node_modules" ] || { echo 'worktree_setup control failed: matching lockfile not linked' >&2; exit 1; }
echo B > package-lock.json
PATH="$t/stub:$PATH" sh bin/worktree_setup.sh
[ ! -e "$t/main/node_modules/WIPED" ] && [ ! -L node_modules ] || { echo 'worktree_setup control failed: npm ci ran through the link' >&2; exit 1; }
