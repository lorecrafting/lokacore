#!/bin/sh
# Red controls for the CI line under each open PR in bin/session_status.sh (loka-x4ejm): a handoff
# claimed "hosted CI not run" when it had failed twice, and a later session spent ten minutes with
# `gh pr view` to learn the truth. No network: a stub `gh` answers the two calls the script makes.
set -eu
. "$(dirname "$0")/lib/clean_git_env.sh"
bin=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }

mkdir -p "$tmp/stub"
# `gh pr list --json number,title,...` comes twice: the title list, then the CI rollup list. The CI
# list is the one that asks for statusCheckRollup, so the stub tells them apart by that flag alone.
cat > "$tmp/stub/gh" <<'SH'
#!/bin/sh
for a; do case $a in
  *statusCheckRollup*)
    printf '%s\n' "11	aaaa1111	FAILURE:2 SUCCESS:3" "12	bbbb2222	SUCCESS:4"
    exit 0 ;;
  *number,title,headRefName,isDraft*)
    printf '%s\n' "11	OPEN	A failing head	br/eleven" "12	OPEN	A green head	br/twelve"
    exit 0 ;;
esac; done
case $1 in
  pr) [ "$2" = view ] && { printf '%s %s\n' "$3" OPEN; exit 0; } ;;
  run) printf '%s\n' "success deadbeef https://example.invalid/r"; exit 0 ;;
esac
exit 0
SH
chmod +x "$tmp/stub/gh"
# No br, no git repo worth reading: the section under test is the PR list.
cd "$tmp" && git init -q r && cd r

out=$(PATH="$tmp/stub:$PATH" sh "$bin/session_status.sh" 2>&1) || bad "exit: $out"

# Break: a PR whose head has a failed ci does not show that failure, so the next handoff can repeat
# "CI not run" over a red head (the loka-x4ejm report).
printf '%s\n' "$out" | grep -q 'ci: aaaa1111 FAILURE:2' || {
  bad 'a failing head does not print its conclusion under the PR'
  printf '%s\n' "$out"
}
# The control for it: a green head prints its successes, so the line is not just always "FAILURE".
printf '%s\n' "$out" | grep -q 'ci: bbbb2222 SUCCESS:4' || {
  bad 'a green head does not print its conclusion'
  printf '%s\n' "$out"
}
# The ci line belongs under its own PR, not floating: PR 11's line must follow PR 11's row.
printf '%s\n' "$out" | grep -A1 '^11	' | grep -q 'ci: aaaa1111' || {
  bad 'the ci line is not under its PR row'
  printf '%s\n' "$out"
}
exit "$fail"
