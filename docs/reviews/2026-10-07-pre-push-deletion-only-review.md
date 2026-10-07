# Review: skip pre-push checks for deletion-only pushes

- PR: #290, branch `fix/pre-push-deletion-only`
- Commit reviewed: `12fe9ab6915e6934025939d2671a4a602071d520`
- Reviewer: independent (authored none of the work)
- Depth: config-only hook change (docs/WORKFLOW.md, Review stance); stub-driven behavior
  matrix and two hook mutants in place of suite mutation.
- Verdict: **APPROVE**

## What must be true (written before reading the diff)

1. Every stdin line a deletion (all-zero local sha) → exit 0, `bin/check_all.sh` not run.
2. Empty stdin → full `bin/check_all.sh` (no lane flag), as before.
3. Update-only pushes → lane unchanged: `--metadata` when `bin/ci_scope.sh` says skip for
   every update, otherwise full.
4. Mixed delete+update → lane chosen from the update lines only, in either line order;
   deletions neither force full nor skip the run.
5. POSIX `sh` only (hook shebang `/bin/sh`); works for 40- and 64-char zero shas.
6. No other caller relies on deletion-only pushes running the full line.

## Checks

Stub `bin/check_all.sh` (prints its args) and stub `bin/ci_scope.sh` (skip for local sha
`a…`, run otherwise) in a temp directory; hooks run from there under `/bin/dash` and
`/bin/sh` with controlled stdin. Results (dash; `/bin/sh` identical for the cases rerun):

| stdin | main hook | PR hook | mutant 1: guard deleted | mutant 2: guard ignores `seen` |
|---|---|---|---|---|
| deletion-only (2 lines) | full | **no run, exit 0** | full (red) | no run |
| empty | full | full | full | full |
| update, metadata | `--metadata` | `--metadata` | `--metadata` | `--metadata` |
| update, code | full | full | full | full |
| delete then metadata update | `--metadata` | `--metadata` | `--metadata` | no run (red) |
| metadata update then delete | `--metadata` | `--metadata` | `--metadata` | no run (red) |
| delete then code update | full | full | full | no run (red) |

Requirements 1–4 hold; both mutants are distinguished by the matrix. The guard
`[ "$seen" = 1 ] || [ "$deleted" = 0 ] || exit 0` exits only when no update line and at least
one deletion line were read. `case *[!0]*`, `[ ]`, `||` are POSIX; the zero test is length-free.

Callers: `docs/CHECKS.md` describes pre-push only as running the lane `bin/ci_scope.sh`
selects; `bin/ci_scope.sh` is called per update line and never sees deletions (unchanged).
No CI workflow invokes `.githooks/pre-push`. Nothing depends on the old behavior.

No frozen fixtures or expected answers touched. No test added; the hook has no test
harness and the PR's stub red control matches this matrix. Diff is one flag and one line:
nothing to delete.

## Findings

None.

Note (not a finding): a stdin consisting of a blank line is now classified as
deletion-only and skips (main ran full). Git never writes a blank ref line, so this is
reachable only by hand invocation.
