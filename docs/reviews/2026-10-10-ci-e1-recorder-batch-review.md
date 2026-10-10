# Review: e1-recorder in full on batch-branch pushes (loka-b98y, PR #361)

- PR #361, branch `ci/e1-recorder-prs`, head `6f53e470b4af84cf353d0d3deecb2ce5a5fd1623`; files `.github/workflows/ci.yml`, `docs/CHECKS.md`, `docs/checks.gen.json`.
- Governing: [CHECKS.md CI bullet](../CHECKS.md), [two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md), [WORKFLOW step 7](../WORKFLOW.md); owner scope in Beads loka-b98y, PM ruling drops the pull_request trigger.
- Verdict: **APPROVE WITH NOTES**: no blocker, no should-fix, two nits.

## Must be true

1. A push to `toolbox/batch-*` sets `FULL` to `true`; `github.ref` for a push is `refs/heads/<branch>`.
2. Item-branch pushes still skip every e1 step; `main` still runs nothing on push (`branches-ignore: [main]`); schedule and `full` dispatch still run in full.
3. The gate stays per step, so the job never becomes `skipped`; `ci-green` keeps `e1-recorder` in `needs` and its failure/cancelled/skipped test.
4. Triggers and the per-ref concurrency group are unchanged.
5. CHECKS.md and `checks.gen.json` describe the new trigger and agree.

## Proof

- `ci.yml:112`: `startsWith(github.ref, 'refs/heads/toolbox/batch-')` matches the remote branches `toolbox/batch-m1`..`m7`; `polish/ch1-batch1` is outside the owner scope. All three e1 steps keep `if: env.FULL == 'true'` (`ci.yml:114,118,122`); `ci-green` unchanged (`ci.yml:198-204`); `on:` and `concurrency` unchanged.
- Head push run `38075977042` (item branch): e1-recorder success with checkout, setup-node and recorder steps `skipped`.
- Cited run `38075354915` (earlier head e687166b, pull_request): e1-recorder ran every step, success, 18:20:11 to 18:27:02 (6m51s). Claim backed.
- `actionlint` 1.7.12 on the head file: exit 0. Claim backed.
- `checks.gen.json` text equals the new CHECKS bullet (diff read).
- Batch-branch condition itself: proven on the next `toolbox/batch-m6` push (PM).

## Findings

1. **nit**, `.github/workflows/ci.yml:112`: a `workflow_dispatch` on a `toolbox/batch-*` ref without `-f full=true` now also runs the recorder in full, as `github.ref` is the batch branch. `docs/CHECKS.md:134-135` names only "a push to a `toolbox/batch-*` branch". Harmless (more coverage); a reader expecting a quick dispatch gets 6 more minutes.
2. **nit**, PR body: `/code-review medium` ran on an empty range, so no tool result is reported. Run it on the PR (`/code-review medium 361`) in the fix round, or note it as not applicable to a 4-line CI change.
