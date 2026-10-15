# Second-opinion review: Homestead hs-7 gifting and barter (loka-kgd.108.5, loka-kgd.70)

- Branch `toolbox/hs-7`, exact head `9e6a83d6b3867ce73244a2ec27b1f735831cb030`, base `398ee570` (diff `398ee570...9e6a83d6`). No PR (batch lane). Covers the first review's fix round (501a8598, 9e6a83d6).
- Governing: [Barter (row kgd.70)](../system/mechanics.md#barter-toolbox-row-kgd70), [escrow 20a](../system/mechanics.md#escrow-custody-toolbox-row-20a), [barter declarations](../system/cartridge.md#barter-declarations), [protocol Identify/Resolve](../system/protocol.md) (lines 55-68), [composition](../system/architecture.md#building-mechanics-by-composition), [WORKFLOW review stance](../WORKFLOW.md), first review [2026-10-15-hs-7-review.md](2026-10-15-hs-7-review.md).
- Verdict: **APPROVE WITH NOTES**. No blocker.
- Written 2026-10-15 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. R1: price 0 only on an entitlement with escrow, in both loaders; buy/sell/ShopOffer/discount keep minimum 1.
2. R2: ActionInput `quoted_price` 0 must not let buy accept 0.
3. R3: a price-0 transition writes no payment op; commerce save accepts it.
4. R4: untimed output moves inputs to custody and output to body in one proposal, no job; `no_output` when the output is absent; 20a/20b unchanged.
5. R5: floor 1.101; claim/cancel need a timed commission (claim also an output); schedule only with `ready_after`.
6. R6: removed or changed fixtures keep their coverage.
7. R7: replay, retry and cold reopen hold.

All hold. R2 holds with a changed reply class (finding 1).

## Findings

1. **should-fix** `protocol/action.schema.json:56` (ActionInput `quoted_price` minimum 1 -> 0). A buy or sell quoting 0 was `invalid` at identify (`kernel/ts/src/commands/invocation.ts:36`, no receipt, protocol.md:59); it now passes identify and is a receipted `rejected unsupported_capability` at resolve (`invocation.ts:121`). Probe: shop variant of gift_sampler, buy (trader, stone) quoting 0 -> `{"kind":"saved","revision":0,"decision":{"kind":"rejected","error":{"code":"unsupported_capability"}}}`. Scenario: a client sends quoted_price 0, then retries the same `invocation_id` with the right price and gets the replayed rejection instead of a purchase. No money moves. Fix: one line in mechanics.md "Price 0" (`docs/system/mechanics.md:3501`) or protocol.md naming the new class, or keep the minimum 1 for buy/sell at the invocation layer. No fixture pins quoted_price 0 for buy/sell.
2. **nit** `mobile/authority/local-story/gift.test.ts`: covers only the shop variant. A barter-only cold reopen (no shop, probe copy of the test) passed, but nothing pins it. Low risk: `commerce-save.ts:29` skips NPCs without a shop.
3. **nit (process)** The developer's `/code-review` result for this diff is not reported (loka-7p2w).

## Evidence

- Focused suites green at head: kernel/ts `gift, construction, loader_floors, validate, service_contracts, commerce_contracts, escrow, built, cartridge_services`; mobile `gift.test.ts`, `escrow.test.ts`; `mix test` content_gift, content_construction, loader_floors, core/service_contracts, core/contracts (17 passed).
- The 9e6a83d6 `move` refactor (`kernel/ts/src/mechanics/service/shared.ts` ~152-158, ~225) is behavior-identical: the settle callers' suites stay green.
- Mutants (detached worktree, each reverted, tree clean):

| Mutant | Result |
|---|---|
| `service/shared.ts:147` escrowed output push dropped | killed: TS gift + mobile gift |
| `\|\| service.price === 0` removed (charge price 0) | killed: barter rejected |
| `lib/loka/content/services.ex:143` `free` always true | killed: mix exit 2 |
| `cartridge_services.ts` `order()` claim without `ready_after` | killed: TS gift.test |

- Loader parity probes: claim/cancel at price 0 refused at `.price` in both; cancel on untimed refused at `.benefit.service` in both; 20a free escrow with no output admitted in both (allowed by spec); barter quoted 1 on a price-0 service -> `rejected invalid_state`. Schema: Command buy/sell quoted 0 -> 1 error each; use_service 0 -> 0 errors.
- Claims rerun: `commerce-save.ts:29` reconciles only NPCs with a shop (confirmed); zero money ops -> `payments []` (`:47-54`, confirmed).
- Fixtures: invalid.json drops `output`->`ready_after` (now valid), keeps `ready_after`->`output`; service_contracts 0 -> -1 keeps the minimum pinned; room/meal/drink price 0 now refused by the loader `free` check (`cartridge_services.ts:68`, `services.ex:143`), mutant-killed. Coverage kept.
- First review findings 1-4 dispositioned in 501a8598/9e6a83d6 (gift text, 20b reason, GameView validate, mobile shop variant); finding 5 carried as nit 2 above.
