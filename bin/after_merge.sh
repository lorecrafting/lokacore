#!/bin/sh
# PM bookkeeping after a reviewed PR merged (docs/PM.md step 7), in the integration checkout:
# pull main, close the Beads issue, remove the PR branch's worktree, delete the branch (local and
# remote) and review-<PR>, commit the Beads export (plus a ROADMAP edit already made) and push main.
# A review-<PR> not yet in main whose commits touch only docs/reviews/ is cherry-picked onto main first
# (a record with no fix round; the PM pushing it into the PR cancelled the developer's CI, loka-o0pw).
#   bin/after_merge.sh <PR> <beads-id[,beads-id...]> [ROADMAP commit subject]
# Refuses unless the PR is MERGED, main is checked out and the tracked files are clean (untracked files are ignored, like pm_merge.sh) apart from
# .beads/issues.jsonl, and docs/ROADMAP.md (which must then be edited) when a subject is given.
# The pull and the Beads merge are bin/lib/beads_sync.sh (`br sync --merge`): a dirty export and a
# moved main export fold together; only a row edited on both sides refuses, after main is pulled. Every other refusal
# (including an unmerged branch, a review-<PR> touching other paths, or a dirty PR worktree) happens before any change,
# except that a stale script copy first fast-forwards main and a failed record cherry-pick comes after the pull.
# review-<PR> counts as merged when `git cherry` finds each of its commits' patches in origin/main.
# A checkout whose copy of this script is behind origin/main fast-forwards and re-runs the new copy.
# A rerun after a failed Beads commit works: br close is skipped for an issue already closed.
# An export dirtied again after the commit (a concurrent br write) gets its own Beads commit before the push.
# br sync and br close retry once on a stale WAL index or a busy database (br1, loka-8zf5).
set -u
GH=${GH:-gh}
die() { echo "after_merge: $*" >&2; exit 1; }
. "$(dirname "$0")/lib/beads_sync.sh"
[ $# -ge 2 ] && [ $# -le 3 ] || { echo "usage: $0 <PR> <beads-id[,beads-id...]> [ROADMAP commit subject]" >&2; exit 2; }
pr=$1 id=$2 subject=${3-} j=.beads/issues.jsonl
cd "$(git rev-parse --show-toplevel)" || exit 2
[ "$(git branch --show-current)" = main ] || die 'main is not checked out here'
if [ -z "${AFTER_MERGE_REEXEC-}" ]; then
  git fetch -q origin main || die 'fetch failed'
  git diff --quiet HEAD origin/main -- bin/after_merge.sh bin/lib/beads_sync.sh || {
    git -c core.hooksPath=/dev/null merge -q --ff-only origin/main || die 'this script is behind main and the pull failed: pull by hand'
    AFTER_MERGE_REEXEC=1 exec sh bin/after_merge.sh "$@"
  }
fi
info=$($GH pr view "$pr" --json state,headRefName --jq '"\(.state) \(.headRefName)"') || die "cannot read PR #$pr"
[ "${info%% *}" = MERGED ] || die "PR #$pr is ${info%% *}, not MERGED"
branch=${info#* }
for f in $(git status --porcelain --untracked-files=no | cut -c4-); do
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
# The record reached main on the PR branch (a fix round, step 5) or is picked here: records only.
review=$(git rev-parse -q --verify "refs/heads/review-$pr") # the sha checked here is the one deleted
picks=
if [ -n "$review" ]; then
  cherry=$(git cherry origin/main "$review") || die "git cherry review-$pr failed; nothing changed"
  # git cherry skips merge commits, whose resolution could hold unmerged content.
  [ -z "$(git rev-list --merges origin/main.."$review")" ] || die "review-$pr has a merge not in origin/main; nothing changed"
  picks=$(printf '%s\n' "$cherry" | sed -n 's/^+ //p')
  for c in $picks; do
    for f in $(git diff-tree --no-commit-id --name-only -r "$c"); do
      case $f in docs/reviews/*) ;; *) die "review-$pr is not in origin/main and $c touches $f; nothing changed" ;; esac
    done
  done
fi
[ -z "$subject" ] || git diff --quiet HEAD origin/main -- docs/ROADMAP.md || die 'main changed docs/ROADMAP.md: set your edit aside, pull, redo it'
beads_sync
# -X theirs: the record wins a docs/reviews/README.md clash; review_index.sh below regenerates it.
[ -z "$picks" ] || git cherry-pick -X theirs --empty=drop $picks > /dev/null \
  || { git cherry-pick --abort; die "cherry-pick of review-$pr failed; main pulled, nothing else changed"; }
# A rerun after a failed Beads commit finds the issue closed already.
for i in $(echo "$id" | tr , ' '); do
  [ "$(br show "$i" --json | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["status"])')" = closed ] \
    || br1 close "$i" --reason "Merged #$pr" || die "br close $i failed"
done
[ -z "$wt" ] || git worktree remove "$wt" || die "worktree for $branch not removed (uncommitted work?)"
! git rev-parse -q --verify "refs/heads/$branch" > /dev/null || git branch -q -d "$branch" || die "$branch is not merged; not deleted"
[ -z "$review" ] || git update-ref -d "refs/heads/review-$pr" "$review" || die "review-$pr moved or not deleted"
[ -z "$remote" ] || git push -q origin --delete "$branch" || die 'remote branch not deleted'
sh bin/review_index.sh || die 'review index not regenerated'
git add $j docs/reviews/README.md && { [ -z "$subject" ] || git add docs/ROADMAP.md; } || die 'add failed'
if ! git diff --cached --quiet; then
  git commit -qm "${subject:-Beads: close $id (merged #$pr)}" || die 'commit failed'
  git diff --quiet -- $j || git commit -qm "Beads: export after $id (merged #$pr)" -- $j || die 'export commit failed'
fi
[ -z "$(git rev-list origin/main..HEAD)" ] || git push -q origin main || die 'push failed; commit is local'
echo "after_merge: #$pr done ($id closed, $branch removed)"
