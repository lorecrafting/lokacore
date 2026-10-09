# Pre-polish audit B: save and persistence (2026-10-08)

Base: `main` at `e38af110`. Read-only area audit (loka-v9q), not a PR review.
Scope: `mobile/authority/local-story` (save, store, commit, transaction, invocation,
receipt-history, receipt-save, elapsed, elapsed-store, deadline-receipts, deadline-save,
authority, delivery), `kernel/ts/src/runtime/proposal.ts`, `world.ts`.
Governing: [save.md](../system/save.md) (opening `:21-28`, `:52-54`; commit/fence `:85-96`;
file/load `:110-134`; elapsed `:231-319`), [protocol.md trusted replay](../system/protocol.md#trusted-local-elapsed-replay),
[owner rules](../system/owner-rules.md) `:146-154`, [storage lessons](../lessons/storage.md).

## Must be true

1. Every refusal is typed (`unsupported_save_format` first, `save_corrupt`, `pinned_release_missing`), nothing written but derived tables (save.md:21-28, :110).
2. Head, changed rows, reports, elapsed checkpoint and receipt commit in one `BEGIN IMMEDIATE` transaction; a failed COMMIT fences until a closed-transaction read settles it; memory never serves unconfirmed state (save.md:85-96).
3. Known invocation id: same digest version + valid DecisionResult + same digest replays, else `conflict`; faults get no receipt (save.md:62-68).
4. Reopen rebuilds from the pinned release under the pinned context, restores head clock/RNG, and validates rows against the revision-ordered accepted receipts; forged rows refuse `save_corrupt` without rewriting bytes (save.md:129-150, lessons:19-20).
5. Elapsed checkpoint target ≥ confirmed head; run mismatch is `stale_view`; no invented anchor (save.md:234-243).
6. Deadlines: reopen never renews; head clock vs due job agree (save.md:956-958).

## Checked

- Code read in full for every scope file. Refusal tests present: `saves.test.ts:200,221,249,330`, `recovery.test.ts:134,153`, `start_over.test.ts:321-399`, `elapsed-driver.test.ts:315`; failed/unknown/lost COMMIT via real deferred-constraint and lost-ack faults (`__tests__/elapsed-host.test.ts:23-56`, `faults.test.ts`).
- Forge run (scratch script, not committed) on the bundled chapter `missing_child_v042` after `choose_ancestry` + `move north` (head revision 2, clock 64800), reopened through `openGame`:

| forge | result | bytes after |
|---|---|---|
| `head.clock − 1` | `save_corrupt` | head still 64799, 2 receipts |
| `head.clock + 1` | `save_corrupt` | unchanged |
| `head.revision − 1` | `save_corrupt` | unchanged |
| newest accepted receipt deleted | `save_corrupt` | unchanged |
| same `clock − 1` on the minimal ferry elapsed cartridge | **opens** at 65800; first pulse commits revision 2 | rewritten |

## Findings

- **B1 | should-fix | `mobile/authority/local-story/liquid-save.ts:20-29`, `exchange-save.ts:15-24`** — `receiptHistory` (the only check that ties head clock/revision to the receipt chain, `receipt-history.ts:31,41`) runs only when a content-enumerated gate matches; the two lists are duplicated and must be extended per mechanic. Failure: a cartridge outside both lists reopens a head clock rolled back behind its newest elapsed receipt and the driver rewrites the save (table, last row). The bundled chapter always matches (knowledge, water, populations), so no shipped exposure. Fix: delete both gates and the `historyChecked`/boolean plumbing; run `receiptHistory` unconditionally (chapter reopen cost is already paid). Small; can wait for RC.

Questions (no concrete failure in the shipped chapter):
- `store.ts:155-164` guards unsafe SQLite integers only for `loka-save-v2`; `authority.ts:185` writes new saves as v1 until the first driver pulse upgrades them (`elapsed.ts:30`). Is the v1 head meant to skip `natural()` (store.ts:166-171)?

## jk0 facts

1. No clause in `docs/system/save.md` (or another `docs/system` file) requires reopen to refuse a head clock earlier than the newest committed receipt. Receipts store no clock (`store.ts:36-46,:55-58`). Nearest text: save.md:129-131 (head restores clock/RNG), :472 (B3 "final replayed balances must match the current saved rows"), :956-958 (reopen never renews a deadline); `docs/lessons/storage.md:19-20` (cold reopen replays the exact stored receipts).
2. No direct comparison exists. Indirect: `receipt-history.ts:41` `same(world.state, saved.state)` requires the state replayed from seed through every accepted receipt (clock included) to equal the hydrated head/rows, and `:31,:41` pin head revision to the chain; only when the B1 gate is on. `deadline-save.ts:155-160` compares head clock to a bound deadline job (the expire-stage case `chandlers_debt_rows.test.ts:176`).
3. Today (table above): bundled chapter refuses `save_corrupt` in both directions with bytes preserved; a gate-off cartridge reopens and rewrites. Disposition suggestion: answer jk0 as "enforced by receipt replay, proven by forge"; the fix is B1 plus one sentence in save.md "The save file" naming the rule; a dedicated chapter test is one row in an existing forge table if the PM wants it pinned.

## Verdict

HEALTHY WITH FINDINGS (B1 should-fix, can wait for RC; one question).
