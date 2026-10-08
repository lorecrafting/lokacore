# Review: integration scripts (merge queue, E1 batch integration)

- PR #302, branch `tools/integration-scripts`, head reviewed `5459d3ac25f13475ffb17216d991a5b67677fbb1`, base `760d2315`.
- Governing: [WORKFLOW step 7](../WORKFLOW.md) at `760d2315` (queue command, lines 122-133), [skip-CI-on-drafts review](2026-10-07-skip-ci-on-drafts-review.md) (queue reasons), PM brief (integration requirements).
- Verdict: **CHANGES REQUIRED** (one blocker: a required guard has no red control).

## Must be true (written before the diff)

1. Queue: wait for head `<sha>`; both `changes` rows `pass,pass`; fail, skipping or cancel stops with no merge; watch `--fail-fast`; merge `--match-head-commit <sha>`; any gh error or unknown state never merges.
2. Integration: no run on a dirty tree; cherry-pick the record, then `merge --no-ff`; a conflict exits non-zero and is never auto-resolved; artifact sha256 `1c53bcd8…1115`; typecheck, E1 tests, recorder (exit 2 only) and the full size gate; pending count compared; push only with `--push` (keepalive, one retry); cleanup never deletes unmerged work.
3. Every guard above has a case that goes red when it is removed, and no case can hang.

## Evidence

- `merge_queue.sh` matches the base command line for line. The only addition is a 40-hex SHA check. WORKFLOW step 7 keeps the reasons (head wait, draft-only skip, `pass,pass`, late push fails the merge, why not `--auto`).
- Adversarial queue runs, using the suite's stub `gh` with real `jq` and a 3 s alarm. `pass,pass,pass`, empty `[]`, a non-JSON gh error, uppercase `PASS` and a renamed `ci / changes` row each poll until the alarm and never merge. `pass,skipping` stops with rc 1 and no merge. No false merge found. The 3-row hang is the known fail-safe question from the skip-CI review.
- Mutants, each run against `bin/integration_red_controls.sh` in a throwaway worktree. Killed: M1, `*skipping*` stop removed (draft hits the alarm, 142). M2, `pass,pass` gate becomes `-n`. M3, no head wait. M4, watch result ignored. M5, no `--match-head-commit`. M6, one `pass` is enough. I1, no `--no-ff`. I2, `-X theirs`. I3, recorder rc ≥1 accepted. I4, count not compared. I5, size gate on diff only. I6, artifact hash skipped. I7, batch-worktree clean check removed. I8, push always. I10, no cherry-pick. I11, branch kept. **Survived: I9**, the main-tree clean check at `integrate_batch.sh:29` deleted (suite rc 0).
- Real recorder (`origin/slice/chapter-one-e1-r9-certification:kernel/ts/test/e1_cases.ts`) takes `artifact outdir`, returns 2 on pending and 1 on failure, and its report fields match `integrate_batch.sh:52-53`. It has **no** clean-tree check. The stub at `integration_red_controls.sh:97` adds one.
- The real `check_ts_size.mjs` reads every tracked and untracked file when it gets no args.
- Local suite: rc 0, about 13 s. shellcheck is not installed and was not run.
- Hosted CI on `5459d3ac`: all 7 jobs pass (browser, 2× changes, elixir, lint, sim, typescript). `lint` ran the new suite.

## Findings

1. **blocker**, `bin/integration_red_controls.sh` (no case; guard at `bin/integrate_batch.sh:29`). The brief requires "must not run with a dirty tree", but deleting line 29 leaves the suite green (I9). Failure scenario: a refactor drops or weakens line 29. The PM has an uncommitted fix in `kernel/ts/src` in the integration tree. Typecheck, size gate, E1 tests and the real recorder (no clean-tree check) all pass on the working tree, so `--push` pushes a merge commit that lacks the edit and was never checked as committed. Fix: add a case with a dirty tracked file that asserts both a non-zero exit **and** an unmoved HEAD. Exit code alone will not catch it, because the stub recorder's own dirty check exits 1 after the merge has landed.
2. **should-fix (PM decides)**, `bin/integrate_batch.sh:65-67` and `bin/integration_red_controls.sh:112,124`. The brief says the script "must not delete ... a branch that tracks a remote". The script runs `git branch -D` on the batch branch whatever its upstream is, and the fixture makes `batch` track `origin/batch` and asserts that it is deleted. So the test pins the behavior the brief forbids on a plain reading. Scenario: the batch branch tracks `origin/e1/batch-e`, and a run without `--push` deletes the local branch. Nothing is lost, because line 66 proves the branch is in HEAD and the remote branch stays, but the brief is broken as written. Either restrict the deletion to untracked branches or record that the brief means the remote branch.
3. **nit**, `bin/integrate_batch.sh:67`. `git worktree remove` on a pre-existing developer worktree (found at line 32) silently deletes its gitignored files (checked: `tmp/x` removed, rc 0). Scenario: the batch worktree holds a recorder output under `tmp/` that a review cites, and it is gone after the cleanup.
4. **nit**, `bin/integrate_batch.sh:44,61`. When the push fails twice, the script prints the hint "HEAD is the unchecked merge; undo with git reset --hard HEAD^". At that point every check has passed, so the PM may throw away a good merge.
5. **nit**, `bin/integration_red_controls.sh:97`. The stub recorder refuses a dirty tree, but the real one does not. This divergence is what hides finding 1.

Over-engineering: none found. Both scripts stay close to the commands they replace. The `rebuild` hint (line 14) is hard to read but has a use.

## Fix round 1: `8ea4f559` — APPROVE WITH NOTES

Scope: `8ea4f559` only (dirty-tree case, stub recorder, push-failure message) and their direct callers.

- Blocker 1 closed. The new case `integration_red_controls.sh:127-130` dirties tracked `f.txt` and asserts exit 1 **and** an unmoved HEAD. Deleting `integrate_batch.sh:29` now fails the suite (`dirty-tree: exit 0, want 1` and `merged`). The suite passes at `8ea4f559`.
- Nit 5 closed. The stub recorder has no clean-tree check, which matches the real recorder. Caller check: with `integrate_batch.sh:34` deleted, the `dirty-worktree` case still fails (`merged`), so removing the stub check hid no other guard.
- Nit 4 closed. `hint=` moved above the push (`integrate_batch.sh:58`), so a push that fails twice prints "all checks passed; only the push failed, twice (log …)" with no reset advice. `die` at :66 already ran without a hint.
- Should-fix 2 and nit 3: kept by PM ruling (the remote copy stays; worktree removal unchanged). Not reopened.
- Hosted CI on `8ea4f559` at check time: `changes` ×2 and `lint` pass; `browser`, `elixir`, `sim` and `typescript` pending. The record head `465c072e` was green on both workflows.

No open findings beyond the PM rulings.
