# Review: toolbox row W11 stock-sensitive prices, save/reconciliation second opinion (loka-kgd.128)

- Branch `toolbox/m11-prices`, exact commit `14faf7bd588deb59fa04e95a481e76b717e5b0e3` (base `1bd6ed6b`). Second opinion because save reconciliation changed ([WORKFLOW Review count](../WORKFLOW.md)); scope: `mobile/` diff (`commerce-save.ts`, `exchange-save.ts`, `prices.test.ts`) and the kernel commerce functions replay calls.
- Governing: [save.md B3 shop recovery](../system/save.md#b3-shop-recovery) (W11 paragraph), [mechanics.md W11](../system/mechanics.md#stock-sensitive-prices-toolbox-row-w11) (Save, Exchange, Trade jobs), [storage lessons](../lessons/storage.md).
- **Verdict: CHANGES REQUIRED** (one untested requirement, one dead check; behaviour at head correct).

## Must be true (written before the diff)

1. Reopen accepts every lawful stock history: Buys at different table prices, rejected stale quotes, Sell back, `buy_discount` on top, and a trade job moving any set item (the offer's own `item` too) between NPCs.
2. A forged receipt (wrong price, item outside the set, swapped instance) is `save_corrupt` with the file bytes intact.
3. Real failed COMMIT and lost acknowledgement leave all-prior or all-next rows; the same-invocation retry replays without a second Buy.
4. No new save section, table or schema; plain offers keep receipt-tracked custody.

## Evidence

- Head: `prices.test.ts`, `commerce.test.ts`, `transport.test.ts` 16/16 pass. Real SQLite (`node:sqlite`), failed COMMIT by a deferred FK armed on the first write, lost ack after a real COMMIT, by operation (`__tests__/elapsed-host.test.ts:19-71`).
- Reviewer scratch (deleted, never committed), each step cold-reopened: buy 2, stale 2 `invalid_state`, buy 3, sell 1, buy 3, buy 5, sold-out `not_owned`, give fish_a to the fisher, wait to 28800 (the trade job returns it), buy 5: pennies 3/37, all reopen. Friendly `buy_discount` 1/2 on the stock offer: 1, 1, stale 3, 2 reopen. Lost ack on buy 3: all-next, retry `replay: true`, no second Buy. Forged price (quote 3 to 4 in command and ops): `save_corrupt`, sha256 unchanged.
- 4: no `store.ts`/schema change under `mobile/`; `protocol/entity.schema.json` adds only the cartridge `ShopOffer.stock`.
- Mutants (the three test files above, restored by `git checkout`): M1 drop the stock replay trigger (`exchange-save.ts:21`): red (forged swap). M4 static-price compare for stock Buy (`commerce-save.ts:148`): red. M5 M1+M2: red. **M2 set check to `false` (`commerce-save.ts:151`): green**, also with the scratch. **M3 drop `.filter((o) => !o.stock)` (`commerce-save.ts:35`): green**; with the scratch's fish_a trade-job history, M3 gives `save_corrupt` and head opens.

## Findings

1. **should-fix** `mobile/authority/local-story/prices.test.ts:56-115`: requirement 1 (set not tracked as offer custody, mechanics.md W11 Save) is untested. M3 passes the suite, yet a lawful history (give fish_a to the fisher, wait to 28800, reopen) is then `save_corrupt`: `custodyEvidence` (`commerce-save.ts:257`) refuses the `wait` receipt's transfer. Fix: one cold reopen after a trade job moves the offer's own `item`.
2. **should-fix** `mobile/authority/local-story/commerce-save.ts:144,151`: the set check is dead. `receiptRecovery` (`receipt-save.ts:28-30`) always runs `receiptHistory` before `commerceSave` for a stock cartridge (`exchange-save.ts:20-27`), and replay deep-compares each decision (`receipt-history.ts:37`), whose moved item comes from `selected` over the set. No reachable receipt fails `set.includes`. Fix: `(!offer.stock && (moved !== p.item_id || custody[moved] !== source))`, drop `set`; the forged test's basket arm (`prices.test.ts:117-119,145`) then names no break of its own and can go.
3. **nit** `commerce-save.ts:150`: `moved === undefined` is covered by `moves.length !== 1` (and by `moved !== p.item_id` on the plain path).

## Fix round 1 re-check (`b2344dcb4b5b6a0499ad67846a837de8bf3479d7`)

Scope: `1df8d6f` (spec) and `b2344dc` (fix), the `mobile/` part and `mechanics.md` Save bullet only. **Verdict: APPROVE.**

- Finding 1 resolved: `prices.test.ts:156-189` (buy 2, buy 3, give fish_a to the fisher, wait to 28800, reopen). M3 (`offerCustody` filter to `() => true`, `commerce-save.ts:90`) fails only that test; restored.
- Finding 2 resolved: set check gone; plain path `(!offer.stock && (moved !== p.item_id || custody[moved] !== source))` at `commerce-save.ts:153`; basket arm deleted; `mechanics.md` Save bullet now says the replay recomputes each moved instance. The forged-swap test still fails without the replay trigger (round 1 M1).
- Finding 3 resolved: `moved === undefined` gone; `moves.length !== 1` now precedes every use of `moved`.
- Extraction: `acquiredOnce` (`shop-event.ts`) is the exact negation of the old event block (each `!==` to `===`, `>` to `<=`, `||` to `&&`); `offerCustody` is the old expression. Same reopen behaviour: `prices`, `commerce`, `transport` 17/17 at head, plus the forged-price probe (scratch, deleted): `save_corrupt`, sha256 unchanged.
- Note, not a finding (identical at `14faf7bd`, so not introduced here): `acquired.length === 1` to `true` (`shop-event.ts:16`) and dropping `moved !== p.item_id` on the plain path (`commerce-save.ts:153`) both stay green in these three files at head and at `14faf7bd`.
