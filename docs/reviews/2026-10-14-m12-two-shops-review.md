# Review: two shops make cold reopen save_corrupt (loka-kgd.149)

- Branch `toolbox/m12-two-shops`, head `b759a67fdee533e19345d0a40e16406709fef6ef`, forked at `6171ecdf`; batch head now `6642e7c1` (no change since the fork to `commerce-save.ts`, `receipt-save.ts`, `receipt-history.ts`, `exchange-save.ts`, `shop-event.ts`, `cartridges/prices_sampler` or `lib/loka/content/commerce.ex`). No PR (batch model). Hosted CI green on the head (ci, book-e2e).
- Governing: Beads `loka-kgd.149` brief; M11 batch review finding 1 (`docs/reviews/2026-10-13-m11-batch-fable-review.md` on `toolbox/batch-m12`); [storage lessons](../lessons/storage.md); [reviewer stance](../../.claude/agents/reviewer.md).
- Verdict: **CHANGES REQUIRED**. The code at the head is correct; two of its new branches have no test that goes red when they are broken (reviewer.md step 3).
- Written 2026-10-14 by anthropic/claude-opus-5-5 (main reviewer). This replaces the partial record of `644a9cf2`, which stopped before the diff was read because the disk was full.

## Must be true (written before the diff)

1. Each `buy`/`sell` receipt is checked by `shopReceipt` exactly once, under the shop NPC its `provider_id` names. A receipt that names an entity which is not a shop NPC is `save_corrupt`.
2. Each shop's loop reconciles its own currency. Another shop's receipt counts as a payment there only when both shops use the same currency; otherwise it must carry no money ops in that currency.
3. A receipt at shop A must not move a tracked (plain-offer) item of shop B unless there is evidence for the move. `custodyEvidence` returns `true` for any buy or sell, so the per-provider filter must not let A's receipt move B's tracked item unchecked.
4. Final balances and custody checks are unchanged; the existing commerce, prices, property and escrow save tests are unchanged.

## Check against the list

1. Met. `commerce-save.ts:41-45` checks a receipt only when `seller === provider`, and `:43` refuses a provider that has no shop. Every shop comes from an NPC (`commerce.ex:9` iterates `defs["npc"]`), so every shop provider is visited once by the loop at `:28`.
2. Met: `:46-50`. The two-currency half is not tested (finding 2).
3. Met. A plain offer's item must be initially held by its own shop (`commerce.ex:119` `stocked?`), so no item is the plain offer of two shops, and `shopReceipt` (`:147`) binds a plain move to `p.item_id` held by the seller. A stock-offer move is replayed by `receiptHistory` (`exchange-save.ts:21`) and bound by `acquiredOnce`. The forged swap at `two_shops.test.ts:200-206` stays `save_corrupt` with the decision comparison of `receiptHistory` disabled; the item event no longer matches the move.
4. Met. Only `commerce-save.ts` and the new `two_shops.test.ts` change. `commerceSave` has one caller, `receipt-save.ts:30`; `shopReceipt` is file-local.

Focused run (two_shops, commerce, prices, property, escrow): green.

## Mutants (bin/mutate.sh and hand edits, `two_shops.test.ts` narrow, then the four other suites)

| Mutant | Result |
|---|---|
| `if (shopped && seller === provider)` -> `if (shopped)` (the old unfiltered loop; red control of the brief) | red |
| payer/recipient `seller` -> `provider` (`:46`) | red |
| the custody loop skips other shops' receipts (`:59`), the commit's red control | red |
| `? same(sellerShop.resource, shop.resource)` -> `? true` (`:48`) | **SURVIVED** |
| delete `:43` and read `sellerShop?.resource` | **SURVIVED** |
| `:43` `invalid()` -> `continue` | survived; equivalent (the receipt is then skipped whole, and the custody check at `:76` refuses it) |
| `receipt-history.ts` decision comparison removed | survived; informational (see point 3) |

## Findings

1. **blocker**, `mobile/authority/local-story/two_shops.test.ts:163`: no test fails when the non-shop guard (`commerce-save.ts:43`) is removed. The forgery keeps its two `resource.adjust` ops, so the money count at `:54` refuses it, not the guard. The commit's "red control: guard removed" goes red only through `TypeError: Cannot read properties of undefined (reading 'resource')`, which is a crash and not a `save_corrupt` refusal. Scenario (run): delete `:43` and use `sellerShop?.resource`; forge receipt 2 with `provider_id = body`, strip its `resource.adjust` ops, and set the body's penny row to 15 and the fisher's to 0. The save opens and the basket is free. The suite stays green; at the head the same save is `save_corrupt`. Fix: use that forgery shape at `:163`.
2. **blocker**, `mobile/authority/local-story/commerce-save.ts:48`: no test covers two shops with different currencies. Scenario (run): the test-local clone gets a `shells` resource and the fisher's shop uses shells; one buy at each shop, then cold reopen. At the head the save opens; under `? true` it is `save_corrupt`. This is the same class of bug as the brief, so it needs one test. Fix: add that case to `two_shops.test.ts`.
3. **nit**: neither commit message nor the Beads notes report the developer's `/code-review` result. Run it in the fix round.

## Claims rerun

- "red controls: the tracking shop ignoring another shop's moves fails the lawful reopen" (b759a67f): backed (the `:59` mutant goes red).
- "A receipt naming a provider that is not a shop is save_corrupt (red control: guard removed)" (b759a67f): not backed (finding 1).
