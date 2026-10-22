#!/bin/sh
# New batch branch (loka-9pio): a worktree from origin/main under worktrees.noindex next to the main
# checkout, made checkable by bin/worktree_setup.sh before the first push (the pre-push hook needs
# deps), then pushed with upstream. Prints the worktree and head.
#   bin/new_batch.sh <branch>
set -eu
[ $# = 1 ] || { echo "usage: $0 <branch>" >&2; exit 2; }
b=$1
main=$(git -C "$(dirname "$0")" worktree list --porcelain | sed -n '1s/^worktree //p')
wt=$(dirname "$main")/worktrees.noindex/$(echo "$b" | tr / -)
git -C "$main" fetch -q origin main
git -C "$main" worktree add -q -b "$b" "$wt" origin/main
"$wt/bin/worktree_setup.sh"
git -C "$wt" push -q -u origin "$b"
echo "$wt $(git -C "$wt" rev-parse HEAD)"
