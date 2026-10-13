# Review: toolbox row W11, stock-sensitive prices (loka-kgd.128)

- Branch `toolbox/m11-prices`, head `14faf7bd588deb59fa04e95a481e76b717e5b0e3`, diffed against `1bd6ed6b` (`toolbox/batch-m11`). No PR (batch model). Installed `kernel_api` 1.80 to 1.82.
- Governing: [Stock-sensitive prices](../system/mechanics.md#stock-sensitive-prices-toolbox-row-w11) and [stock price declarations](../system/cartridge.md#stock-price-declarations) (added here), [B3 shop](../system/mechanics.md#pegs-immediate-shop-b3-selected-contract), [replenish](../system/mechanics.md#replenish-toolbox-row-19b), [B3 shop recovery](../system/save.md#b3-shop-recovery), Beads `loka-kgd.128` (brief, 2026-10-13).
- Hosted CI at review time: `book-e2e` success; `ci` **failure** (job `kernel`, step `node bin/check_ts_size.mjs`; finding 1).
- Verdict: **CHANGES REQUIRED** (CI red at head; one should-fix test gap).
- Written 2026-10-13 21:48 UTC in Claude Code by anthropic/claude-opus-5-5 (reviewer). A second-opinion reviewer covers the mobile save depth.

## Must be true

1. `ShopOffer.stock {items, buy}`: optional, no other keys; `items` 2..16 distinct item refs led by the offer's `item`; `buy` one integer >= 1 per item. Both kernels refuse a length mismatch, a wrong `items[0]`, duplicates, an unresolved item and a floor below 1.82.
2. Buy price is `buy[n-1]` for `n` set instances directly held by the shopkeeper (`selected`, charged steps), then `buy_discount`; shelf and exchange call the same function; 0 held is the sold-out refusal.
3. Buy moves the first held set instance in `selected` (EntityId) order; Sell returns a set instance at the flat `sell`; receipt op and event name the moved instance.
4. A price that moved between view and press is `invalid_state`.
5. Save: no static quote comparison for stock offers; the moved item is a set member; real-SQLite reopen, replay and failed-COMMIT test.
6. Trade is 19b content only if replenish admits NPC holders (it does: `ItemLocation` npc); existing shops and Chapter 1 unchanged.

## Proof

- Green at head (local): `node --test` prices, commerce, commerce_contracts, validate; mobile `prices.test.ts`, `commerce.test.ts`; `mix test test/loka/content_prices_test.exs`.
- Mutants (throwaway worktree, each restored):
  - killed: table index `buy[held.length]` (prices a); Buy moves the last held instance (prices a); count over everything the shopkeeper holds (prices a, basket); save skip `|| offer.stock` removed (mobile reopen `save_corrupt`); Elixir floor `[1,82]` to `[1,81]` (content_prices).
  - survived: TS loader `buy[0] !== o.buy` dropped and TS unresolved-item check dropped (finding 2); save set check dropped (finding 3, as the developer reported).
- Acceptance literals hand-checked: player 20 → 18 → 15 → 10 → 11 (sell); fishmonger 20 → 22 → 25 → 30 → 29; prices 2, 3, 5, then unavailable `not_owned`, then 5 after the sell; trade at 28800 gives 2 held, price 3.
- Stale quote: view price and rule price come from one `buyPrice` (`kernel/ts/src/mechanics/commerce/shared.ts:20`); a trade job or the player's own Buy changes the count, and the next press with the old quote is `invalid_state` (test b).

## Findings

1. **blocker** CI `ci` run 38472211429, `bin/check_ts_size.mjs`: `kernel/ts/src/content/cartridge_commerce.ts:6` `commerce` 44/40, `kernel/ts/src/mechanics/commerce/shared.ts:37` `exchange` 45/40, `mobile/authority/local-story/commerce-save.ts:27` `commerceSave` 62/60, `:129` `shopReceipt` 54/50. Scenario: merging into `toolbox/batch-m11` turns the batch head red. Fix: shorten or split the four functions (finding 3 removes two lines of `shopReceipt`).
2. **should-fix** `kernel/ts/src/content/cartridge_commerce.ts:76,80`: two TS loader rules have no TS case. With `|| buy[0] !== o.buy` or the `UNRESOLVED_REFERENCE` test removed, all four TS files pass; a probe artifact with flat `buy: 4` or `stock.items[2]` = `nowhere` then loads in TS while Elixir refuses it (`test/loka/content_prices_test.exs` has both rows). Also no case in either kernel covers the `buy_discount` bound over table entries (`cartridge_commerce.ts:62-64`, `lib/loka/content/commerce.ex:97-101`): `minimum 3` with `stock.buy [5,3,2]` would load and "discount" 2 up to 3 if the bound were dropped. Fix: three rows in `kernel/ts/test/prices.test.ts` test e, one in the Elixir test.
3. **nit** `mobile/authority/local-story/commerce-save.ts:144,151`: the set check cannot fail first. `exchangeSave` (`receipt-save.ts:28`) replays every accepted receipt of a stock cartridge before `commerceSave` (`:30`), and a kernel decision only moves an item from `selected` over the set. Decision: delete `set` and keep only the plain-offer branch (Simplicity; no test can name the check). save.md's "moved item must be one of the set" stays true through replay. The PM may keep it as the brief asked.
4. **nit** The `/code-review` result is not in the commits or Beads; the PM holds the handback.

## Checks asked by the PM

- Shelf and exchange share `buyPrice`: yes. The shelf's past-budget fallback (`shared.ts:91`) only labels an offer the rule refuses.
- Both kernels' floors and loader rules: twins match in code (paths differ by artifact vs source, as elsewhere); TS tests lack two rows (finding 2).
- Schema sweep: `protocol/fixtures/invalid.json` covers each new keyword (required, min/max items, minimum, maximum, types, additionalProperties).
- Mobile diff: no obvious error; plain offers keep the old custody check.
