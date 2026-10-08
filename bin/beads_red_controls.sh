#!/bin/sh
# A bad exported path must fail the same checker used by the hook and CI.
set -eu
case_file=$(mktemp)
trap 'rm -f "$case_file" "$case_file.states"' EXIT
printf '%s\n' '{"id":"loka-example","source_repo_path":null,"description":"docs/ROADMAP.md"}' > "$case_file"
python3 bin/check_beads_export.py "$case_file"
printf '%s\n' '{"id":"loka-example","source_repo_path":"relative/path"}' > "$case_file"
if python3 bin/check_beads_export.py "$case_file" >/dev/null 2>&1; then
  echo 'Beads path control failed: source_repo_path was accepted' >&2
  exit 1
fi
printf '%s\n' '{"id":"loka-example","source_repo_path":null,"description":"/Users/example/secret"}' > "$case_file"
if python3 bin/check_beads_export.py "$case_file" >/dev/null 2>&1; then
  echo 'Beads path control failed: machine path was accepted' >&2
  exit 1
fi
printf '%s\n' '{"id":"loka-example","source_repo_path":null,"external_ref":"https://github.com/lorecrafting/lokacore/pull/1"}' > "$case_file"
python3 bin/check_beads_export.py "$case_file"
printf '%s\n' '{"id":"loka-example","source_repo_path":null,"description":"C:\\Users\\example"}' > "$case_file"
if python3 bin/check_beads_export.py "$case_file" >/dev/null 2>&1; then
  echo 'Beads path control failed: drive path was accepted' >&2
  exit 1
fi
# Completeness controls run on rows planted from the plan's own slice codes, not on the live tracker.
mk() { # mk <variant>: base | audit | missing | duplicate | swap | wisp
python3 - "$1" "$case_file" <<'PY'
import json
import re
import sys
from pathlib import Path

variant, out = sys.argv[1:]
codes = re.findall(r'^\| \*\*([A-E]\d+) ', Path('docs/MISSING-CHILD-PLAN.md').read_text(), re.MULTILINE)
rows = [{'id': f'loka-{c.lower()}', 'title': f'{c} \u2014 slice', 'dependencies': []} for c in codes]
rows[1]['dependencies'] = [{'issue_id': rows[1]['id'], 'depends_on_id': rows[0]['id']}]
if variant == 'audit':
    rows.append({'id': 'loka-audit-followup', 'title': 'Audit follow-up: close a reviewed finding', 'dependencies': []})
elif variant == 'missing':
    rows.pop()
elif variant == 'duplicate':
    rows.append(dict(rows[0], id='loka-duplicate-slice'))
elif variant == 'swap':  # same count: the last code is replaced by a copy of the first
    rows[-1]['title'] = rows[0]['title']
elif variant == 'wisp':
    rows[0]['id'] = 'loka-wisp-1'
    rows[1]['dependencies'][0]['depends_on_id'] = 'loka-wisp-1'
Path(out).write_text(''.join(json.dumps(row) + '\n' for row in rows))
PY
}
mk base
python3 bin/check_beads_export.py --complete "$case_file"
mk audit
python3 bin/check_beads_export.py --complete "$case_file"
for variant in missing duplicate swap wisp; do
  mk "$variant"
  if python3 bin/check_beads_export.py --complete "$case_file" >/dev/null 2>&1; then
    echo "Beads completeness control failed: a $variant case was accepted" >&2
    exit 1
  fi
done
# PR drift: each line is lost if its branch in bin/beads_pr_drift.py breaks; a fragment ref still maps to its PR.
cat > "$case_file" <<'JSON'
{"issues":[
{"id":"a","status":"in_progress","external_ref":"https://github.com/lorecrafting/lokacore/pull/5"},
{"id":"b","status":"closed","external_ref":"https://github.com/lorecrafting/lokacore/pull/6#B2"},
{"id":"c","status":"closed","external_ref":"https://github.com/lorecrafting/lokacore/pull/6#B3"},
{"id":"d","status":"open","external_ref":"docs/briefs/x.md"},
{"id":"e","status":"in_progress","external_ref":"https://github.com/lorecrafting/lokacore/pull/10"}]}
JSON
printf '5 MERGED\n6 OPEN\n9 OPEN\n10 CLOSED\n' > "$case_file.states"
expected='drift: a is in_progress but PR #5 is MERGED
drift: b is closed but PR #6 is still OPEN
drift: c is closed but PR #6 is still OPEN
drift: e is in_progress but PR #10 is CLOSED
drift: open PR #9 has no Beads issue'
if [ "$(python3 bin/beads_pr_drift.py "$case_file" "$case_file.states")" != "$expected" ]; then
  echo 'Beads drift control failed: drift lines differ' >&2
  exit 1
fi
cat > "$case_file" <<'JSON'
{"issues":[
{"id":"a","status":"in_progress","external_ref":"https://github.com/lorecrafting/lokacore/pull/7"},
{"id":"b","status":"closed","external_ref":"https://github.com/lorecrafting/lokacore/pull/8"},
{"id":"c","status":"open","external_ref":null},
{"id":"d","status":"open","external_ref":"https://github.com/lorecrafting/lokacore/pull/11"}]}
JSON
printf '7 OPEN\n8 MERGED\n11 OPEN\n' > "$case_file.states"
if [ -n "$(python3 bin/beads_pr_drift.py "$case_file" "$case_file.states")" ] \
  || [ "$(python3 bin/beads_pr_drift.py --in-progress-prs "$case_file")" != 7 ]; then
  echo 'Beads drift control failed: clean tracker reported drift or wrong lookups' >&2
  exit 1
fi
echo 'ok   beads: valid audit task accepted; local paths, missing/duplicate slices and reserved IDs refused; PR drift reported'
