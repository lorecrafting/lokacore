# Review: M14 row 43a, terrain movement costs (loka-kgd.167)

- Branch `toolbox/m14-43a`, exact head `1f715af59079e33bc4a70dda0a73665ff64565d5`, merge base `20be5318a` (origin/main). No PR (batch M14, loka-kgd.164).
- Governing: brief and PM rulings in `br show loka-kgd.167`; [mechanics.md row 43a](../system/mechanics.md#terrain-movement-costs-toolbox-row-43a); [cartridge.md terrain declarations](../system/cartridge.md#terrain-declarations); [SR7](../system/mechanics.md#movement-on-a-status-toolbox-row-sr7); [contracts lessons](../lessons/contracts.md).
- Record required: the slice changes `protocol/cartridge.schema.json`, `protocol/entity.schema.json` (Tag) and kernel_api (1.106). The brief's "no review record" line was overridden by the PM.
- Verdict: **APPROVE WITH NOTES** at 1f715af5.
- Written 2026-10-16 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. Fare: base (`cost.amount`, else 1 mv) times flee, then statuses, then the destination room's tags in authored order; floor at each step; origin tags ignored; a fare of 0 writes no op.
2. Refusal is the existing `insufficient_resource`; view and rule share `movementPlan`.
3. Schema: `terrain` maps Tag keys to integers 0..1000; `cost` optional; Tag gains `road`, `marsh`.
4. Floor 1.106 on `terrain`, on `movement` without `cost`, and on a room/item/barrier tagged road or marsh, identical in Elixir and TS.
5. No NPC, transport or water change; no new event or op.
6. Compiler passes `terrain` through, keeps tag order; hash fixture pinned.
7. mechanics.md and cartridge.md amended.

Holds: 1-2 (`kernel/ts/src/mechanics/movement/shared.ts:164-182`, sole caller `sequence.ts:144`), 3 (pattern = enum pinned by a test; `invalid.json` drops the obsolete `/movement/cost missing_property`), 4 (`cartridge_pools.ts:44-52`, `cartridge_knowledge.ts`; `lib/loka/content/resources.ex:184-195`, `barriers.ex`; `loader_floors.json` 5 cases), 5, 6 (`terrain_sampler_hash.json`: sha256 of canonical recomputed independently; ford tags `["road","marsh"]` in authored order), 7.

## Test the tests (detached scratch worktree, focused files, each reverted)

| Mutant | Result |
| --- | --- |
| M1 `Math.round` for floor in `fare` | `terrain.test.ts` red |
| M2 room tags walked in reverse | `terrain.test.ts` red |
| M3 TS floor compared to 1.105 | `loader_floors.test.ts` red |
| M4 TS costless-movement trigger dropped | `loader_floors.test.ts` red |
| E1 Elixir costless trigger dropped (`resources.ex`) | `loader_floors_test.exs` red |
| E2 Elixir `marsh` dropped (`barriers.ex`) | `loader_floors_test.exs` red |

Focused green at head: TS terrain, loader_floors, status_movement, portable_abi, e1_services, affects; Elixir content_terrain, loader_floors, content_status_movement, core/contracts, core/portable_abi (38 passed); `kernel/ts` tsc clean. Merge-tree with 35-engine (`7bd17ba9d`): conflicts only in append/version regions (system-graph, toolbox.gen, mechanics.md, `world.ts` INSTALLED, loader_floors.json); `sequence.ts` `fare` call auto-merges.

## Findings

1. Nit, `protocol/entity.schema.json` (commit 1ad3dde71): ~170 lines of array reflow with no semantic change; protocol JSON is outside prettier and `cartridge.schema.json` keeps the expanded style. Blame and merge noise for every later Tag row.
2. Nit, `docs/system/mechanics.md:3661`, `docs/system/cartridge.md:1809`: "cost optional, so a cartridge can scale the default 1 mv fare". On the 1 mv default any percent under 100 makes the move free, and a `[road, marsh]` room at 50/300 is also free (1→0→0). SR7 (`mechanics.md:2621`) states this trap; row 43a does not.
3. Nit, handback: no `/code-review medium` result and no check table.
4. Nit, `kernel/ts/test/terrain.test.ts:84`: reads `gameView(w).exits` without validating against `protocol/gameview.schema.json` (loka-x3i0).
5. Question (PM ruling), no 1.106 floor for `road`/`marsh` named in resistances, `has_tag` or status `passes`: a cartridge at_least 1.105 with such a reference loads on 1.106 but is SCHEMA_VIOLATION on a real 1.105 kernel. Same precedent as SR7's 1.62 floor (rooms, items, barriers only).
6. Question, `protocol/room.schema.json:491`: room `tags` has no `uniqueItems`, so `["marsh","marsh"]` loads and compounds (3 mv at 300% → 9 → 27).

Not findings: rounding to 0 (PM ruling 2, brief case 6); `terrain: {}`/`movement: {}` raise the floor identically in both kernels and were SCHEMA_VIOLATION before; no reader of `movement.cost` in mobile or Elixir runtime; mv loop (start 10, gain 0, sink fares only, no faucet).
