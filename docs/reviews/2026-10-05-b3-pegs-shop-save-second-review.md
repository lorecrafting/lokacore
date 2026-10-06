# B3 Peg's shop: independent save/protocol second opinion

Reviewed integrated head `340025a0ef5d3644e84ac23634b74dfa6d20d459`, source
`e530505061bb7195f034a286caaf3be213ea13c9`, against provisional A3
`6a8be6d1` (including its adopted `05e72a3c` correction).
Fresh reviewer authored none of the implementation. Verdict: **CHANGES REQUIRED**.

Requirements derived before the diff: [B3 recovery](../system/save.md#b3-shop-recovery)
requires chronological exact penny transfers, bound item custody, lawful intermediate
reopen and atomic receipt retry/fault handling. [B3 composition](../system/protocol.md#b3-shop-composition)
and the [brief](../briefs/chapter-one/b3-pegs-shop-brief-2026-10-05.md) require
current generated contracts, compiler/loader parity and independent release/ID pins.

## Findings

- **B3-S1 — blocker:** `protocol/fixtures/missing_child_v018_ids.json:49` allocates
  fresh IDs to the `player_corpse` and `rat_corpse` templates, shifting nine later
  real items. For example line 55 pins torch as
  `48e925e9-3e80-821a-961b-285dfd4c0f7f`; both an independent SHA-256 ordinal
  calculation and `newWorld` produce `3f7be222-cc48-8fb0-b007-f6d17119bd7f`.
  `fresh.ts:91` excludes template items from initial allocation. Commerce tests
  derive their IDs from `fresh`, so the incorrect independent fixture remains
  undetected. Correct the fixture independently and consume its literal answers
  in a focused allocation/commerce test so an allocation regression fails.
- **B3-S2 — blocker:** `protocol/entity.schema.json:373` and
  `protocol/gameview.schema.json:1715` introduce `ShopOffer`, `Shop`, `ShopAction`
  and `ShopItemView` without examples. The existing
  `test/loka/core/contracts_test.exs:17` fails with `MatchError: nil` when it
  requires every contract's examples. Add valid current examples for all four
  definitions and regenerate/check the artifacts; retain the existing check.

## Verification

Focused kernel commerce/contracts, real SQLite commerce/B2 and existing fault
tests: **41 passed**, 18.0 s. Compiler/contract tests: **11/12 passed**;
the failure is B3-S2 (all three chapter compiler tests passed).
Contract generation check: exit 0. Independent Python canonical encoding/hash
and literal shelf prices/masses pass; independent ID calculation exposes B3-S1.

Independent saved-SQLite probes refuse a missing purchase receipt and forged
actor, provider, quote, event scope/context/cause and resource version. In a
disposable detached checkout, omitting payment validation fails the existing
forged-payment case and the resource-version probe; omitting saved provider/quote
binding fails the provider probe. Restored source passes all seven scoped tests.
The checkout was restored and removed; no production source changed.

Chronological S2 commerce composition, exact retry, finite buyback, active/expired
ledger protection, failed COMMIT and both unknown outcomes pass. No save-behavior
finding reproduced. Broad schema mutation sweep and full publication checks remain
deferred under the provisional lane; no native/browser proof claimed.
Ponytail Review: **Lean already. Ship.** The two contract-proof blockers remain open.

## Scoped fix recheck — 2026-10-05

Reviewed exact integrated head `9c7e537942e13455a1f64b5afdb90b60faae27dd`,
fix source `bd3d8c05518a890d7b6b282970092ce6b9b50cde`.
Verdict: **APPROVE**; B3-S1 and B3-S2 closed, no open findings.
Scope was the fixes, their tests and direct callers.

- B3-S1: the Python SHA-256 enumerator excludes corpse templates and includes
  scheduled jobs and slot holders in the declared allocation order. It reproduces
  the committed 58-ID fixture without a change. The focused test checks every
  fresh identity against that independent fixture, then buys and wears its exact
  torch and cold-reopens at player17/Peg23/Aldric10 with the pinned light holder.
  Independently restoring the original ID fixture makes only this new test fail;
  the prior six commerce tests still pass. Restored fixture: seven tests pass.
- B3-S2: all four new definitions have valid minimal examples; generated contracts
  match. Independently removing those examples reproduces the existing contract
  example failure (8/9 pass). Restored schemas: all nine tests pass.

Focused Node commerce/schema checks: eight pass. Elixir contract/chapter compiler
checks: twelve pass. Contract generator check: exit 0. Mutation checkout restored
and removed. No runtime behavior or chapter artifact/hash changed.
Ponytail Review: **Lean already. Ship.** Publication checks retain their existing gate.
