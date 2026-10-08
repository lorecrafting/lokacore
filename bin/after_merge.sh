#!/bin/sh
# PM bookkeeping after a reviewed PR merged (docs/WORKFLOW.md step 7), in the integration checkout:
# pull main, close the Beads issue, remove the PR branch's worktree, delete the branch (local and
# remote) and review-<PR>, commit the Beads export (plus a ROADMAP edit already made) and push main.
#   bin/after_merge.sh <PR> <beads-id> [ROADMAP commit subject]
# Refuses unless the PR is MERGED, main is checked out and the tree is clean apart from
# .beads/issues.jsonl, and docs/ROADMAP.md (which must then be edited) when a subject is given.
# A dirty export is copied out, reset, the pull runs, it is copied back and `br sync --flush-only`
# rewrites it from the database; it is refused when main also changed the export (the post-merge
# import is not proven to run first, so copying back could drop main's rows). Every refusal
# (including an unmerged branch or review-<PR>, or a dirty PR worktree) happens before any change.
set -u
GH=${GH:-gh}
die() { echo "after_merge: $*" >&2; exit 1; }
[ $# -ge 2 ] && [ $# -le 3 ] || { echo "usage: $0 <PR> <beads-id> [ROADMAP commit subject]" >&2; exit 2; }
pr=$1 id=$2 subject=${3-} j=.beads/issues.jsonl
cd "$(git rev-parse --show-toplevel)" || exit 2
[ "$(git branch --show-current)" = main ] || die 'main is not checked out here'
info=$($GH pr view "$pr" --json state,headRefName --jq '"\(.state) \(.headRefName)"') || die "cannot read PR #$pr"
[ "${info%% *}" = MERGED ] || die "PR #$pr is ${info%% *}, not MERGED"
branch=${info#* }
for f in $(git status --porcelain --untracked-files=all | cut -c4-); do
  [ "$f" = $j ] || { [ -n "$subject" ] && [ "$f" = docs/ROADMAP.md ]; } || die "uncommitted $f"
done
[ -z "$subject" ] || ! git diff --quiet -- docs/ROADMAP.md || die 'subject given but docs/ROADMAP.md is unchanged'
wt=$(git worktree list --porcelain | awk -v b="branch refs/heads/$branch" '/^worktree /{w=substr($0, 10)} $0 == b {print w}')
[ -z "$wt" ] || [ -z "$(git -C "$wt" status --porcelain)" ] || die "the $branch worktree has uncommitted work"
git fetch -q origin main || die 'fetch failed'
for b in "$branch" "review-$pr"; do
  ! git rev-parse -q --verify "refs/heads/$b" > /dev/null || git merge-base --is-ancestor "$b" origin/main || die "$b is not in origin/main; nothing changed"
done
# Copying a dirty export back over main's changes would drop them unless the hook imported them first.
git diff --quiet -- $j || git diff --quiet HEAD origin/main -- $j || die 'main changed the Beads export and the local one is dirty: merge it by hand'
[ -z "$subject" ] || git diff --quiet HEAD origin/main -- docs/ROADMAP.md || die 'main changed docs/ROADMAP.md: set your edit aside, pull, redo it'
tmp=$(mktemp -d) && trap 'rm -rf "$tmp"' EXIT
git diff --quiet -- $j || { cp $j "$tmp/export" && git checkout -- $j; } || die 'cannot set the export aside'
if ! git pull -q --ff-only origin main; then
  [ ! -f "$tmp/export" ] || cp "$tmp/export" $j
  die 'pull failed (export restored)'
fi
[ ! -f "$tmp/export" ] || cp "$tmp/export" $j
br sync --flush-only > /dev/null || die 'br sync --flush-only failed'
br close "$id" --reason "Merged #$pr" > /dev/null || die "br close $id failed"
[ -z "$wt" ] || git worktree remove "$wt" || die "worktree for $branch not removed (uncommitted work?)"
for b in "$branch" "review-$pr"; do
  ! git rev-parse -q --verify "refs/heads/$b" > /dev/null || git branch -q -d "$b" || die "$b is not merged; not deleted"
done
! git ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1 || git push -q origin --delete "$branch" || die 'remote branch not deleted'
git add $j && { [ -z "$subject" ] || git add docs/ROADMAP.md; } || die 'add failed'
if ! git diff --cached --quiet; then
  git commit -qm "${subject:-Beads: close $id (merged #$pr)}" || die 'commit failed'
  git push -q origin main || die 'push failed; commit is local'
fi
echo "after_merge: #$pr done ($id closed, $branch removed)"
