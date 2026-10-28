#!/bin/sh
# Merge gate (docs/PM.md step 7, loka-fxeq): merge a reviewed PR only on the exact head that
# bin/wait_ci.sh passed (printing bin/ci_timing.sh on that head either way), then run bin/after_merge.sh with the same arguments. Run in the main checkout;
# with a ROADMAP subject, make the ROADMAP status edit first (after_merge commits it).
#   bin/merge_pr.sh <PR> <beads-id[,beads-id...]> [ROADMAP commit subject]
# Refuses before merging when main is not checked out, a tracked file other than .beads/issues.jsonl
# (and docs/ROADMAP.md with a subject) is dirty, a subject is given with ROADMAP unedited, the PR
# is not OPEN, or wait_ci on its head is not green.
set -u
GH=${GH:-gh}
die() { echo "merge_pr: $*" >&2; exit 1; }
[ $# -ge 2 ] && [ $# -le 3 ] || { echo "usage: $0 <PR> <beads-id[,beads-id...]> [ROADMAP commit subject]" >&2; exit 2; }
pr=$1 subject=${3-} here=$(dirname "$0")
[ "$(git branch --show-current)" = main ] || die 'main is not checked out here'
for f in $(git status --porcelain --untracked-files=no | cut -c4-); do
  [ "$f" = .beads/issues.jsonl ] || { [ -n "$subject" ] && [ "$f" = docs/ROADMAP.md ]; } || die "uncommitted $f"
done
[ -z "$subject" ] || ! git diff --quiet -- docs/ROADMAP.md || die 'subject given but docs/ROADMAP.md is unchanged'
info=$($GH pr view "$pr" --json state,headRefOid --jq '"\(.state) \(.headRefOid)"') || die "cannot read PR #$pr"
[ "${info%% *}" = OPEN ] || die "PR #$pr is ${info%% *}, not OPEN"
sha=${info#* }
sh "$here/wait_ci.sh" "$sha"; ci=$?
sh "$here/ci_timing.sh" "$sha" # cancelled jobs and sim times, green or red (docs/PM.md step 7)
[ "$ci" -eq 0 ] || die "CI on $sha is not green: no merge"
$GH pr merge "$pr" --merge --match-head-commit "$sha" || die "gh pr merge failed on $sha"
sh "$here/after_merge.sh" "$@" || die "merged; bookkeeping failed: rerun bin/after_merge.sh $*"
