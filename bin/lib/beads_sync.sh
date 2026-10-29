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
  # An unpushed merge advanced the base: a row it took from here that main changed since would merge
  # as main-only (database = base) and lose this checkout's copy. br itself refuses an older main copy
  # (AmbiguousBase) and a row edited here since (export != base: BothModified).
  both=$(python3 -I -c '
import json, subprocess
def rows(text): return {r["id"]: r for r in map(json.loads, filter(str.strip, text.splitlines()))}
def show(rev): return rows(subprocess.run(["git", "show", rev + ":.beads/issues.jsonl"], capture_output=True, text=True, check=True).stdout)
def read(path):
    try: return rows(open(path).read())
    except FileNotFoundError: return {}
head, main, base, export = show("HEAD"), show("origin/main"), read(".beads/beads.base.jsonl"), read(".beads/issues.jsonl")
print(*sorted(i for i in base if base[i] != head.get(i) and main.get(i) != head.get(i) and export.get(i) == base[i]))
') || die 'cannot compare the base with main'
  [ -z "$both" ] || die "rows $both are in this checkout's unpushed merge and main changed them since: a merge would keep main's copy. Nothing changed.
Compare a row: br --no-auto-import show <id> --json; git show origin/main:.beads/issues.jsonl | grep '\"id\":\"<id>\"'
Make one real edit to each (br --no-auto-import update <id> ..., e.g. main's change), then rerun this script:
the merge then refuses BothModified and prints how to keep a side."
  git diff --quiet HEAD origin/main -- .beads/issues.jsonl || git checkout -q HEAD -- .beads/issues.jsonl || die 'cannot reset the export'
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
