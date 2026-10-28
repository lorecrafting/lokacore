#!/bin/sh
# Beads checkpoint in the main checkout (docs/HANDOFF.md, Session procedure): pull main, flush the
# database to .beads/issues.jsonl, refuse a machine path, commit the export and docs/HANDOFF.md, push.
#   bin/beads_checkpoint.sh ["commit subject"]
# Refuses before any change unless main is checked out, has no unpushed commit and no tracked file
# other than those two is dirty. The pull and Beads merge are beads_sync (bin/lib/beads_sync.sh).
# A rejected push prints the recovery lines.
set -u
die() { echo "beads_checkpoint: $*" >&2; exit 1; }
subject=${1:-Beads: checkpoint} j=.beads/issues.jsonl
. "$(dirname "$0")/lib/beads_sync.sh"
cd "$(git rev-parse --show-toplevel)" || exit 2
[ "$(git branch --show-current)" = main ] || die 'main is not checked out here'
for f in $(git status --porcelain --untracked-files=no | cut -c4-); do
  [ "$f" = $j ] || [ "$f" = docs/HANDOFF.md ] || die "uncommitted $f"
done
git fetch -q origin main || die 'fetch failed'
[ -z "$(git rev-list origin/main..HEAD)" ] || die 'main has unpushed commits: push or drop them first'
beads_sync || die 'export not committed: fix the cause, rerun'
git add $j docs/HANDOFF.md || die 'git add failed'
git diff --cached --quiet || git commit -q -m "$subject" || die 'commit failed'
git push -q origin main || die "push rejected: main moved; rerun bin/beads_checkpoint.sh (it pulls and merges again)"
echo "beads_checkpoint: pushed $(git rev-parse --short HEAD)"
