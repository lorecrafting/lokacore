#!/bin/sh
# Red controls for bin/wait_ci.sh: a stub gh on PATH, the real repo, and WAIT_CI_ATTEMPTS=1 so no case
# waits. The break is the one that cost three 40-minute timeouts (2026-11-12): `gh run list --commit`
# matches only the full 40-character sha, so a short one listed nothing and read as "no runs yet".
set -eu
bin=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }
full=$(git -C "$bin/.." rev-parse HEAD)
short=$(printf '%s' "$full" | cut -c1-9)

# The stub answers only a 40-character sha, exactly as gh does; $GREEN says whether the runs passed.
mkdir -p "$tmp/stub"
cat > "$tmp/stub/gh" <<'SH'
#!/bin/sh
[ "$1 $2" = "run list" ] || exit 1
while [ $# -gt 0 ]; do [ "$1" = --commit ] && { sha=$2; break; }; shift; done
case $sha in
  ''|*[!0-9a-f]*) exit 1 ;;
esac
[ ${#sha} -eq 40 ] || exit 0
[ "${NO_RUNS:-0}" = 1 ] && exit 0
printf 'ci:completed:%s\nbook-e2e:completed:%s\ngraph-diff:completed:%s\n' \
  "${GREEN:-success}" "${GREEN:-success}" "${GREEN:-success}"
SH
chmod +x "$tmp/stub/gh"
run() { PATH="$tmp/stub:$PATH" WAIT_CI_ATTEMPTS=1 sh "$bin/wait_ci.sh" "$@"; }

# 1. A short sha is resolved before gh is asked: a green head reads green, not a false timeout.
out=$(run "$short" 2>&1) && : || bad "short sha exit $? (a false timeout is the bug)"
case $out in *"timed out"*) bad "short sha still timed out" ;; esac

# 2. A full sha still works, so the fix did not narrow the tool to short shas.
run "$full" >/dev/null 2>&1 || bad "full sha exit $?"

# 3. A red run still fails; the fix must not become a rubber stamp.
GREEN=failure run "$full" >/dev/null 2>&1 && bad "a failing run passed"

# 4. No runs says so, and does not claim a timeout.
out=$(NO_RUNS=1 run "$full" 2>&1) && bad "a sha with no runs passed" || :
case $out in *"no runs found"*) : ;; *) bad "no-runs message: $out" ;; esac

[ "$fail" -eq 0 ] && echo WAIT_CI_RED_CONTROLS_ok
exit "$fail"
