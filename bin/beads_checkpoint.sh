#!/bin/sh
# Beads checkpoint in the main checkout (docs/HANDOFF.md, Session procedure): pull main, flush the
# database to .beads/issues.jsonl, refuse a machine path, commit the export and docs/HANDOFF.md, push.
#   bin/beads_checkpoint.sh ["commit subject"]
# Refuses before any change unless main is checked out, has no unpushed commit and no tracked file
# other than those two is dirty. A dirty export is set aside for the pull and copied back (as bin/after_merge.sh does); it is
# refused when main also changed the export. A rejected push stops with the manual recovery lines.
set -u
die() { echo "beads_checkpoint: $*" >&2; exit 1; }
subject=${1:-Beads: checkpoint} j=.beads/issues.jsonl here=$(cd "$(dirname "$0")" && pwd)
cd "$(git rev-parse --show-toplevel)" || exit 2
[ "$(git branch --show-current)" = main ] || die 'main is not checked out here'
for f in $(git status --porcelain --untracked-files=no | cut -c4-); do
  [ "$f" = $j ] || [ "$f" = docs/HANDOFF.md ] || die "uncommitted $f"
done
git fetch -q origin main || die 'fetch failed'
[ -z "$(git rev-list origin/main..HEAD)" ] || die 'main has unpushed commits: push or drop them first'
git diff --quiet -- $j || git diff --quiet HEAD origin/main -- $j || die 'main changed the Beads export and the local one is dirty: merge it by hand (br sync --merge)'
tmp=$(mktemp -d) && trap 'rm -rf "$tmp"' EXIT
git diff --quiet -- $j || { cp $j "$tmp/export" && git checkout -- $j; } || die 'cannot set the export aside'
if ! git pull -q --ff-only origin main; then
  [ ! -f "$tmp/export" ] || cp "$tmp/export" $j
  die 'pull failed (export restored)'
fi
[ ! -f "$tmp/export" ] || cp "$tmp/export" $j
br sync --flush-only > /dev/null || die 'br sync --flush-only failed'
python3 "$here/check_beads_export.py" $j || die 'export not committed: fix the issue text, rerun'
git add $j docs/HANDOFF.md || die 'git add failed'
git diff --cached --quiet || git commit -q -m "$subject" || die 'commit failed'
git push -q origin main || die "push rejected: git pull --rebase origin main; br sync --merge; br sync --flush-only; commit $j; push"
echo "beads_checkpoint: pushed $(git rev-parse --short HEAD)"
