#!/bin/sh
# The lane control (bin/main_guard.py): a push to main carries status-only and documentation
# commits, never code, because ci.yml does not run on main (docs/PM.md:92, two-lane decision).
# One lane per case; a failure names the case it broke.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
src=$(cd "$(dirname "$0")" && pwd)
guard="$src/main_guard.py"
t=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$t"' EXIT

fail() { echo "main_guard control failed: $*" >&2; exit 1; }

# Allowed: the PM's own lane and documentation.
python3 -I "$guard" --files .beads/issues.jsonl docs/HANDOFF.md docs/ROADMAP.md \
  docs/decisions/README.md docs/rnd/line-key-binding-2026-11-15.md ||
  fail 'status-only and documentation commits were refused'

# Refused: code, whatever the file's age or size.
for f in mobile/app/author/inbook.ts kernel/ts/play/prose.ts bin/worktree_setup.sh \
  .github/workflows/ci.yml protocol/fixtures/toolbox_showcase_hash.json cartridges/prologue/room.json; do
  python3 -I "$guard" --files "$f" > /dev/null 2>&1 &&
    fail "code was allowed onto main: $f"
done

# A mixed push is refused for its code, not passed for its status files.
python3 -I "$guard" --files .beads/issues.jsonl mobile/app/author/inbook.ts > /dev/null 2>&1 &&
  fail 'a mixed push was allowed'

# A real git pair, the way pre-push calls it: two commits, one status-only, one code.
cd "$t" && git init -q . && mkdir -p .beads mobile/app
printf 'a\n' > .beads/issues.jsonl && git add -A .
git -c user.name=t -c user.email=t@t commit -qm one
first=$(git rev-parse HEAD)
printf 'b\n' > mobile/app/panel.tsx && git add -A .
git -c user.name=t -c user.email=t@t commit -qm two
python3 -I "$guard" "$first" HEAD > /dev/null 2>&1 && fail 'a code commit reached main through the git diff'
# The same pair with the status-only commit last passes.
git reset -q --hard "$first"
python3 -I "$guard" "$first" HEAD || fail 'a status-only push was refused through the git diff'

# A new branch (zero remote sha) is not this guard's business.
python3 -I "$guard" 0000000000000000000000000000000000000000 HEAD || fail 'a new branch was refused'
