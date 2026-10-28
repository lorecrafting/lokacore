#!/bin/sh
# Kernel tests gain no `as never` outside kernel/ts/test/harness.ts (loka-ivjq.15): use its typed helpers
# (eid, ctx, cmd, commands, reload) or a real type. lint/as_never_baseline.txt holds each file's count when
# the check landed; a file over its count, or a new file with any, fails. A drop prints the line to record.
#   sh bin/check_as_never.sh
cd "$(dirname "$0")/.." || exit 2
# ast-grep exits 1 when nothing matches; anything above that (a missing binary) must not read as zero casts.
out=$(ast-grep run -p '$X as never' -l tsx kernel/ts/test --json=stream); [ $? -le 1 ] || exit 2
printf '%s\n' "$out" | sed -n 's/.*"file":"\([^"]*\)".*/\1/p' | grep -vx kernel/ts/test/harness.ts | LC_ALL=C sort | uniq -c |
  awk 'NR == FNR { base[$2] = $1; next }
    { seen[$2] = 1; if ($1 > base[$2] + 0) { print "FAIL " $2 ": " $1 " as never, baseline " base[$2] + 0; bad = 1 }
      else if ($1 < base[$2]) print "lower lint/as_never_baseline.txt to: " $1 " " $2 }
    END { for (f in base) if (!(f in seen)) print "lower lint/as_never_baseline.txt to: 0 " f " (delete the line)"; exit bad }' \
    lint/as_never_baseline.txt -
