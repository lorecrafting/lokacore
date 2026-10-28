# Sourced by after_merge.sh and beads_checkpoint.sh in the main checkout. beads_sync sets a dirty
# .beads/issues.jsonl aside (the database holds its rows), fast-forwards main with hooks off (the
# post-merge import would overwrite a local row edit), then `br sync --merge` folds main's rows and the
# database together and rewrites the export. A row changed on both sides is refused: never --force or
# --force-db, which keep one side silently. check_beads_export.py then refuses a machine path. A failed
# pull or merge restores the export set aside.
# br1 runs br once more after `br doctor migrate-schema recover` on a stale WAL index or a busy
# database (loka-8zf5); any other br failure returns 1. Source it before any cd.
beads_bin=$(cd "$(dirname "$0")" && pwd)
br1() {
  err=$(br "$@" 2>&1 > /dev/null) && return 0
  case $err in
    *'WAL index'* | *'database is busy'*) echo "br $1: $err; recover and retry once" >&2
      br doctor migrate-schema recover > /dev/null && br "$@" > /dev/null ;;
    *) echo "$err" >&2; return 1 ;;
  esac
}
beads_sync() {
  aside=$(mktemp) || return 1
  git diff --quiet -- .beads/issues.jsonl || { cp .beads/issues.jsonl "$aside" && git checkout -- .beads/issues.jsonl; } \
    || { echo 'cannot set the export aside' >&2; rm -f "$aside"; return 1; }
  git -c core.hooksPath=/dev/null pull -q --ff-only origin main && br1 sync --merge || {
    [ ! -s "$aside" ] || cp "$aside" .beads/issues.jsonl
    rm -f "$aside"; echo 'pull or br sync --merge failed (export restored; a row edited on both sides: resolve it with br, then rerun)' >&2; return 1
  }
  rm -f "$aside"
  python3 "$beads_bin/check_beads_export.py" .beads/issues.jsonl || { echo 'the export has a machine path: fix the issue text' >&2; return 1; }
}
