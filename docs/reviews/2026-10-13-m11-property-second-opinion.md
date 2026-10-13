# Review: m11 property and bank (rows 24/25) mobile save, second opinion

- Branch `toolbox/m11-property`, exact commit `19b6c6bff0bc8a22f333b0ce7f28ed7d43092f94` (base `23f7d115`); Beads `loka-kgd.127`. Second opinion because save reconciliation changed ([WORKFLOW Review count](../WORKFLOW.md)); scope: `git diff 23f7d115..19b6c6bf -- mobile/` and the kernel service functions it calls. Another reviewer covers the rest.
- Governing: [save.md Commit, fence, reconcile](../system/save.md#commit-fence-reconcile), [B3 shop recovery](../system/save.md#b3-shop-recovery), [B8 service recovery](../system/save.md#b8-service-recovery) ("B3/S2 payment history ... must recognize the new service producer"), [storage lessons](../lessons/storage.md) (forged-row red control per persisted field; failed and lost COMMIT), mechanics.md "Property and bank".
- **Verdict: APPROVE WITH NOTES** (behaviour correct in every probe; the branch's own test covers only the lawful path).

## Must be true (written before the diff)

1. Reopen accepts every lawful history: deposits and withdrawals at both branches, interleaved with shop payments, a refused overdraft (rejection receipt, no revision), a lost-ack retry.
2. Reopen refuses, without rewriting, a receipt whose bank amount, vault or account differs from the service, and a forged account or balance row.
3. Real failed COMMIT reopens all prior; lost acknowledgement reopens all next; the retry replays and charges nothing again.
4. No save section, table or format change.

## Evidence

- 4: the mobile diff is `commerce-save.ts` (+1 function, pairs list) and a new test; `store.ts`, `save.md` untouched; account is an existing `facts` row.
- Code: `commerce-save.ts:44-51` checks `[fee pair, bank pair]` positionally on running balances; `receipt-history.ts:38` replays every accepted receipt through `step` and requires the identical decision and final state, gated on any service (`liquid-save.ts:21-30`).
- Runs at head: `property`, `escrow`, `service`, `commerce`, `transport` tests green. Reviewer scratch probe (not committed): 1. buy_hut, deposit A, withdraw A, deposit A, shop buy, withdraw B, refused overdraft (`rejected invalid_state`), deposit B: reopen `[0, 30, 10]`. 3. failed/lost COMMIT on a deposit and on a withdraw, real deferred-FK COMMIT failure: prior/next exactly, file unchanged on failure, retry `replay` iff lost, second retry leaves disk identical. 2. forged amount, vault (clerk_b), account (receipt+row), account row only, omitted bank pair, fee/amount swapped, pairs reordered: all `save_corrupt`, disk unchanged. Provider as its own vault (same row adjusted twice): lawful, reopens, lost ack replays.
- Mutants (`commerce-save.ts`): M1 no bank pair, M2 swapped direction, M3 amount+1: each red (`property.test.ts:59`). M4 delete `:49` length check: **green** in all five suites. M6 drop `receiptHistory` (`liquid-save.ts:30`): forged `savings` row 11 reopens `open`; branch tests stay green.
- Op order (brief Q3): coherent kernel reorder (bank pair before fee, `service/shared.ts:255-260`): kernel `property.test.ts` 5/5 green, mobile reopen `save_corrupt`. Loud, caught by `property.test.ts:59`, not silent. Not new coupling: `receipt-history.ts:38` already freezes op order for every stored receipt.

## Findings

1. **should-fix** `mobile/authority/local-story/property.test.ts:59`: lawful path only; no failed/lost COMMIT, refused overdraft or forged bank receipt/row case (storage lessons). M4 and M6 survive it. If the services gate at `liquid-save.ts:21-29` is narrowed (loka-b60), a save whose `savings` row is raised from 10 to 11 reopens `open` (M6), crediting a penny the vault never received. Fix: add the forged `savings` row and one lost-ack deposit to this test.
2. **nit** `docs/system/save.md:798` (B8): no line names the bank pair; the reconciliation rule lives only in mechanics.md.
