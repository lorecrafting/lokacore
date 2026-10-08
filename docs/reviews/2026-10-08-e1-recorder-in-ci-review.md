# Review: E1 recorder in CI, honest summary, single case table (PR #317)

- PR: #317, branch `ci/e1-recorder-in-ci` (Beads loka-hs9, loka-wo7)
- Commit reviewed: `31e41f2762b5ad4d8d78e648267ebc874effe822`
- Governing: [e1-certification.md](../system/e1-certification.md) (recorder exit codes, v042-only
  scope), [CHECKS.md](../CHECKS.md) (CI jobs, `ci-green`), [checks lessons](../lessons/checks.md).
- Verdict: **CHANGES REQUIRED** (one blocker, S1)

## What must be true

1. Hosted CI runs `e1_cases.ts` on the selected v042 artifact. Exit 1 or 2 makes `ci-green` red.
2. The artifact uses the `bin/integrate_batch.sh` recipe and sha `1c53bcd8…`. A mismatch or a build
   error stops the job before the recorder runs.
3. A scoped skip never uses a commit whose recorder failed as its baseline (`bin/ci_base.sh`).
4. The recorder refuses any non-v042 admitted candidate by name, exit 1, before it writes.
5. One case table drives record and replay. Case order and fault schedules are unchanged, and
   `checkRefusals` runs after the last refusal and before `thirty-days`.
6. The summary gives the passed count and the total, `N of M`, for both pass and fail.

## Checks

- (1) `.github/workflows/ci.yml:127-143`, `:181`: `e1-recorder` is in `ci-green` `needs`. The gate fails on
  `failure`/`cancelled`. A skip happens only when `changes` sets `skip`, the same as for the other jobs.
- (2) The step runs as `bash -e`. If python3 fails, `-e` stops the job. In the pipe, the exit
  status is from `sha256sum -c`. The python line uses the same recipe as `integrate_batch.sh:14`, unescaped.
  The local rebuild gives `1c53bcd8…`.
- (4) Guard at `e1_cases.ts:270-271` comes before `source()`, `checkDispositions` and `mkdirSync`.
  `admitCandidate` (`e1_policy.ts:94`) already pins version and hash, so the id check is sufficient.
- (5) The old order and the new `CASES` (`e1_cases.ts:55-93`) were compared entry by entry and
  are identical. `REFUSALS` entries have 2 elements, so no fault schedule leaks in.
- (6) `receipts.length of CASES.length`. On a failure, only the receipts that passed are counted.

## Mutants run

- A: `bin/ci_base.sh:8` reverted to `elixir, typescript, sim` with count 3. `bin/docs_only_red_controls.sh`
  stays **green** (rc 0). See S1. With the proposed S1 stub (not committed), the suite is green on the PR's predicate.
  With mutant A it is **red** (`FAIL ci_base failed recorder is not a green baseline: want '', got '<sha>'`).
- B: guard moved after `mkdirSync`. The guard test fails (r9c fails the dispositions check first, so
  the message differs). The test passes without the mutant.
- C: `['carry-limit', carryLimit]` dropped from `CASES` in a temporary commit (detached worktree, never
  pushed). The recorder gives **rc 2** with `pending: 37 of 37 real SQLite cases passed` and
  `gap authored_obligations: /world/carry`. The PR body's disposition-drop control (rc 2, then rc 0
  after restore) covers the other path.

## Findings

- **S1 blocker** (the suite stays green when the core predicate is broken, per the review stance), `bin/docs_only_red_controls.sh:57` (stub for `bin/ci_base.sh:8`): no stub
  answer has the other three code jobs green and `e1-recorder` failed. The "Baseline" red control
  in the PR body plants a broken stub, not a broken predicate. Mutant A shows that removing
  `e1-recorder` from the predicate stays green. Failure scenario: a later edit drops the name. A PR
  commit with a red recorder then becomes the baseline. A docs-only commit on top skips every job,
  and `ci-green` passes at the head. Fix: add an answer such as `recorderfailed` (three successes
  plus `e1-recorder` `failure`), with `b "" 0 code "failed recorder is not a green baseline"
  recorderfailed`.
- Nit, `e1_cases.ts:368`: M comes from `CASES`, so a dropped case shrinks M too (mutant C prints
  `37 of 37`). The gap line still names the dropped path, so this is an observation, not a defect.

Accepted per PM: separate job (about 6 min), not in `check_all.sh`, literal candidate id, no fast
test for the `checkRefusals` call (pre-existing).
