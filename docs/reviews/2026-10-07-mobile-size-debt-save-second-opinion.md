# Mobile size debt: local save split, second opinion

- PR #305 (`chore/mobile-size-debt`), reviewed at `a81dbf1d`, base `294062aa`.
- Scope: `mobile/authority/local-story/**` only (save, store, commit, narration, invocation,
  bell/deadline/finale/deer/dialogue save and their new receipt modules, bell tests).
- Governing: AGENTS.md "Persistence shape (ADR-072)", [WORKFLOW.md Review stance](../WORKFLOW.md#review-stance),
  [storage lessons](../lessons/storage.md).

**Verdict: APPROVE WITH NOTES.** The split is behavior-preserving.

## Must be true

1. One transaction per decision: elapsed checkpoint, reports, head + delta rows, receipt, in
   that order, inside `transaction` (BEGIN IMMEDIATE / COMMIT, rollback on throw).
2. Memory (`s.world`, `s.revision`) changes only after `commit` returns true.
3. An unknown COMMIT sets `s.fence`; no decision runs until `settle` resolves it.
4. Reopen validators keep every check, in the same order, with the same error text.
5. No module state duplicated or split; no new import cycle.

## Checks

- `commit.ts:24-73` equals the removed `store.ts` `commit` (write order unchanged; HEAD/delta
  moved into `writeDelta`). `save.ts` commit/adopt/fence code is untouched apart from imports.
- `store.ts` `restorable`/`firstSave`: same predicates, same short-circuit order.
- `narration.ts`: `corpsePickup`, `readableDetail`, `recipeDetail` are whitespace-identical to the
  removed code; `receiptDetail` → `travelDetail`/`bandaged` and `combatLines`/`latest` are the
  same expressions, same order.
- `bell-receipt.ts`, `deadline-receipts.ts`, `finale-receipts.ts`, deer/dialogue helpers: line
  by line, same checks and order; `bellSave`, `deadlineSave`, `finaleSave` call order
  unchanged (finale: begin → bell → scene → order → completion).
- `invocation.ts` `hold`: same reservation; the only module WeakMap (`invocation.ts:49`) did not move.
- Import graph: `narration → save`, `commit → store`, `*-receipts → store` (types); no cycle.
- Bell tests: the same 13 test names before and after; assert count 60 → 62.
- Suites (one run each): local_story, faults, recovery, bell, bell_receipts, deer,
  deer_bleed_recovery, finale, chandlers_debt, saves, narration_routing, wren_escort,
  missing_child, story_points: all pass (deer needs `mix deps.get` in a fresh worktree).

## Mutants (head `a81dbf1d`)

| # | Mutant | Result |
|---|---|---|
| M1 | `commit.ts` skip receipt INSERT | killed (faults: "saved without a durable receipt") |
| M2 | `save.ts` adopt `next.world` before `commit` | killed (faults, 21) |
| M3 | `save.ts` unknown COMMIT returns pending, no fence | killed (faults, 24) |
| M4 | `commit.ts` skip HEAD write | killed (9) |
| M6 | `finale-save.ts` drop `checkOrder` | killed (finale) |
| M7 | `bell-receipt.ts` `silencedOnly` always true | killed (bell_receipts) |
| M5 | `deadline-receipts.ts:217` drop trust `fact_changed` check | **survives**, full local-story suite |
| M8 | `deadline-save.ts:163` skip `activated(...)` | **survives**, full local-story suite |

M5 and M8 also survive on `294062aa` (same edits in the old `deadline-save.ts`, full suite).

## Findings

1. **should-fix (pre-existing, not introduced here)** `deadline-receipts.ts:217`,
   `deadline-save.ts:163`: no test forges the accept receipt or the expiry trust event. Failure:
   a save whose accept receipt does not activate the instance or schedule its job, or whose
   expiry receipt lacks the trust `fact_changed` event, reopens instead of `save_corrupt`, and
   the suite stays green. Follow-up issue, not a blocker for this split.
2. **nit** `deadline-save.ts:2-3`: two `import type` lines from `contracts.gen.ts`; merge them.

Workspace removed after the review; no code edited.
