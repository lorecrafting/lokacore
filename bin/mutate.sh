#!/bin/sh
# Mutant sweep: for each mutant save the file, apply it, run the tests, restore from the saved copy,
# record the result, print one table. Exits 1 if a mutant failed to apply or a restore left a diff.
#   bin/mutate.sh <mutants-file> <full-test-command>
# Mutants file, one per line, TAB-separated: file, exact old text (must occur once), new text,
# optional narrow test command (the tests that import the mutated module). A mutant runs its narrow
# command first and the full command only if the narrow one stays green. Lines starting # are skipped.
# Results: red-narrow, red-full, SURVIVED (all green; exit stays 0, the table is the report).
set -u
[ $# -eq 2 ] && [ -f "$1" ] || { echo "usage: $0 <mutants-file> <full-test-command>" >&2; exit 2; }
list=$1 full=$2
tab=$(printf '\t')
tmp=$(mktemp -d)
cur=
trap '[ -z "$cur" ] || cp "$tmp/orig" "$cur"; rm -rf "$tmp"' EXIT
trap 'exit 130' INT TERM
rc=0
while IFS=$tab read -r file old new narrow; do
  case $file in ''|'#'*) continue ;; esac
  cp "$file" "$tmp/orig" || { echo "FAIL	$file	not readable"; rc=1; continue; }
  cur=$file
  if ! python3 -I -c 'import sys
f, o, n = sys.argv[1:]
s = open(f).read()
sys.exit(1) if s.count(o) != 1 else open(f, "w").write(s.replace(o, n))' "$file" "$old" "$new"; then
    res=APPLY-FAIL rc=1
  elif [ -n "$narrow" ] && ! sh -c "$narrow" > /dev/null 2>&1; then res=red-narrow
  elif ! sh -c "$full" > /dev/null 2>&1; then res=red-full
  else res=SURVIVED
  fi
  cp "$tmp/orig" "$file"
  cmp -s "$tmp/orig" "$file" || { res="$res RESTORE-FAIL"; rc=1; }
  cur=
  printf '%s\t%s\t%s -> %s\n' "$res" "$file" "$old" "$new"
done < "$list"
exit $rc
