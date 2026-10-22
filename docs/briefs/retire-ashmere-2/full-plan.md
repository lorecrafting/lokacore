# Retire Ashmere fully: coverage check, K remap, slices (planner, 2026-10-21)

Read-only plan on retire/ashmere-2 at 691bd3385. Nothing was run. "Only in chapter/r9c" comes from a field-level diff of every cartridge source (Python walk of `cartridges/*/**/*.json`), not from capability locks. A capability lock can hide a gap: the showcase locks `population` but has no `shoo`, and it locks `attributes` but has no ancestries.

## Decisions the PM must make
- **D1 (blocks T and Z).** Bleed (`bandage`), expedition and population (`shoo`) have no transcript source outside the chapter, and a fragment cannot hold a transcript: `bin/features.exs` globs `cartridges/*/transcripts/<key>.jsonl`, and `transcripts.test.ts` needs a KAT for it. Recommended: three minimal mechanic samplers with KATs, `bleed_sampler`, `expedition_sampler` and `shoo_sampler`, following the speech_sampler KAT pattern. The alternative is an owner-accepted exemption in `features --check`.
- **D2 (Z scope).** "Zero hits" means zero outside history. Excluded: docs/{archive,reviews,evidence,decisions,briefs,playtests,rnd,worldbuilding}, .beads and package-lock.json (a false hit on hash text). Contract fixtures that use Ashmere ids only as opaque data are kept, unless the owner wants repo-wide zero.
- **D3 (tell L3 now).** L3 must not delete `kernel/ts/test/wisp_fixture.ts`, `priory_fixture.ts` or `fixtures/c5-provisional-artifact.json`, because K and R files import them. They move to M6a, M6b and M2b. L3 also writes `test/fixtures/chapter_v042` paths, but L2 is cancelled, so those paths are wrong.

## Fragment helpers
- **TypeScript.** There is no shared helper. The pattern is `transport_fixture.ts` `bundle(change)`/`genesis`/`fresh`: decode the KAT canonical, change it, `encode`, sha256, `loadCartridge`, `newWorld`. M0 lifts it into `kernel/ts/test/fragment.ts` with a KAT path argument. Each `*_fixture.ts` is rebased on it and keeps its export names. Base on a frozen sampler KAT (for example `cartridge_rooms_hash.json` or `containers_sampler_v009_hash.json`) rather than `toolbox_showcase_hash.json` where you can, because the showcase hash still moves.
- **Elixir.** `Loka.ContentSource.copy/compile(dir, changes)` in `test/test_helper.exs`. `write` runs `mkdir_p`, so a fragment can add a `bleeds/` directory to a sampler copy.
- There is no `test/support` directory.

## Coverage table

"Only chapter/r9c" = no other cartridge source authors the field. R19 = one of the 19 renamed samplers.

| Mechanic (fields) | Only chapter/r9c? | Who else authors it (paths under cartridges/) | Target |
|---|---|---|---|
| bleed + bandage (`bleeds/`, `items.bandage`) | yes | none | sampler:bleed_sampler (new, D1) |
| expedition (`expedition`, shelter) | yes | none | sampler:expedition_sampler (new, D1) |
| population shoo/sight (deer) | yes | none (showcase locks population, no shoo) | sampler:shoo_sampler (new, D1) |
| escort follow/Flee/Rejoin | yes | none (ferry_sampler R19: loader refs only) | fragment: ferry_sampler + inline escort |
| patrol checkpoints/Restart | yes | none | fragment: patrol_fixture over rooms_sampler |
| water admission/drowning | yes | none (the showcase "water" is a liquid kind) | fragment: water_fixture over rooms_sampler |
| transport use_transport | not showcase | fast_travel_sampler/transports | sampler:fast_travel_sampler (+ new KAT) |
| crow scavenge (corridor, fallback, carrying, delivered) | yes | none | fragment: transport_fixture + inline population |
| hound bundles (member_role, loot_role, pelts) | yes | none | fragment: c4_pack_fixture + inline bundle |
| pack, wander, flight | no | toolbox_showcase/populations/goblins.json; fear/tracks/targets/ranged samplers | showcase:goblins |
| writer groups (two writers, one advance) | yes | none | fragment: deer + bleed fixtures |
| bell cue + suppression (d9), reaction duration | yes | none | fragment: inline bell_cue |
| Knock (d10) | yes | none | fragment inline |
| map positions, where, visited, known_npcs | no | toolbox_showcase/map_positions.json | showcase |
| Rest-bound dream scene (scenes.rest, credit) | yes | sleep_sampler has dream reactions only | fragment: sleep_sampler + inline scene |
| scene Begin detail, choices, finale | yes | scene_sampler R19 (other shape) | fragment: scene_sampler |
| exact Continue replay (invocation.ts:57) | guarded only by r9c family 2 | scene_sampler R19 | sampler:scene_sampler (M1 moves the guard) |
| exchange/contribution (infirmary) | yes | none | fragment: harvest_sampler + inline quest |
| careful harvest | no | harvest_sampler/rooms | sampler:harvest_sampler |
| discount quote (practical skills) | yes | none | fragment inline |
| riddle at runtime | yes | none (ferry_sampler R19: loader refs only) | fragment: ferry_sampler + inline riddle |
| ancestry choice | not showcase | derived/craft/damage/durability/ranged samplers | sampler:derived_sampler |
| ancestry dark_sight, faction, skill | yes | none | fragment over derived_sampler |
| quest item stays; message incoming/on_time | yes | none | fragment: errand_sampler R19 |
| quest deadline | no | toolbox_showcase/quests, quest_sampler | sampler:quest_sampler |
| corpse_ingress (Study) | yes | none | fragment: cellar_sampler R19 v008 |
| lessons, qualifications | no | showcase npcs and dialogues (teach/lesson) | showcase |
| defence block_chance/dodge | yes | none | fragment: training_fixture |
| light ignite/douse/refuel | no | toolbox_showcase/items/lantern.json; senses/sky samplers | showcase:lantern |
| self_luminous/glow darkness | yes | none | fragment inline |
| liquid pour/drink | no | toolbox_showcase/items/cask.json, cellar_skin.json; use_sampler | showcase |
| liquid Fill (liquid_source), liquid service/vessel | yes | none | fragment inline |
| food eat | no | toolbox_showcase/items/loaf.json, egg_*.json; kitchen/needs samplers | showcase |
| service quote/settle | no | toolbox_showcase/services/*.json | showcase |
| service recovery/debit/stock, lantern_meals, gain_every | yes | none | fragment inline |
| commerce buy/sell, shop stock | no | showcase shops (npcs/chandler, bess); prices_sampler | showcase / sampler:prices_sampler |
| readable topics | no | toolbox_showcase/topics, codex_sampler | sampler:codex_sampler |
| notice board | not showcase | identity_sampler/rooms/square.json | sampler:identity_sampler |
| hidden NPC discovery (perception, discovered) | yes | none | fragment over ward_sampler (status_readers:278) |
| NPC flight over hidden/climb face | yes | hidden_sampler, climb_sampler (faces only) | fragment: c4_pack_fixture + hidden_sampler |
| long-wait property over bleed/water/patrol jobs | yes (longwait compiles all cartridges) | none | D1 samplers + water/patrol fragments (T) |

### Transcript source per capability (bin/features.exs:36; slice T)

| Capability | Command | New source |
|---|---|---|
| attributes | choose_ancestry | derived_sampler (+ new derived_sampler_hash.json) |
| bleed | bandage | bleed_sampler (D1) |
| commerce | buy/sell | toolbox_showcase |
| expedition | expedition | expedition_sampler (D1) |
| food | eat | toolbox_showcase (loaf) |
| knowledge | where | toolbox_showcase |
| light | ignite/refuel | toolbox_showcase (lantern) |
| liquid | pour/drink | toolbox_showcase (cask) |
| population | shoo | shoo_sampler (D1) |
| readable | read | toolbox_showcase (parish_roll) |
| service | use_service | toolbox_showcase (stew) |
| transport | use_transport | fast_travel_sampler (+ KAT from M3a) |

The showcase transcripts also need `transcripts.test.ts` to add `protocol/fixtures/toolbox_showcase_hash.json` to its kats globs. `docs/features.json` names `missing_child_v042_{hash,ids}` as a fixture in 12 rows, and it is the only fixture in readable, commerce, skills, service and expedition. T repoints them before Z.

Other enumerators:
- `longwait_property.test.ts:30` needs no edit. The new samplers join it, and T adds water and patrol fragment artifacts.
- `bin/system_graph_homes.exs:41` needs no edit; regenerate `system-graph.gen.json`.
- `loader_floors.json` floors 1.39 and 1.40: the source becomes derived_sampler, owned by T.

## Slice table

| Id | Scope | Files | Tokens | Wave | Depends on |
|---|---|---|---|---|---|
| M0 | `kernel/ts/test/fragment.ts`, with a red control (a broken fragment fails to load) | 1 | 20k | A (now) | - |
| M1 | Save-code deletion: bell-save, finale-save, bell-receipt, finale-receipts; edit dialogue-save.ts:35 and receipt-save.ts:32; bell/finale tests; quest_started_at; kernel bell/finale to fragments; Continue-replay guard into scene.test.ts (m); r9c_custody_terminal x2. **Review record.** | 16 | 110k | B | L1, M0 |
| M2a | Pack and hounds on the showcase goblins (kernel, mobile, Book) | 9 | 110k | B | L1, L3, M0 |
| M2b | Bleed: new bleed_sampler and KAT; c5_* tests, job_completion_invariant, content_bleed, c5_bleed (m) | 11 | 100k | B | L1, L3, M0 |
| M2c | Deer: new shoo_sampler and KAT; deer*, writer_groups, hidden_passage_npc, sim_mechanics, deer_bleed_recovery, content_deer | 12 | 120k | C | M2a (c4_pack_fixture), M2b (c5_bleed_fixture) |
| M3a | Transport, crow, study ingress, dialogue hub; owns transport_fixture; fast_travel KAT | 11 | 130k | C | M3b, M3c, M3d (they drop the transport_fixture import) |
| M3b | Water and escort | 7 | 100k | B | L1, L3, M0 |
| M3c | Bell cue (d9) and knowledge/Knock (d10), including book/d9.test.ts | 9 | 120k | B | L1, L3, M0 |
| M3d | Expedition and the new expedition_sampler with KAT | 8 | 110k | B | L1, L3, M0 |
| M3e | Patrol and the climb/hidden/doors/spells single cases | 11 | 120k | B | L1, M0 |
| M4a | Food and service on the showcase (kernel, mobile, Book, Elixir) | 12 | 110k | B | L1, L3, M0 |
| M4c | Dream (sleep_sampler + inline Rest scene) and standing | 8 | 80k | B | L1, L3, M0 |
| M4b | Infirmary/exchange, practical skills | 12 | 110k | B | L1, M0 |
| M5a | Light, liquid, d10_presentation | 12 | 130k | B | L1, M0 |
| M5b | Training, character, commerce, chandlers_contracts | 12 | 120k | B | L1, M0 |
| M6a | Riddle, message, stays, first search, boards, status_readers:278; delete wisp_fixture | 13 | 140k | B | L1, L3 (D3), M0 |
| M6b | Readable on codex_sampler; delete priory_fixture | 10 | 110k | B | L1, L3 (D3), M0 |
| M6c | Book shell and head_rollback onto the showcase | 7 | 90k | B | L1 |
| M7 | content_missing_child_test.exs: 10 refusals to per-case sampler copies | 1 | 60k | D | M2c, M3a |
| T | 12 transcripts, KATs, transcripts.test globs, features.json/gen, loader_floors, longwait | 20 | 130k | D | M2b, M2c, M3a, M3d, D1 |
| S | Storybook re-snapshot from showcase routes (npm scripts only; MCP down) | 63 | 150k | B | L1 |
| Z | Final deletion: both chapter dirs, r9c, 94 missing_child fixtures and generators, v042 last, r9c E2 tests (one citation per row), schema examples + contracts.gen.ts, docs to zero (D2), regenerate gen files | 151 | 140k | E | all, including L3 and S |

**Wave order:**
- A: M0, while L1 and L3 finish.
- B: starts after L1 and L3 merge. 14 slices, run 3 at a time under the load gate. Suggested order: M1, M3b, M3d, then M3c, M2a, S, then the rest.
- C: M2b, M3a, M7.
- D: T.
- E: Z.

Total about 2.4M tokens (sum of the table), plus reviews: M1's own review record, one batch review per wave, and Z.

## Risks
1. L3 is running and will delete three helpers that K files import (D3). It also writes chapter_v042 paths that will be wrong. Message L3 now.
2. If D1 is refused, bleed, expedition and population lose their only transcript. Z then fails `features --check` unless an exemption is added. That is a visible gap, not a silent one.
3. Showcase-based tests and the 7 showcase transcripts break or need re-recording whenever showcase content changes. Prefer frozen sampler KAT bases for fragments.
4. A retargeted test is a new test. Expected values come from the inline fragment or a KAT, never from a kernel run. Each M brief carries one red control per guarded behaviour.
5. Deleting the r9c E2 tests and r9c_faults leaves only the cited same-layer tests. Family 2's Continue-replay guard must land in M1 first, or it is lost silently.
6. M1 removes production save validation in receipt-save and dialogue-save. Old Ashmere saves are not opened (App.tsx), but this still needs the review record.
7. Shared-file order: M2c after M2a and M2b, M3a after M3b-d, M6c after M6b, and K files that name L1 samplers after L1. Breaking the order causes red runs on the batch branch.
8. Wave B has 14 slices, so it takes about 5 rounds at 3 test-running agents.

## Full remapped psv

Buckets: R/K/D are from files.psv. N = new row (a grep hit not in files.psv, or a new file); H = history. new_slice `-` = no work. Besides the four requested new_target kinds, three more are used: `edit:` (a code or doc edit that is not a retarget), `regen:` (a generated file) and `keep:` (unchanged; history or opaque ids, per D2). M1 `delete:` rows are checked per case: a case whose guarded line is in surviving code moves to scene.test.ts (m).

```psv
path|bucket|reason|target|slice|new_target|new_slice
kernel/ts/test/attributes.test.ts|R|stat/resource_compare reads wrong value|resource_sampler|S1|sampler:resource_sampler|L1
kernel/ts/test/author.test.ts|R|bin/loka dev drops last good artifact on failed compile|rooms_sampler|S1|sampler:rooms_sampler|L1
kernel/ts/test/barriers.test.ts|R|illegal barrier transition / key reach / loader barrier refs|gate_sampler|S1|sampler:gate_sampler|L1
kernel/ts/test/budget_record.test.ts|R|budget_exceeded not one valid diagnostics record|green_sampler|S1|sampler:green_sampler|L1
kernel/ts/test/cartridge.test.ts|R|loader accepts bad fact defaults, byte cap, known-answer hash|facts_sampler, hello_sampler (cartridge_hash.json conformance)|S1|sampler:facts_sampler, hello_sampler (cartridge_hash.json conformance)|L1
kernel/ts/test/cartridge_escort.test.ts|R|loader accepts unresolved escort bindings|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/cartridge_items.test.ts|R|loader accepts bad item/NPC/carrying refs|items_sampler|S1|sampler:items_sampler|L1
kernel/ts/test/cartridge_riddle.test.ts|R|loader accepts bad riddle/journal refs, API1.9 floor|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/cartridge_rooms.test.ts|R|loader accepts bad room/detail/text refs|rooms_sampler, details_sampler|S1|sampler:rooms_sampler, details_sampler|L1
kernel/ts/test/chapters.test.ts|R|chapter marker selects wrong chapter|chapters_sampler|S1|sampler:chapters_sampler|L1
kernel/ts/test/checks.test.ts|R|luck check boundary, wait, time_window, clock overflow|recipe_sampler, check_sampler|S1|sampler:recipe_sampler, check_sampler|L1
kernel/ts/test/content_graph.test.ts|R|reach report wrong (id string only)|hello_sampler (text)|S1|sampler:hello_sampler (text)|L1
kernel/ts/test/dialogue.test.ts|R|talk/choose/close and dialogue loader checks|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/elapsed.test.ts|R|trusted elapsed boundary, elapsed loader|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/equipment.test.ts|R|slot holders, wear/remove, worn custody|wear_sampler, items_sampler|S1|sampler:wear_sampler, items_sampler|L1
kernel/ts/test/exit_admission.test.ts|R|exit availability ignores movement action policy|ferry_sampler (via ferry_probe)|S1|sampler:ferry_sampler (via ferry_probe)|L1
kernel/ts/test/facts.test.ts|R|fact.assign, conditions, variants, facts_typed|facts_sampler|S1|sampler:facts_sampler|L1
kernel/ts/test/ferry_probe.ts|R|helper|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/invocation.test.ts|R|P1 identity/outcome adapter|recipe_sampler, check_sampler, items_sampler|S1|sampler:recipe_sampler, check_sampler, items_sampler|L1
kernel/ts/test/invocation_cases.json|R|known answers data|recipe_sampler, check_sampler, items_sampler|S1|sampler:recipe_sampler, check_sampler, items_sampler|L1
kernel/ts/test/journal.test.ts|R|journal text selection|errand_sampler, journal_sampler|S1|sampler:errand_sampler, journal_sampler|L1
kernel/ts/test/keyed_admission.test.ts|R|admission matches another action than invoked|ferry_sampler (via ferry_probe)|S1|sampler:ferry_sampler (via ferry_probe)|L1
kernel/ts/test/locks.test.ts|R|item barrier verbs, reach through lids, loader key reach|locks_sampler|S1|sampler:locks_sampler|L1
kernel/ts/test/longwait_property.test.ts|R|long wait != hourly (comment names hello only)|hello_sampler (comment)|S1|edit:new D1 samplers join automatically; add water and patrol fragment artifacts to its map (after L1)|T
kernel/ts/test/play.test.ts|R|loka play CLI, trace replay, redaction|rooms_sampler, details_sampler, facts_sampler|S1|sampler:rooms_sampler, details_sampler, facts_sampler|L1
kernel/ts/test/play_gate.test.ts|R|CLI doors/brief mode|gate_sampler|S1|sampler:gate_sampler|L1
kernel/ts/test/play_items.test.ts|R|CLI items, 1025-match lookup refusal|items_sampler|S1|sampler:items_sampler|L1
kernel/ts/test/play_recipes.test.ts|R|CLI recipes, wait, status line|recipe_sampler, check_sampler, ferry_sampler, resource_sampler|S1|sampler:recipe_sampler, check_sampler, ferry_sampler, resource_sampler|L1
kernel/ts/test/position.test.ts|R|position@1, RESERVED_FACT|position_sampler, ferry_sampler|S1|sampler:position_sampler, ferry_sampler|L1
kernel/ts/test/quest_delivery.test.ts|R|quest delivery FIFO/budget|errand_sampler|S1|sampler:errand_sampler|L1
kernel/ts/test/quest_dialogue.test.ts|R|accept activates quest, loader accept checks|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/quests.test.ts|R|quest@1 lifecycle, loader quest checks|errand_sampler|S1|sampler:errand_sampler|L1
kernel/ts/test/reactions.test.ts|R|reaction delivery order, budgets|green_sampler|S1|sampler:green_sampler|L1
kernel/ts/test/recipes.test.ts|R|ActionSet algebra, recipe execution|recipe_sampler, items_sampler|S1|sampler:recipe_sampler, items_sampler|L1
kernel/ts/test/recipes_loader.test.ts|R|loader on recipes, v1 policies|recipe_sampler, check_sampler, hello_sampler, resource_sampler|S1|sampler:recipe_sampler, check_sampler, hello_sampler, resource_sampler|L1
kernel/ts/test/resources.test.ts|R|costs, thresholds, regen, mv|resource_sampler, rooms_sampler|S1|sampler:resource_sampler, rooms_sampler|L1
kernel/ts/test/rule_steps.test.ts|R|rule query_steps counted wrong|ferry_sampler, gate_sampler|S1|sampler:ferry_sampler, gate_sampler|L1
kernel/ts/test/scene.test.ts|R|modal scene Continue/start|scene_sampler|S1|sampler:scene_sampler|L1
kernel/ts/test/schedule.test.ts|R|job drain order, run_job refusal, calendar loader|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/sim.test.ts|R|simulator invariants over corpus (names sampler ids)|all renamed samplers|S1|sampler:all renamed samplers|L1
kernel/ts/test/sim.ts|R|helper (containers_cartridge_ prefix)|renamed samplers|S1|sampler:renamed samplers|L1
kernel/ts/test/sim_seeds.json|R|regression seeds data|errand/ferry/green/resource samplers|S1|sampler:errand/ferry/green/resource samplers|L1
kernel/ts/test/target.test.ts|R|target resolution table, 1024 cap|details_sampler|S1|sampler:details_sampler|L1
kernel/ts/test/target_present.test.ts|R|target_present, talk path codes|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/world.test.ts|R|IdSource, move/look, movement invariants|rooms_sampler|S1|sampler:rooms_sampler|L1
kernel/ts/test/variants.test.ts|R|variant text, npc_present (comment/id only)|variants_sampler (+ items text)|S1|sampler:variants_sampler (+ items text)|L1
kernel/ts/test/combat_fixture.ts|R|helper, frozen v0.0.9|cellar_sampler (frozen containers_sampler_v009)|S1|sampler:cellar_sampler (frozen containers_sampler_v009)|L1
kernel/ts/test/combat.test.ts|R|M4 combat rounds, Flee, credit|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
kernel/ts/test/combat_actions.test.ts|R|encounter ActionSet filtering|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
kernel/ts/test/combat_band.test.ts|R|hp band cut|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
kernel/ts/test/combat_credit.test.ts|R|counterfeit credit attribution|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
kernel/ts/test/combat_content.test.ts|R|combat loader contracts|cellar_sampler frozen v008|S1|sampler:cellar_sampler frozen v008|L1
kernel/ts/test/combat_flee.test.ts|R|Flee exit selection, fare, budget|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
kernel/ts/test/climb_flee.test.ts|R|Flee over climb face without item|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
kernel/ts/test/death_fixture.ts|R|helper, frozen v0.0.8|cellar_sampler frozen v008|S1|sampler:cellar_sampler frozen v008|L1
kernel/ts/test/death.test.ts|R|fatal sequence custody/return|cellar_sampler frozen v008|S1|sampler:cellar_sampler frozen v008|L1
kernel/ts/test/death_content.test.ts|R|corpse loader contracts|cellar_sampler frozen v008|S1|sampler:cellar_sampler frozen v008|L1
kernel/ts/test/pen.test.ts|R|hs-4 animals (killer id from death fixture)|pen_sampler + cellar_sampler id|S1|sampler:pen_sampler + cellar_sampler id|L1
kernel/ts/test/npc_hp.test.ts|R|NPC HP rows, loader API 1.4|cellar_sampler frozen v007|S1|sampler:cellar_sampler frozen v007|L1
kernel/ts/test/targets.test.ts|R|target choice, allies (combat_fixture import)|targets_sampler + cellar_sampler|S1|sampler:targets_sampler + cellar_sampler|L1
kernel/ts/test/reward_storage_fixture.ts|R|helper|cellar_sampler (containers_reward_storage)|S1|sampler:cellar_sampler (containers_reward_storage)|L1
kernel/ts/test/reward_storage.test.ts|R|reward clamp, receive custody|cellar_sampler|S1|sampler:cellar_sampler|L1
kernel/ts/test/reward_storage_content.test.ts|R|reward loader|cellar_sampler|S1|sampler:cellar_sampler|L1
kernel/ts/test/put.test.ts|R|Put pair|cellar_sampler|S1|sampler:cellar_sampler|L1
kernel/ts/test/container_history.test.ts|R|historical artifacts keep canonical answers (drop missing_child_v001/v002 rows)|cellar_sampler frozen v006-v010|S1|sampler:cellar_sampler frozen v006-v010|L1
kernel/ts/test/calendar.test.ts|R|calendar/schedule/window; delete the v015 test at :175 (covered by calendar.test.ts:69 displayed subdivisions)|ferry_sampler|S1|sampler:ferry_sampler|L1
kernel/ts/test/readable.test.ts|K|Read target/refusal/budget; scene part rename, v003 part retarget|scene_sampler + codex_sampler (readable)|S3b|sampler:scene_sampler + codex_sampler|M6b
kernel/ts/test/readable_play.test.ts|K|terminal Read resolves authored aliases|codex_sampler|S3b|sampler:codex_sampler|M6b
kernel/ts/test/cartridge_liquids.test.ts|K|loader accepts bad liquid metadata / vessel on corpse template|items_sampler + r9c_interactions|S3c|sampler:items_sampler + inline vessel-on-corpse edit|M5a
kernel/ts/test/c4_pack_fixture.ts|K|helper|r9c_interactions|S2a|fragment:rebase on showcase KAT goblins pack (fragment.ts); keep export names|M2a
kernel/ts/test/c4_pack.test.ts|K|pack admission/rotation/hp bands|r9c_interactions|S2a|showcase:goblins pack admission/rotation/hp bands|M2a
kernel/ts/test/c4_pack_elapsed.test.ts|K|one elapsed advance != hourly play for pack|r9c_interactions|S2a|showcase:goblins pack, one elapsed advance vs hourly|M2a
kernel/ts/test/c4_pack_flight.test.ts|K|wounded flight boundary, job order|r9c_interactions|S2a|showcase:goblins wounded flight + combat_fixture (cellar_sampler)|M2a
kernel/ts/test/c4_schema_contracts.test.ts|K|pack/roster schema bounds|r9c_interactions (or fixture-free literals)|S2a|fragment:inline literals (schema bounds need no cartridge)|M2a
kernel/ts/test/c5_bleed_fixture.ts|K|helper (kernel/ts/test/fixtures/c5-provisional-artifact.json)|r9c_interactions; delete the provisional artifact|S2a|sampler:bleed_sampler (new, D1) KAT; stop reading c5-provisional-artifact.json|M2b
kernel/ts/test/c5_bleed_early_expiry.test.ts|K|bleed early expiry|r9c_interactions|S2a|sampler:bleed_sampler (new, D1)|M2b
kernel/ts/test/c5_bleed.test.ts|K|bleed apply/refresh/cure/expiry|r9c_interactions|S2a|sampler:bleed_sampler (new, D1)|M2b
kernel/ts/test/c5_bleed_death.test.ts|K|water expiry clears bleed before return|r9c_interactions|S2a|fragment:bleed_sampler + inline water route (water expiry clears bleed)|M2b
kernel/ts/test/deer_fixture.ts|K|helper|r9c_interactions|S2a|sampler:shoo_sampler (new, D1) KAT; keep export names|M2c
kernel/ts/test/deer.test.ts|K|deer sight/flight/slot handoff; drop "v042 genesis IDs" pin|r9c_interactions|S2a|sampler:shoo_sampler (new, D1); drop v042 genesis pin|M2c
kernel/ts/test/deer_contracts.test.ts|K|deer wire guards|r9c_interactions|S2a|sampler:shoo_sampler (new, D1)|M2c
kernel/ts/test/hidden_passage_npc.test.ts|K|fleeing NPC takes hidden/climb face|r9c_interactions|S2a|fragment:c4_pack_fixture + inline hidden/climb face from hidden_sampler|M2c
kernel/ts/test/writer_groups.test.ts|K|writer-group joins in one advance|r9c_interactions|S2a|fragment:deer_fixture + c5_bleed_fixture (two writers, one advance)|M2c
kernel/ts/test/hounds.test.ts|K|hound area loader, wander, pelt slots; drop genesis pin|r9c_interactions|S2a|fragment:c4_pack_fixture + inline area and bundle roles (member_role/loot_role); drop genesis pin|M2a
kernel/ts/test/sim_mechanics.test.ts|K|simulator accepts legal chapter receipts (marsh start, bleed, exchange)|r9c_interactions|S2a|sampler:bleed_sampler + shoo_sampler in the sim; drop marsh-start/exchange story cases (exchange: infirmary.test.ts)|M2c
kernel/ts/test/transport_fixture.ts|K|helper compiles the chapter source live|cartridges/r9c_interactions|S2b|sampler:fast_travel_sampler KAT (new fast_travel_sampler_hash.json) via fragment.ts|M3a
kernel/ts/test/water_fixture.ts|K|helper|r9c_interactions|S2b|fragment:rooms_sampler KAT + inline water section (drop transport_fixture import)|M3b
kernel/ts/test/patrol_fixture.ts|K|helper (v024)|r9c_interactions|S2b|fragment:rooms_sampler KAT + inline patrol route (fragment.ts)|M3e
kernel/ts/test/crow.test.ts|K|crow custody/legs/fallback|r9c_interactions|S2b|fragment:transport_fixture + inline crow population (corridor/fallback/carrying)|M3a
kernel/ts/test/crow_loader.test.ts|K|crow allowlist/corridor loader|r9c_interactions|S2b|fragment:transport_fixture + inline crow population|M3a
kernel/ts/test/d9_content.test.ts|D|five terminal pairs project distinct cast prompts (story prose)|-|S2b|delete:five terminal pairs project distinct cast prompts (story prose)|L3
kernel/ts/test/d9_contracts.test.ts|K|cue/suppression contracts; drop v040 allocation pin|r9c_interactions|S2b|fragment:inline bell_cue + suppression over ferry_sampler; drop v040 pin and transport_fixture|M3c
kernel/ts/test/d9_suppression.test.ts|K|bell suppression deadline/resume jobs|r9c_interactions|S2b|fragment:inline bell_cue + suppression jobs|M3c
kernel/ts/test/d10_contracts.test.ts|K|map/Knock contracts and loader|r9c_interactions|S2b|showcase:map_positions; Knock contract fragment inline|M3c
kernel/ts/test/d10_knowledge.test.ts|K|visited rooms, known_npcs, reopen|r9c_interactions|S2b|showcase:visited rooms, known_npcs, reopen|M3c
kernel/ts/test/c6_contracts.test.ts|K|expedition contracts/loader; drop C6 allocation pin|r9c_interactions|S2b|sampler:expedition_sampler (new, D1); drop C6 allocation pin|M3d
kernel/ts/test/c6_expedition.test.ts|K|expedition stage order, Restart|r9c_interactions|S2b|sampler:expedition_sampler (new, D1)|M3d
kernel/ts/test/c6_source_acceptance.test.ts|K|expedition shelter/detour on compiled source|r9c_interactions|S2b|sampler:expedition_sampler compiled source (drop transport_fixture)|M3d
kernel/ts/test/escort.test.ts|K|escort follow/Flee/Rejoin binding|r9c_interactions|S2b|fragment:ferry_sampler + inline escort binding, combat_fixture for Flee|M3b
kernel/ts/test/patrol.test.ts|K|patrol checkpoints, Rejoin, Restart|r9c_interactions|S2b|fragment:patrol_fixture + combat_fixture|M3e
kernel/ts/test/patrol_content.test.ts|K|patrol loader|r9c_interactions|S2b|fragment:patrol_fixture|M3e
kernel/ts/test/transport.test.ts|K|fare/refusal/recovery/free lesson|r9c_interactions|S2b|sampler:fast_travel_sampler (fare/refusal/recovery); free-lesson case fragment|M3a
kernel/ts/test/water.test.ts|K|water admission, drowning deadline, recovery|r9c_interactions|S2b|fragment:water_fixture|M3b
kernel/ts/test/water_content.test.ts|K|water loader|r9c_interactions|S2b|fragment:water_fixture|M3b
kernel/ts/test/study_ingress.test.ts|K|Study ingress rechecks corpse|r9c_interactions|S2b|fragment:cellar_sampler death v008 + inline corpse_ingress|M3a
kernel/ts/test/western_ashmere.test.ts|D|Western Ashmere route/Hob schedule (rooms dropped from r9c); schedule boundaries covered by schedule.test.ts:102|-|S2b|delete:Western Ashmere route/Hob schedule (rooms dropped from r9c); schedule boundaries covered by schedule.test.ts:102|L3
kernel/ts/test/climb.test.ts|K|one test: loader refuses patrol route over climb face|climb_sampler + r9c_interactions|S2b|fragment:climb_sampler + inline patrol over climb face|M3e
kernel/ts/test/hidden_passage.test.ts|K|one test: loader refuses patrol/expedition over hidden face|hidden_sampler + r9c_interactions|S2b|fragment:hidden_sampler + inline patrol/expedition over hidden face|M3e
kernel/ts/test/doors.test.ts|K|test g: walks below API 1.81 on a population plan|doors_sampler + r9c_interactions|S2b|fragment:doors_sampler + inline population plan (test g, API 1.81 floor)|M3e
kernel/ts/test/spells.test.ts|K|one test: cast not offered in a cartridge without spells|spells_sampler + r9c_interactions|S2b|sampler:hello_sampler (any cartridge without spells; cast not offered)|M3e
kernel/ts/test/food_fixture.ts|K|helper|r9c_interactions|S3a|showcase:food items (loaf/egg stock) via fragment.ts|M4a
kernel/ts/test/food.test.ts|K|apple stock conservation, Eat refusals; drop v035 ID pin|r9c_interactions|S3a|showcase:food stock conservation, Eat refusals; drop v035 ID pin|M4a
kernel/ts/test/homes.test.ts|D|Gareth/Ada homes and child-enum prose (story); job day boundaries covered by schedule.test.ts:102|-|S3a|delete:Gareth/Ada homes and child-enum prose (story); job day boundaries covered by schedule.test.ts:102|L3
kernel/ts/test/cartridge_food.test.ts|K|loader accepts impossible held food|r9c_interactions|S3a|fragment:food_fixture + impossible held-food edit|M4a
kernel/ts/test/dream_fixture.ts|K|helper|r9c_interactions|S3a|fragment:sleep_sampler KAT + inline Rest-bound dream scene|M4c
kernel/ts/test/dream.test.ts|K|paid Rest dream checkpoint/branches; drop S2/Bell story case|r9c_interactions|S3a|fragment:dream_fixture; drop S2/Bell story case|M4c
kernel/ts/test/cartridge_dreams.test.ts|K|loader refuses impossible Rest bindings|r9c_interactions|S3a|fragment:dream_fixture|M4c
kernel/ts/test/service_fixture.ts|K|helper|r9c_interactions|S3a|showcase:services (stew/deposit quote, settle) via fragment.ts; recovery/debit/stock variants inline|M4a
kernel/ts/test/service.test.ts|K|service quote/rollback/settlement|r9c_interactions|S3a|showcase:service quote/rollback/settlement|M4a
kernel/ts/test/cartridge_services.test.ts|K|loader refuses unproducible service bindings|r9c_interactions|S3a|fragment:service_fixture + unproducible binding edit|M4a
kernel/ts/test/infirmary_fixture.ts|K|helper|r9c_interactions|S3a|fragment:harvest_sampler KAT + inline exchange/contribution quest|M4b
kernel/ts/test/infirmary.test.ts|K|harvest/exchange conservation and caps|r9c_interactions|S3a|fragment:infirmary_fixture|M4b
kernel/ts/test/infirmary_contracts.test.ts|K|exchange/harvest contracts and loader|r9c_interactions|S3a|fragment:infirmary_fixture|M4b
kernel/ts/test/practical_skills_fixture.ts|K|helper|r9c_interactions|S3a|sampler:harvest_sampler (careful) + inline discount quote|M4b
kernel/ts/test/practical_skills.test.ts|K|careful harvest/discount quote floors|r9c_interactions|S3a|sampler:harvest_sampler + inline discount|M4b
kernel/ts/test/practical_skills_contracts.test.ts|K|method field bounds|r9c_interactions|S3a|fragment:inline literals (method field bounds)|M4b
kernel/ts/test/light_fixture.ts|K|helper (v021 + items)|r9c_interactions|S3c|showcase:lantern fuel (ignite/douse/refuel) via fragment.ts; self_luminous inline|M5a
kernel/ts/test/light.test.ts|K|burn intervals, refuel conservation, darkness; drop successor ID pin|r9c_interactions|S3c|showcase:lantern burn/refuel/darkness; drop successor ID pin|M5a
kernel/ts/test/light_contracts.test.ts|K|light contracts, API1.19 floor|r9c_interactions|S3c|showcase:light contracts, API1.19 floor|M5a
kernel/ts/test/d10_presentation.test.ts|K|Where/Map/Knock from saved observation|r9c_interactions|S3c|showcase:Where/Map from saved observation (via light_fixture); Knock inline|M5a
kernel/ts/test/liquid.test.ts|K|Fill/Pour/Drink conservation, mass ceiling|r9c_interactions|S3c|showcase:cask/skin Pour/Drink conservation; Fill from liquid_source inline|M5a
kernel/ts/test/training_fixture.ts|K|helper (v021 + combat_fixture)|r9c_interactions|S3c|showcase:lessons/qualifications via fragment.ts; block/dodge defence inline|M5b
kernel/ts/test/training.test.ts|K|lesson payment/qualification/defence draws|r9c_interactions|S3c|showcase:lesson payment/qualification; defence draws inline|M5b
kernel/ts/test/training_contracts.test.ts|K|skill/training contracts and loader|r9c_interactions (+cellar_sampler)|S3c|showcase:skill/training loader (+cellar_sampler)|M5b
kernel/ts/test/character_choice.test.ts|K|ancestry choice receipt, attribute effects|r9c_interactions|S3c|sampler:derived_sampler ancestries; dark_sight/faction/skill inline|M5b
kernel/ts/test/character_contracts.test.ts|K|character creation wire contracts|r9c_interactions|S3c|fragment:inline literals (wire contracts)|M5b
kernel/ts/test/commerce.test.ts|K|keep only "loader independently rejects malformed shop stock and funding" (TS loader layer); delete the 3 buy/sell cases (covered by prices.test.ts:91 stale quote, showcase_economy.test.ts:149 and :278 buy/sell)|r9c_interactions|S3c|sampler:prices_sampler (keep only the shop stock/funding loader case)|M5b
kernel/ts/test/commerce_contracts.test.ts|K|shop contract malformed prices|r9c_interactions (fixture swap only)|S3c|sampler:prices_sampler|M5b
kernel/ts/test/chandlers_contracts.test.ts|K|deadline/payment contract fields|r9c_interactions (fixture swap only)|S3c|sampler:quest_sampler (deadline/payment contract fields)|M5b
kernel/ts/test/chandlers_debt.test.ts|D|Chandler's Debt story timings (quest dropped from r9c); deadline fail/complete covered by quest_deadline.test.ts:95 and :128|-|S3c|delete:Chandler's Debt story timings (quest dropped from r9c); deadline fail/complete covered by quest_deadline.test.ts:95 and :128|L3
kernel/ts/test/first_search.test.ts|K|quest activation delivery, trigger matching, reaction source rollback|r9c_interactions|S3b|sampler:errand_sampler + green_sampler reactions (activation, trigger, rollback)|M6a
kernel/ts/test/notice_boards.test.ts|K|board loader/projection|r9c_interactions or identity_sampler (boards)|S3b|sampler:identity_sampler (board)|M6a
kernel/ts/test/wren_riddle.test.ts|K|riddle retry on bound row, participant leaves disables Choose|r9c_interactions (vesper riddle)|S3b|fragment:ferry_sampler + inline riddle dialogue|M6a
kernel/ts/test/wisp_fixture.ts|D|helper of wisp (not in r9c)|-|S3b|delete:after cartridge_wisp and status_readers drop it (moved from L3)|M6a
kernel/ts/test/wisp.test.ts|D|Wisp S4 riddle story; riddle retry/participants covered by wren_riddle.test.ts:137 and :193 (K)|-|S3b|delete:Wisp S4 riddle story; riddle retry/participants covered by wren_riddle.test.ts:137 and :193 (K)|L3
kernel/ts/test/cartridge_wisp.test.ts|K|reopening dialogue rejects direct assign of once-proven fact; drop wisp-specific cases|r9c_interactions (vesper riddle)|S3b|fragment:ferry_sampler + inline riddle; drop wisp_fixture import|M6a
kernel/ts/test/status_readers.test.ts|R|ward sampler readers; the wisp test at :278 (blind hides discovered NPC and glowing detail) has no target: keep only if ward_sampler gains nothing new, else delete (see no-target list)|ward_sampler|S3b|fragment::278 blind reader over ward_sampler + inline perception/discovered NPC (after L1)|M6a
kernel/ts/test/priory_fixture.ts|D|helper (Priory books; topics dropped from r9c)|-|S3b|delete:after priory_contracts and mobile priory-fixture move to codex_sampler (moved from L3)|M6b
kernel/ts/test/priory.test.ts|D|Priory route/novice schedule story; Read grants once covered by codex.test.ts:64|-|S3b|delete:Priory route/novice schedule story; Read grants once covered by codex.test.ts:64|L3
kernel/ts/test/priory_contracts.test.ts|K|item writing/topic refs/unique mappings fail closed|codex_sampler|S3b|sampler:codex_sampler|M6b
kernel/ts/test/missing_child_stays.test.ts|K|quest item received once, custody rules, corpse keeps it|r9c_interactions (vesper_message)|S3b|fragment:errand_sampler + inline quest item stays rule|M6a
kernel/ts/test/missing_child_bell.test.ts|K|Ring/Silence admission and terminal (bell-save production)|r9c_interactions|S3b|fragment:ferry_sampler dialogue + inline exclusive terminal pair (Ring/Silence admission is generic); drop v015 pin|M1
kernel/ts/test/missing_child_finale.test.ts|K|scene must bind Begin detail; endings need Begin+ack|r9c_interactions|S3b|fragment:scene_sampler + inline Begin detail binding (loader + endings need Begin+ack)|M1
kernel/ts/test/missing_child.test.ts|D|v042 release pins (simulator seeds + allocation oracle); simulator invariants covered by sim.test.ts:182|-|S3b|delete:v042 release pins (simulator seeds + allocation oracle); simulator invariants covered by sim.test.ts:182|L3
kernel/ts/test/e1.test.ts|K|E1 command refuses wrong candidate/policy/repro|r9c_interactions + toolbox_showcase candidates|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1.ts|K|E1 runner|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_policy.ts|K|candidate table: drop ashmere_missing_child row|r9c_interactions|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_repro.ts|K|repro|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_barrier.test.ts|K|barrier.set witness (already showcase)|toolbox_showcase|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_obligations.ts|K|generic witnesses (split out v042 route parts from e1_creatures.ts)|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_barrier.ts|K|witness module|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_order.ts|K|witness module|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_repair.ts|K|witness module|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_identity.ts|K|witness module|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_knowledge_effects.ts|K|witness module|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_creatures.ts|K|witness module; delete its fixed v042 route|unchanged|S5|edit:generic E1 harness kept (L3 brief: drop v042 candidate, split e1_creatures route)|L3
kernel/ts/test/e1_obligations.test.ts|D|witness cases on v042 Maud/ferry/stay; retarget only if PM keeps E1 cases (see risks)|-|S5|delete:witness cases on v042 Maud/ferry/stay; retarget only if PM keeps E1 cases (see risks)|L3
kernel/ts/test/e1_case_host.ts|D|fixed v042 SQLite proof host|-|S5|delete:fixed v042 SQLite proof host|L3
kernel/ts/test/e1_cases.ts|D|v042 case runner|-|S5|delete:v042 case runner|L3
kernel/ts/test/e1_cases.test.ts|D|v042 case bindings|-|S5|delete:v042 case bindings|L3
kernel/ts/test/e1_dispositions.json|D|v042 disposition table|-|S5|delete:v042 disposition table|L3
kernel/ts/test/e1_creatures.test.ts|D|v042 creature witnesses|-|S5|delete:v042 creature witnesses|L3
kernel/ts/test/e1_debt.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_debt.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_dialogue_circuit.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_dialogue_circuit.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_epilogue_talks.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_epilogue_talks.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_faults.ts|D|v042 storage anchors|-|S5|delete:v042 storage anchors|L3
kernel/ts/test/e1_identity.test.ts|D|v042 witnesses|-|S5|delete:v042 witnesses|L3
kernel/ts/test/e1_items.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_items.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_journal.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_knowledge_effects.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_maud.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_maud.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_night_marsh.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_night_marsh.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_optional_quests.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_optional_quests.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_paths.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_refusals.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_rejoin.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_rejoin.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_routes.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_routes.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_services.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_services.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_watch_rounds.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_watch_rounds.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_wisp_herbs.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_wisp_herbs.test.ts|D|v042 route|-|S5|delete:v042 route|L3
kernel/ts/test/e1_world.ts|D|v042 idle-world model|-|S5|delete:v042 idle-world model|L3
kernel/ts/test/e1_world_witness.ts|D|v042 world witnesses|-|S5|delete:v042 world witnesses|L3
kernel/ts/test/e1_world_witness.test.ts|D|v042 world witnesses|-|S5|delete:v042 world witnesses|L3
kernel/ts/test/transcripts.test.ts|R|transcripts replay; drop missing_child_* glob|renamed samplers + S6 transcripts|S8|edit:kats glob +toolbox_showcase_hash.json, +new sampler KATs, -missing_child_*|T
mobile/authority/local-story/__tests__/elapsed-host.test.ts|R|helper elapsedBundle|ferry_sampler|S1|sampler:ferry_sampler|L1
mobile/authority/local-story/carrying-reach.test.ts|R|saved custody cycle faults before carrying|items_sampler|S1|sampler:items_sampler|L1
mobile/authority/local-story/chapters.test.ts|R|derived chapter after reopen|chapters_sampler|S1|sampler:chapters_sampler|L1
mobile/authority/local-story/elapsed.test.ts|R|elapsed receipts/fencing|scene_sampler|S1|sampler:scene_sampler|L1
mobile/authority/local-story/equipment.test.ts|R|worn item after reopen|wear_sampler|S1|sampler:wear_sampler|L1
mobile/authority/local-story/faults.test.ts|R|every fault leaves prior/next revision|details_sampler, check_sampler|S1|sampler:details_sampler, check_sampler|L1
mobile/authority/local-story/journal.test.ts|R|journal projection after reopen|journal_sampler|S1|sampler:journal_sampler|L1
mobile/authority/local-story/keyed.test.ts|R|invoke passes action_key|ferry_sampler|S1|sampler:ferry_sampler|L1
mobile/authority/local-story/lineage.test.ts|R|lineage seed/context pinned|recipe_sampler, check_sampler|S1|sampler:recipe_sampler, check_sampler|L1
mobile/authority/local-story/local_story.test.ts|R|restart, receipts, COMMIT faults, kill, trace, jobs|recipe/ferry/green/items samplers|S1|sampler:recipe/ferry/green/items samplers|L1
mobile/authority/local-story/observe.test.ts|R|budget fault observation sink|green_sampler|S1|sampler:green_sampler|L1
mobile/authority/local-story/position.test.ts|R|position after reopen|position_sampler|S1|sampler:position_sampler|L1
mobile/authority/local-story/recovery.test.ts|R|leftover transaction, corrupt save, trace cap|items_sampler|S1|sampler:items_sampler|L1
mobile/authority/local-story/resource-recovery.test.ts|R|opted rows/Rest receipts|position_sampler, cellar_sampler|S1|sampler:position_sampler, cellar_sampler|L1
mobile/authority/local-story/saves.test.ts|R|save identity/pin/corrupt|recipe_sampler, check_sampler, items_sampler|S1|sampler:recipe_sampler, check_sampler, items_sampler|L1
mobile/authority/local-story/scene.test.ts|R|scene line two reopen|scene_sampler|S1|sampler:scene_sampler; gains the Continue-replay guard from r9c_custody_terminal family 2 (after L1 renames it)|M1
mobile/authority/local-story/session.test.ts|R|Start over lost ack|items_sampler|S1|sampler:items_sampler|L1
mobile/authority/local-story/smoke.test.ts|R|smoke controller restart/pending|items_sampler|S1|sampler:items_sampler|L1
mobile/authority/local-story/start_over.test.ts|R|Start over over corrupt report|ferry_sampler|S1|sampler:ferry_sampler|L1
mobile/authority/local-story/story_points.test.ts|R|story point capture/delivery|ferry_sampler|S1|sampler:ferry_sampler|L1
mobile/authority/local-story/combat.test.ts|R|combat receipts reopen/FULL/unknown COMMIT|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
mobile/authority/local-story/combat_schedule.test.ts|R|departure vs due round reopen|cellar_sampler frozen v009|S1|sampler:cellar_sampler frozen v009|L1
mobile/authority/local-story/death.test.ts|R|corpse reopen atomic|cellar_sampler frozen v007|S1|sampler:cellar_sampler frozen v007|L1
mobile/authority/local-story/npc-hp.test.ts|R|NPC HP adoption atomic|cellar_sampler frozen v007|S1|sampler:cellar_sampler frozen v007|L1
mobile/authority/local-story/__tests__/reward-host.test.ts|R|helper|cellar_sampler|S1|sampler:cellar_sampler|L1
mobile/authority/local-story/reward_storage.test.ts|R|reward atomic under rollback|cellar_sampler|S1|sampler:cellar_sampler|L1
mobile/authority/local-story/sampler.test.ts|D|sampler content walk; scene line-two reopen covered by scene.test.ts:96 (m), journal by journal.test.ts:46 (m)|-|S1|delete:sampler content walk; scene line-two reopen covered by scene.test.ts:96 (m), journal by journal.test.ts:46 (m)|L3
mobile/authority/local-story/mauds_cellar.test.ts|D|five kills -> reward duplicated by reward_storage.test.ts:27 (m)|-|S1|delete:five kills -> reward duplicated by reward_storage.test.ts:27 (m)|L3
mobile/authority/local-story/mauds_cellar_book.test.ts|D|Maud story-ended claim (story)|-|S1|delete:Maud story-ended claim (story)|L3
mobile/authority/local-story/c4_pack.test.ts|K|pack/flight reopen, failed COMMIT|r9c_interactions|S2a|showcase:goblins pack/flight reopen, failed COMMIT (via c4_pack_fixture)|M2a
mobile/authority/local-story/c5_bleed.test.ts|K|bleed ticks through SQLite, COMMIT faults|r9c_interactions|S2a|sampler:bleed_sampler (new, D1)|M2b
mobile/authority/local-story/deer.test.ts|K|deer receipts, forged sight, COMMIT faults|r9c_interactions|S2a|sampler:shoo_sampler (new, D1)|M2c
mobile/authority/local-story/deer_bleed_recovery.test.ts|K|interleaved round/population/bleed receipt|r9c_interactions|S2a|fragment:deer_fixture + bleed definition inline|M2c
mobile/authority/local-story/hounds.test.ts|K|population accepted-history refusal, wander unknown COMMIT|r9c_interactions|S2a|fragment:c4_pack_fixture + inline bundle roles|M2a
mobile/authority/local-story/c6_expedition.test.ts|K|expedition saves, forged transitions, failed/lost COMMIT|r9c_interactions|S2b|sampler:expedition_sampler (new, D1)|M3d
mobile/authority/local-story/crows.test.ts|K|crow receipts, forged occurrence, COMMIT faults|r9c_interactions|S2b|fragment:transport_fixture + inline crow population|M3a
mobile/authority/local-story/d9.test.ts|K|bell cue reopen, uncertain COMMIT|r9c_interactions|S2b|fragment:inline bell_cue (reopen, uncertain COMMIT)|M3c
mobile/authority/local-story/d10_knowledge.test.ts|K|knowledge rows forged/failed/lost|r9c_interactions|S2b|showcase:knowledge rows forged/failed/lost|M3c
mobile/authority/local-story/dialogue_hub.test.ts|K|hub answer failed/lost COMMIT|r9c_interactions|S2b|fragment:ferry_sampler dialogue hub (drop transport_fixture)|M3a
mobile/authority/local-story/patrol.test.ts|K|patrol receipts, forged rows, COMMIT faults|r9c_interactions|S2b|fragment:patrol_fixture|M3e
mobile/authority/local-story/transport.test.ts|K|ferry receipts, forged custody, COMMIT faults|r9c_interactions|S2b|sampler:fast_travel_sampler|M3a
mobile/authority/local-story/water.test.ts|K|water receipts, deadline settle, COMMIT faults|r9c_interactions|S2b|fragment:water_fixture|M3b
mobile/authority/local-story/water_chapter.test.ts|D|bought torch through drowning: covered by water.test.ts:133 and :370 (m), light.test.ts:80 (m)|-|S2b|delete:bought torch through drowning: covered by water.test.ts:133 and :370 (m), light.test.ts:80 (m)|L3
mobile/authority/local-story/western_ashmere.test.ts|D|Western Ashmere route (rooms dropped)|-|S2b|delete:Western Ashmere route (rooms dropped)|L3
mobile/authority/local-story/wren_escort.test.ts|K|escort save corruption, Rejoin reopen|r9c_interactions|S2b|fragment:ferry_sampler + inline escort (save corruption, Rejoin reopen)|M3b
mobile/authority/local-story/head_rollback.test.ts|K|head clock behind newest receipt refuses|toolbox_showcase|S2b|showcase:head clock behind newest receipt refuses|M6c
mobile/authority/local-story/__tests__/food-host.ts|K|helper|r9c_interactions|S3a|showcase:via food_fixture|M4a
mobile/authority/local-story/food.test.ts|K|Eat receipts, forgeries, COMMIT faults|r9c_interactions|S3a|showcase:Eat receipts/forgeries/COMMIT|M4a
mobile/authority/local-story/__tests__/dream-host.test.ts|K|helper|r9c_interactions|S3a|fragment:dream_fixture|M4c
mobile/authority/local-story/dream.test.ts|K|dream checkpoints reopen, forged receipts, COMMIT|r9c_interactions|S3a|fragment:dream_fixture|M4c
mobile/authority/local-story/service.test.ts|K|service receipts/forgeries/COMMIT|r9c_interactions|S3a|showcase:service receipts/forgeries/COMMIT|M4a
mobile/authority/local-story/infirmary.test.ts|K|exchange receipts/COMMIT/corruption|r9c_interactions|S3a|fragment:infirmary_fixture|M4b
mobile/authority/local-story/__tests__/practical-host.ts|K|helper|r9c_interactions|S3a|sampler:harvest_sampler via practical_skills_fixture|M4b
mobile/authority/local-story/practical_skills.test.ts|K|skills-save receipts/COMMIT|r9c_interactions|S3a|sampler:harvest_sampler via practical_skills_fixture|M4b
mobile/authority/local-story/light.test.ts|K|fuel receipts/COMMIT/forged refills|r9c_interactions|S3c|showcase:fuel receipts/COMMIT/forged refills|M5a
mobile/authority/local-story/light_book.test.ts|K|Book binds Refuel supply, Douse when worn|r9c_interactions|S3c|showcase:Book Refuel supply, Douse when worn|M5a
mobile/authority/local-story/liquid.test.ts|K|liquid-save provenance, COMMIT|r9c_interactions|S3c|showcase:liquid-save provenance, COMMIT|M5a
mobile/authority/local-story/training.test.ts|K|lesson receipts/forged/COMMIT|r9c_interactions|S3c|showcase:lesson receipts/forged/COMMIT|M5b
mobile/authority/local-story/character_choice.test.ts|K|creation receipt, forged ancestry, COMMIT|r9c_interactions|S3c|sampler:derived_sampler (creation receipt, forged ancestry, COMMIT)|M5b
mobile/authority/local-story/commerce.test.ts|D|shop receipts: cold reopen two_shops.test.ts:152, forged receipt :169, failed COMMIT prices.test.ts:59 (all m)|-|S3c|delete:shop receipts: cold reopen two_shops.test.ts:152, forged receipt :169, failed COMMIT prices.test.ts:59 (all m)|L3
mobile/authority/local-story/__tests__/chandlers-setup.test.ts|D|helper (Chandler's Debt dropped)|-|S3c|delete:helper (Chandler's Debt dropped)|L3
mobile/authority/local-story/chandlers_debt.test.ts|D|deadline receipts: quest_deadline.test.ts:100, :119 failed/lost COMMIT, :153 forged row (m)|-|S3c|delete:deadline receipts: quest_deadline.test.ts:100, :119 failed/lost COMMIT, :153 forged row (m)|L3
mobile/authority/local-story/chandlers_debt_forged.test.ts|D|forged deadline receipts: quest_deadline.test.ts:153 (m)|-|S3c|delete:forged deadline receipts: quest_deadline.test.ts:153 (m)|L3
mobile/authority/local-story/chandlers_debt_rows.test.ts|D|forged rows: quest_deadline.test.ts:153 (m)|-|S3c|delete:forged rows: quest_deadline.test.ts:153 (m)|L3
mobile/authority/local-story/chandlers_debt_turnin.test.ts|D|forged turn-in: quest_deadline.test.ts:153 (m)|-|S3c|delete:forged turn-in: quest_deadline.test.ts:153 (m)|L3
mobile/authority/local-story/__tests__/bell-setup.test.ts|K|helper|r9c_interactions|S3b|delete:helper of the bell tests only (quest_started_at moves off it); per case: guarded line in surviving code (invocation.ts, scene, story points) -> move case to scene.test.ts (m)|M1
mobile/authority/local-story/bell.test.ts|K|bell-save forged/lost receipts (Ashmere-keyed production code)|r9c_interactions|S3b|delete:guards bell-save.ts, which is deleted (Ashmere-keyed quest bell_of_ashmere); per case: guarded line in surviving code (invocation.ts, scene, story points) -> move case to scene.test.ts (m)|M1
mobile/authority/local-story/bell_receipts.test.ts|K|bell COMMIT uncertainty/forgeries|r9c_interactions|S3b|delete:guards bell-save/bell-receipt, deleted; generic COMMIT faults stay in faults.test.ts:207; per case: guarded line in surviving code (invocation.ts, scene, story points) -> move case to scene.test.ts (m)|M1
mobile/authority/local-story/quest_started_at.test.ts|K|started_at must be past LogicalTime|r9c_interactions (via bell-setup)|S3b|fragment:quest activation over errand_sampler KAT (fragment.ts); started_at < LogicalTime is universal|M1
mobile/authority/local-story/finale.test.ts|K|finale-save reopen at every line|r9c_interactions|S3b|delete:guards finale-save.ts, deleted (quest missing_child); story_points.test.ts:283 keeps report timing; per case: guarded line in surviving code (invocation.ts, scene, story points) -> move case to scene.test.ts (m)|M1
mobile/authority/local-story/vesper_message.test.ts|K|message receipts/custody/COMMIT; drop v010->v012 migration test|r9c_interactions|S3b|fragment:errand_sampler + inline message incoming/on_time; drop v010->v012 migration|M6a
mobile/authority/local-story/wren_riddle.test.ts|K|riddle-save receipts/COMMIT|r9c_interactions|S3b|fragment:ferry_sampler + inline riddle|M6a
mobile/authority/local-story/wisp.test.ts|D|wisp riddle saves: wren_riddle.test.ts:189 forged evidence, :341 failed/lost COMMIT (m, K)|-|S3b|delete:wisp riddle saves: wren_riddle.test.ts:189 forged evidence, :341 failed/lost COMMIT (m, K)|L3
mobile/authority/local-story/missing_child.test.ts|D|Q1 story flows; reward atomicity covered by reward_storage.test.ts:27 and :85 (m)|-|S3b|delete:Q1 story flows; reward atomicity covered by reward_storage.test.ts:27 and :85 (m)|L3
mobile/authority/local-story/__tests__/priory-fixture.ts|K|helper|codex_sampler|S3b|sampler:codex_sampler|M6b
mobile/authority/local-story/priory.test.ts|K|topics-save Read receipts, forgeries, COMMIT|codex_sampler|S3b|sampler:codex_sampler; nested-book-in-closed-container case inline|M6b
mobile/authority/local-story/readable_alias_book.test.ts|K|aliased Read place offer survives redraw|codex_sampler|S3b|sampler:codex_sampler|M6b
mobile/app/book/__tests__/polish-book.test.ts|R|helper default fixture|cellar_sampler|S1|sampler:cellar_sampler|L1
mobile/app/book/item_detail.test.ts|R|item results order|cellar_sampler|S1|sampler:cellar_sampler|L1
mobile/app/book/live_actions.test.ts|R|captured controls across pulses|cellar_sampler, ferry_sampler|S1|sampler:cellar_sampler, ferry_sampler|L1
mobile/app/book/model.test.ts|R|buttons model|items_sampler|S1|sampler:items_sampler|L1
mobile/app/book/touch.test.ts|R|Lantern by touch (ferry text)|lantern_proof, ferry_sampler|S1|sampler:lantern_proof, ferry_sampler|L1
mobile/app/book/reward_storage.test.ts|R|Put pair/freshness|cellar_sampler|S1|sampler:cellar_sampler|L1
mobile/app/book/hounds.test.ts|K|instance-bound Attack, pelt Contents|r9c_interactions|S2a|fragment:c4_pack_fixture + inline pelt bundle (instance-bound Attack, Contents)|M2a
mobile/app/book/dream.test.ts|K|Book dream routing over uncertain COMMIT|r9c_interactions|S3a|fragment:dream_fixture|M4c
mobile/app/book/food.test.ts|K|Book Eat returns World once|r9c_interactions|S3a|showcase:Book Eat returns World once|M4a
mobile/app/book/infirmary.test.ts|K|Book patch controls exact targets|r9c_interactions|S3a|fragment:infirmary_fixture|M4b
mobile/app/book/liquid.test.ts|K|Book liquid pairs/freshness|r9c_interactions|S3c|showcase:Book liquid pairs/freshness|M5a
mobile/app/book/practical_skills.test.ts|K|Book teacher detail offer|r9c_interactions|S3a|sampler:harvest_sampler via practical-host|M4b
mobile/app/book/training.test.ts|K|Character page attributes/qualifications|toolbox_showcase|S3b|showcase:Character page attributes/qualifications|M5b
mobile/app/book/riddle.test.ts|K|NPC tile riddle controls|r9c_interactions|S3b|fragment:inline riddle on ferry_sampler|M6a
mobile/app/book/readable.test.ts|K|Book Read receipts/recovery|codex_sampler|S3b|sampler:codex_sampler|M6b
mobile/app/book/notice_board.test.ts|D|board/Study/Elspeth routes (story); Read covered by readable.test.ts (book)|-|S3b|delete:board/Study/Elspeth routes (story); Read covered by readable.test.ts (book)|L3
mobile/app/book/priory.test.ts|K|nested book Item Read restore|codex_sampler|S3b|sampler:codex_sampler + inline nested book|M6b
mobile/app/book/shop.test.ts|K|shop detail binds item/merchant/quote|toolbox_showcase|S3b|showcase:shop detail binds item/merchant/quote|M6c
mobile/app/book/pass1_ui4.test.ts|K|item page option order, Lift, purse note|toolbox_showcase|S3b|showcase:item page option order, Lift, purse|M6c
mobile/app/book/polish.test.ts|K|polish picks (corpse Take, map focus, retry)|toolbox_showcase|S3b|showcase:corpse Take, map focus, retry|M6c
mobile/app/book/polish_detail.test.ts|K|pickup/Give/Drop returns; locks+sampler parts rename|toolbox_showcase + locks_sampler + cellar_sampler|S3b|showcase:pickup/Give/Drop + locks_sampler + cellar_sampler (after L1)|M6c
mobile/app/book/hostile_refusal.test.ts|K|one test on v042 (buy reason is a word)|toolbox_showcase|S3b|showcase:buy refusal reason|M6c
mobile/app/chapter.test.ts|K|app shell opens showcase save, refuses old pinned save, pause/resume|toolbox_showcase (old-save case via a changed showcase bundle)|S3b|showcase:shell opens showcase save; old-save case via changed showcase bundle|M6c
mobile/app/walkthrough/ashmere_missing_child.walk.ts|D|retired chapter contact-sheet route|-|S8|delete:retired chapter contact-sheet route|L3
mobile/app/walkthrough/ashmere_sampler.walk.ts|D|sampler precedent route (owner playtests showcase)|-|S8|delete:sampler precedent route (owner playtests showcase)|L3
mobile/app/tests/steps.ts|R|comment only|-|S8|delete:comment lines only (zero-hit sweep)|Z
test/loka/content_test.exs|R|one diagnostic per code; mix loka.compile|hello_sampler|S1|sampler:hello_sampler|L1
test/loka/content_attributes_test.exs|R|attributes compile/refusals|hello_sampler, resource_sampler|S1|sampler:hello_sampler, resource_sampler|L1
test/loka/content_raid_test.exs|R|API floors|hello_sampler|S1|sampler:hello_sampler|L1
test/loka/content_rooms_test.exs|R|rooms/details/facts compiler refusals + KATs|rooms/details/facts samplers|S1|sampler:rooms/details/facts samplers|L1
test/loka/content_recipes_test.exs|R|recipe compiler refusals + KAT|recipe_sampler|S1|sampler:recipe_sampler|L1
test/loka/content_dusk_test.exs|R|check/failure outcome refusals + KAT|check_sampler|S1|sampler:check_sampler|L1
test/loka/content_road_test.exs|R|resources compiler + KAT|resource_sampler|S1|sampler:resource_sampler|L1
test/loka/content_rest_test.exs|R|position fact, recovery compiler + KAT|position_sampler, ferry_sampler|S1|sampler:position_sampler, ferry_sampler|L1
test/loka/content_gate_test.exs|R|barrier compiler + KAT|gate_sampler|S1|sampler:gate_sampler|L1
test/loka/content_locks_test.exs|R|item barrier compiler + KAT|locks_sampler|S1|sampler:locks_sampler|L1
test/loka/content_items_test.exs|R|item/carrying compiler + KAT|items_sampler|S1|sampler:items_sampler|L1
test/loka/content_variants_test.exs|R|variants compiler|items_sampler|S1|sampler:items_sampler|L1
test/loka/content_wear_test.exs|R|slot compiler + KAT|wear_sampler|S1|sampler:wear_sampler|L1
test/loka/content_errand_test.exs|R|quest compiler + KAT|errand_sampler|S1|sampler:errand_sampler|L1
test/loka/content_journal_test.exs|R|journal compiler + KAT|journal_sampler|S1|sampler:journal_sampler|L1
test/loka/content_ferry_test.exs|R|schedule/dialogue/story point/elapsed compiler + KAT|ferry_sampler|S1|sampler:ferry_sampler|L1
test/loka/content_escort_test.exs|R|escort compiler|ferry_sampler|S1|sampler:ferry_sampler|L1
test/loka/content_riddle_test.exs|R|riddle compiler|ferry_sampler|S1|sampler:ferry_sampler|L1
test/loka/content_calendar_test.exs|R|calendar compiler|ferry_sampler|S1|sampler:ferry_sampler|L1
test/loka/content_green_test.exs|R|reaction compiler + KAT|green_sampler|S1|sampler:green_sampler|L1
test/loka/content_scenes_test.exs|R|scene compiler + KAT|scene_sampler|S1|sampler:scene_sampler|L1
test/loka/content_chapters_test.exs|R|chapters compiler + KAT|chapters_sampler|S1|sampler:chapters_sampler|L1
test/loka/content_sampler_test.exs|R|sampler KAT, NPC HP compiler|cellar_sampler|S1|sampler:cellar_sampler|L1
test/loka/content_death_test.exs|R|corpse compiler|cellar_sampler|S1|sampler:cellar_sampler|L1
test/loka/content_reward_storage_test.exs|R|reward compiler + KAT|cellar_sampler|S1|sampler:cellar_sampler|L1
test/loka/cartridge_cross_kernel_test.exs|R|compiled artifacts identical in TS|renamed samplers|S1|sampler:renamed samplers|L1
test/loka/system_graph_test.exs|R|cartridge map lists authored files|facts_sampler, rooms_sampler|S1|sampler:facts_sampler, rooms_sampler|L1
test/loka/cartridge_chapters_hash.py|R|KAT generator|chapters_sampler|S1|sampler:chapters_sampler|L1
test/loka/cartridge_containers_hash.py|R|KAT generator|items/locks/cellar samplers|S1|sampler:items/locks/cellar samplers|L1
test/loka/cartridge_journal_hash.py|R|KAT generator|journal_sampler|S1|sampler:journal_sampler|L1
test/loka/cartridge_sampler_hash.py|R|KAT generator|cellar_sampler|S1|sampler:cellar_sampler|L1
test/loka/cartridge_scene_hash.py|R|KAT generator|scene_sampler|S1|sampler:scene_sampler|L1
test/loka/cartridge_reward_storage_hash.py|R|KAT generator|cellar_sampler|S1|sampler:cellar_sampler|L1
test/fixtures/reward_storage/README.md|R|path text|cellar_sampler|S1|sampler:cellar_sampler|L1
test/loka/content_liquids_test.exs|K|liquid compiler refusals (items part rename; chapter part)|items_sampler + r9c_interactions|S4|sampler:items_sampler + showcase liquids via Loka.ContentSource|M5a
test/loka/content_bleed_test.exs|K|bleed/bandage declaration bounds|r9c_interactions|S4|sampler:bleed_sampler via Loka.ContentSource.copy/compile|M2b
test/loka/content_deer_test.exs|K|deer plan/bundle refusals|r9c_interactions|S4|sampler:shoo_sampler via Loka.ContentSource.copy/compile|M2c
test/loka/content_expedition_test.exs|K|expedition edge refusal|r9c_interactions|S4|sampler:expedition_sampler via Loka.ContentSource|M3d
test/loka/content_food_test.exs|K|held-food refusals|r9c_interactions|S4|fragment:Loka.ContentSource over showcase food items|M4a
test/loka/content_light_test.exs|K|fuel/dark text refusals, API1.19|r9c_interactions|S4|showcase:Loka.ContentSource over showcase lantern|M5a
test/loka/content_patrol_test.exs|K|patrol route/ownership refusals|r9c_interactions|S4|fragment:Loka.ContentSource over rooms_sampler + patrol|M3e
test/loka/content_practical_skills_test.exs|K|careful/discount refusals|r9c_interactions|S4|fragment:Loka.ContentSource harvest_sampler + discount edit|M4b
test/loka/content_training_test.exs|K|training refusals|r9c_interactions|S4|showcase:Loka.ContentSource over showcase teachers|M5b
test/loka/content_transports_test.exs|K|ferry/free lesson refusals|r9c_interactions|S4|sampler:fast_travel_sampler via Loka.ContentSource|M3a
test/loka/content_water_test.exs|K|water route refusals (pool_bottom -> well_bottom only)|r9c_interactions|S4|fragment:Loka.ContentSource over rooms_sampler + water route|M3b
test/loka/content_d10_test.exs|K|map/Knock refusals before artifact|r9c_interactions|S4|fragment:Loka.ContentSource over showcase + Knock/map edits|M3c
test/loka/content_d9_test.exs|K|cue/suppression refusals|r9c_interactions|S4|fragment:Loka.ContentSource over ferry_sampler + bell_cue|M3c
test/loka/content_first_search_test.exs|K|quest reaction refs/owners|r9c_interactions|S4|sampler:errand_sampler via Loka.ContentSource|M6a
test/loka/content_climb_test.exs|K|one test: patrol over climb face refused|climb_sampler + r9c_interactions|S4|fragment:Loka.ContentSource climb_sampler + patrol edit|M3e
test/loka/content_hidden_passage_test.exs|K|one test: patrol/expedition over hidden face refused|hidden_sampler + r9c_interactions|S4|fragment:Loka.ContentSource hidden_sampler + patrol edit|M3e
test/loka/content_services_test.exs|K|service funding/provider refusals (maud_offer dropped: adapt)|r9c_interactions|S4|showcase:Loka.ContentSource over showcase services|M4a
test/loka/content_dreams_test.exs|K|Rest dream refusals (dream_annex dropped: use inn_rooms/dream_of_the_fen)|r9c_interactions|S4|fragment:Loka.ContentSource over sleep_sampler + Rest dream|M4c
test/loka/content_standing_test.exs|K|standing API floor, hostile speaker warns (guard dropped: use another NPC)|r9c_interactions|S4|sampler:standing_sampler (API floor, hostile speaker warns)|M4c
test/loka/content_wisp_test.exs|K|riddle source refusals, once-proven fact assign|r9c_interactions (vesper riddle)|S4|fragment:Loka.ContentSource ferry_sampler + riddle edits|M6a
test/loka/content_notice_boards_test.exs|K|board refs/catalog refusals|identity_sampler (boards)|S4|sampler:identity_sampler|M6a
test/loka/content_priory_test.exs|K|book metadata/topic refusals|codex_sampler|S4|sampler:codex_sampler via Loka.ContentSource|M6b
test/loka/content_missing_child_test.exs|K|KAT test D; 10 refusal tests (ancestry, scene detail, shop, exchange, hound area, deer hide, crow corridor/roles, wander, flight) move to r9c base|r9c_interactions|S4|fragment:Loka.ContentSource per case: ancestry->derived_sampler, scene detail->scene_sampler, shop->prices_sampler, exchange->harvest_sampler, hound area/wander/flight->showcase goblins, deer hide->shoo_sampler, crow->fast_travel_sampler; KAT test D deleted|M7
test/loka/cartridge_missing_child_hash.py|D|KAT generator of retired chapter|-|S4|delete:KAT generator of retired chapter|L3
test/loka/cartridge_missing_child_v015_hash.py|D|KAT generator of retired chapter|-|S4|delete:KAT generator of retired chapter|L3
test/loka/cartridge_missing_child_v016_hash.py|D|KAT generator of retired chapter|-|S4|delete:KAT generator of retired chapter|L3
test/loka/cartridge_missing_child_v017_hash.py|D|KAT generator of retired chapter|-|S4|delete:KAT generator of retired chapter|L3
test/loka/cartridge_missing_child_v026_hash.py|D|KAT generator of retired chapter|-|S4|delete:KAT generator of retired chapter|L3
test/loka/cartridge_missing_child_v027_hash.py|D|KAT generator of retired chapter|-|S4|delete:KAT generator of retired chapter|L3
test/loka/cartridge_r9c_interactions_hash.py|D|reads v042; freeze r9c fixture (PM choice, see risks)|-|S8|delete:reads v042; freeze r9c fixture (PM choice, see risks)|L3
bin/red_controls.exs|R|features red control path ashmere_details/transcripts/skills.jsonl|details_sampler path|S1|sampler:details_sampler path|L1
.github/workflows/ci.yml|D|e1-recorder job builds v042 artifact (line 137)|retarget recorder to r9c or delete job|S5|delete:e1-recorder job builds v042 artifact (line 137)|L3
kernel/ts/test/containment.test.ts|R|take/drop/give custody, containment invariants|items_sampler|S1|sampler:items_sampler|L1
kernel/ts/test/deep_fen.test.ts|D|D5 deep-fen route (fox_den_deep dropped). Authority-layer COMMIT reconcile covered by mobile local_story.test.ts:241 and :270; lookalike substitution by missing_child_stays (K)|-|S2b|delete:D5 deep-fen route (fox_den_deep dropped). Authority-layer COMMIT reconcile covered by mobile local_story.test.ts:241 and :270; lookalike substitution by missing_child_stays (K)|L3
kernel/ts/test/fixtures/c5-provisional-artifact.json|D|frozen provisional chapter artifact|-|S2a|delete:frozen provisional chapter artifact (moved from L3: c5_bleed_fixture reads it)|M2b
kernel/ts/test/r9c_custody_terminal.test.ts|R|comment links to deleted focused tests only|update links|S8|delete:E2 integration on r9c; focused breaks are retargeted in M-slices (cite each); per case: guarded line in surviving code (invocation.ts, scene, story points) -> move case to scene.test.ts (m)|M1
mobile/authority/local-story/r9c_creatures_transport.test.ts|R|comment links only|update links|S8|delete:E2 integration on r9c; focused tests retargeted in M2-M3 (cite per family)|Z
mobile/authority/local-story/r9c_custody_terminal.test.ts|R|comment links only|update links|S8|delete:E2 integration on r9c AFTER moving family 2 Continue-replay guard (invocation.ts:57, PR 314 M4) to scene.test.ts (m); per case: guarded line in surviving code (invocation.ts, scene, story points) -> move case to scene.test.ts (m)|M1
cartridges/derived_sampler/transcripts/attributes.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/attributes.jsonl (only transcript of attributes)|-|-|sampler:derived_sampler transcript (choose_ancestry) + new derived_sampler_hash.json|T
cartridges/bleed_sampler/transcripts/bleed.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/bleed.jsonl (only transcript of bleed)|-|-|sampler:bleed_sampler transcript (bandage), D1|T
cartridges/toolbox_showcase/transcripts/commerce.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/commerce.jsonl (only transcript of commerce)|-|-|showcase:transcript (buy/sell at a showcase shop)|T
cartridges/expedition_sampler/transcripts/expedition.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/expedition.jsonl (only transcript of expedition)|-|-|sampler:expedition_sampler transcript, D1|T
cartridges/toolbox_showcase/transcripts/food.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/food.jsonl (only transcript of food)|-|-|showcase:transcript (eat a loaf)|T
cartridges/toolbox_showcase/transcripts/knowledge.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/knowledge.jsonl (only transcript of knowledge)|-|-|showcase:transcript (where; map_positions.json)|T
cartridges/toolbox_showcase/transcripts/light.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/light.jsonl (only transcript of light)|-|-|showcase:transcript (ignite/douse/refuel lantern)|T
cartridges/toolbox_showcase/transcripts/liquid.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/liquid.jsonl (only transcript of liquid)|-|-|showcase:transcript (pour/drink cask or skin)|T
cartridges/shoo_sampler/transcripts/population.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/population.jsonl (only transcript of population)|-|-|sampler:shoo_sampler transcript (shoo), D1|T
cartridges/toolbox_showcase/transcripts/readable.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/readable.jsonl (only transcript of readable)|-|-|showcase:transcript (read parish_roll or mill_ledger)|T
cartridges/toolbox_showcase/transcripts/service.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/service.jsonl (only transcript of service)|-|-|showcase:transcript (use_service stew)|T
cartridges/fast_travel_sampler/transcripts/transport.jsonl|N|replaces cartridges/ashmere_missing_child/transcripts/transport.jsonl (only transcript of transport)|-|-|sampler:fast_travel_sampler transcript (use_transport)|T
.beads/issues.jsonl|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
cartridges/ashmere_bell/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_bell rename|L1
cartridges/ashmere_bell/transcripts/action_recipe.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_bell rename|L1
cartridges/ashmere_chapters/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_chapters rename|L1
cartridges/ashmere_details/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_details rename|L1
cartridges/ashmere_dusk/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_dusk rename|L1
cartridges/ashmere_dusk/transcripts/schedule.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_dusk rename|L1
cartridges/ashmere_errand/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_errand rename|L1
cartridges/ashmere_errand/transcripts/quest.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_errand rename|L1
cartridges/ashmere_facts/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_facts rename|L1
cartridges/ashmere_ferry/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_ferry rename|L1
cartridges/ashmere_ferry/transcripts/dialogue.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_ferry rename|L1
cartridges/ashmere_ferry/transcripts/schedule.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_ferry rename|L1
cartridges/ashmere_gate/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_gate rename|L1
cartridges/ashmere_gate/transcripts/barrier.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_gate rename|L1
cartridges/ashmere_gate/transcripts/movement.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_gate rename|L1
cartridges/ashmere_green/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_green rename|L1
cartridges/ashmere_green/transcripts/movement.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_green rename|L1
cartridges/ashmere_hello/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_hello rename|L1
cartridges/ashmere_items/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_items rename|L1
cartridges/ashmere_journal/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_journal rename|L1
cartridges/ashmere_locks/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_locks rename|L1
cartridges/ashmere_missing_child/|N|chapter source (whole directory)|-|-|delete:retired chapter content; transcripts replaced in T|Z
cartridges/ashmere_rest/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_rest rename|L1
cartridges/ashmere_rest/transcripts/position.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_rest rename|L1
cartridges/ashmere_road/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_road rename|L1
cartridges/ashmere_road/transcripts/action_recipe.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_road rename|L1
cartridges/ashmere_rooms/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_rooms rename|L1
cartridges/ashmere_rooms/rooms/boathouse.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_rooms rename|L1
cartridges/ashmere_rooms/rooms/ferry_landing.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_rooms rename|L1
cartridges/ashmere_rooms/rooms/well_lane.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_rooms rename|L1
cartridges/ashmere_sampler/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_sampler rename|L1
cartridges/ashmere_sampler/text.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_sampler rename|L1
cartridges/ashmere_scene/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_scene rename|L1
cartridges/ashmere_scene/transcripts/scene.jsonl|R|sampler file under a renamed directory|-|-|sampler:ashmere_scene rename|L1
cartridges/ashmere_wear/cartridge.json|R|sampler file under a renamed directory|-|-|sampler:ashmere_wear rename|L1
cartridges/identity_sampler/text.json|N|NPC named Wren (generic name reused)|-|-|keep:no KAT; rename only if D2 wants repo-wide zero|Z
cartridges/r9c_interactions/|N|renamed chapter copy (whole directory)|-|-|delete:retired chapter content; transcripts replaced in T|Z
docs/archive/decisions/owner-decision-narrow-n-2026-10-01.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/design/foundation/specimen.html|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/design/room-view/explorations/footer-blocks.html|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/design/room-view/explorations/lantern-loop.html|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/design/room-view/explorations/map-ornaments.html|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/design/room-view/explorations/tiny-map.html|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/LATER-ENDINGS.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/LATER-MECHANICS.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/pm-decision-later-story-reconciliation-2026-10-04.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/ROADMAP.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/00-first-cartridge-design.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/00a-chapter-one-content.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/05-cartridges-content-capabilities.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/06-quests-dialogue-actions-scripting.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/08-builder-api-ai-factory.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/09-cartridge-lab-certification.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/14-implementation-plan.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/15-acceptance-scenarios.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/21-composable-world-primitives.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/pre-release-proof.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/R-MILESTONES.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/archive/spec/README.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/chapter-one/chapter-one-e2-gate-checklist-2026-10-08.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/chapter-one/chapter-one-e3-r10-browser-gate-brief-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/chapter-one/README.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/polish/design-input-batch-4-2026-10-09.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/polish/design-input-batch-6-2026-10-09.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/polish/design-input-n5l-2026-10-09.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/briefs/polish/storybook-plan-2026-10-08.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/BUILDERS-GUIDE.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/checks.gen.json|N|generated; names deleted tests|-|-|regen:(elixir bin/contracts.exs)|Z
docs/CHECKS.md|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/decisions/owner-decision-actual-chapter-cutover-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-chapter-one-content-2026-10-02.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-chapter-one-plan-2026-10-02.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-chapter-one-polish-order-2026-10-07.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-m12-b-notice-board-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-mechanics-toolbox-2026-10-08.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-no-wait-opening-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-opening-npc-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-product-order-2026-10-15.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-real-chapter-cast-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-retire-first-chapter-2026-10-21.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-sampler-batch-2026-10-03.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-sampler-development-look-2026-10-03.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/owner-decision-worldbuilding-decoupled-2026-10-15.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-c2-watchmans-rounds-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d1-ferry-isle-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d4-homes-orchard-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d5-deep-fen-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d6-water-depths-2026-10-06.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d7-deer-2026-10-06.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d8-crow-scavenge-2026-10-06.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d9-real-cast-2026-10-06.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-d9-village-reactions-2026-10-06.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-e1-batch-e-dispositions-2026-10-07.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-e2-fixtures-e1-closure-2026-10-08.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-fen01-south-search-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-fen02-mire-hollow-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-m12-a-readable-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-mechanics-continuation-plan-2026-10-03.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-q1-a-first-lead-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-q2-a-first-search-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-q2-b-riddle-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-q2-c-rescue-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-q2-c-stays-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-q3-bell-prior-lost-2026-10-05.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/pm-decision-sampler-shrine-approach-2026-10-04.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/decisions/README.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/design/room-view/room-view.html|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/design/system-dashboard/spec.md|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/design/ui-exploration/chapter-one-playable.html|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/evidence/2026-10-07-e1-coverage-complete/case-SHA256SUMS|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-07-e1-coverage-complete/case-SHA256SUMS.verify|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-07-e1-coverage-complete/e1-tests.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-07-e1-coverage-complete/report.json|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-07-e1-coverage-complete/sqlite-full.jsonl|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/chapter-cites.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/faults-3-runs.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/flip-kill-after.diff|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/flip-kill-after.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/flip-kill-before.diff|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/flip-kill-before.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/focused-authority.txt|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/focused-green.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/focused-kernel.txt|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/heads-diff.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/r9c-all.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/rc1-memory-before-commit.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/rc2-reconcile-assumes-committed.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/rc3-reconcile-never-committed.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/rc4-fence-not-pending.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/README.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/red.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/report-check.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/report.json|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/restore.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/runner.log|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/SHA256SUMS|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/evidence/2026-10-08-e2-r9c/SHA256SUMS.verify|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/features.gen.md|N|generated|-|-|regen:(elixir bin/features.exs)|T
docs/features.json|N|12 rows cite missing_child_v042_{hash,ids} as fixtures (no-file check)|-|-|edit:repoint readable/commerce/skills/service/expedition to toolbox_showcase_hash.json or new KATs; drop v042 from the 7 rows with other fixtures|T
docs/HANDOFF.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/MECHANICS-TOOLBOX.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/MISSING-CHILD-PLAN.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/playtests/2026-10-21-pass1/triage.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-06-e1-loader-integrated-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-06-e1-runner-primary-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-06-e2-v042-brief-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-code-fixture-hygiene-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-batch-e-dispositions-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-closure-fable-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-closure-opus-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-dialogue-policy-binding-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-epilogue-conversations-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-guard-refusals-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-reaction-witnesses-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-recipe-outcomes-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-e1-rejoin-batch-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-07-mobile-size-debt-save-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e1-recorder-in-ci-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-gate-fable-audit.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s0-runner-candidate-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s0-runner-candidate-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s1-synthetic-cartridge-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s2-custody-terminal-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s3-elapsed-jobs-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s4-creatures-transport-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s5-closing-proof-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-e2-s5-closing-proof-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-loka-8mm-world-time-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-loka-8mm-world-time-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-polish-batch2-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-polish-ch1-batch1-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-prepolish-audit-kernel.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-08-prepolish-audit-save.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-09-batch-m2-344-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-09-dialogue-hub-345-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-09-live-switch-335-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-09-m3-reactions-w1-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-batch-m4-fable-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-batch-m5-fable-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-batch-m6-fable-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-batch-m7-fable-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-batch-m8-head-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-m6-waitfix-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-showcase-decision-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-showcase-plan-1-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-showcase-slice-a-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-g1-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m4-hidden-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m4-rope-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m4-sky-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m4-time-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m4-variety-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m5-buffs-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m5-drains-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m5-exposure-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m5-hints-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m5-modifiers-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m5-variants-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m6-codex-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m6-standing-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m7-foes-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m7-j2mo-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m7-say-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m7-scars-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m7-targets-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m8-harvest-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m8-pop-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m8-spells-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m8-useon-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-10-toolbox-m9-readers68-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-12-m10-encounters-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-12-m10-flows-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-12-m10-sleep-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-12-m9b-durability-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-12-m9b-reach-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-13-m10-friction-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-13-m11-doors-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-13-m11-doors-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-13-m11-property-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-14-m12-batch-fable-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-14-m12-delayed-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-14-m12-pairs-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-14-m12-pairs-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-14-m12-tracks-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-15-homestead-a-batch-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-15-hs-11-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-15-hs-14-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-15-hs-5-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-15-kgd-108-14-second-opinion.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-15-loka-icr4-theft-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-15-loka-kgd.142-fd5-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-16-batch-m14-412-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-16-pr411-hostile-refusal-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/2026-10-21-retire-ashmere-1-review.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/reviews/README.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/rnd/koster-research-notes/writings-principles.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/ROADMAP.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/showcase/hub-and-first-districts.md|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/spec/conformance/contract-links.json|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/spec/release-scope.json|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/spec/release-scope.md|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/system-graph.gen.json|N|generated|-|-|regen:regenerate|Z
docs/system/book-ui.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/system/cartridge.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/system/e1-certification.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/system/future.md|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/system/mechanics.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/system/owner-rules.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/system/protocol.md|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/system/README.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/system/save.md|N|live doc names the chapter, r9c or Ashmere samplers|-|-|edit:rewrite text to showcase/sampler names (zero hits)|Z
docs/world-parameters.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
docs/worldbuilding/00-foundations/inspirations-and-anti-inspirations.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/worldbuilding/00-foundations/premise-and-pillars.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/worldbuilding/05-geography/starting-region.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/worldbuilding/21-story/chapter-structure.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/worldbuilding/23-places/starting-settlement.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
docs/worldbuilding/README.md|H|history record|-|-|keep:history, excluded from the zero-hit grep (D2)|-
kernel/ts/src/contracts.gen.ts|N|generated from schema examples with Ashmere ids|-|-|regen:after neutral schema examples|Z
kernel/ts/test/r9c_creatures_transport.test.ts|N|E2 S4 kernel rows on r9c|-|-|delete:E2 integration; focused tests retargeted in M2/M3a|Z
kernel/ts/test/r9c_elapsed_jobs.test.ts|N|E2 S3 kernel rows on r9c|-|-|delete:E2 integration; focused tests retargeted in M3e/M4a/M5a/M2b|Z
kernel/ts/test/r9c_interactions.test.ts|N|pins r9c compiled bytes|-|-|delete:r9c is deleted (pin of retired content)|Z
mobile/app/App.tsx|N|comment names the retire decision and the old db file name|-|-|keep:keep the legacy db filename (it is data); reword comment if D2 says zero hits|Z
mobile/app/book/d9.test.ts|N|Ashmere text in a universal test (not in files.psv)|-|-|fragment:neutral narration literal (NEW ROW: text says Ashmere)|M3c
mobile/app/package-lock.json|N|false hit: integrity hash text|-|-|keep:no edit (exclude from zero-hit grep)|Z
mobile/app/stories/ChapterPages.stories.tsx|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/EntityLine.stories.tsx|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/Live.stories.tsx|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/chapel-map.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/corpse-contents.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/elspeth-asked.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/first-room.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/hound-combat.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/maud-paid-bed.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/night-green.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/peg-shop.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/live/vesper-riddle.sql|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/NpcPage.stories.tsx|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/Page.stories.tsx|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/routes.ts|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/scenarios.ts|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/screen.tsx|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/SystemDataModel.stories.tsx|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/ancestry.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/carrying-empty.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/carrying-held.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/chapter-title.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/character-full.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/character-unknown.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/combat-bleeding.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/combat-one-foe.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/combat-pack.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/contents.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/dream.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/item-container.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/item-fuel.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/item-plain.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/item-too-heavy.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/journal.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/map-barred.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/map-two-levels.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/map-where.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/notice-bed-resume.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/notice-board.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/notice-read.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/npc-choice.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/npc-closed.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/npc-refused.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/npc-riddle.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/npc-services.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/npc-shop.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/room-at-night.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/room-first.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/room-long-log.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/room-notices.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/room-npcs-items.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/room-refusal.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/scene.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/views/settings.json|K|Storybook view/scenario built from missing_child_v042|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/tests/showcase.e2e.ts|N|comment names the decision file|-|-|keep:comment only; keep (decision file name) or reword per D2|Z
mobile/authority/local-story/bell-receipt.ts|N|Ashmere-keyed save code|-|-|delete:only bell-save/finale-save/finale-receipts import it|M1
mobile/authority/local-story/bell-save.ts|N|Ashmere-keyed save code (bell_of_ashmere)|-|-|delete:production code keyed to a retired quest; edit dialogue-save.ts:16,35|M1
mobile/authority/local-story/finale-save.ts|N|Ashmere-keyed save code (missing_child)|-|-|delete:production code keyed to a retired quest; edit receipt-save.ts:13,32|M1
mobile/authority/local-story/r9c_elapsed_jobs.test.ts|N|E2 S3 durable rows on r9c|-|-|delete:E2 integration; focused tests retargeted in M3e/M4a/M5a/M2b|Z
mobile/authority/local-story/r9c_faults.test.ts|N|E2 exit 6 SQLite faults on r9c commits|-|-|delete:faults.test.ts:207/:213 and local_story kill cases cover each row (Z brief cites one per row; red control)|Z
protocol/action.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/cartridge.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/delta.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/dialogue.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/entity.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/event.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/fixtures/bell_contracts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/bleed_composition.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/cartridge_bell_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_chapters_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_details_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_dusk_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_errand_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_facts_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_ferry_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_gate_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_green_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_items_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_journal_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_loader.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_locks_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_rest_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_road_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_rooms_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_sampler_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_scene_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/cartridge_wear_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/character_composition.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/containers_cartridge_items_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_cartridge_locks_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_cartridge_sampler_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_reward_storage_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_sampler_v006_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_sampler_v007_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_sampler_v008_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_sampler_v009_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/containers_sampler_v010_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/dream_contracts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/escort.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/first_search_contracts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/food_contracts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/generate_missing_child_b7.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_c3_provisional.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_d5.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v018_ids.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v019.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v020.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v021.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v023.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v024.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v025.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v028.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v029.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v030.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v031.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v032.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v033.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v034.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v035.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v036.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v037.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v038.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v039.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v040.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/generate_missing_child_v041.py|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/invalid.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/loader_floors.json|N|floors 1.39/1.40 compile cartridges/ashmere_missing_child|-|-|sampler:derived_sampler source (edit at_least to below)|T
protocol/fixtures/missing_child_b7_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_b7_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_c3_b8_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_c3_b8_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_c3_provisional_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_c3_provisional_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_d5_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_d5_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_d8_trace_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v001_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v002_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v003_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v004_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v009_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v009_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v010_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v010_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v012_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v012_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v015_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v015_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v016_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v016_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v017_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v017_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v018_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v018_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v019_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v020_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v021_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v021_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v023_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v023_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v024_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v024_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v025_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v025_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v026_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v026_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v027_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v027_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v028_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v028_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v029_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v029_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v030_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v030_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v031_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v031_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v032_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v032_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v033_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v033_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v034_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v034_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v035_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v035_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v036_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v036_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v037_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v038_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v038_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v039_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v039_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v040_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v040_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v041_hash.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v041_ids.json|N|frozen chapter fixture or generator|-|-|delete:frozen retired chapter answer|Z
protocol/fixtures/missing_child_v042_hash.json|N|Storybook views and features.json read it|-|-|delete:after S re-snapshots and T repoints features.json|Z
protocol/fixtures/missing_child_v042_ids.json|N|Storybook scenarios read it|-|-|delete:after S|Z
protocol/fixtures/r9c_interactions_hash.json|N|r9c KAT|-|-|delete:r9c is deleted|Z
protocol/fixtures/r9c_interactions_ids.json|N|r9c ids|-|-|delete:r9c is deleted|Z
protocol/fixtures/reward_storage_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/riddle_contracts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/sampler_v006_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/sampler_v007_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/sampler_v008_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/sampler_v009_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/sampler_v010_hash.json|R|renamed sampler frozen answer|-|-|edit:rewrite in L1|L1
protocol/fixtures/service_contracts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/wisp_attempts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/fixtures/wisp_contracts.json|N|contract fixture with Ashmere ids as opaque data; tests universal|-|-|keep:opaque ids; neutralize only if D2 says repo-wide zero|Z
protocol/gameview.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/manifest.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/observation.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/policy.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/reaction.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/README.md|N|live doc on plan.md Docs list|-|-|edit:L3 rewrites; Z re-greps to zero (fix chapter_v042 paths: L2 cancelled)|L3
protocol/relation.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/room.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
protocol/scene.schema.json|N|schema examples use Ashmere ids|-|-|edit:neutral example ids; regenerate contracts.gen.ts|Z
test/loka/content_r9c_interactions_test.exs|N|r9c KAT|-|-|delete:r9c is deleted|Z
kernel/ts/test/job_completion_invariant.test.ts|N|universal test missing from files.psv (imports a chapter helper)|-|-|sampler:bleed_sampler via c5_bleed_fixture (NEW ROW: missing from files.psv)|M2b
bin/features.exs|N|features --check: needs one transcript per implemented capability; no code change|-|-|keep:no edit; replacement transcripts per capability above|T
bin/system_graph_homes.exs|N|authored() globs cartridges/*; bleeds home empties unless bleed_sampler|-|-|keep:no edit; regenerate docs/system-graph.gen.json|Z
kernel/ts/test/fragment.ts|N|NEW helper: KAT path + change(c) -> {canonical, sha256}, genesis/newWorld (generalizes transport_fixture.bundle)|-|-|fragment:new shared helper; every M slice imports it read-only|M0
mobile/authority/local-story/finale-receipts.ts|N|only importer is finale-save.ts|-|-|delete:dead once finale-save.ts goes|M1
mobile/authority/local-story/dialogue-save.ts|N|calls bellSave at :16,:35|-|-|edit:drop the bellSave call (code edit)|M1
mobile/authority/local-story/receipt-save.ts|N|calls finaleSave at :13,:32|-|-|edit:drop the finaleSave call (code edit)|M1
cartridges/bleed_sampler/|N|NEW minimal sampler (D1): one bleed + bandage|-|-|sampler:bleed_sampler (new)|M2b
cartridges/shoo_sampler/|N|NEW minimal sampler (D1): one sight population + shoo|-|-|sampler:shoo_sampler (new)|M2c
protocol/fixtures/bleed_sampler_hash.json|N|NEW KAT (speech_sampler pattern; Python-written answer)|-|-|sampler:bleed_sampler|M2b
protocol/fixtures/shoo_sampler_hash.json|N|NEW KAT|-|-|sampler:shoo_sampler|M2c
test/loka/content_bleed_sampler_test.exs|N|NEW KAT pin (content_speech_test.exs pattern)|-|-|sampler:bleed_sampler|M2b
test/loka/content_shoo_sampler_test.exs|N|NEW KAT pin|-|-|sampler:shoo_sampler|M2c
protocol/fixtures/fast_travel_sampler_hash.json|N|NEW KAT for the transport base and transcript|-|-|sampler:fast_travel_sampler|M3a
test/loka/content_fast_travel_sampler_test.exs|N|NEW KAT pin|-|-|sampler:fast_travel_sampler|M3a
cartridges/expedition_sampler/|N|NEW minimal sampler (D1): one expedition with shelter|-|-|sampler:expedition_sampler (new)|M3d
protocol/fixtures/expedition_sampler_hash.json|N|NEW KAT|-|-|sampler:expedition_sampler|M3d
test/loka/content_expedition_sampler_test.exs|N|NEW KAT pin|-|-|sampler:expedition_sampler|M3d
protocol/fixtures/derived_sampler_hash.json|N|NEW KAT for the attributes transcript|-|-|sampler:derived_sampler|T
test/loka/content_derived_sampler_test.exs|N|NEW KAT pin (or extend the existing derived content test)|-|-|sampler:derived_sampler|T
mobile/app/.storybook/preview.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories.test.ts|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/CombatPage.stories.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/ItemPage.stories.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/MapPage.stories.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/NoticePage.stories.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/RecoveryPages.stories.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/RoomPage.stories.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
mobile/app/stories/SectionPages.stories.tsx|K|Storybook page/test rendering v042 views (plan.md S7; no grep word)|-|-|showcase:re-snapshot from showcase routes (npm scripts)|S
```
