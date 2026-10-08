#!/bin/sh
# Skip a job only when the entire known ancestor range is outside that job's inputs.
# Lane elixir (pre-push only, not CI) also skips *.test.ts: no Elixir check reads one. Other
# kernel/ts/test files stay inputs: Elixir tests run its peers (differential_peer.ts, cartridge_peer.ts).
base=${1-} after=${2-HEAD} lane=${3-code}
case $lane in code|browser|elixir) ;; *) echo run; exit 0 ;; esac
if [ -n "$base" ] && git merge-base --is-ancestor "$base" "$after" 2>/dev/null; then
  files=$(git diff --name-only --no-renames "$base" "$after") || { echo run; exit 0; }
  [ -n "$files" ] || { echo run; exit 0; }
  printf '%s\n' "$files" | awk -v lane="$lane" '
    /\.md$/ && !/\.gen\.md$/ { next }
    $0 == ".beads/issues.jsonl" { next }
    lane == "elixir" && /\.test\.ts$/ { next }
    # Mobile .ts is code (kernel tests import Book model/presenter; the typescript job runs mobile tests).
    lane == "code" && /^mobile\// && (/\.(tsx|ttf|txt|sksl)$/ || /^mobile\/app\/(tests|plugins)\// || $0 == "mobile/app/app.json") { next }
    { bad = 1 }
    END { exit !bad }
  ' && { echo run; exit 0; }
  echo skip
  exit 0
fi
echo run
