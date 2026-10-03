# Review: process speed-up (PR #130)

- PR: #130, branch `process-speedup`, commit reviewed `3561d7e` (code CI green on `b434ce2`; `3561d7e` CI: `changes` and `lint` green, `elixir`, `typescript` and `sim` skipped)
- Governing: [owner decision 2026-10-03](../decisions/owner-decision-process-speedup-2026-10-03.md), [WORKFLOW](../WORKFLOW.md), [CHECKS](../CHECKS.md)
- Reviewer: Opus, fresh, authored none of the work
- Verdict: **CHANGES REQUIRED**

## Requirements derived before reading the diff

1. The code jobs are skipped only on a `pull_request` `synchronize` push whose `before` is an ancestor of the new head and whose changed files (both sides of a rename, deletions included) are all Markdown. `opened`, `reopened`, a missing `before` and a non-ancestor `before` run everything. `lint`, with the docs link check, always runs.
2. A file that a code job checks counts as code, even if it ends in `.md`.
3. Every new guard has a planted case that fails when the guard is removed. The red controls must not write to the real repository when a hook exports `GIT_DIR`.
4. CI runs the 10,000 fresh sim sequences exactly once, in `sim`. The `typescript` job still runs every other kernel test.
5. WORKFLOW step 7 does not let the PM merge a head whose code was never green.
6. The union merge keeps both branches' lines, and the PM's check catches what union can get wrong.
7. The agent-file wording matches decision 5 (one `check_all`; pre-push is the final run).

## Evidence

All crafted commits were made in a throwaway `--no-local` clone with hooks off, never in the real repository. Results of `bin/docs_only.sh`:

| Range | Got |
|---|---|
| rename `.ts`→`.md`; delete `.ts`; mixed `.md`+`.ex`; merge from a fake `main` that brings `.ex`; `before` not an ancestor; unknown SHA; empty `after`; empty diff; rename `.md`→`.ts` | `run` |
| `.md` only; `.md` only after a merge; mode change on `.md` | `skip` |
| `docs/features.gen.md` only | `skip` (F-2) |

- The `ci.yml` `changes` step blanks `BEFORE` unless the event is `pull_request` `synchronize`, so `opened`, `reopened` and `push` to `main` run everything.
- Run 37104154288 (`3561d7e`): `lint` and `changes` succeeded; `elixir`, `sim` and `typescript` were skipped.
- Run 37103938215 (`b434ce2`): `sim` logged "the regression seeds, then 10000 fresh sequences" (14 tests). `typescript` ran `test:nosim` (32 of 33 files) with no sim test. `check_docs` ran in `lint` and no longer in `elixir`.
- Red controls under `GIT_DIR=<clone>/.git`: the clone's refs and HEAD were unchanged. With the `unset` line deleted, a planted `json` commit landed in the clone. The isolation works and the `unset` is load-bearing.
- Mutants of `bin/docs_only.sh` run against `bin/docs_only_red_controls.sh`:
  - empty diff → `skip`: caught.
  - ancestor check removed: caught.
  - `--no-renames` dropped: **suite stays green** (F-1).
  - `\.md$` → `md$`: green (not plausible enough to report).
- Union merge test: branch X edits an existing line of `docs/decisions/README.md`, and branch Y inserts a line right after it. The merge keeps the old line and the edited line both (F-3).

## Findings

- **F-1 blocker** `bin/docs_only_red_controls.sh:17-28`. No planted rename. Remove `--no-renames` from `bin/docs_only.sh:7` and the red controls still pass. Git's default rename detection then lists only the new path, so a push that renames `kernel/ts/src/rng.ts` to `rng.md` prints `skip`, and `elixir`, `typescript` and `sim` never run on a deleted kernel module. Reproduced in the clone: the diff lists only `kernel/ts/src/rng.md`. Fix: plant a `.json`→`.md` rename that must say `run`, and list it in `docs/CHECKS.md:63`.
- **F-2 should-fix** `bin/docs_only.sh:8` (the comment at `:4` says ".gen.* under docs/ is code"). The check tests only the `.md` suffix. A push that edits only `docs/features.gen.md` or `docs/contracts.gen.md` (a hand edit or a bad merge) prints `skip` (reproduced), so `elixir bin/features.exs --check` / `contracts.exs --check` (`ci.yml` elixir job) never see the drift before merge. Fix: treat `*.gen.md` as code in the awk condition, with a planted case.
- **F-3 should-fix** `docs/WORKFLOW.md` Git hygiene, union bullet. "It checks the line order" misses duplicates. In this index, existing lines are edited in place ("Ruling 3 superseded", review-line fix rounds). If one branch edits line L and another inserts a line next to L, union keeps both the old L and the new L with no conflict (reproduced). Fix: the PM checks for duplicated entries as well as order.
- **F-4 should-fix** `docs/WORKFLOW.md:98`, "the last head that ran them". `ci.yml:8-10` cancels superseded runs. Sequence: code push A, then a Markdown push B within about 2 minutes. A's run is cancelled, and B skips because A..B is Markdown-only. "Last head that ran them" can be read as the last head whose code jobs *completed* green, which is before A, so A's code would merge untested. Fix: name the newest head with a non-Markdown change; if its run was cancelled or failed, re-run it (`gh run rerun`) before merging.
- **N-1 nit** `kernel/ts/package.json:12`. `ls test/*.test.ts` does not recurse, while `npm test` uses `test/**/*.test.ts`. A future test in a subdirectory would run locally but never in CI. `grep -v sim.test` would also drop any future `*sim.test.ts`. Today: 32 of 33 files, nothing missed.
- **N-2 nit** `docs/WORKFLOW.md:81`, `.claude/agents/developer.md:48`. "Reruns the checks and pushes" reads as `check_all` followed by the pre-push run of it, which conflicts with decision 5 as worded in step 3.
- **Q-1 question** (no failure scenario confirmed). `pull_request` CI tests the merge ref. Before this PR, a Markdown push re-tested the PR merged with the current `main`. Now that test is skipped, so a semantic conflict with code merged to `main` since the last code push is caught only by `main`'s own post-merge CI. Accepted risk?

Requirements 1, 3 (isolation), 4 and 7 hold apart from the findings above. The `.gitattributes` and `ci.yml` job wiring are minimal, and there is nothing to delete.

Codex Sol review: appended by the PM.

## Codex Sol first review (3561d7e), verbatim

CHANGES REQUESTED

```text
F1 | blocker | docs/WORKFLOW.md:98 at 3561d7e
Scenario: A has green code jobs. Push B changes TypeScript, but its CI is queued or still in `changes`. Markdown-only push C cancels B via cancel-in-progress and skips all three code jobs. C’s lint/changes finish green; A remains “the last head that ran them,” so step 7 permits merging C even though B’s code never passed CI.

Require a green code-tested ancestor with only Markdown changes between it and the merge head. If that cannot be established, run all three code jobs before merging; cancelled or unstarted runs cannot justify the skip.
```
