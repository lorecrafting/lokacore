# Sourced by after_merge.sh and beads_checkpoint.sh in the main checkout. beads_sync sets a dirty
# .beads/issues.jsonl aside (the database holds its rows), fast-forwards main, then
# `br sync --merge --force` folds main's rows and the database together and rewrites the export;
# a row changed on both sides keeps the newer edit (plain --merge stops on any locally edited row).
# check_beads_export.py then refuses a machine path. A failed pull restores the export.
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
  if ! git pull -q --ff-only origin main; then
    [ ! -s "$aside" ] || cp "$aside" .beads/issues.jsonl
    rm -f "$aside"; echo 'pull failed (export restored)' >&2; return 1
  fi
  rm -f "$aside"
  br1 sync --merge --force || { echo 'br sync --merge --force failed' >&2; return 1; }
  python3 "$beads_bin/check_beads_export.py" .beads/issues.jsonl || { echo 'the export has a machine path: fix the issue text' >&2; return 1; }
}
