#!/bin/sh
# Each way the sound manifest can be wrong must fail bin/check_sounds.py, on a planted copy.
set -eu
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
dir=$tmp/mobile/app/book/sounds
reset() { # one good final row and its file, then the case's own edit of a row
  rm -rf "$dir"
  mkdir -p "$dir"
  : >"$dir/a.m4a"
  python3 - "$dir/manifest.json" "${1:-}" <<'PY'
import json, sys
row = dict(file="a.m4a", status="final", used_for="x", author="x", source_url="x", licence="CC0",
           credit=None, human_made_evidence="x", edited="cut", replace_note=None)
exec(sys.argv[2])
json.dump([row], open(sys.argv[1], "w"))
PY
}
check() { python3 bin/check_sounds.py --root "$tmp" "$@" >"$tmp/out" 2>&1; }
refused() { # refused <what the failure says> [check flags]
  said=$1
  shift
  if check "$@"; then
    echo "sounds control failed: accepted, expected: $said" >&2
    exit 1
  fi
  grep -qF "$said" "$tmp/out" || {
    echo "sounds control failed: expected $said, got: $(cat "$tmp/out")" >&2
    exit 1
  }
}
reset
check --release # the good copy passes, so each refusal below comes from its own plant
reset
: >"$dir/b.m4a"
refused 'b.m4a: no row'
reset
rm "$dir/a.m4a"
refused 'a.m4a: row has no file'
for field in file status used_for author source_url licence human_made_evidence edited; do
  reset "row['$field'] = ''"
  refused "empty $field"
done
reset
python3 -c 'import json, sys; rows = json.load(open(sys.argv[1])); json.dump(rows * 2, open(sys.argv[1], "w"))' "$dir/manifest.json"
refused 'a.m4a: two rows'
reset "row['status'] = 'placeholder'"
refused 'empty replace_note'
reset "row['status'] = 'draft'"
refused 'status must be'
reset "row['licence'] = 'CC BY-NC 4.0'"
refused 'licence must be'
reset "row['licence'] = 'CC BY 4.0'"
refused 'needs a credit'
reset "row['licence'] = 'CC BY 4.0'; row['credit'] = 'x'"
check
reset "row['status'] = 'placeholder'; row['replace_note'] = 'y'"
check # a placeholder passes the push
refused 'still a placeholder' --release
check --report
grep -qF 'x: a.m4a' "$tmp/out" || {
  echo 'sounds control failed: the report did not list the placeholder' >&2
  exit 1
}
echo 'sounds red controls passed'
