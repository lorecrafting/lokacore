# loka-4hik.2 plan: retire Ashmere, phase 2 (delete the cartridges, move or drop their tests)

Written 2026-10-21 by a read-only Opus 5.5 planner. Nothing was edited and no suites were run. I classified the 381 dependent files from their headers, their test names and the fixtures and helpers they import. "Covered by" claims for D rows are file-level only: before deleting, the developer runs the AGENTS.md mutant check ("One test per break per layer").

## The answer to the owner's question (plain English)

Most of what carries the Ashmere name is engine coverage that applies anywhere, not chapter overhead.
- **Mechanic samplers (19 cartridges).** These are small, mechanic-only cartridges (rooms, facts, recipes, doors, items, dialogue, quests, combat and so on). About 140 test files use them for the core loader, kernel, save and terminal guarantees. They stay. Only the name changes (bucket R).
- **The chapter (`ashmere_missing_child`) and its 70 frozen fixtures.** About 165 tests check engine-wide breaks through it: forged or failed/lost COMMIT receipts, reopen, jobs and time, and loader refusals. These cover mechanics that the showcase does not have: bleed, escort, expedition, patrol, water, transport, crows, deer, bell cue, dreams and exchange. They move (bucket K), mostly onto `r9c_interactions`, the existing synthetic cartridge that already has all of these mechanics.
- **What gets deleted (75 files, bucket D).**
  - The E1 v042 certification cases.
  - Story routes: Western Ashmere, the Priory route, Q1 flows, the deep fen, homes.
  - Version and allocation pins.
  - Story-only Book routes.
  - Tests whose break another same-layer test already catches. The main one is Chandler's Debt (5 files, about 40 forged-receipt cases), whose deadline rules `quest_deadline.test.ts` covers.

## Decisions the PM must make first (they block S8, not the parallel slices)

1. **Keep `r9c_interactions` as the home for chapter-only mechanics?**
   - The catch: r9c is the v042 chapter renamed (`test/loka/cartridge_r9c_interactions_hash.py`), and its text still has Wren, Elspeth and Ashmere.
   - Recommended: yes. It has a neutral id, a real source and a content test (`test/loka/content_r9c_interactions_test.exs`), and it is the only neutral cartridge with bleed/escort/expedition/patrol/water. A neutral rewrite of its prose can be a later item; story content is not added now.
   - The alternative is to keep the frozen `missing_child_vNNN` fixtures in place. That is cheaper now but leaves 70 Ashmere fixtures in the repo.
2. **Freeze the r9c fixture.** Its generator asserts the v042 sha (`cartridge_r9c_interactions_hash.py:13`). Recommended: delete the generator in S8. `r9c_interactions_hash.json` then becomes the frozen, independently reviewed answer. The compiler still checks the source against it.
3. **E1.** Recommended:
   - Keep the generic harness: `e1.ts`, `e1_policy.ts`, `e1_repro.ts`, `e1_obligations.ts` and its witness modules, and `e1_barrier.test.ts`.
   - Drop the v042 candidate and all v042 case files.
   - Retarget or delete the CI `e1-recorder` job (`.github/workflows/ci.yml:120-139`).
   - Certification for the real game is re-done when that chapter exists.
4. **Ashmere-keyed production code.** `mobile/authority/local-story/bell-save.ts:13-17`, `finale-save.ts:96-97` and `bell-receipt.ts:175` are hard-wired to the quests `bell_of_ashmere` and `missing_child`. They do nothing in the showcase app, and only r9c keeps them reachable.
   - Recommended: file a follow-up Beads item to delete them together with `bell*.test.ts` and `finale.test.ts`.
   - Until then those tests are K on r9c.
5. **Storybook (S7)** is paused (one-lane memory). Its 36 view snapshots, 9 SQL scenarios and `screen.tsx`/`scenarios.ts` are built from `missing_child_v042_hash.json`. Keep `missing_child_v042_hash.json` and `missing_child_v042_ids.json` until the stories are re-snapshotted from the showcase.

## Rename map (R)

Directory, `cartridge.json` id and title change. Content and versions stay as they are.

| Old | New | Main consumers |
|---|---|---|
| ashmere_hello | hello_sampler | `cartridge_hash.json` conformance, `content_test.exs`, recipes_loader v1 policies |
| ashmere_rooms | rooms_sampler | world, cartridge_rooms, play, author, system_graph |
| ashmere_details | details_sampler | target, cartridge_rooms, play, faults (m), red control |
| ashmere_facts | facts_sampler | facts, cartridge, play |
| ashmere_bell | recipe_sampler | recipes, checks, invocation, lineage, saves, local_story |
| ashmere_dusk | check_sampler | checks, content_dusk, lineage, saves, faults |
| ashmere_road | resource_sampler | resources, attributes, recipes_loader |
| ashmere_rest | position_sampler | position (k, m), resource-recovery |
| ashmere_gate | gate_sampler | barriers, play_gate, rule_steps |
| ashmere_locks | locks_sampler | locks, polish_detail |
| ashmere_items | items_sampler | containment, cartridge_items, equipment, smoke, session, recovery, model |
| ashmere_wear | wear_sampler | equipment (k, m) |
| ashmere_errand | errand_sampler | quests, quest_delivery, journal |
| ashmere_journal | journal_sampler | journal (k, m) |
| ashmere_ferry | ferry_sampler | dialogue, schedule, calendar, elapsed, story_points, start_over, ferry_probe, elapsed-host |
| ashmere_green | green_sampler | reactions, budget_record, observe |
| ashmere_scene | scene_sampler | scene (k, m), elapsed (m), readable |
| ashmere_chapters | chapters_sampler | chapters (k, m) |
| ashmere_sampler | cellar_sampler | combat/death/npc_hp/reward/training (frozen v006-v010), polish-book default, live_actions |

None of the new names is already taken. Collisions avoided: `reactions_sampler`, `quest_sampler`, `barrier_sampler`, `doors_sampler`, `lantern_proof`.

**Rename mechanics.** Use the r9c precedent:
- A one-off Python run parses each frozen answer, replaces the id (and the title), re-dumps it canonical (sort_keys, no whitespace) and recomputes the sha256.
- Never take the new answer from compiler output. The Elixir content tests then prove that source compiles to the rewritten answer.
- `_ids.json` UUIDs do not depend on the cartridge id, so they stay.
- A handful of tests pin a literal 64-hex hash and need it recomputed in Python: facts, recipes, containment, play, budget_record, story_points (m).
- Sed map: `ashmere_<x>@` → `<new>@` and `cartridges/ashmere_<x>` → `cartridges/<new>`.
- **Round-trip check first.** Before renaming anything, parse every fixture and re-dump it unchanged (`sort_keys`, `separators=(',',':')`, `ensure_ascii=False`). The result must equal its existing `canonical` byte for byte. If it does not, stop: the rewrite would silently change the answer.
- **Lexical order shifts.** `recipe_sampler` sorts after `check_sampler` (`bell` sorted before `dusk`), and `cellar_sampler` now sorts first. Re-check any test that asserts an order across cartridges: saves/lineage (bell and dusk), the sim corpus list and counts (`sim.test.ts:86,110,288`), and the cross-kernel iteration order.

## Fixtures

- **Rewrite (S1), 34 files.**
  - `cartridge_{bell,chapters,details,dusk,errand,facts,ferry,gate,green,items,journal,locks,rest,road,rooms,sampler,scene,wear}_hash.json` and `cartridge_hash.json` (hello).
  - `containers_cartridge_{items,locks,sampler}_hash.json`, `containers_sampler_v006..v010_hash.json` and `sampler_v006..v010_hash.json`.
  - `containers_reward_storage_hash.json`, `reward_storage_hash.json` and `test/fixtures/reward_storage/`.
- **Re-record (S1), 17 transcripts.** These are the transcripts under the 18 renamed sampler directories; their headers carry the content hash.
- **Delete (S8), 94 files.**
  - All `protocol/fixtures/missing_child_*` (71 json) and all `generate_missing_child_*.py` (23).
  - Exception: v042 hash and ids stay until S7.
  - `kernel/ts/test/fixtures/c5-provisional-artifact.json` is deleted in S2a.
- **Keep, unchanged.** Contract fixtures that use Ashmere ids only as opaque data: `invalid.json`, `cartridge_loader.json`, `loader_floors.json`, `*_contracts.json`, `bleed_composition.json`, `character_composition.json`, `wisp_attempts.json`.
  - S1 runs their tests. If `cartridge_loader.json` or `invalid.json` embeds a renamed sampler artifact compared against a live answer, S1 applies the same rewrite to it.
  - Schema `examples` in `protocol/*.schema.json` (and `contracts.gen.ts`) stay.
- **New transcripts (S6).** `bin/features.exs:62` fails "missing transcript" for an implemented capability without one. Twelve capabilities have their only transcript in `cartridges/ashmere_missing_child/transcripts/`: attributes, bleed, commerce, expedition, food, knowledge, light, liquid, population, readable, service and transport.
  - Record replacements on `toolbox_showcase`. Use `r9c_interactions` for bleed and expedition, and `fast_travel_sampler` or r9c for transport.

## Scripts, workflows, generated files

- `bin/red_controls.exs:132`: the path becomes `cartridges/details_sampler/transcripts/skills.jsonl` (S1).
- `.github/workflows/ci.yml:120-139`, the e1-recorder job: retarget to `r9c_interactions_hash.json` with its pinned sha, or delete it (S5).
- `kernel/ts/test/transcripts.test.ts:20`: drop the `missing_child_*hash.json` glob (S8).
- Regenerate `docs/features.gen.md` (S1, then S6), `docs/system-graph.gen.json` (S1) and `docs/checks.gen.json` if it changes.
- Paths change for `kernel/ts/test/sim.test.ts:86,110,288` (corpus list) and `test/loka/cartridge_cross_kernel_test.exs` (S1).

## Docs (S8, except where noted)

- **Update:**
  - `docs/system/cartridge.md`: the retired-chapter section becomes a history line; sampler names.
  - `docs/system/e1-certification.md` (S5).
  - `docs/system/mechanics.md`, `docs/MECHANICS-TOOLBOX.md`, `docs/BUILDERS-GUIDE.md:47-53` (S1 transcript path) and `docs/system/README.md`.
  - `docs/system/book-ui.md`, `docs/system/owner-rules.md`, `docs/world-parameters.md`, `docs/ROADMAP.md` and `docs/HANDOFF.md`.
  - `protocol/README.md`: fixture list.
  - `mobile/app/tests/steps.ts:1,21`: comments.
  - Comment links in the r9c tests.
- **Append** a phase-2 line to `docs/decisions/owner-decision-retire-ashmere-2026-10-21.md`.
- **Move** `docs/MISSING-CHILD-PLAN.md` to `docs/archive/`.
- **Leave** reviews, archive, older decisions and worldbuilding as they are (history).

## K rows without a clean target

- **Readable books with topics.** Covers `priory_contracts`, `priory` (m), `readable_alias_book`, Book `priory` and Book `readable`. r9c dropped topics, so the target is `codex_sampler`. Cases that need a book nested in a closed container may not exist there; drop those cases rather than add content.
- **`content_notice_boards_test.exs`.** r9c removed the inn board details, so the target is `identity_sampler`, which has a board.
- **`content_services`, `content_dreams`, `content_standing`, `content_water`.** Each mutates a key r9c dropped (`maud_offer`, `dream_annex`, `guard`, `pool_bottom`). Rebase them on the nearest kept key; that key is named in the table row.
- **`e1_obligations.test.ts`.** Its witness cases need Maud's cellar, which r9c dropped. It is marked D; it is K only if the PM keeps E1 cases.
- **`status_readers.test.ts:278`** (a blind player sees neither a discovered NPC nor a glowing detail) uses the Wisp and the marsh marker. Neither exists outside the chapter. Delete it unless `ward_sampler` already has a glowing detail.
- **`kernel/ts/test/e1_creatures.ts`** mixes generic witnesses with a fixed v042 route. S5 must split it before the route is deleted.
- **Storybook (S7).** It has no target until the views are re-snapshotted from the showcase.

## Mutant-first triage (every K slice brief, S2a-S4)

A test retargeted onto new content is effectively a new test.
- Before retargeting a K file, break its guarded branch once (a focused mutant, never a full sweep).
- If a neutral same-layer test already fails, delete the file instead of retargeting it, and cite that test.
- The kernel-side K rows are the likeliest to fall to D: light, liquid, food, service, training and d10 already have neutral kernel tests (for example `liquid_composition`, `fuel_composition`, `senses`, `needs`, `kitchen`, `craft`, `fast_travel`). The mobile save-integrity rows rarely have a neutral twin.
- Expect K to shrink and S2-S4 to come in under the estimates. This is the direct answer to the owner's overhead question.

## Slices

Each file belongs to exactly one slice. Bucket counts per slice are in the Counts table below. Sizes are estimates for one Opus developer.

| Slice | Scope | Files (tests/helpers) + other | Est. tokens | Wave |
|---|---|---|---|---|
| S1 Sampler renames | 19 dir renames, 34 fixture rewrites, 17 transcripts re-recorded, sed over the R files in every layer, red control, KAT scripts, generated docs | 137 + 19 dirs + 34 fixtures | ~190k (mostly mechanical; run the sed as a single map) | 1 |
| S2a Creatures on r9c | c4 pack, c5 bleed, deer, hounds, writer_groups, sim_mechanics; mobile c4/c5/deer/hounds; Book hounds | 23 | ~120k | 1 |
| S2b Travel and watch on r9c | transport_fixture family: crow, d9, d10, c6, transport, water, patrol, escort, study_ingress, single tests in climb/hidden/doors/spells; mobile counterparts; head_rollback onto the showcase | 38 | ~200k | 1 |
| S3a Food, dream, service, exchange, practical | kernel helpers, their mobile hosts and Book tests | 28 | ~150k | 1 |
| S3b Riddle, readable, bell/finale, message, Book shell | wren_riddle, readable, priory and codex, bell/finale/vesper on r9c; Book shop/training/polish/pass1_ui4/hostile_refusal and chapter.test onto the showcase | 39 | ~190k | 1 |
| S3c Light, liquid, training, character, commerce | kernel helpers and mobile counterparts; chandlers deletion | 27 | ~150k | 1 |
| S4 Elixir chapter tests | content_* refusal tests rebased on r9c; the 10 refusal tests of content_missing_child move; chapter KAT scripts deleted | 29 | ~140k | 1 |
| S5 E1 retire | 40 v042 case files deleted; e1_policy candidate; e1.test retarget; ci.yml job; e1-certification.md | 52 | ~70k | 1 |
| S6 Transcripts | 12 replacement transcripts; features.gen.md | ~12 + 1 | ~120k | 2 (after S1) |
| S7 Storybook re-snapshot | 36 views, 9 SQL scenarios, screen/scenarios/routes/Live/Page/SystemDataModel stories, stories.test.ts | ~60 | ~150k | deferred (Storybook paused) |
| S8 Final deletion | `cartridges/ashmere_missing_child` (295 files), 94 fixtures and generators, r9c generator, walkthroughs, transcripts.test glob, docs | 8 + deletions + docs | ~90k | 3 (after S2-S6) |

**Overlap notes**
- Wave-1 slices share no file. Helper ownership keeps the kernel and mobile sides of each mechanic in the same slice: `transport_fixture` and `water_fixture` in S2b; `deer_fixture` and `c4_pack_fixture` in S2a; `food`/`dream`/`service`/`infirmary`/`practical` helpers and their hosts in S3a; `light_fixture` and `training_fixture` in S3c; `priory_fixture`, `wisp_fixture`, `bell-setup` and `priory-fixture` in S3b.
- `combat_fixture`, `death_fixture` and `polish-book` belong to S1 and are rename-only, so the slices that import them need no edit.
- About 8 files in S3b/S3c also name a renamed sampler: `training_contracts`, `cartridge_liquids`, `light_fixture`, light (m), readable, polish_detail, priory (m) and chapter.test. Whichever of S1 or S3 merges second reruns S1's sed map on them. The map is idempotent.
- S6 and S1 both regenerate `docs/features.gen.md`. It is a generated file, so the later slice regenerates it.
- S8 needs S2a-S6 merged. Until S7 runs, it keeps `missing_child_v042_{hash,ids}.json`.
- Per the batch-PRs memory, run S2a/S2b/S3a/S3b/S3c/S4 as one draft batch branch with one reviewer pass on its head. S1 and S5 can be their own PRs.

## Risks

- **r9c is the chapter in disguise.** Retargeting about 95 tests to it keeps Ashmere prose under a neutral id. That is the owner's call (decision 1).
- **Literal drift on retarget.** Tests written against v009-v041 carry older numbers and keys. r9c changes the ferry fare (5), the room price (4), the dropped rooms and NPCs, and the IDs from `r9c_interactions_ids.json`. Expected values must come from r9c files or the ids fixture, never from a kernel run.
- **Thinner focused coverage.** The r9c E2 tests say their breaks are "killed by the focused tests linked below". Those focused tests are exactly the ones moving. If a slice deletes a focused test without a same-layer replacement, only the broad E2 run catches the break, and broad runs do not count.
- **No missing transcripts at the end.** S6 must land before S8, or `features --check` fails.
- **Rename churn.** Content hashes change, so 17 transcripts need re-recording. Missing one fails `transcripts.test.ts`.
- **Production code stays reachable** through r9c (decision 4).

## Cost

- **Development:** about 1.4M tokens (S1-S6 and S8), plus about 150k for S7 when Storybook resumes.
- **Reviews:** one review for each of S1, S5, S8 and the batch.
- **Wall clock:** the load gate allows at most 5 agents and at most 3 running tests. Every developer runs tests, so wave 1 goes three at a time: S1, S2b and S5 first, then S3b, S4 and S2a, then S3a and S3c.
- **This planning run:** about 290k tokens.


## S7 Storybook block (K, deferred, re-snapshot from the showcase)

All of these depend on `missing_child_v042_hash.json`. Storybook is paused, so they stay until it reactivates.
- `mobile/app/stories/views/*.json`: 36 GameView snapshots.
- `mobile/app/stories/live/*.sql`: 9 seeded scenarios.
- `mobile/app/stories/screen.tsx:7`, `scenarios.ts:10` and `routes.ts`.
- `Live.stories.tsx`, `Page.stories.tsx` and `SystemDataModel.stories.tsx`. The last one names `cartridges/ashmere_rooms/...` at line 201; its rename belongs to S1.
- The page stories that render the views: Chapter, Combat, Item, Map, Notice, Npc, Recovery, Room and Section.
- `mobile/app/stories.test.ts`.

The break they guard: a Book page drifts from its catalogued design. The fix is to regenerate the views from showcase routes with the existing scenario replay, and only then delete the v042 fixture (S8 follow-up).

## Counts

381 files classified (helpers and data files included; S7 stories listed above): R 140, K 167, D 74.

| Area | R | K | D |
|---|---|---|---|
| Kernel tests (kernel/ts/test) | 70 | 78 | 11 |
| E1 harness and v042 cases (kernel/ts/test/e1_*) | 0 | 12 | 39 |
| Mobile authority (mobile/authority/local-story) | 28 | 38 | 13 |
| Mobile app (mobile/app) | 7 | 16 | 3 |
| Elixir tests and KAT scripts (test/) | 34 | 23 | 7 |
| Scripts and workflows | 1 | 0 | 1 |

| Slice | R | K | D | files |
|---|---|---|---|---|
| S1 | 134 | 0 | 3 | 137 |
| S2a | 0 | 22 | 1 | 23 |
| S2b | 0 | 33 | 5 | 38 |
| S3a | 0 | 27 | 1 | 28 |
| S3b | 1 | 30 | 8 | 39 |
| S3c | 0 | 20 | 7 | 27 |
| S4 | 0 | 23 | 6 | 29 |
| S5 | 0 | 12 | 40 | 52 |
| S8 | 5 | 0 | 3 | 8 |

## Kernel tests (kernel/ts/test)

Paths under `kernel/ts/test/`. (m) = mobile authority layer.

| File | Bucket | Break / reason | Target | Slice |
|---|---|---|---|---|
| `attributes.test.ts` | R | stat/resource_compare reads wrong value | resource_sampler | S1 |
| `author.test.ts` | R | bin/loka dev drops last good artifact on failed compile | rooms_sampler | S1 |
| `barriers.test.ts` | R | illegal barrier transition / key reach / loader barrier refs | gate_sampler | S1 |
| `budget_record.test.ts` | R | budget_exceeded not one valid diagnostics record | green_sampler | S1 |
| `calendar.test.ts` | R | calendar/schedule/window; delete the v015 test at :175 (covered by calendar.test.ts:69 displayed subdivisions) | ferry_sampler | S1 |
| `cartridge.test.ts` | R | loader accepts bad fact defaults, byte cap, known-answer hash | facts_sampler, hello_sampler (cartridge_hash.json conformance) | S1 |
| `cartridge_escort.test.ts` | R | loader accepts unresolved escort bindings | ferry_sampler | S1 |
| `cartridge_items.test.ts` | R | loader accepts bad item/NPC/carrying refs | items_sampler | S1 |
| `cartridge_riddle.test.ts` | R | loader accepts bad riddle/journal refs, API1.9 floor | ferry_sampler | S1 |
| `cartridge_rooms.test.ts` | R | loader accepts bad room/detail/text refs | rooms_sampler, details_sampler | S1 |
| `chapters.test.ts` | R | chapter marker selects wrong chapter | chapters_sampler | S1 |
| `checks.test.ts` | R | luck check boundary, wait, time_window, clock overflow | recipe_sampler, check_sampler | S1 |
| `climb_flee.test.ts` | R | Flee over climb face without item | cellar_sampler frozen v009 | S1 |
| `combat.test.ts` | R | M4 combat rounds, Flee, credit | cellar_sampler frozen v009 | S1 |
| `combat_actions.test.ts` | R | encounter ActionSet filtering | cellar_sampler frozen v009 | S1 |
| `combat_band.test.ts` | R | hp band cut | cellar_sampler frozen v009 | S1 |
| `combat_content.test.ts` | R | combat loader contracts | cellar_sampler frozen v008 | S1 |
| `combat_credit.test.ts` | R | counterfeit credit attribution | cellar_sampler frozen v009 | S1 |
| `combat_fixture.ts` | R | helper, frozen v0.0.9 | cellar_sampler (frozen containers_sampler_v009) | S1 |
| `combat_flee.test.ts` | R | Flee exit selection, fare, budget | cellar_sampler frozen v009 | S1 |
| `container_history.test.ts` | R | historical artifacts keep canonical answers (drop missing_child_v001/v002 rows) | cellar_sampler frozen v006-v010 | S1 |
| `containment.test.ts` | R | take/drop/give custody, containment invariants | items_sampler | S1 |
| `content_graph.test.ts` | R | reach report wrong (id string only) | hello_sampler (text) | S1 |
| `death.test.ts` | R | fatal sequence custody/return | cellar_sampler frozen v008 | S1 |
| `death_content.test.ts` | R | corpse loader contracts | cellar_sampler frozen v008 | S1 |
| `death_fixture.ts` | R | helper, frozen v0.0.8 | cellar_sampler frozen v008 | S1 |
| `dialogue.test.ts` | R | talk/choose/close and dialogue loader checks | ferry_sampler | S1 |
| `elapsed.test.ts` | R | trusted elapsed boundary, elapsed loader | ferry_sampler | S1 |
| `equipment.test.ts` | R | slot holders, wear/remove, worn custody | wear_sampler, items_sampler | S1 |
| `exit_admission.test.ts` | R | exit availability ignores movement action policy | ferry_sampler (via ferry_probe) | S1 |
| `facts.test.ts` | R | fact.assign, conditions, variants, facts_typed | facts_sampler | S1 |
| `ferry_probe.ts` | R | helper | ferry_sampler | S1 |
| `invocation.test.ts` | R | P1 identity/outcome adapter | recipe_sampler, check_sampler, items_sampler | S1 |
| `invocation_cases.json` | R | known answers data | recipe_sampler, check_sampler, items_sampler | S1 |
| `journal.test.ts` | R | journal text selection | errand_sampler, journal_sampler | S1 |
| `keyed_admission.test.ts` | R | admission matches another action than invoked | ferry_sampler (via ferry_probe) | S1 |
| `locks.test.ts` | R | item barrier verbs, reach through lids, loader key reach | locks_sampler | S1 |
| `longwait_property.test.ts` | R | long wait != hourly (comment names hello only) | hello_sampler (comment) | S1 |
| `npc_hp.test.ts` | R | NPC HP rows, loader API 1.4 | cellar_sampler frozen v007 | S1 |
| `pen.test.ts` | R | hs-4 animals (killer id from death fixture) | pen_sampler + cellar_sampler id | S1 |
| `play.test.ts` | R | loka play CLI, trace replay, redaction | rooms_sampler, details_sampler, facts_sampler | S1 |
| `play_gate.test.ts` | R | CLI doors/brief mode | gate_sampler | S1 |
| `play_items.test.ts` | R | CLI items, 1025-match lookup refusal | items_sampler | S1 |
| `play_recipes.test.ts` | R | CLI recipes, wait, status line | recipe_sampler, check_sampler, ferry_sampler, resource_sampler | S1 |
| `position.test.ts` | R | position@1, RESERVED_FACT | position_sampler, ferry_sampler | S1 |
| `put.test.ts` | R | Put pair | cellar_sampler | S1 |
| `quest_delivery.test.ts` | R | quest delivery FIFO/budget | errand_sampler | S1 |
| `quest_dialogue.test.ts` | R | accept activates quest, loader accept checks | ferry_sampler | S1 |
| `quests.test.ts` | R | quest@1 lifecycle, loader quest checks | errand_sampler | S1 |
| `reactions.test.ts` | R | reaction delivery order, budgets | green_sampler | S1 |
| `recipes.test.ts` | R | ActionSet algebra, recipe execution | recipe_sampler, items_sampler | S1 |
| `recipes_loader.test.ts` | R | loader on recipes, v1 policies | recipe_sampler, check_sampler, hello_sampler, resource_sampler | S1 |
| `resources.test.ts` | R | costs, thresholds, regen, mv | resource_sampler, rooms_sampler | S1 |
| `reward_storage.test.ts` | R | reward clamp, receive custody | cellar_sampler | S1 |
| `reward_storage_content.test.ts` | R | reward loader | cellar_sampler | S1 |
| `reward_storage_fixture.ts` | R | helper | cellar_sampler (containers_reward_storage) | S1 |
| `rule_steps.test.ts` | R | rule query_steps counted wrong | ferry_sampler, gate_sampler | S1 |
| `scene.test.ts` | R | modal scene Continue/start | scene_sampler | S1 |
| `schedule.test.ts` | R | job drain order, run_job refusal, calendar loader | ferry_sampler | S1 |
| `sim.test.ts` | R | simulator invariants over corpus (names sampler ids) | all renamed samplers | S1 |
| `sim.ts` | R | helper (containers_cartridge_ prefix) | renamed samplers | S1 |
| `sim_seeds.json` | R | regression seeds data | errand/ferry/green/resource samplers | S1 |
| `target.test.ts` | R | target resolution table, 1024 cap | details_sampler | S1 |
| `target_present.test.ts` | R | target_present, talk path codes | ferry_sampler | S1 |
| `targets.test.ts` | R | target choice, allies (combat_fixture import) | targets_sampler + cellar_sampler | S1 |
| `variants.test.ts` | R | variant text, npc_present (comment/id only) | variants_sampler (+ items text) | S1 |
| `world.test.ts` | R | IdSource, move/look, movement invariants | rooms_sampler | S1 |
| `fixtures/c5-provisional-artifact.json` | D | frozen provisional chapter artifact | - | S2a |
| `c4_pack.test.ts` | K | pack admission/rotation/hp bands | r9c_interactions | S2a |
| `c4_pack_elapsed.test.ts` | K | one elapsed advance != hourly play for pack | r9c_interactions | S2a |
| `c4_pack_fixture.ts` | K | helper | r9c_interactions | S2a |
| `c4_pack_flight.test.ts` | K | wounded flight boundary, job order | r9c_interactions | S2a |
| `c4_schema_contracts.test.ts` | K | pack/roster schema bounds | r9c_interactions (or fixture-free literals) | S2a |
| `c5_bleed.test.ts` | K | bleed apply/refresh/cure/expiry | r9c_interactions | S2a |
| `c5_bleed_death.test.ts` | K | water expiry clears bleed before return | r9c_interactions | S2a |
| `c5_bleed_early_expiry.test.ts` | K | bleed early expiry | r9c_interactions | S2a |
| `c5_bleed_fixture.ts` | K | helper (kernel/ts/test/fixtures/c5-provisional-artifact.json) | r9c_interactions; delete the provisional artifact | S2a |
| `deer.test.ts` | K | deer sight/flight/slot handoff; drop "v042 genesis IDs" pin | r9c_interactions | S2a |
| `deer_contracts.test.ts` | K | deer wire guards | r9c_interactions | S2a |
| `deer_fixture.ts` | K | helper | r9c_interactions | S2a |
| `hidden_passage_npc.test.ts` | K | fleeing NPC takes hidden/climb face | r9c_interactions | S2a |
| `hounds.test.ts` | K | hound area loader, wander, pelt slots; drop genesis pin | r9c_interactions | S2a |
| `sim_mechanics.test.ts` | K | simulator accepts legal chapter receipts (marsh start, bleed, exchange) | r9c_interactions | S2a |
| `writer_groups.test.ts` | K | writer-group joins in one advance | r9c_interactions | S2a |
| `d9_content.test.ts` | D | five terminal pairs project distinct cast prompts (story prose) | - | S2b |
| `deep_fen.test.ts` | D | D5 deep-fen route (fox_den_deep dropped). Authority-layer COMMIT reconcile covered by mobile local_story.test.ts:241 and :270; lookalike substitution by missing_child_stays (K) | - | S2b |
| `western_ashmere.test.ts` | D | Western Ashmere route/Hob schedule (rooms dropped from r9c); schedule boundaries covered by schedule.test.ts:102 | - | S2b |
| `c6_contracts.test.ts` | K | expedition contracts/loader; drop C6 allocation pin | r9c_interactions | S2b |
| `c6_expedition.test.ts` | K | expedition stage order, Restart | r9c_interactions | S2b |
| `c6_source_acceptance.test.ts` | K | expedition shelter/detour on compiled source | r9c_interactions | S2b |
| `climb.test.ts` | K | one test: loader refuses patrol route over climb face | climb_sampler + r9c_interactions | S2b |
| `crow.test.ts` | K | crow custody/legs/fallback | r9c_interactions | S2b |
| `crow_loader.test.ts` | K | crow allowlist/corridor loader | r9c_interactions | S2b |
| `d10_contracts.test.ts` | K | map/Knock contracts and loader | r9c_interactions | S2b |
| `d10_knowledge.test.ts` | K | visited rooms, known_npcs, reopen | r9c_interactions | S2b |
| `d9_contracts.test.ts` | K | cue/suppression contracts; drop v040 allocation pin | r9c_interactions | S2b |
| `d9_suppression.test.ts` | K | bell suppression deadline/resume jobs | r9c_interactions | S2b |
| `doors.test.ts` | K | test g: walks below API 1.81 on a population plan | doors_sampler + r9c_interactions | S2b |
| `escort.test.ts` | K | escort follow/Flee/Rejoin binding | r9c_interactions | S2b |
| `hidden_passage.test.ts` | K | one test: loader refuses patrol/expedition over hidden face | hidden_sampler + r9c_interactions | S2b |
| `patrol.test.ts` | K | patrol checkpoints, Rejoin, Restart | r9c_interactions | S2b |
| `patrol_content.test.ts` | K | patrol loader | r9c_interactions | S2b |
| `patrol_fixture.ts` | K | helper (v024) | r9c_interactions | S2b |
| `spells.test.ts` | K | one test: cast not offered in a cartridge without spells | spells_sampler + r9c_interactions | S2b |
| `study_ingress.test.ts` | K | Study ingress rechecks corpse | r9c_interactions | S2b |
| `transport.test.ts` | K | fare/refusal/recovery/free lesson | r9c_interactions | S2b |
| `transport_fixture.ts` | K | helper compiles the chapter source live | cartridges/r9c_interactions | S2b |
| `water.test.ts` | K | water admission, drowning deadline, recovery | r9c_interactions | S2b |
| `water_content.test.ts` | K | water loader | r9c_interactions | S2b |
| `water_fixture.ts` | K | helper | r9c_interactions | S2b |
| `homes.test.ts` | D | Gareth/Ada homes and child-enum prose (story); job day boundaries covered by schedule.test.ts:102 | - | S3a |
| `cartridge_dreams.test.ts` | K | loader refuses impossible Rest bindings | r9c_interactions | S3a |
| `cartridge_food.test.ts` | K | loader accepts impossible held food | r9c_interactions | S3a |
| `cartridge_services.test.ts` | K | loader refuses unproducible service bindings | r9c_interactions | S3a |
| `dream.test.ts` | K | paid Rest dream checkpoint/branches; drop S2/Bell story case | r9c_interactions | S3a |
| `dream_fixture.ts` | K | helper | r9c_interactions | S3a |
| `food.test.ts` | K | apple stock conservation, Eat refusals; drop v035 ID pin | r9c_interactions | S3a |
| `food_fixture.ts` | K | helper | r9c_interactions | S3a |
| `infirmary.test.ts` | K | harvest/exchange conservation and caps | r9c_interactions | S3a |
| `infirmary_contracts.test.ts` | K | exchange/harvest contracts and loader | r9c_interactions | S3a |
| `infirmary_fixture.ts` | K | helper | r9c_interactions | S3a |
| `practical_skills.test.ts` | K | careful harvest/discount quote floors | r9c_interactions | S3a |
| `practical_skills_contracts.test.ts` | K | method field bounds | r9c_interactions | S3a |
| `practical_skills_fixture.ts` | K | helper | r9c_interactions | S3a |
| `service.test.ts` | K | service quote/rollback/settlement | r9c_interactions | S3a |
| `service_fixture.ts` | K | helper | r9c_interactions | S3a |
| `missing_child.test.ts` | D | v042 release pins (simulator seeds + allocation oracle); simulator invariants covered by sim.test.ts:182 | - | S3b |
| `priory.test.ts` | D | Priory route/novice schedule story; Read grants once covered by codex.test.ts:64 | - | S3b |
| `priory_fixture.ts` | D | helper (Priory books; topics dropped from r9c) | - | S3b |
| `wisp.test.ts` | D | Wisp S4 riddle story; riddle retry/participants covered by wren_riddle.test.ts:137 and :193 (K) | - | S3b |
| `wisp_fixture.ts` | D | helper of wisp (not in r9c) | - | S3b |
| `cartridge_wisp.test.ts` | K | reopening dialogue rejects direct assign of once-proven fact; drop wisp-specific cases | r9c_interactions (vesper riddle) | S3b |
| `first_search.test.ts` | K | quest activation delivery, trigger matching, reaction source rollback | r9c_interactions | S3b |
| `missing_child_bell.test.ts` | K | Ring/Silence admission and terminal (bell-save production) | r9c_interactions | S3b |
| `missing_child_finale.test.ts` | K | scene must bind Begin detail; endings need Begin+ack | r9c_interactions | S3b |
| `missing_child_stays.test.ts` | K | quest item received once, custody rules, corpse keeps it | r9c_interactions (vesper_message) | S3b |
| `notice_boards.test.ts` | K | board loader/projection | r9c_interactions or identity_sampler (boards) | S3b |
| `priory_contracts.test.ts` | K | item writing/topic refs/unique mappings fail closed | codex_sampler | S3b |
| `readable.test.ts` | K | Read target/refusal/budget; scene part rename, v003 part retarget | scene_sampler + codex_sampler (readable) | S3b |
| `readable_play.test.ts` | K | terminal Read resolves authored aliases | codex_sampler | S3b |
| `wren_riddle.test.ts` | K | riddle retry on bound row, participant leaves disables Choose | r9c_interactions (vesper riddle) | S3b |
| `status_readers.test.ts` | R | ward sampler readers; the wisp test at :278 (blind hides discovered NPC and glowing detail) has no target: keep only if ward_sampler gains nothing new, else delete (see no-target list) | ward_sampler | S3b |
| `chandlers_debt.test.ts` | D | Chandler's Debt story timings (quest dropped from r9c); deadline fail/complete covered by quest_deadline.test.ts:95 and :128 | - | S3c |
| `cartridge_liquids.test.ts` | K | loader accepts bad liquid metadata / vessel on corpse template | items_sampler + r9c_interactions | S3c |
| `chandlers_contracts.test.ts` | K | deadline/payment contract fields | r9c_interactions (fixture swap only) | S3c |
| `character_choice.test.ts` | K | ancestry choice receipt, attribute effects | r9c_interactions | S3c |
| `character_contracts.test.ts` | K | character creation wire contracts | r9c_interactions | S3c |
| `commerce.test.ts` | K | keep only "loader independently rejects malformed shop stock and funding" (TS loader layer); delete the 3 buy/sell cases (covered by prices.test.ts:91 stale quote, showcase_economy.test.ts:149 and :278 buy/sell) | r9c_interactions | S3c |
| `commerce_contracts.test.ts` | K | shop contract malformed prices | r9c_interactions (fixture swap only) | S3c |
| `d10_presentation.test.ts` | K | Where/Map/Knock from saved observation | r9c_interactions | S3c |
| `light.test.ts` | K | burn intervals, refuel conservation, darkness; drop successor ID pin | r9c_interactions | S3c |
| `light_contracts.test.ts` | K | light contracts, API1.19 floor | r9c_interactions | S3c |
| `light_fixture.ts` | K | helper (v021 + items) | r9c_interactions | S3c |
| `liquid.test.ts` | K | Fill/Pour/Drink conservation, mass ceiling | r9c_interactions | S3c |
| `training.test.ts` | K | lesson payment/qualification/defence draws | r9c_interactions | S3c |
| `training_contracts.test.ts` | K | skill/training contracts and loader | r9c_interactions (+cellar_sampler) | S3c |
| `training_fixture.ts` | K | helper (v021 + combat_fixture) | r9c_interactions | S3c |
| `r9c_custody_terminal.test.ts` | R | comment links to deleted focused tests only | update links | S8 |
| `transcripts.test.ts` | R | transcripts replay; drop missing_child_* glob | renamed samplers + S6 transcripts | S8 |

## E1 harness and v042 cases (kernel/ts/test/e1_*)

Paths under `kernel/ts/test/`. (m) = mobile authority layer.

| File | Bucket | Break / reason | Target | Slice |
|---|---|---|---|---|
| `e1_case_host.ts` | D | fixed v042 SQLite proof host | - | S5 |
| `e1_cases.test.ts` | D | v042 case bindings | - | S5 |
| `e1_cases.ts` | D | v042 case runner | - | S5 |
| `e1_creatures.test.ts` | D | v042 creature witnesses | - | S5 |
| `e1_debt.test.ts` | D | v042 route | - | S5 |
| `e1_debt.ts` | D | v042 route | - | S5 |
| `e1_dialogue_circuit.test.ts` | D | v042 route | - | S5 |
| `e1_dialogue_circuit.ts` | D | v042 route | - | S5 |
| `e1_dispositions.json` | D | v042 disposition table | - | S5 |
| `e1_epilogue_talks.test.ts` | D | v042 route | - | S5 |
| `e1_epilogue_talks.ts` | D | v042 route | - | S5 |
| `e1_faults.ts` | D | v042 storage anchors | - | S5 |
| `e1_identity.test.ts` | D | v042 witnesses | - | S5 |
| `e1_items.test.ts` | D | v042 route | - | S5 |
| `e1_items.ts` | D | v042 route | - | S5 |
| `e1_journal.test.ts` | D | v042 route | - | S5 |
| `e1_knowledge_effects.test.ts` | D | v042 route | - | S5 |
| `e1_maud.test.ts` | D | v042 route | - | S5 |
| `e1_maud.ts` | D | v042 route | - | S5 |
| `e1_night_marsh.test.ts` | D | v042 route | - | S5 |
| `e1_night_marsh.ts` | D | v042 route | - | S5 |
| `e1_obligations.test.ts` | D | witness cases on v042 Maud/ferry/stay; retarget only if PM keeps E1 cases (see risks) | - | S5 |
| `e1_optional_quests.test.ts` | D | v042 route | - | S5 |
| `e1_optional_quests.ts` | D | v042 route | - | S5 |
| `e1_paths.ts` | D | v042 route | - | S5 |
| `e1_refusals.ts` | D | v042 route | - | S5 |
| `e1_rejoin.test.ts` | D | v042 route | - | S5 |
| `e1_rejoin.ts` | D | v042 route | - | S5 |
| `e1_routes.test.ts` | D | v042 route | - | S5 |
| `e1_routes.ts` | D | v042 route | - | S5 |
| `e1_services.test.ts` | D | v042 route | - | S5 |
| `e1_services.ts` | D | v042 route | - | S5 |
| `e1_watch_rounds.test.ts` | D | v042 route | - | S5 |
| `e1_watch_rounds.ts` | D | v042 route | - | S5 |
| `e1_wisp_herbs.test.ts` | D | v042 route | - | S5 |
| `e1_wisp_herbs.ts` | D | v042 route | - | S5 |
| `e1_world.ts` | D | v042 idle-world model | - | S5 |
| `e1_world_witness.test.ts` | D | v042 world witnesses | - | S5 |
| `e1_world_witness.ts` | D | v042 world witnesses | - | S5 |
| `e1.test.ts` | K | E1 command refuses wrong candidate/policy/repro | r9c_interactions + toolbox_showcase candidates | S5 |
| `e1.ts` | K | E1 runner | unchanged | S5 |
| `e1_barrier.test.ts` | K | barrier.set witness (already showcase) | toolbox_showcase | S5 |
| `e1_barrier.ts` | K | witness module | unchanged | S5 |
| `e1_creatures.ts` | K | witness module; delete its fixed v042 route | unchanged | S5 |
| `e1_identity.ts` | K | witness module | unchanged | S5 |
| `e1_knowledge_effects.ts` | K | witness module | unchanged | S5 |
| `e1_obligations.ts` | K | generic witnesses (split out v042 route parts from e1_creatures.ts) | unchanged | S5 |
| `e1_order.ts` | K | witness module | unchanged | S5 |
| `e1_policy.ts` | K | candidate table: drop ashmere_missing_child row | r9c_interactions | S5 |
| `e1_repair.ts` | K | witness module | unchanged | S5 |
| `e1_repro.ts` | K | repro | unchanged | S5 |

## Mobile authority (mobile/authority/local-story)

Paths under `mobile/authority/local-story/`. (m) = mobile authority layer.

| File | Bucket | Break / reason | Target | Slice |
|---|---|---|---|---|
| `mauds_cellar.test.ts` | D | five kills -> reward duplicated by reward_storage.test.ts:27 (m) | - | S1 |
| `mauds_cellar_book.test.ts` | D | Maud story-ended claim (story) | - | S1 |
| `sampler.test.ts` | D | sampler content walk; scene line-two reopen covered by scene.test.ts:96 (m), journal by journal.test.ts:46 (m) | - | S1 |
| `__tests__/elapsed-host.test.ts` | R | helper elapsedBundle | ferry_sampler | S1 |
| `__tests__/reward-host.test.ts` | R | helper | cellar_sampler | S1 |
| `carrying-reach.test.ts` | R | saved custody cycle faults before carrying | items_sampler | S1 |
| `chapters.test.ts` | R | derived chapter after reopen | chapters_sampler | S1 |
| `combat.test.ts` | R | combat receipts reopen/FULL/unknown COMMIT | cellar_sampler frozen v009 | S1 |
| `combat_schedule.test.ts` | R | departure vs due round reopen | cellar_sampler frozen v009 | S1 |
| `death.test.ts` | R | corpse reopen atomic | cellar_sampler frozen v007 | S1 |
| `elapsed.test.ts` | R | elapsed receipts/fencing | scene_sampler | S1 |
| `equipment.test.ts` | R | worn item after reopen | wear_sampler | S1 |
| `faults.test.ts` | R | every fault leaves prior/next revision | details_sampler, check_sampler | S1 |
| `journal.test.ts` | R | journal projection after reopen | journal_sampler | S1 |
| `keyed.test.ts` | R | invoke passes action_key | ferry_sampler | S1 |
| `lineage.test.ts` | R | lineage seed/context pinned | recipe_sampler, check_sampler | S1 |
| `local_story.test.ts` | R | restart, receipts, COMMIT faults, kill, trace, jobs | recipe/ferry/green/items samplers | S1 |
| `npc-hp.test.ts` | R | NPC HP adoption atomic | cellar_sampler frozen v007 | S1 |
| `observe.test.ts` | R | budget fault observation sink | green_sampler | S1 |
| `position.test.ts` | R | position after reopen | position_sampler | S1 |
| `recovery.test.ts` | R | leftover transaction, corrupt save, trace cap | items_sampler | S1 |
| `resource-recovery.test.ts` | R | opted rows/Rest receipts | position_sampler, cellar_sampler | S1 |
| `reward_storage.test.ts` | R | reward atomic under rollback | cellar_sampler | S1 |
| `saves.test.ts` | R | save identity/pin/corrupt | recipe_sampler, check_sampler, items_sampler | S1 |
| `scene.test.ts` | R | scene line two reopen | scene_sampler | S1 |
| `session.test.ts` | R | Start over lost ack | items_sampler | S1 |
| `smoke.test.ts` | R | smoke controller restart/pending | items_sampler | S1 |
| `start_over.test.ts` | R | Start over over corrupt report | ferry_sampler | S1 |
| `story_points.test.ts` | R | story point capture/delivery | ferry_sampler | S1 |
| `c4_pack.test.ts` | K | pack/flight reopen, failed COMMIT | r9c_interactions | S2a |
| `c5_bleed.test.ts` | K | bleed ticks through SQLite, COMMIT faults | r9c_interactions | S2a |
| `deer.test.ts` | K | deer receipts, forged sight, COMMIT faults | r9c_interactions | S2a |
| `deer_bleed_recovery.test.ts` | K | interleaved round/population/bleed receipt | r9c_interactions | S2a |
| `hounds.test.ts` | K | population accepted-history refusal, wander unknown COMMIT | r9c_interactions | S2a |
| `water_chapter.test.ts` | D | bought torch through drowning: covered by water.test.ts:133 and :370 (m), light.test.ts:80 (m) | - | S2b |
| `western_ashmere.test.ts` | D | Western Ashmere route (rooms dropped) | - | S2b |
| `c6_expedition.test.ts` | K | expedition saves, forged transitions, failed/lost COMMIT | r9c_interactions | S2b |
| `crows.test.ts` | K | crow receipts, forged occurrence, COMMIT faults | r9c_interactions | S2b |
| `d10_knowledge.test.ts` | K | knowledge rows forged/failed/lost | r9c_interactions | S2b |
| `d9.test.ts` | K | bell cue reopen, uncertain COMMIT | r9c_interactions | S2b |
| `dialogue_hub.test.ts` | K | hub answer failed/lost COMMIT | r9c_interactions | S2b |
| `head_rollback.test.ts` | K | head clock behind newest receipt refuses | toolbox_showcase | S2b |
| `patrol.test.ts` | K | patrol receipts, forged rows, COMMIT faults | r9c_interactions | S2b |
| `transport.test.ts` | K | ferry receipts, forged custody, COMMIT faults | r9c_interactions | S2b |
| `water.test.ts` | K | water receipts, deadline settle, COMMIT faults | r9c_interactions | S2b |
| `wren_escort.test.ts` | K | escort save corruption, Rejoin reopen | r9c_interactions | S2b |
| `__tests__/dream-host.test.ts` | K | helper | r9c_interactions | S3a |
| `__tests__/food-host.ts` | K | helper | r9c_interactions | S3a |
| `__tests__/practical-host.ts` | K | helper | r9c_interactions | S3a |
| `dream.test.ts` | K | dream checkpoints reopen, forged receipts, COMMIT | r9c_interactions | S3a |
| `food.test.ts` | K | Eat receipts, forgeries, COMMIT faults | r9c_interactions | S3a |
| `infirmary.test.ts` | K | exchange receipts/COMMIT/corruption | r9c_interactions | S3a |
| `practical_skills.test.ts` | K | skills-save receipts/COMMIT | r9c_interactions | S3a |
| `service.test.ts` | K | service receipts/forgeries/COMMIT | r9c_interactions | S3a |
| `missing_child.test.ts` | D | Q1 story flows; reward atomicity covered by reward_storage.test.ts:27 and :85 (m) | - | S3b |
| `wisp.test.ts` | D | wisp riddle saves: wren_riddle.test.ts:189 forged evidence, :341 failed/lost COMMIT (m, K) | - | S3b |
| `__tests__/bell-setup.test.ts` | K | helper | r9c_interactions | S3b |
| `__tests__/priory-fixture.ts` | K | helper | codex_sampler | S3b |
| `bell.test.ts` | K | bell-save forged/lost receipts (Ashmere-keyed production code) | r9c_interactions | S3b |
| `bell_receipts.test.ts` | K | bell COMMIT uncertainty/forgeries | r9c_interactions | S3b |
| `finale.test.ts` | K | finale-save reopen at every line | r9c_interactions | S3b |
| `priory.test.ts` | K | topics-save Read receipts, forgeries, COMMIT | codex_sampler | S3b |
| `quest_started_at.test.ts` | K | started_at must be past LogicalTime | r9c_interactions (via bell-setup) | S3b |
| `readable_alias_book.test.ts` | K | aliased Read place offer survives redraw | codex_sampler | S3b |
| `vesper_message.test.ts` | K | message receipts/custody/COMMIT; drop v010->v012 migration test | r9c_interactions | S3b |
| `wren_riddle.test.ts` | K | riddle-save receipts/COMMIT | r9c_interactions | S3b |
| `__tests__/chandlers-setup.test.ts` | D | helper (Chandler's Debt dropped) | - | S3c |
| `chandlers_debt.test.ts` | D | deadline receipts: quest_deadline.test.ts:100, :119 failed/lost COMMIT, :153 forged row (m) | - | S3c |
| `chandlers_debt_forged.test.ts` | D | forged deadline receipts: quest_deadline.test.ts:153 (m) | - | S3c |
| `chandlers_debt_rows.test.ts` | D | forged rows: quest_deadline.test.ts:153 (m) | - | S3c |
| `chandlers_debt_turnin.test.ts` | D | forged turn-in: quest_deadline.test.ts:153 (m) | - | S3c |
| `commerce.test.ts` | D | shop receipts: cold reopen two_shops.test.ts:152, forged receipt :169, failed COMMIT prices.test.ts:59 (all m) | - | S3c |
| `character_choice.test.ts` | K | creation receipt, forged ancestry, COMMIT | r9c_interactions | S3c |
| `light.test.ts` | K | fuel receipts/COMMIT/forged refills | r9c_interactions | S3c |
| `light_book.test.ts` | K | Book binds Refuel supply, Douse when worn | r9c_interactions | S3c |
| `liquid.test.ts` | K | liquid-save provenance, COMMIT | r9c_interactions | S3c |
| `training.test.ts` | K | lesson receipts/forged/COMMIT | r9c_interactions | S3c |
| `r9c_creatures_transport.test.ts` | R | comment links only | update links | S8 |
| `r9c_custody_terminal.test.ts` | R | comment links only | update links | S8 |

## Mobile app (mobile/app)

Paths under `mobile/app/`. (m) = mobile authority layer.

| File | Bucket | Break / reason | Target | Slice |
|---|---|---|---|---|
| `book/__tests__/polish-book.test.ts` | R | helper default fixture | cellar_sampler | S1 |
| `book/item_detail.test.ts` | R | item results order | cellar_sampler | S1 |
| `book/live_actions.test.ts` | R | captured controls across pulses | cellar_sampler, ferry_sampler | S1 |
| `book/model.test.ts` | R | buttons model | items_sampler | S1 |
| `book/reward_storage.test.ts` | R | Put pair/freshness | cellar_sampler | S1 |
| `book/touch.test.ts` | R | Lantern by touch (ferry text) | lantern_proof, ferry_sampler | S1 |
| `book/hounds.test.ts` | K | instance-bound Attack, pelt Contents | r9c_interactions | S2a |
| `book/dream.test.ts` | K | Book dream routing over uncertain COMMIT | r9c_interactions | S3a |
| `book/food.test.ts` | K | Book Eat returns World once | r9c_interactions | S3a |
| `book/infirmary.test.ts` | K | Book patch controls exact targets | r9c_interactions | S3a |
| `book/practical_skills.test.ts` | K | Book teacher detail offer | r9c_interactions | S3a |
| `book/notice_board.test.ts` | D | board/Study/Elspeth routes (story); Read covered by readable.test.ts (book) | - | S3b |
| `book/hostile_refusal.test.ts` | K | one test on v042 (buy reason is a word) | toolbox_showcase | S3b |
| `book/pass1_ui4.test.ts` | K | item page option order, Lift, purse note | toolbox_showcase | S3b |
| `book/polish.test.ts` | K | polish picks (corpse Take, map focus, retry) | toolbox_showcase | S3b |
| `book/polish_detail.test.ts` | K | pickup/Give/Drop returns; locks+sampler parts rename | toolbox_showcase + locks_sampler + cellar_sampler | S3b |
| `book/priory.test.ts` | K | nested book Item Read restore | codex_sampler | S3b |
| `book/readable.test.ts` | K | Book Read receipts/recovery | codex_sampler | S3b |
| `book/riddle.test.ts` | K | NPC tile riddle controls | r9c_interactions | S3b |
| `book/shop.test.ts` | K | shop detail binds item/merchant/quote | toolbox_showcase | S3b |
| `book/training.test.ts` | K | Character page attributes/qualifications | toolbox_showcase | S3b |
| `chapter.test.ts` | K | app shell opens showcase save, refuses old pinned save, pause/resume | toolbox_showcase (old-save case via a changed showcase bundle) | S3b |
| `book/liquid.test.ts` | K | Book liquid pairs/freshness | r9c_interactions | S3c |
| `walkthrough/ashmere_missing_child.walk.ts` | D | retired chapter contact-sheet route | - | S8 |
| `walkthrough/ashmere_sampler.walk.ts` | D | sampler precedent route (owner playtests showcase) | - | S8 |
| `tests/steps.ts` | R | comment only | - | S8 |

## Elixir tests and KAT scripts (test/)

| File | Bucket | Break / reason | Target | Slice |
|---|---|---|---|---|
| `test/fixtures/reward_storage/README.md` | R | path text | cellar_sampler | S1 |
| `test/loka/cartridge_chapters_hash.py` | R | KAT generator | chapters_sampler | S1 |
| `test/loka/cartridge_containers_hash.py` | R | KAT generator | items/locks/cellar samplers | S1 |
| `test/loka/cartridge_cross_kernel_test.exs` | R | compiled artifacts identical in TS | renamed samplers | S1 |
| `test/loka/cartridge_journal_hash.py` | R | KAT generator | journal_sampler | S1 |
| `test/loka/cartridge_reward_storage_hash.py` | R | KAT generator | cellar_sampler | S1 |
| `test/loka/cartridge_sampler_hash.py` | R | KAT generator | cellar_sampler | S1 |
| `test/loka/cartridge_scene_hash.py` | R | KAT generator | scene_sampler | S1 |
| `test/loka/content_attributes_test.exs` | R | attributes compile/refusals | hello_sampler, resource_sampler | S1 |
| `test/loka/content_calendar_test.exs` | R | calendar compiler | ferry_sampler | S1 |
| `test/loka/content_chapters_test.exs` | R | chapters compiler + KAT | chapters_sampler | S1 |
| `test/loka/content_death_test.exs` | R | corpse compiler | cellar_sampler | S1 |
| `test/loka/content_dusk_test.exs` | R | check/failure outcome refusals + KAT | check_sampler | S1 |
| `test/loka/content_errand_test.exs` | R | quest compiler + KAT | errand_sampler | S1 |
| `test/loka/content_escort_test.exs` | R | escort compiler | ferry_sampler | S1 |
| `test/loka/content_ferry_test.exs` | R | schedule/dialogue/story point/elapsed compiler + KAT | ferry_sampler | S1 |
| `test/loka/content_gate_test.exs` | R | barrier compiler + KAT | gate_sampler | S1 |
| `test/loka/content_green_test.exs` | R | reaction compiler + KAT | green_sampler | S1 |
| `test/loka/content_items_test.exs` | R | item/carrying compiler + KAT | items_sampler | S1 |
| `test/loka/content_journal_test.exs` | R | journal compiler + KAT | journal_sampler | S1 |
| `test/loka/content_locks_test.exs` | R | item barrier compiler + KAT | locks_sampler | S1 |
| `test/loka/content_raid_test.exs` | R | API floors | hello_sampler | S1 |
| `test/loka/content_recipes_test.exs` | R | recipe compiler refusals + KAT | recipe_sampler | S1 |
| `test/loka/content_rest_test.exs` | R | position fact, recovery compiler + KAT | position_sampler, ferry_sampler | S1 |
| `test/loka/content_reward_storage_test.exs` | R | reward compiler + KAT | cellar_sampler | S1 |
| `test/loka/content_riddle_test.exs` | R | riddle compiler | ferry_sampler | S1 |
| `test/loka/content_road_test.exs` | R | resources compiler + KAT | resource_sampler | S1 |
| `test/loka/content_rooms_test.exs` | R | rooms/details/facts compiler refusals + KATs | rooms/details/facts samplers | S1 |
| `test/loka/content_sampler_test.exs` | R | sampler KAT, NPC HP compiler | cellar_sampler | S1 |
| `test/loka/content_scenes_test.exs` | R | scene compiler + KAT | scene_sampler | S1 |
| `test/loka/content_test.exs` | R | one diagnostic per code; mix loka.compile | hello_sampler | S1 |
| `test/loka/content_variants_test.exs` | R | variants compiler | items_sampler | S1 |
| `test/loka/content_wear_test.exs` | R | slot compiler + KAT | wear_sampler | S1 |
| `test/loka/system_graph_test.exs` | R | cartridge map lists authored files | facts_sampler, rooms_sampler | S1 |
| `test/loka/cartridge_missing_child_hash.py` | D | KAT generator of retired chapter | - | S4 |
| `test/loka/cartridge_missing_child_v015_hash.py` | D | KAT generator of retired chapter | - | S4 |
| `test/loka/cartridge_missing_child_v016_hash.py` | D | KAT generator of retired chapter | - | S4 |
| `test/loka/cartridge_missing_child_v017_hash.py` | D | KAT generator of retired chapter | - | S4 |
| `test/loka/cartridge_missing_child_v026_hash.py` | D | KAT generator of retired chapter | - | S4 |
| `test/loka/cartridge_missing_child_v027_hash.py` | D | KAT generator of retired chapter | - | S4 |
| `test/loka/content_bleed_test.exs` | K | bleed/bandage declaration bounds | r9c_interactions | S4 |
| `test/loka/content_climb_test.exs` | K | one test: patrol over climb face refused | climb_sampler + r9c_interactions | S4 |
| `test/loka/content_d10_test.exs` | K | map/Knock refusals before artifact | r9c_interactions | S4 |
| `test/loka/content_d9_test.exs` | K | cue/suppression refusals | r9c_interactions | S4 |
| `test/loka/content_deer_test.exs` | K | deer plan/bundle refusals | r9c_interactions | S4 |
| `test/loka/content_dreams_test.exs` | K | Rest dream refusals (dream_annex dropped: use inn_rooms/dream_of_the_fen) | r9c_interactions | S4 |
| `test/loka/content_expedition_test.exs` | K | expedition edge refusal | r9c_interactions | S4 |
| `test/loka/content_first_search_test.exs` | K | quest reaction refs/owners | r9c_interactions | S4 |
| `test/loka/content_food_test.exs` | K | held-food refusals | r9c_interactions | S4 |
| `test/loka/content_hidden_passage_test.exs` | K | one test: patrol/expedition over hidden face refused | hidden_sampler + r9c_interactions | S4 |
| `test/loka/content_light_test.exs` | K | fuel/dark text refusals, API1.19 | r9c_interactions | S4 |
| `test/loka/content_liquids_test.exs` | K | liquid compiler refusals (items part rename; chapter part) | items_sampler + r9c_interactions | S4 |
| `test/loka/content_missing_child_test.exs` | K | KAT test D; 10 refusal tests (ancestry, scene detail, shop, exchange, hound area, deer hide, crow corridor/roles, wander, flight) move to r9c base | r9c_interactions | S4 |
| `test/loka/content_notice_boards_test.exs` | K | board refs/catalog refusals | identity_sampler (boards) | S4 |
| `test/loka/content_patrol_test.exs` | K | patrol route/ownership refusals | r9c_interactions | S4 |
| `test/loka/content_practical_skills_test.exs` | K | careful/discount refusals | r9c_interactions | S4 |
| `test/loka/content_priory_test.exs` | K | book metadata/topic refusals | codex_sampler | S4 |
| `test/loka/content_services_test.exs` | K | service funding/provider refusals (maud_offer dropped: adapt) | r9c_interactions | S4 |
| `test/loka/content_standing_test.exs` | K | standing API floor, hostile speaker warns (guard dropped: use another NPC) | r9c_interactions | S4 |
| `test/loka/content_training_test.exs` | K | training refusals | r9c_interactions | S4 |
| `test/loka/content_transports_test.exs` | K | ferry/free lesson refusals | r9c_interactions | S4 |
| `test/loka/content_water_test.exs` | K | water route refusals (pool_bottom -> well_bottom only) | r9c_interactions | S4 |
| `test/loka/content_wisp_test.exs` | K | riddle source refusals, once-proven fact assign | r9c_interactions (vesper riddle) | S4 |
| `test/loka/cartridge_r9c_interactions_hash.py` | D | reads v042; freeze r9c fixture (PM choice, see risks) | - | S8 |

## Scripts and workflows

| File | Bucket | Break / reason | Target | Slice |
|---|---|---|---|---|
| `bin/red_controls.exs` | R | features red control path ashmere_details/transcripts/skills.jsonl | details_sampler path | S1 |
| `.github/workflows/ci.yml` | D | e1-recorder job builds v042 artifact (line 137) | retarget recorder to r9c or delete job | S5 |
