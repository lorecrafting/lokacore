# Runtime-built content: rooms made during play (Settle S2/S3 design study)

Read-only study, branch main @ c2b089dc, 2026-10-11. Facts cite file:line or doc section; proposals are marked.

## 0. Facts the design rests on

| Fact | Where |
|---|---|
| Rooms are immutable definitions inside `World`, keyed by room EntityId, with `roomIds` mapping DefinitionRefString to EntityId; `World.cartridge` is readonly. `State` has no room section. | `kernel/ts/src/runtime/decision.ts:122-128` (World), `:61-88` (State) |
| A `RoomDefinition` is `{key, title, description, exits {north..down: Connection}, details?, actions?, tags?, cues?, sanctuary?, variants?, dark_description?}`. Exits are static content. | `kernel/ts/src/contracts.gen.ts:218` |
| Runtime-created entities already exist: `State.created` holds `EntityIdentity` rows (corpses, spawned hounds, pelts); `hydrate` derives their entities from the identity row plus the pinned cartridge template, and load refuses invalid rows as `save_corrupt`. "Derived corpse definitions are rebuilt from durable identity and the pinned cartridge only." | `kernel/ts/src/runtime/created.ts:2`, `:23`; save.md "Created corpse rows (M5-B)" |
| IDs are deterministic: `id(worldContextId, commandId, ordinal)` is a UUIDv8 of SHA-256 over `["loka-id-v1", context, commandId, ordinal]`; one allocator per decision. | `kernel/ts/src/foundation/id_source.ts:1-18`; protocol.md "Numeric profile" (`decision.ts:244`) |
| The save is SQLite (`expo-sqlite`; OPFS in the browser): tables `head`, `state_row (section, key) -> value`, `receipt`, `save` (pin: cartridge id, version, content hash, lock, `world_context_id`), `report`, `trace`, `observation`. Loading rebuilds the world from the release's cartridge under the pinned context, then applies rows. | save.md "The save file" (`store.ts:50`, `:99`); web-preview.md `:19` |
| Receipts store the Command and DecisionResult; replay returns the stored result without deciding again; the committed delta's rows are written in one transaction with head and receipt. | save.md "Receipts", "Commit, fence, reconcile" |
| The exact release pin is refused on mismatch; pre-production has no migration. | save.md "Opening a story" |
| Registered invariants include `exits_resolve`, `player_in_one_room`, `containment_acyclic`, `one_container_per_item`. | `protocol/invariants.json` |
| The GameView builds the place from `describe` (variants) and exits in compass order; the Book consumes only the GameView. | `kernel/ts/src/view/view.ts:46-47`, `:89`, `:113`; architecture.md "Book presenter" |
| Items can be moved to a roomless terminal consumed holder (D4); row 41 decay reuses it. | MECHANICS-TOOLBOX.md row 41 |
| Settle rows: S1 furnishing (depends G1, G7, 24), S2 construction "L; runtime-created rooms and exits change the world-graph contract: decision record first" (depends 20b, G7), S3 settlement, S4 defence. G7 locks already name access types `furnish`, `build`, `control`; row 24 property; 20b timed job claim and cancel: all M11. Row 41 decay: M13. | MECHANICS-TOOLBOX.md rows G7 (`:157`), 24 (`:159`), 20b (`:163`), 41 (`:176`), S1-S4 (`:192-195`) |
| The engine owns no world numbers; cartridges declare them. | docs/world-parameters.md; S2 row text "the engine owns no numbers" |
| Mid-save content rules proposed earlier: add-only, tombstone never delete, versioned definitions; dials not rules. | docs/rnd/ai-world-shaping-2026-10-11.md A2, A3 |

## 1. Where built content lives

| Option | What it means | Decay and change | Replay | Save size | Realm sharing | AI structures later | Verdict |
|---|---|---|---|---|---|---|---|
| (a) Cartridge JSON | the build writes a new room into the content artifact; the hash changes | every change recompiles and re-pins; the save then opens on a different hash and is refused today (save.md "Opening a story") | breaks: receipts were decided on the old content | artifact grows per house (4 MiB cap, cartridge.md "Compiler") | every player would need a different artifact | contradicts "closed semantics, open composition" | reject |
| (b) Save state only | the build writes a full room (title, description, exits) into a state row | easy: it is state | works: a receipted delta | one full room per house | fine | the AI would write prose and shape into state with no compiler check | partial |
| (c) Cartridge blueprints + save instances | the cartridge declares `blueprints` (room shape, text keys, bounds, costs, decay) and `sites` (authored rooms with free directions); the build writes an identity row `{blueprint, site, direction, owner, stage, condition...}`; `hydrate` derives the room from blueprint plus row | easy: stage and condition are row fields; decay is a status and a reaction | works: same ids from `(context, commandId, ordinal)`; the room is rebuilt from the row and the pinned blueprint, exactly as corpses are (`created.ts:2`) | tens of bytes per house | the blueprint travels by content hash; the instance is shard state | AI picks and places blueprints (ring 1); new blueprints arrive by the add-only patch of A2 | **recommend** |

**Recommendation (proposal).** The owner's instinct is right about the instance and half-right about the content file: the *instance* lives only in the save, so it can decay, change and be razed without touching the cartridge; the *shape* must come from the cartridge as a blueprint, because the engine has no free text (every line is a catalogued text key, cartridge.md "Text"; trap 4), every number must be authored content (world-parameters.md), and the compiler is the only place bounds, text keys and exit reciprocity are checked. This is precisely how the engine already treats corpses and spawned hounds: durable identity in `State.created`, definition from the pinned template. Option (c) is (b) with the shape validated at compile time.

## 2. Data model

**Cartridge side (proposal).** Owned by a new capability `construction@1`, opt-in, both compilers.

| Declaration | Fields | Compiler and loader checks |
|---|---|---|
| `blueprints/<key>.json` | `title`, `description`, optional `variants` keyed by `stage` and `condition` band (ruin, worn), `tags`, `details`, `fixtures` (item definitions placed at completion: bed, chest), `materials [{item, count}]`, `labour` (game hours; job 20b), `decay {every, by}` in real minutes, `repair [{item, count}]`, `max_per_owner`, `extends` (may another blueprint attach to this one: v1 `false`) | text keys catalogued; items of this cartridge; `materials` non-empty or `labour` > 0; `decay.every` safe like `regen.every` (cartridge.md "Compiler") |
| Room `site` field | `{directions: [north, ...], blueprints: [refs], locks?}` on an authored room | each listed direction has no authored exit (`SITE_EXIT_CONFLICT`); blueprints resolve |
| `world.construction` | `max_total`, `max_per_owner` | positive safe integers |

**State side (proposal).** Reuse `State.created` with a new `EntityOrigin` kind `built` rather than a new section, so load validation, ordering and `hydrate` extend one path (`created.ts:23`).

| Field | Meaning |
|---|---|
| id (the row key) | the built room's EntityId, minted `id(context, commandId, ordinal)` by the completing command |
| `origin {kind: "built", blueprint, site, direction, owner}` | durable identity: never changes |
| `stage` | `under_construction`, `complete`, `ruin`, `razed` |
| `condition` | 0..100; decay lowers it, repair raises it |
| `built_at`, `job` | logical time; the 20b JobId while under construction |

Derived at `hydrate`: a `RoomDefinition` from the blueprint with the row's stage and condition selecting the description variant; the room's `key` is `built/<id>`; two connections: `site.direction -> room` and `room.opposite -> site`; `World.rooms[id]` and `roomIds["built/<id>"]`. Fixtures become ordinary items with `origin.kind: built_fixture` contained in the room; the room is a containment target like any authored room (`State.containers`).

**How existing systems see it.** Movement, sight, the GameView's `exits()` and the `exits_resolve` invariant read room exits from `World.rooms`; the S2 row calls this "the world-graph contract" because today those exits are static content. The change is one reader: `exits(world, roomId)` returns the authored exits plus built connections from state, used by `mechanics/movement`, `view.ts:219`, the map (D10 positions: a built room's position is the site's plus the direction offset) and the invariant. Containment, light, statuses on rooms (the room is a status holder like any other), NPC movement and population wander already work on EntityIds, so a hydrated built room needs nothing from them; schedules and quest objectives reference rooms by DefinitionRef, so in v1 authored content cannot name a built room (see §7).

**Forbidden (proposal).** Building over an authored room; adding an exit to an authored room in a direction that already has one (`SITE_EXIT_CONFLICT` at compile time, `invalid_state` at runtime); removing or redirecting any authored exit; building off a built room when the blueprint's `extends` is false (v1 always); exceeding the caps; a second structure in the same site direction while the first is not `razed`; reusing a razed room's id.

## 3. Lifecycle

| Phase | Mechanism (proposal) | Reuses | Conservation |
|---|---|---|---|
| Start | recipe `build {blueprint}` at a site (target: the site's detail), G7 `build` access on the site; policy checks caps and materials in reach | action_recipe, G7, caps leaf `built_count {owner, at_least}` | materials move to the consumed holder in the same delta (`one_container_per_item`) |
| Construction | the recipe writes the row at `under_construction` and opens a 20b job due at clock + `labour`; the site shows an authored "framing" detail variant; cancel returns the materials (20b cancel path) | engine jobs (`mechanics/bleed/job.ts` pattern), 20b claim and cancel | returned materials come back from the consumed holder: needs a `consumed -> holder` move, the same op 19b replenish introduces |
| Completion | the job's `run_job` sets `complete`, mints the room id (its own CommandId, `jobCommandId`, so replay mints the same), places fixtures, emits `custom_event built` for reactions | job completion, `created` hydrate, W1 reactions | fixtures are created items, declared in the blueprint (a registered source, as spec 09 asks) |
| Use | enter, rest, store; G7 locks `enter`, `put`, `get`, `furnish` with `owner` and `role` leaves; S1 furnishing | G7, containment, position regen | none |
| Upkeep and decay | a `weathering` status on the room (G3 status holder) with expiry every `decay.every` real minutes; its expiry reaction lowers `condition` by `decay.by`; at 0 the stage becomes `ruin`: description and exits stay, locks stop holding, fixtures keep working or not per variant | G3 statuses, W1 `status_expired` reaction, row 41 pattern | none |
| Repair | recipe `repair` consuming `repair` materials, condition back to 100, stage `complete` | action_recipe | materials to the consumed holder |
| Demolish | owner action `raze`: items inside move to the site room, NPCs inside move to the site, stage `razed`, exits removed from the layer; the row stays as a tombstone so the id is never reused and old receipts still resolve | containment moves, escort-style NPC relocation, A2 tombstone rule | items never vanish; only the structure does |
| Ownership and trade | row 24 buys the plot (the site's G7 `build` grant); transfer is a G7 grant change; S3 later adds residents by population plans whose `home` may be a built room | rows 24, G7, C3 populations | none |

Nobody is ever trapped: a ruin keeps its exits; a raze moves occupants first; a player standing in a room that becomes a ruin keeps standing there (`player_in_one_room` holds).

## 4. Persistence and integrity

| Question | Answer (proposal, on existing mechanisms) |
|---|---|
| How built instances enter the save | As `created` rows in `state_row`, written in the one changed-row transaction with head, RNG and receipt (save.md "Commit, fence, reconcile"); no new table, no format bump, exactly as corpse rows (save.md "Created corpse rows"). |
| How replay rebuilds them | Receipt replay returns stored results and allocates nothing (save.md "Receipts"); a fresh re-decision mints the same id because `id(context, commandId, ordinal)` and `jobCommandId(jobId, due)` are pure (`id_source.ts:14-30`). Load runs `hydrate(world, state, true)` and derives every built room from its row and the pinned blueprint; a row whose blueprint, site or direction does not resolve, or collides, is `save_corrupt`, as `created.ts:23-45` does for hounds and corpses. |
| What the pin means | Unchanged: cartridge id, version, content hash, lock, `world_context_id` (save.md "The save file"). Built content is state under that pin, so the pin still answers "which rules and blueprints decided this save". |
| Blueprint changes in a later cartridge | Pre-production: a new content hash is a new release and the save is refused as today. Later: keep blueprints versioned by key (`hut@1`, `hut@2`); a row names the version it was built from; a later cartridge must carry every blueprint version a save may hold, or load refuses. Changing a blueprint's text or decay in place is a dial (A3) and is safe; removing one is a tombstone rule violation (A2). |
| Save-size bounds | One row per structure (identity plus stage and condition, well under 1 KiB) plus fixtures as ordinary items. Caps are authored: `world.construction.max_total`, `max_per_owner`, `max_per_site` (one per site direction). The loader refuses a save over the pinned caps as `save_corrupt`; admission refuses the build that would exceed them as `invalid_state`. |
| Trace and receipts | Nothing new: `trace.command` records the committed events; `custom_event built` and `razed` make structures countable from the trace. |

## 5. Engine changes, smallest first

| # | Change | Size | Touches |
|---|---|---|---|
| 1 | Layered exits reader: `exits(world, roomId)` = authored exits plus built connections from `created` rows; used by movement, sight, `view.ts:219`, map positions and the `exits_resolve` invariant. The S2 "world-graph contract" change; everything else sits on it. | M | `mechanics/movement`, `view/view.ts`, `runtime/invariants.ts`; `protocol/invariants.json` text; no schema change |
| 2 | `EntityOrigin` kind `built` and `hydrate` derive of a RoomDefinition from a blueprint; load validation; `movable` false for built rooms and fixtures | M | `protocol/entity.schema.json` (EntityIdentity, EntityOrigin), `runtime/created.ts`, `mobile/authority/local-story/store.ts` load path; Elixir contract twin for the schema |
| 3 | Blueprint and site schema in the compiler (Elixir) and loader (TS): `BuildingBlueprint`, room `site`, `world.construction`; diagnostics `SITE_EXIT_CONFLICT`, references, text keys, caps; capability `construction@1` in the registry | M | `protocol/cartridge.schema.json`, `capability_registry.json`, `lib/loka/content/*.ex`, `kernel/ts/src/content/cartridge_construction.ts`, `bin/features.exs` row; `kernel_api` bump |
| 4 | Recipe steps `build.start {blueprint}` and `build.raze`, delta op `built.set` with expected-row precondition (the `levelling.set` pattern), both kernels' compose; policy leaf `built_count` | M | `protocol/reaction.schema.json` or recipe steps, `foundation/compose.ts`, `lib/loka/core/compose.ex`, `mechanics/policy.ts` |
| 5 | Job completion `build.complete` on a 20b job; fixtures created at completion | S once 20b exists | `mechanics/service` jobs, `created.ts` |
| 6 | Decay: a blueprint-declared status on the room with an expiry reaction stepping `condition` | S | content on G3 and W1; one `built.set` from a reaction step |
| 7 | Map: a built room's `MapPosition` derived from the site's position plus direction; Book draws it as any discovered room | S | `view/knowledge.ts`, D10 positions; Book unchanged (consumes GameView) |
| 8 | Save validators and red controls: planted collision, dangling site, over-cap | S | `store.ts` load, tests |

The Book needs no new component: a built room is a place with a title, description, exits, items and actions, all already in the GameView.

## 6. Planned slot and slicing

**Split the foundation from S2 (proposal).** Changes 1-3 are a "built rooms layer" that neither needs materials, labour nor decay, and that S1 furnishing, Homestead and row 24 all benefit from (an owned room to furnish). Place it **right after M11**, before Homestead: M11 brings G7 locks (ownership and `build` access), row 24 property (buying a plot) and 20b jobs (construction time), which are its dependencies. S2 proper (materials, labour, stages) then lands in Homestead, S3 settlement and S4 defence stay last.

| Slice | Content | Proof | Depends on |
|---|---|---|---|
| 1. Hut on a plot | changes 1-4 minimal: one blueprint `hut`, one authored site in `cartridges/settle_sampler` (and a showcase settlement district later), recipe `build` with instant completion, no materials | the hut is entered, its exit back resolves, it persists across save and reload, replay of the same receipts mints the same room id, the sim's `exits_resolve` and `player_in_one_room` hold over seeds that build | G7 (locks on the site), after M11 |
| 2. Time and timber | materials consumed to the consumed holder, 20b job with labour, `under_construction` detail variant, cancel returns materials, caps and `built_count` leaf | the build refuses without timber; the room appears two game hours later via the dev clock; cancel returns the timber; the third hut on one plot is refused | 20b, 19b's consumed-to-holder move |
| 3. Weather and ruin | `weathering` status, decay reaction, repair recipe, raze with occupant relocation, map position | after N real minutes the hut reads worn, then ruin; repair restores it; raze moves the chest's items to the plot; a player inside a ruin can still leave | G3, W1 (done), row 41 pattern |

## 7. Open questions for the owner

| Question | Recommended answer |
|---|---|
| Save only, content file, or both? | Instance in the save; shape as a cartridge blueprint (option c). Not the content file for instances: the hash pin and replay forbid it. |
| May authored content (schedules, quests) name a built room? | Not in v1: rooms are referenced by DefinitionRef at compile time. Use G7 roles and `built_count` leaves instead; revisit for S3 residents (a population plan whose `home` accepts a blueprint ref, resolved to the owner's built room). |
| Can players name their house? | Not as engine text in v1 (no free text in state; trap 4; Realm moderation trap 9). Offer a choice among authored name keys per blueprint; a Book-side local label later if wanted. |
| Does a ruined house disappear? | No. Ruin is a stage with its own description; exits stay; raze is a deliberate owner action and leaves a tombstone row. |
| Can you build off a built room (streets, wings)? | v1 no (`extends: false`); S3 raises it with a depth cap, so a town is sites plus one ring of structures. |
| Who pays upkeep and how fast is decay? | Authored per blueprint in real minutes, gentle (trap 6); a blueprint may declare none. Upkeep as a periodic coin sink only when row 24's bank exists. |
| One site, one structure? | Yes: one structure per site direction; a razed one frees the direction. |
| Where does this sit against the AI world-shaping work? | Same layer: an AI district adds blueprints and sites by add-only patch (A2) and places structures through the same `build` path (ring 1), so no second mechanism. |
