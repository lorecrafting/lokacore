# Review: liquid line binds its vessel, PR #512 (loka-tc2e, kernel_api 1.122)

- PR [#512](https://github.com/lorecrafting/lokacore/pull/512) `feat/tc2e-liquid-vessel` at `a951e70109c354af53a453cc90ef06aa35bc89e7`, diff `origin/main...a951e7010`.
- Governing: "BRIEF loka-tc2e" (`br show loka-tc2e`), PM rulings 2026-10-30 in `br show loka-ewtx` ((3) pour names the receiver), [B7 well and waterskin](../system/mechanics.md#b7-well-and-waterskin-selected-contract), `protocol/text.schema.json` Text, AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **APPROVE** at `f30b3825f3b4e3d2dfcd24a432f575fdaec48adc` after the fix re-check below (first pass at `a951e7010`: CHANGES REQUIRED, one blocker).

## Must be true (written before reading the diff)

1. Fill and Drink lines bind participant `vessel` = the payload vessel; Pour binds the receiver.
2. `remaining` is the vessel's committed quantity read from that vessel's `liquid.set` op, not recomputed; `capacity` is that vessel's spec capacity.
3. Acceptance rows 1-3 pinned with hand-derived literals (fill 1/4 -> 3, 4, 4; drink from 4 -> 1, 3, 4; pour 3 into 1/3 -> 2, 3, 3).
4. Acceptance row 4: a pour that moves nothing stays `invalid_state` with no line.
5. No schema change (bindings are integers, participants EntityIds); no caller outside `liquid/rule.ts`; nothing under `mobile/app/book`, `view/`, `protocol/*.schema.json`, services.
6. `world.ts:108` and `cartridge.json:8` at 1.122; hash fixture regenerated; transcript and story repins hash-only.
7. B7 gains the one sentence citing loka-tc2e.

Results: 1-3 and 5-7 hold; 4 does not (finding 1).

## Findings

1. **Blocker, `kernel/ts/test/liquid.test.ts:138`** (with the row dropped at :132 in a951e7010). Acceptance row 4 is no longer pinned. The custody case `owned(4, 4)` pour asserts only "not accepted, world unchanged". The mutant `shared.ts:155` `return 'invalid_state'` -> `return 'not_present'` stays green in `liquid`, `composition`, `compose` and `cartridge_liquids` tests (pass 12 + 48, fail 0); no other test pins a pour `invalid_state`. Failure: a full receiver reports "not present" to the Book and CI passes. The PR body's disposition "duplicate refusal row removed ... the custody test already holds" is not backed by that run. Fix: restore the dropped assertion, or make the :138 case assert `{code: 'invalid_state'}`.

## Evidence

- `bin/mutate_diff.sh origin/main` at the head: 4 mutants, 4 red-narrow, the same as the handback table.
- Hand mutants on `shared.ts`, each red on "each liquid line binds its vessel ...": M1 `remaining: payload.quantity`; M2 pour binds `source_id`; M3 `capacity` dropped; M4 `remaining: set.from.quantity`; M5 pour `capacity` from the source.
- Literals trace to `liquid_fixture.ts:15` (capacity 4), `:31` (drink_amount 1) and the in-test receiver capacity 3.
- PR claims rerun: sed old content hash -> new reproduces all 37 transcript/story files (0 differ); cites `shared.ts:172`, `:187` and `mechanics.md:1196-1198` match.
- `d10_contracts.test.ts` (hash fixture) passes.
- CI (`gh run list --commit a951e701...`): graph-diff success; `ci` and `book-e2e` in progress when seen.

## Fix re-check at `f30b3825f3b4e3d2dfcd24a432f575fdaec48adc`

- Diff `a951e7010..f30b3825f`: this record and the index (carried unchanged), plus `kernel/ts/test/liquid.test.ts:161-162`, which asserts `{code: 'invalid_state'}` for `cases[1]` (the `owned(4, 4)` full-receiver pour). Nothing else changed.
- Finding 1 closed: the same `shared.ts:155` `not_present` mutant now fails "liquid refusal participants and custody ..." (pass 11, fail 1); unmutated, pass 12.
- CI seen: graph-diff success; `ci` in progress, `book-e2e` queued.
