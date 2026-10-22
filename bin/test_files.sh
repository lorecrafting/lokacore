#!/bin/sh
# node --test on the named test files only (loka-xkl2), for `npm run test:files -- <files>`. Refuses
# an empty list and a name that is no file (an unmatched glob stays literal): with no file named,
# node --test runs the whole suite. Arguments starting with - pass through as node flags.
[ $# -gt 0 ] || { echo "test_files: name at least one test file" >&2; exit 2; }
for f; do case $f in -*) continue ;; esac; [ -f "$f" ] || { echo "test_files: no such file: $f" >&2; exit 2; }; done
exec node --test --test-reporter="${TEST_REPORTER:-spec}" "$@"
