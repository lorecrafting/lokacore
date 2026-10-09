# Review: housekeeping 2026-10-09, check_all verdict line and developer/PM rules (PR #331)

- PR #331, branch `chore/housekeeping-2026-10-09`, head `3f57f89b`, base main `dd49bee0`. Beads loka-hlj, loka-unn, loka-7lo, loka-cu1. Short review: docs plus `bin/check_all.sh`.
- Governing: the four Beads proposals (owner-approved housekeeping); [WORKFLOW Review stance](../WORKFLOW.md), [Token hygiene](../WORKFLOW.md#token-hygiene).
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Every exit path of `bin/check_all.sh` (pass, step failure, failure inside a `( … )` subshell, `--metadata`, `--no-ts`, SIGINT/SIGTERM) prints one last line, `check_all: PASS` or `check_all: FAIL <step>`. The step it names is the step that failed.
2. The cross-worktree lock is still released on every one of those paths. Exit codes and the tree stamp do not change.
3. developer.md: commit before `/code-review`; the review never runs checkout, stash or reset; quote the verdict line; full package `npm test` after any label, accessible-name or exported-symbol change.
4. WORKFLOW step 2: the PM splits L rows into two briefs; the brief states the handoff threshold up front, by a link and not a copied number.

## Proof

- (1, 2) Scratch git repo (`check_all.sh` up to the re-armed trap, `mise exec` removed, planted steps):
  fail `exit=1 FAIL false planted_step`; subshell `(cd sub && m true a && m false planted_sub)` `exit=1 FAIL false planted_sub`; `exit 0` and fall-through `exit=0 PASS`; `m sh -c "exit 7"` `exit=7`; SIGTERM `exit=130 FAIL sleep 30`; SIGINT (job control) `exit=130 FAIL sleep 30`; `--metadata` path (no lock) `exit=1 FAIL false planted_meta`. Lock was released in every case.
- Mutant: drop the re-arm line (`check_all.sh:31`). The run then exits 1 with an empty last line, so the re-arm is required (this matches the PR's self-review claim).
- Tree stamp line and the `[ … ] && exit 0` exits are unchanged. POSIX keeps `$?` across the EXIT trap, and `rc=7` above confirms it.
- PR body claim rerun: red control `FAIL <planted step>` holds. Success path `bin/check_all.sh --no-ts` on this head: exit 0, last line `check_all: PASS`, lock released. An earlier run with this record still untracked gave exit 1, `check_all: FAIL elixir bin/check_docs.exs` (stale index). That is a live red control: the line names the right step.
- (3, 4) Text is in `developer.md:29,32-33` and `WORKFLOW.md:64-65`. `#token-hygiene` holds the threshold (`WORKFLOW.md:275`). The link is the same one step 5 uses.

## Findings

1. nit, `bin/check_all.sh:15-31`: nothing pins the verdict line. `integration_red_controls.sh` stubs `check_all.sh`. A later edit that sets another EXIT trap (as `check_lock.sh` did) drops the line without any failure; the mutant above shows this. Disposition: open; a red control is optional (not in the brief).
2. nit, `bin/check_all.sh:14-29`: a failure before the first `step`/`m` prints `check_all: FAIL ` with an empty step. Examples: the shell is killed while it waits in `. bin/check_lock.sh`, or `mktemp` fails. The line still says FAIL, so no one reads it as a pass.
3. nit, PR body: self-review was by hand, not `/code-review medium`. developer.md allows this for a small diff ("otherwise … the same questions by hand").
