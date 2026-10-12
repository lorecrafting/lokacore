# Review: balance tool 1, economy and ecology ledger (loka-kgd.107.1)

- Written 2026-10-12 06:14 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Branch `toolbox/m9b-ledger`, head `c6837e9432213d51c5102548991ddf2406a20ed6`, diffed against `1aa26ad9` (merge-base with `toolbox/batch-m9b`). No PR (batch model). Tool only: no kernel_api, schema, save or Elixir change.
- Governing: [Economy and ecology ledger](../system/cartridge.md#economy-and-ecology-ledger-balance-tool-1) (added here, `d7c87e6b`), [Content reports](../system/cartridge.md#content-reports) (`reach.ts` CLI and `contentGraph`), Beads `loka-kgd.107.1` brief.
- Hosted `ci` and `book-e2e` green on the head (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (two nits).

## Must be true

1. Currencies are exactly the resources named by shop `resource`, service/transport `currency`, choice `payment.resource`/`lesson_payment.resource`; supply = player start + every NPC purse (zero purses included).
2. Every `transfer` caller is a row: commerce, service, transport, dialogue payment (`grep transfer(` in `kernel/ts/src/mechanics`: exactly these four; equipment's `transfer` is custody). Lesson is a sink, payment a faucet.
3. Roles resolve through `d.roles[name].npc/.item`, never the role key; stock reads `resource_starts[benefit.stock.key]`.
4. Any other edge to a currency appears in `unclassified`; classified sites never do.
5. Read-only over `loadCartridge`; refusal exits 1, usage 2; no gate, no committed output.

All five hold.

## Checks run

- `node --test test/ledger.test.ts test/content_graph.test.ts`: 8/8 pass; prettier clean; `bin/check_ts_size.mjs` exit 0.
- All 68 `cartridges/*` compiled with `mix loka.compile` to scratch; ledger exit 0 on each; `unclassified` empty and one currency everywhere.
- Showcase matches the brief: pennies start 10, maximum 100, purses bess 0, nell 0, supply 10; shop_buy 4 ×2, shop_sell 1 ×2; boar/tilt_boar drops; goblin plans cap 2; item sinks edible and `wat_letter` hand_over.
- CLI: no args exit 2; `{}` artifact exit 1 with `UNKNOWN_FORMAT`.
- Mutants (`kernel/ts/play/ledger.ts`): `(lesson_)?` removed from the dialogue path: red; zero purses dropped (`!== undefined` to truthy): red; `availability.through` misread: red; item dropped from the sort key: **green** (finding 1).

## Findings

1. **nit** `kernel/ts/test/ledger.test.ts:27`: the spec orders rows by item last, but each shop and NPC has one offer/drop, so dropping `r.item` from the sort key (`kernel/ts/play/ledger.ts:38`) passes; a shop authored `[torch, candle]` would print in authored order. Fix: give shopkeep a second offer authored after torch but sorting before it, and expect its rows first.
2. **nit** `kernel/ts/play/ledger.ts:32`: the comparator returns 1 for equal keys (both `cmp(a,b)` and `cmp(b,a)` are 1), breaking the sort contract; an NPC with two `drops` of the same item at different chances (no duplicate refusal found in the loader) ties. Fix: `ka < kb ? -1 : ka > kb ? 1 : 0` so ties keep artifact order.

## Departures

- (a) `resource` on every coin row and unclassified entry: accepted; needed to tell two currencies apart, and the spec states it.
- (b) one row shape `{site, ref, …}` with `npc` the other side: accepted; the spec states per site where the NPC is `ref` (shop, drop).
- (c) per-site split for the 40-line limit: accepted. The byte-identical claim is not reproducible (first draft uncommitted); the current output matches the brief on the showcase and runs on all 68 cartridges.
