# Review: forged-row guard tests (loka-2gr, loka-zfq)

- Draft PR #320, branch `test/forged-guards`, head `00c008822870b988c2e7da113673b5e81a60292b`. Tests only (merge-base diff touches six `*.test.ts` files). No hosted CI (draft lane).
- Reviewer: fresh independent Opus. Governing: [save.md "Selected S2 recovery"](../system/save.md#selected-s2-recovery), [storage lessons](../lessons/storage.md) (each persisted field gets its own forged-row red control), pattern [#313 review](2026-10-08-loka-mkm-forged-deadline-receipts-review.md).
- **Verdict: CHANGES REQUIRED**

## Must be true (written before reading the diff)

1. Each "new test" forges a real saved SQLite row, reopens `save_corrupt`, and reopens `open` under its own mutant only.
2. Each "not reachable alone" row has a correct reason; a wrong one hides an untested guard.
3. The unforged stages reopen `open`, so no forgery passes vacuously.
4. Moved helpers keep every older test's meaning.
5. The crow test reaches `shared.ts:74-80` and goes red without it.
6. No production change.

## Checks (narrow `chandlers_debt*.test.ts`, 95 tests; mutants applied alone in a throwaway worktree, restored from a copy)

- Item 1, own-mutant diagonal (each fails exactly its own test): `deadline-save.ts` :122, :244, :160; `deadline-receipts.ts` :81, :143, :62. Off-by-one: `:158 >=`→`>` and `receipts :156 >=`→`>` are each red on one test.
- Item 3: `every unforged stage reopens` (`chandlers_debt_rows.test.ts:301`) covers all six stages.
- Item 4: helper move read hunk by hunk; old `forge(false|true)` row queries select the same single row. Old-test mutant `:189` deleted: only "activates another instance" is red.
- Item 5: deleting the `role` clause or the `generation` clause turns the new crow test red (`kernel/ts/test/crow.test.ts:307`). `target` deleted: green. That matches the PM-accepted dispute.
- Item 2 sample: :61 (forged in the other direction, still refused), :146 (dialogue-save refuses first), :157 (cancelled job, clock before and after the deadline: refused), receipts :173/:174 (payload equality also binds type and fact): hold. :156: fails, see S1.
- Disputes: round 2 #6 `axisMoved` (one call site) and #9 (columns via `forgeRows`): agree; both reuse the existing helpers, and adding a `forge` option would be more code.

## Findings

1. **blocker** `mobile/authority/local-story/deadline-save.ts:156`, PR table row ":156 not reachable alone: :158 refuses". :158 only fires at or after the deadline. Forgery: `expire` stage, job `status='pending'`, `UPDATE head SET clock=237600`. Unmutated: `save_corrupt`. With :156 deleted: `open`, and the narrow suite stays 95/0. Fix: one `forgeRows('expire', …)` case in `chandlers_debt_rows.test.ts`, red under the :156 deletion; correct the row.
2. **question** `deadline-receipts.ts:37`, row "(:38) refuses". :38 and :41 are skipped when `exchanges` is true. Then a string `expected: ""` with `value: 1` passes :39, because `Math.max` coerces `"" + 1`. Is this reachable in a bundle that has both exchanges and the deadline? If so, the row reason needs the `!exchanges` condition. Not run.
3. nit `deadline-receipts.ts:82`: `<=`→`<` survives. This only makes the check stricter (a lawful resolution exactly at `through` would be refused), so it is outside the forged-accept scope.

Over-engineering: none found.
