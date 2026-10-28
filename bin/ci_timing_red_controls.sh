#!/bin/sh
# Red controls for bin/ci_timing.sh: a stub gh applies the real --jq to controlled `run list` ($CI for
# ci.yml, $E2E otherwise) and `run view` ($JOBS_<id>, else $JOBS) records. Needs jq.
set -eu
bin=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }
cat > "$tmp/gh" <<'SH'
#!/bin/sh
case "$1 $2" in "run list") ;; "run view") eval "json=\${JOBS_$3:-\$JOBS}" ;; *) exit 1 ;; esac
case $* in "run list"*ci.yml*) json=$CI ;; "run list"*) json=$E2E ;; esac
while [ $# -gt 1 ]; do [ "$1" = --jq ] && q=$2; shift; done
printf '%s\n' "$json" | jq -r "$q"
SH
chmod +x "$tmp/gh"
# Break: a sim leg's duration (either leg) is missing for the head or the nightly, another job or an unfinished sim is printed.
J='{"jobs":[{"name":"lint","conclusion":"success","startedAt":"2026-10-15T10:00:00Z","completedAt":"2026-10-15T10:01:00Z"},{"name":"sim (fresh)","conclusion":"success","startedAt":"2026-10-15T10:00:00Z","completedAt":"2026-10-15T10:07:23Z"},{"name":"sim (showcase)","conclusion":"failure","startedAt":"2026-10-15T10:00:00Z","completedAt":"2026-10-15T10:10:00Z"},{"name":"sim (fresh)","conclusion":"","startedAt":"2026-10-15T10:00:00Z","completedAt":"0001-01-01T00:00:00Z"}]}'
CI='[{"conclusion":"success","databaseId":7}]' E2E='[]' JOBS=$J PATH="$tmp:$PATH" sh "$bin/ci_timing.sh" 1234567890ab > "$tmp/out" 2>&1 || bad "ci_timing exit $?"
[ "$(grep 'sim (' "$tmp/out" | grep -vc median)" = 4 ] && grep -qx 'PR head 12345678: sim (showcase) job failure 600s' "$tmp/out" \
  && grep -qx 'PR head 12345678: sim (fresh) job success 443s' "$tmp/out" && grep -qx 'ci.yml nightly: sim (fresh) job success 443s' "$tmp/out" \
  || { bad 'sim time: wrong lines'; cat "$tmp/out"; }
# Break (loka-9nd4): the nightly median is the newest run, the mean, or counts a failed leg. Five runs: 280 290 300 540 550 s, newest first.
leg() { printf '{"name":"sim (fresh)","conclusion":"%s","startedAt":"2026-10-15T10:00:00Z","completedAt":"2026-10-15T10:%02d:%02dZ"}' "$1" $(($2 / 60)) $(($2 % 60)); }
CI='[{"databaseId":1},{"databaseId":2},{"databaseId":3},{"databaseId":4},{"databaseId":5}]' E2E='[]' JOBS='{"jobs":[]}' \
  JOBS_1="{\"jobs\":[$(leg success 550),$(leg failure 30)]}" JOBS_2="{\"jobs\":[$(leg success 280)]}" JOBS_3="{\"jobs\":[$(leg success 540)]}" \
  JOBS_4="{\"jobs\":[$(leg success 290)]}" JOBS_5="{\"jobs\":[$(leg success 300)]}" \
  PATH="$tmp:$PATH" sh "$bin/ci_timing.sh" abc > "$tmp/out" 2>&1 || bad "ci_timing exit $?"
grep -qx 'ci.yml nightly median: sim (fresh) 300s over 5 runs' "$tmp/out" || { bad 'sim median: wrong line'; cat "$tmp/out"; }
[ "$fail" = 0 ] && echo "ci_timing red controls: all pass"
exit "$fail"
