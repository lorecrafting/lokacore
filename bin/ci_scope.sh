#!/bin/sh
# Skip a job only when the entire known ancestor range is outside that job's inputs.
# Lane elixir (pre-push only, not CI) also skips *.test.ts: no Elixir check reads one. Other
# kernel/ts/test files stay inputs: Elixir tests run its peers (differential_peer.ts, cartridge_peer.ts).
# Lane storybook (pre-push only) runs only for Book, story, Storybook or smoke config, the app's package files
# or the game-view package the stories import.
base=${1-} after=${2-HEAD} lane=${3-code}
case $lane in code|browser|elixir|storybook) ;; *) echo run; exit 0 ;; esac
if [ -n "$base" ] && git merge-base --is-ancestor "$base" "$after" 2>/dev/null; then
  files=$(git diff --name-only --no-renames "$base" "$after") || { echo run; exit 0; }
  [ -n "$files" ] || { echo run; exit 0; }
  printf '%s\n' "$files" | awk -v lane="$lane" '
    lane == "storybook" && !/^mobile\/(app\/(book|stories|\.storybook)\/|app\/package(-lock)?\.json$|app\/vitest\.config\.mts$|packages\/game-view\/)/ { next }
    /\.md$/ && !/\.gen\.md$/ { next }
    $0 == ".beads/issues.jsonl" { next }
    lane == "elixir" && /\.test\.ts$/ { next }
    # Mobile code is code: kernel tests import Book model/presenter, mobile tests run App.tsx.
    lane == "code" && (/^mobile\/app\/plugins\// || $0 == "mobile/app/app.json") { next }
    { bad = 1 }
    END { exit bad ? 0 : 1 }
  '
  # Exit 1 means every file is skippable; a code file (0) or a classifier error (other) runs.
  [ $? = 1 ] && echo skip || echo run
  exit 0
fi
echo run
