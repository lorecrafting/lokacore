# The Beads sync step of bin/after_merge.sh and bin/beads_checkpoint.sh (loka-ivjq.28; docs/BEADS.md):
# pull main and fold the database and main's export together with `br sync --merge` (three-way on
# .beads/beads.base.jsonl), so a local Beads write and a moved main export need no hand merge. Sourced
# before any cd (it reads $0); beads_sync runs at the checkout root after the caller fetched origin main
# and calls the caller's die. The pull and a refused merge leave main fast-forwarded.
beads_bin=$(cd "$(dirname "$0")" && pwd)
# br once more after `br doctor migrate-schema recover` on a stale WAL index or a busy database
# (loka-8zf5); any other failure prints br's error and returns 1.
br1() {
  err=$(br "$@" 2>&1 > /dev/null) && return 0
  case $err in
    *'WAL index'* | *'database is busy'*) echo "br $1: $err; recover and retry once" >&2
      br doctor migrate-schema recover > /dev/null && br "$@" > /dev/null ;;
    *) echo "$err" >&2; return 1 ;;
  esac
}
beads_sync() {
  # The export is a flush of the database, so discarding it loses nothing (the merge rebuilds it). An
  # unmoved export stays: after an uncommitted merge the base equals it, and HEAD's older copy would
  # make the next merge refuse with AmbiguousBase.
  git diff --quiet HEAD origin/main -- .beads/issues.jsonl || git checkout -q -- .beads/issues.jsonl || die 'cannot reset the export'
  # Hooks off: the post-merge import is last-writer-wins and would hide a same-row conflict from the merge.
  git -c core.hooksPath=/dev/null pull -q --ff-only origin main || die 'pull failed (main changed a dirty tracked file): set that file aside, rerun'
  br1 sync --merge || die "br sync --merge refused: main is fast-forwarded; the database, export and base are unchanged.
Compare a row: br --no-auto-import show <id> --json; grep '\"id\":\"<id>\"' .beads/issues.jsonl (main's copy).
Until this is resolved a plain br command imports main's rows over this checkout's: use only these.
Keep this checkout's rows: br sync --merge --force-db  (main's other rows are merged in).
Keep main's rows: br sync --merge --force-jsonl. AmbiguousBase = main holds an older copy of a
row edited here (this checkout's merged export was never pushed): --force-db once every listed
BothModified row is compared (--force-db keeps this checkout's side of those too). Then rerun this script."
  python3 "$beads_bin/check_beads_export.py" .beads/issues.jsonl || die 'machine path in the export: fix the issue text with br update, rerun'
}
