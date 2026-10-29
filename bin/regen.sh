#!/bin/sh
# Rewrites every generated file from its inputs; bin/prepush.sh runs it and fails when it changes
# the tree. Run it after editing protocol/, docs/CHECKS.md, docs/MECHANICS-TOOLBOX.md,
# docs/system/, docs/features.json, a cartridge, kernel/ts/src/, mobile/ or a review record, and
# commit what it rewrites. The slow generators run only when their inputs differ from origin/main
# (committed or not; every generator when that diff cannot be read):
#   - a changed cartridge (or lib/): its {description, canonical, sha256} fixture under protocol/fixtures/
#     (bin/regen_hash_fixture.sh), and the old content hash in its transcripts becomes the new one;
#     fixtures that also carry `value` are rebuilt by hand;
#   - mobile/, kernel/ts/src/, protocol/: the stories' views and saves (npm run stories:views);
#   - cartridges/toolbox_showcase/, lib/: test/loka/lint_baseline.txt (mix loka.lint; fixed findings drop out, a new one fails).
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

m mix compile >/dev/null
m mix loka.source_schema >/dev/null # schemas/source/ (the compiler's source contracts; loka-tp02)
sha() { sed -n 's/^  "sha256": "\(.*\)",*$/\1/p' "$1"; }
# Each fixture regen_hash_fixture.sh accepts, with its cartridge (the manifest id).
python3 -c '
import json, sys
for p in sys.argv[1:]:
    d = json.load(open(p, encoding="utf-8"))
    if list(d) == ["description", "canonical", "sha256"]:
        print(p, json.loads(d["canonical"])["manifest"]["id"])
' protocol/fixtures/*_hash.json | while read -r fix id; do
  touched "^(cartridges/$id/|lib/)" || continue
  old=$(sha "$fix")
  sh bin/regen_hash_fixture.sh "cartridges/$id" "$fix"
  new=$(sha "$fix")
  [ "$old" = "$new" ] || find "cartridges/$id" -path '*/transcripts/*.jsonl' -exec perl -pi -e "s/$old/$new/g" {} +
done

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
