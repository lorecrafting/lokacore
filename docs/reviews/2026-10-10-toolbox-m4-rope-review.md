# Review: rope and climb, toolbox row 30 (loka-kgd.28)

- Local branch `toolbox/m4-rope`, head `d8ec887f339f43c32dbb5588dd9d377ed026a30a`, diff `238bd8f2...d8ec887f` (27 files); no PR (batch M4). Protocol change (`room.schema.json`, `invalid.json`, kernel_api 1.45 floor), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row 30 and Traps](../MECHANICS-TOOLBOX.md#traps), [mechanics.md row 11 hidden face](../system/mechanics.md#hidden-passages-and-search-toolbox-row-11), [G1 leaf rule](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1), brief and PM rulings in Beads `loka-kgd.28`.
- Hosted CI on the head: ci and book-e2e, both success.
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. With the rope held the descent is an ordinary move; without it the move still lands and costs the fixed HP once, with the authored line, deterministic (no RNG).
2. The fall runs only after every admission (hidden, barrier, position, fare) and reads HP after the fare.
3. A fall never kills (PM): HP stops at max(1, pool minimum); no death path is reachable.
4. Compiler and loader refuse the same cases: item and text references, the 1.45 floor; patrol legs over a climb face; NPC flight and refuge skip it.
5. No new policy leaf (has_item's `held` reused), so G1 does not apply.
6. Opt-in: Chapter 1 and corpus unchanged.

## Proof

- Focused tests green (local) on a trial merge into `origin/toolbox/batch-m4` (3f4705d0): `climb`, `hidden_passage_npc`, `hidden_passage`, `exit_admission`, `combat_flee`, `c6_expedition`, `barriers`, `tags`; `content_climb_test.exs`, `system_graph_test.exs`.
- Trial merge: conflicts only in `docs/system/cartridge.md` and `mechanics.md` (both append a section at the end; keep both) and `docs/system-graph.gen.json` (regenerate; `bin/contracts.exs` leaves `contracts.gen.ts` unchanged).
- Mutants: floor 1 to 0 (`movement/shared.ts:81`) red; refuge without the climb skip (`population/behavior.ts`) red; Elixir patrol leg without climb (`patrol.ex` `leg?`) red. Rope only in direct custody (`movement/shared.ts:78`) **green** (finding 1).
- Probe: `world.movement.cost` 1 hp, then a ropeless fall from 10 gives 5 (fare then fall chain correctly).
- Chapter 1: `mix loka.compile cartridges/ashmere_chapters` byte-identical at base and head (sha1 `ee93f779`). No corpus or fixture byte changed beyond two new `invalid.json` rows.
- Items 1 to 6 hold. Flee goes through `moveSequence` with the drawn direction (`flee.ts:44`), so it falls the same way. Upward face plain: acceptable, `climb` is per face and cartridge.md tells authors to declare it on the descending face only.

## Findings

1. **should-fix**: rope carried in a pack is untested. `kernel/ts/src/mechanics/movement/shared.ts:78`; `climb.test.ts:62` only takes the rope into the hand. A refactor to direct custody (mutant above) passes, and a player with the rope in a pack falls although mechanics.md promises otherwise. Fix: one assertion with the rope inside a carried container.
2. **nit**: "after the fare" is untested: the sampler has no hp fare, so `sequence.ts:89` reading `{}` instead of `paid.levels` would pass, and an hp-cost cartridge would emit a stale `from`.
3. **nit**: the Flee fall in mechanics.md "Climb face" has no test; it relies on the shared path only.
