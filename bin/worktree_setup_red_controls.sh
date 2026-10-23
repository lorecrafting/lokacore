#!/bin/sh
# bin/worktree_setup.sh clones main's node_modules for a matching lockfile and never runs npm ci through a link.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
src=$(cd "$(dirname "$0")" && pwd)
t=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$t"' EXIT
mkdir "$t/stub" "$t/main"
# Stub mise: `npm ci` marks a wipe when node_modules is still a link, else installs.
printf '%s\n' '#!/bin/sh' 'case "$*" in *npm*) [ ! -L node_modules ] || touch node_modules/WIPED; rm -rf node_modules; mkdir node_modules;; esac' > "$t/stub/mise"
chmod +x "$t/stub/mise"
cd "$t/main"
git init -q . && mkdir bin node_modules && cp "$src/worktree_setup.sh" bin/
echo node_modules > .gitignore; echo A > package-lock.json && cksum < package-lock.json > node_modules/.loka-lock-cksum
git add -A . && git -c user.name=t -c user.email=t@t commit -qm init
git worktree add -q "$t/wt" -b wt
mkdir -p node_modules/.cache "$t/wt/node_modules.tmp/x" # main's cache; a partial clone left by an earlier run
cd "$t/wt"
PATH="$t/stub:$PATH" sh bin/worktree_setup.sh
[ ! -L node_modules ] && [ -f node_modules/.loka-lock-cksum ] && [ ! -e node_modules.tmp ] || { echo 'worktree_setup control failed: matching lockfile not cloned' >&2; exit 1; }
[ ! -e node_modules/.cache ] || { echo "worktree_setup control failed: main's .cache cloned" >&2; exit 1; }
echo stale > node_modules/.loka-lock-cksum
PATH="$t/stub:$PATH" sh bin/worktree_setup.sh
cmp -s node_modules/.loka-lock-cksum "$t/main/node_modules/.loka-lock-cksum" || { echo 'worktree_setup control failed: stale clone kept' >&2; exit 1; }
rm -rf node_modules && ln -s "$t/main/node_modules" node_modules # an older worktree's link
PATH="$t/stub:$PATH" sh bin/worktree_setup.sh
[ ! -L node_modules ] || { echo 'worktree_setup control failed: older link kept' >&2; exit 1; }
rm -rf node_modules && ln -s "$t/main/node_modules" node_modules
echo B > package-lock.json
PATH="$t/stub:$PATH" sh bin/worktree_setup.sh
[ ! -e "$t/main/node_modules/WIPED" ] && [ ! -L node_modules ] || { echo 'worktree_setup control failed: npm ci ran through the link' >&2; exit 1; }
echo A > package-lock.json && rm -rf node_modules
echo B > "$t/main/package-lock.json" && touch "$t/main/node_modules/DRIFT" # a stray npm install in main; marker kept
PATH="$t/stub:$PATH" sh bin/worktree_setup.sh
[ ! -e node_modules/DRIFT ] || { echo "worktree_setup control failed: main's drifted install cloned" >&2; exit 1; }
echo A > "$t/main/package-lock.json" && rm "$t/main/node_modules/DRIFT"
echo stale > node_modules/.loka-lock-cksum
touch "$t/main/node_modules/unreadable" && chmod 000 "$t/main/node_modules/unreadable"
if PATH="$t/stub:$PATH" sh bin/worktree_setup.sh 2> /dev/null || [ -e node_modules.tmp ]; then echo 'worktree_setup control failed: a failed clone exited 0 or left node_modules.tmp' >&2; exit 1; fi
