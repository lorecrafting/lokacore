# Review: E1 recorder debt-elapsed recipe (loka-ssr9, PR #360)

- PR #360, branch `fix/e1-recorder-ssr9`, head `7e4516580934b2953d3b6f53f42d7d24304f9281`, one file: `kernel/ts/test/e1_debt.ts` (test recipe only).
- Governing: [mechanics.md dialogue@1 hub rule](../system/mechanics.md) (lines 417-427, owner OK in Beads loka-x6t.5); [Review stance](../WORKFLOW.md#review-stance).
- Hosted: dispatch `full` run `38073343552` success in every job (e1-recorder, lint, kernel, elixir, sim, mobile, ci-green). Push run `38073335683`: kernel, lint, elixir, sim, mobile `cancelled` after 7 to 8 s, e1-recorder skipped-success, ci-green `failure` only because of those cancellations (same concurrency group). Not a red signal.
- Verdict: **APPROVE**: no blocker, no should-fix, one nit.

## Must be true

1. `a_peg_debt` has more than one choice and `elapsed` resolves no quest, declares no riddle and has no patrol, so the hub reopens (mechanics.md:417-427; `behavior.ts:81`). The recipe's old final `choice === undefined` was stale, not a product regression.
2. The new recipe pins the reopen (a pending choice after `elapsed`), then Leaves with an accepted `close_choice`.
3. No product code or committed expected answer changes.

## Proof

- Scratch worktree, `CASES` trimmed to `debt-elapsed` only (the recorder has no case filter); selected v042 artifact sha256 `1c53bcd8…`:
  - Control, PR head: case passes (exit 2 is only coverage gaps from the trimmed list).
  - M1 `behavior.ts:81` hub never reopens (`|| true`): new line 67 fails, `undefined` vs `true`. Killed.
  - Old recipe (origin/main `e1_debt.ts`) on real code: fails with the reopened Peg hub, reproducing run 38071956810. On M1 the old recipe passes, which confirms it pinned the pre-loka-x6t.5 behaviour.
- Removed post-Leave check (intermediate c888f1b2): `invoke` asserts `close_choice` is `accepted` (`e1_case_host.ts:212`), so a following `choice === undefined` adds almost nothing. Agreed.
- 16 unrun cases: the green full run on this head covers them. No change needed.
- `/code-review medium` reported in the PR body.

## Findings

1. **nit**, `kernel/ts/test/e1_debt.ts:67`: `closable` is always `true` for a dialogue choice (`shared.ts:214`), so the line asserts "some dialogue choice is pending", not "Peg's hub with `elapsed`". Failure case: a regression that opens a different dialogue after `elapsed` passes. Optional: also assert the choice ids or speaker.
