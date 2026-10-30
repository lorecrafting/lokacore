#!/bin/sh
# Rewrites every generated file from its inputs; bin/prepush.sh runs it and fails when it changes
# the tree. Run it after editing protocol/, docs/CHECKS.md, docs/MECHANICS-TOOLBOX.md,
# docs/system/, docs/features.json, a cartridge, lib/ (the source contracts feed schemas/source/), kernel/ts/src/,
# mobile/ or a review record, and
# commit what it rewrites. The slow generators run only when their inputs differ from origin/main
# (committed or not; every generator when that diff cannot be read):
#   - a changed cartridge (or lib/): its compiled known-answer fixtures under protocol/fixtures/
#     (bin/regen_hash_fixture.sh; frozen and derived ones excepted, see FROZEN); a changed
#     test/loka/cartridge_containers_hash.py or input of it: the containers_* fixtures it derives;
#   - mobile/, kernel/ts/src/, protocol/: the stories' views and saves (npm run stories:views);
#   - cartridges/toolbox_showcase/, lib/: test/loka/lint_baseline.txt (mix loka.lint; fixed findings drop out, a new one fails).
# Always: a transcript content_hash that is no known answer of its cartridge becomes the cartridge's
# compiled fixture hash. Merge recipe: a conflict only in hash fixtures or transcript pins takes either
# side, then `sh bin/regen.sh`.
#   bin/regen.sh
set -eu
cd "$(git rev-parse --show-toplevel)"
export MIX_ENV=test
m() { mise exec -- "$@"; }
# Read on each call, so a fixture this run rewrites under protocol/ also triggers the story views.
touched() {
  base=$(git merge-base origin/main HEAD 2>/dev/null) || return 0
  { git diff --name-only "$base" && git ls-files -o --exclude-standard; } | grep -qE "$1"
}

m mix do compile + loka.source_schema >/dev/null # one VM: schemas/source/ from the source contracts (loka-tp02)
# Not rebuilt from a compile: containers_* (derived below), the historical frozen inputs (sampler_v*,
# cartridge_{items,locks,sampler}_hash, reward_storage_hash) and the capability lock (hand-written; no
# generator, no manifest). Every other fixture is a compile of cartridges/<its manifest id>.
FROZEN='^(containers_|sampler_v|cartridge_(items|locks|sampler)_hash|reward_storage)'
python3 -c '
import json, os, re, sys
for p in sys.argv[2:]:
    m = json.loads(json.load(open(p, encoding="utf-8"))["canonical"]).get("manifest")
    if m and not re.match(sys.argv[1], os.path.basename(p)) and os.path.isdir("cartridges/" + m["id"]):
        print(p, m["id"])
' "$FROZEN" protocol/fixtures/*_hash.json | while read -r fix id; do
  touched "^(cartridges/$id/|lib/|$fix\$)" || continue # $fix: a merge took either side of it
  sh bin/regen_hash_fixture.sh "cartridges/$id" "$fix"
done
if touched '^(test/loka/cartridge_containers_hash\.py|protocol/fixtures/(cartridge_(items|locks|sampler)|sampler_v|reward_storage)_)'; then
  python3 test/loka/cartridge_containers_hash.py
fi
# A transcript pin that is no known answer of its cartridge (matched as kernel/ts/test/transcripts.test.ts
# matches: its fixture globs, manifest id and sha256) is stale after a cartridge change or a merge: it
# becomes the hash of the cartridge's compiled fixture. A cartridge without one keeps its pins.
python3 - "$FROZEN" <<'PY'
import fnmatch, glob, json, os, re, sys
kats, compiled = set(), {}
for p in glob.glob('protocol/fixtures/*_hash.json'):
    name, d = os.path.basename(p), json.load(open(p, encoding='utf-8'))
    m = json.loads(d['canonical']).get('manifest')
    if not m: continue
    if any(fnmatch.fnmatch(name, g) for g in ('cartridge_*hash.json', 'containers_*hash.json', 'toolbox_showcase_hash.json', '*_sampler_hash.json')):
        kats.add((m['id'], d['sha256']))
    if not re.match(sys.argv[1], name): compiled[m['id']] = d['sha256']
for t in glob.glob('cartridges/*/transcripts/*.jsonl'):
    cid, text = t.split('/')[1], open(t, encoding='utf-8', newline='').read()
    pin = json.loads(text.split('\n', 1)[0])['ids']['content_hash']
    if (cid, pin) not in kats and cid in compiled:
        open(t, 'w', encoding='utf-8', newline='').write(text.replace(pin, compiled[cid]))
PY

m elixir bin/contracts.exs
(cd kernel/ts && LOKA_WRITE_GEN=1 m node --test --test-reporter=dot test/state_sections.test.ts >/dev/null)
m elixir bin/contracts.exs # the System graph reads docs/state-sections.gen.json
m elixir bin/features.exs
sh bin/review_index.sh
(cd mobile/app && LOKA_WRITE_GEN=1 m node --test --test-reporter=dot catalogue.test.ts >/dev/null) # docs/BOOK-UI-COMPONENTS.md index
if touched '^(mobile/|kernel/ts/src/|protocol/)'; then (cd mobile/app && m npm run -s stories:views); fi
if touched '^(cartridges/toolbox_showcase/|lib/)'; then
  lint=$(m mix loka.lint cartridges/toolbox_showcase 2>&1 >/dev/null | sed 's/^/toolbox_showcase /')
  # The baseline only shrinks: a new finding (or a lint crash) fails here instead of being pinned.
  new=$(printf '%s\n' "$lint" | grep -vxFf test/loka/lint_baseline.txt || true)
  if [ -n "$new" ]; then printf 'regen: lint findings not in test/loka/lint_baseline.txt (fix them):\n%s\n' "$new" >&2; exit 1; fi
  { head -1 test/loka/lint_baseline.txt; [ -z "$lint" ] || printf '%s\n' "$lint"; } >test/loka/lint_baseline.txt.new
  mv test/loka/lint_baseline.txt.new test/loka/lint_baseline.txt
fi
