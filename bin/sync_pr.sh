#!/bin/sh
# After a merge to main: merge origin/main into an open PR branch (never rebase), rebuild
# docs/reviews/README.md as main's list plus the branch's own lines at the end, run the docs
# checker, push. Run in the worktree that has <branch> checked out; toolchain from PATH.
# A conflict outside the union-merged indexes is refused and left untouched. The decisions index
# (docs/decisions/README.md, newest first) is only union-merged: check its order by hand after a sync.
#   bin/sync_pr.sh <branch>
set -u
[ $# -eq 1 ] || { echo "usage: $0 <branch>" >&2; exit 2; }
cd "$(git rev-parse --show-toplevel)" || exit 2
die() { echo "sync_pr: $*" >&2; exit 1; }
idx=docs/reviews/README.md
[ "$(git branch --show-current)" = "$1" ] || die "$1 is not checked out here"
[ -z "$(git status --porcelain)" ] || die 'working tree not clean'
git fetch -q origin main "$1" || die 'fetch failed'
# Done means the pushed branch has main; a local merge whose check or push failed is finished by a rerun.
git merge-base --is-ancestor origin/main "origin/$1" && { echo "sync_pr: origin/$1 already has origin/main"; exit 0; }
if ! git merge-base --is-ancestor origin/main HEAD; then
  own=$(git diff -U0 "$(git merge-base HEAD origin/main)" HEAD -- $idx | sed -n 's/^+\(- .*\)/\1/p')
  git merge --no-commit --no-ff -q origin/main > /dev/null 2>&1 || { git merge --abort; die 'conflict with main; merge it by hand'; }
  git show origin/main:$idx > $idx
  [ -z "$own" ] || printf '%s\n' "$own" >> $idx
  git add $idx
  git commit -qm "Merge origin/main into $1" || die 'commit failed'
  fi
  elixir bin/check_docs.exs || die 'docs check failed; not pushed'
# The pre-push hook runs while the SSH connection idles; keepalives stop GitHub dropping it.
GIT_SSH_COMMAND=${GIT_SSH_COMMAND:-ssh -o ServerAliveInterval=30} git push origin "$1" || die 'push failed'
echo "sync_pr: $1 merged with origin/main and pushed"
