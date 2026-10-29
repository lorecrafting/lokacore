#!/bin/sh
# Beads checkpoint in the main checkout (docs/HANDOFF.md, Session procedure): pull main and merge the
# database with its export (bin/lib/beads_sync.sh), refuse a machine path, commit the export and
# docs/HANDOFF.md, push.
#   bin/beads_checkpoint.sh ["commit subject"]
# Refuses before any change unless main is checked out, has no unpushed commit and no tracked file
# other than those two is dirty; a refused pull or merge leaves main fast-forwarded. A rejected push undoes this run's commit (the files stay dirty): rerun.
set -u
die() { echo "beads_checkpoint: $*" >&2; exit 1; }
. "$(dirname "$0")/lib/beads_sync.sh"
subject=${1:-Beads: checkpoint} j=.beads/issues.jsonl
cd "$(git rev-parse --show-toplevel)" || exit 2
[ "$(git branch --show-current)" = main ] || die 'main is not checked out here'
for f in $(git status --porcelain --untracked-files=no | cut -c4-); do
  [ "$f" = $j ] || [ "$f" = docs/HANDOFF.md ] || die "uncommitted $f"
done
git fetch -q origin main || die 'fetch failed'
[ -z "$(git rev-list origin/main..HEAD)" ] || die 'main has unpushed commits: push or drop them first'
beads_sync
git add $j docs/HANDOFF.md || die 'git add failed'
before=$(git rev-parse HEAD)
git diff --cached --quiet || git commit -q -m "$subject" || die 'commit failed'
git push -q origin main || { git reset -q "$before"; die 'push failed (see git above; usually main moved): this run'\''s commit is undone; rerun bin/beads_checkpoint.sh'; }
echo "beads_checkpoint: pushed $(git rev-parse --short HEAD)"
