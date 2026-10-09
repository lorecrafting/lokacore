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
# (including an unmerged branch or review-<PR>, or a dirty PR worktree) happens before any change, except that a stale script copy first fast-forwards main.
# review-<PR> counts as merged when `git cherry` finds each of its commits' patches in origin/main.
# A checkout whose copy of this script is behind origin/main fast-forwards and re-runs the new copy.
# An export dirtied again after the commit (a concurrent br write) gets its own Beads commit before the push.
set -u
GH=${GH:-gh}
die() { echo "after_merge: $*" >&2; exit 1; }
[ $# -ge 2 ] && [ $# -le 3 ] || { echo "usage: $0 <PR> <beads-id> [ROADMAP commit subject]" >&2; exit 2; }
pr=$1 id=$2 subject=${3-} j=.beads/issues.jsonl
cd "$(git rev-parse --show-toplevel)" || exit 2
[ "$(git branch --show-current)" = main ] || die 'main is not checked out here'
if [ -z "${AFTER_MERGE_REEXEC-}" ]; then
  git fetch -q origin main || die 'fetch failed'
  git diff --quiet HEAD origin/main -- bin/after_merge.sh || {
    git merge -q --ff-only origin/main || die 'this script is behind main and the pull failed: pull by hand'
    AFTER_MERGE_REEXEC=1 exec sh bin/after_merge.sh "$@"
  }
fi
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
remote=
if git ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1; then
  remote=1
  git fetch -q origin "refs/heads/$branch:refs/remotes/origin/$branch" || die "fetch of $branch failed"
  git merge-base --is-ancestor "origin/$branch" origin/main || die "origin/$branch has commits not in main; nothing changed"
fi
! git rev-parse -q --verify "refs/heads/$branch" > /dev/null || git merge-base --is-ancestor "$branch" origin/main || die "$branch is not in origin/main; nothing changed"
# The record reaches main cherry-picked onto the PR branch (step 5): every commit needs an equivalent there.
review=$(git rev-parse -q --verify "refs/heads/review-$pr") # the sha checked here is the one deleted
if [ -n "$review" ]; then
  cherry=$(git cherry origin/main "$review") || die "git cherry review-$pr failed; nothing changed"
  case $cherry in *+*) die "review-$pr is not in origin/main; nothing changed" ;; esac
  # git cherry skips merge commits, whose resolution could hold unmerged content.
  [ -z "$(git rev-list --merges origin/main.."$review")" ] || die "review-$pr has a merge not in origin/main; nothing changed"
fi
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
! git rev-parse -q --verify "refs/heads/$branch" > /dev/null || git branch -q -d "$branch" || die "$branch is not merged; not deleted"
[ -z "$review" ] || git update-ref -d "refs/heads/review-$pr" "$review" || die "review-$pr moved or not deleted"
[ -z "$remote" ] || git push -q origin --delete "$branch" || die 'remote branch not deleted'
sh bin/review_index.sh || die 'review index not regenerated'
git add $j docs/reviews/README.md && { [ -z "$subject" ] || git add docs/ROADMAP.md; } || die 'add failed'
if ! git diff --cached --quiet; then
  git commit -qm "${subject:-Beads: close $id (merged #$pr)}" || die 'commit failed'
  git diff --quiet -- $j || git commit -qm "Beads: export after $id (merged #$pr)" -- $j || die 'export commit failed'
  git push -q origin main || die 'push failed; commit is local'
fi
echo "after_merge: #$pr done ($id closed, $branch removed)"
