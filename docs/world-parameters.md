# World parameters: engine mechanics, cartridge numbers

**Rule:** [AGENTS.md, Mechanics vs numbers](../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently)
([owner decision](decisions/owner-decision-world-parameters-2026-10-02.md)). A world value may also
be an engine default that a cartridge can override; encoding constants stay in the engine with the
safety budgets (section 2); a presenter bakes no world value (section 3). Reviewers reject a change
that adds one; a slice that moves a value below cites its id.

This inventory was taken at origin/main 675b2d7 (audit, 2026-10-02). R6P Untime (#110) then replaced
P1's HH:MM with the double hour's earthly branch (it still assumes a 24-hour day, so it belongs to
W6) and removed P2's wait list. When a row moves to content, mark it DONE with the PR.

Scope read: `kernel/ts/src/**` (all rules, view, actions, dialogue, quest, reaction, policy, behavior, resource, compose, fresh), `lib/loka/**` (compiler + core twins), `mobile/app`, `mobile/authority`, plus the numeric bounds in `protocol/*.schema.json` that fix world values.
Method: ast-grep `kind: number` sweep (plus a 0/1 pass over every rule and ActionSet file) over kernel + mobile (ts and tsx), numeric grep over lib/loka, jq sweep of schema `minimum/maximum/maxItems`, then a read of every rule for implicit values (a missing `time.advance` = a hard-coded zero cost).

Legend, "today": **HC** hard-coded; **DEF** engine default a cartridge can override; **CT** already content.
Priority: **C1** before chapter one; **TM** with the time-model slice; **L** later.

## 1. World parameters found

| id | value | path:line | what it controls | today | recommendation | prio |
|---|---|---|---|---|---|---|
| W1 | `amount: 1` | kernel/ts/src/rules/movement.ts:93 (used :72) | mv each move costs | HC | `cartridge.json world.movement.cost` (default), per-exit `cost` in room exits, per-room `terrain` tag to cost table (`world.terrain.<tag>.cost`; spec 00 §4.1: average of two rooms) | C1 |
| W2 | `'mv'` | kernel/ts/src/rules/movement.ts:71 | which pool pays a move | HC | same field: `world.movement.cost = {resource, amount}` | C1 |
| W3 | no `time.advance` (0 s) | kernel/ts/src/rules/movement.ts:51 | game time a move takes | HC (zero) | `world.movement.duration`, per-exit/terrain override | TM |
| W4 | 0 s for look, scan, examine, take, drop, give, open, close, lock, unlock, talk, choose, close_choice, accept_quest | kernel/ts/src/rules/description_variant.ts:12, :19; movement.ts:30; containment.ts:45, :50, :57; barrier.ts:50; dialogue.ts:63, :84, :117; quest.ts:20 | time cost of each engine verb | HC (zero) | `cartridge.json world.verbs.<verb>.duration` (optional `costs`, as RecipeCost); recipes already have it (W15) | TM |
| W5 | `3600` (s per hour) | kernel/ts/src/behavior.ts:18, :28; policy.ts:41; compose.ts:89; lib/loka/core/compose.ex:110; protocol/command.schema.json LogicalTime (PM ruling "until calendar@1 R8") | length of a game hour | HC | `cartridge.json calendar.units_per_hour` (calendar@1 already exists, has only `start`) | TM |
| W6 | `24` / `86400` (hours/day) | behavior.ts:18, :25, :29; policy.ts:41; schemas: policy.schema time_window from/to max 23, entity.schema daily_schedule keys 0-23, cartridge.schema Calendar.start max 86399 | length of a day; day wrap of schedules and windows | HC (engine + schema) | `calendar.hours_per_day`; schema bounds become loader checks against the calendar | TM |
| W7 | `start ?? 0` (midnight day 1) | kernel/ts/src/fresh.ts:39 | world start time | CT (`calendar.start`, Lantern/ferry/green use 21600); engine default 0; schema caps it to day 1 | keep; lift the 86399 cap with W6; add `calendar.start_day` if multi-day needed | L |
| W8 | regen tick = every hour boundary (`/3600`) | compose.ts:89; lib/loka/core/compose.ex:110 | how often `gain` is applied | HC | `resources.json <pool>.gain_every` (units), default one calendar hour | TM |
| W9 | gain hp 5, ma 4, mv 18 | lib/loka/content/resources.ex:14-16 | regen per tick | DEF (resources.json) | keep as overridable default; document in cartridge guide | — |
| W10 | hp 0..20 start 20; ma 0..100 start 100; mv 0..82 start 82 | lib/loka/content/resources.ex:14-16 | pool bounds and start values | DEF (resources.json; ashmere_road overrides hp/mv) | keep as overridable default | — |
| W11 | hp/ma/mv always added; resource@1 + schedule@1 always required | lib/loka/content/resources.ex:53-69 | whether a world has these pools at all | HC (cannot opt out, only re-tune) | allow `resources.json "<pool>": null` (or `world.pools`) to drop a default pool | L |
| W12 | rest/position multipliers: absent | kernel/ts/src/resource.ts:5 (ponytail note); spec 00 §4 row "Regeneration" (sleep +1/2, rest +1/4, sit +1/8, hunger 1/4) | regen while resting/sleeping/hungry | missing | when added: `resources.json <pool>.regen.by_position.{sleeping,resting,sitting}`, `regen.hungry`; never in kernel | TM (shape) / R7 (values) |
| W13 | band cuts 100,90,...,10,0 and 11 band keys (`perfect_health`...`dying`) | kernel/ts/src/view.ts:80-92 (used :102-104) | condition band of every pool in GameView | HC (one table for all pools) | `resources.json <pool>.bands: [{at_percent, key}]` with a cartridge default `world.bands`; band text in text.json | C1 (shown on status line) |
| W14 | luck die `100` (uniform [0,100)); schema `chance` max 99 | kernel/ts/src/rules/action_recipe.ts:118; protocol/action.schema.json RecipeCheck.chance.maximum 99 | odds scale of a luck check | HC (percent scale) | acceptable mechanism (percent); per-recipe `chance` is CT. Optional later `check.out_of` | L |
| W15 | recipe `duration`, `cooldown`, `costs`, check `chance`/`difficulty`/`resource` | rules/action_recipe.ts:61-77, :117-122 | perform time, cooldown, cost, odds/DC | CT (per recipe) | none | — |
| W16 | wait: no max, no min step, no extra regen | kernel/ts/src/rules/schedule.ts:44-47 | how far one wait may jump; rest effect | HC (unbounded) | `world.wait.max` (units) optional; rest effect via W12 | TM |
| W17 | player body has no capacity, no weight | kernel/ts/src/fresh.ts:28, :37 (body never gets a `capacities` row); containment.ts:43-45 (take never checks) | inventory limit / carry weight | HC (unlimited) | `cartridge.json world.body.capacity`; later `weight` on items + `world.body.carry` (spec 00 §4 "Encumbrance", STR cap) | L |
| W18 | NPC/item capacity default `Infinity` | kernel/ts/src/rules/containment.ts:56 | how many items an NPC accepts when undeclared | DEF (per-entity `capacity` is CT) | keep | — |
| W19 | NPC schedule granularity = whole hour | behavior.ts:24-31; entity.schema daily_schedule keys 0-23 | when NPCs move | HC | keys in calendar time (`"06:30"` or units) once W5/W6 land | TM |
| W20 | `time_window` granularity = whole hour | policy.ts:41-42; policy.schema time_window 0-23 | dusk/dawn style conditions | HC | windows in calendar units, or named periods `calendar.periods.{dusk:[18,6]}` | TM |
| W21 | engine verb, talk and quest-offer priority `0` | kernel/ts/src/actions.ts:109, :135; dialogue.ts:135, :156 | presentation order of engine verbs | HC | `world.verbs.<verb>.priority` (same block as W4) | L |
| W22 | lock/unlock need `key_item` | kernel/ts/src/rules/barrier.ts:44-47 | key rule | CT (key_item per barrier); the rule itself is mechanism | none | — |

Counts: 22 rows. HC 15 (W1-W6, W8, W11, W13, W14, W16, W17, W19-W21; W14 acceptable as mechanism, so 14 to move), DEF 3 (W9, W10, W18), CT 3 (W7, W15, W22), missing 1 (W12). Priority: C1 3 (W1, W2, W13), TM 9 (W3-W6, W8, W12, W16, W19, W20), L 5 (W7, W11, W14, W17, W21).
Only `time.advance` producers today: rules/action_recipe.ts:75-77 (recipe duration) and rules/schedule.ts:47 (wait); every other verb is instantaneous.

### Spec-pinned rows (need a spec/schema amendment before code)
- W1/W2: 00 §4 amendment 2026-09-25 ("1 MV per move from R5, terrain R8") and resource.schema ResourceSpec description.
- W5/W6/W19/W20: PM ruling R5 S6 in command.schema LogicalTime ("until calendar@1 R8 the kernel fixes them"), plus schema bounds time_window 0-23, daily_schedule keys 0-23, Calendar.start <= 86399.
- W8: resource.schema ResourceSpec and delta.schema resource.adjust ("each hour boundary, floor(time / 3600)").
- W13: 04 §15 bands amendment 2026-10-01.
Correction to the brief: regeneration timing does exist (fixed hourly tick, compose.ts:89 and compose.ex:110); only rest/position multipliers are missing.

### Spec values still to come (land them as content, not kernel)
From docs/archive/spec/00-first-cartridge-design.md: terrain cost table and "average of two rooms, rounded down" (:301), mounted halves (:301), position regen bonuses and hunger quarter (:323), encumbrance STR cap halving regen (:341), sleeping takes double damage (:342; also 21 §position@1 :1606), node regrow 3 days (:415). The rounding/averaging rule is mechanism; every number and table is cartridge data.

## 2. Excluded constants (not world settings)

- **04 §5.4 composition budgets**: `LIMITS` (query_steps 32768, events 4096, operations 4096, deliveries 8192, reaction_depth 32, created_jobs 64, pending_jobs 1024, due_jobs_per_advance 1024, selector_cardinality 1024, scene_auto_advances 64, output_bytes 1 MiB), kernel/ts/src/contracts.gen.ts. Safety, spec-frozen.
- **RNG budget** `DRAWS = 8`, rules/action_recipe.ts:103. Safety budget for rejection sampling.
- **Encoding/hash/id**: canonical.ts:10-20 (SAFE 2^53-1, MAX_DEPTH 128, surrogates), lib/loka/core/canonical.ex:10, :161; sha256.ts (all); id_source.ts:34-43 (UUIDv8); rng.ts / rng.ex (xoshiro constants); `INTENT_DIGEST_VERSION`.
- **Schema sizes**: aliases/keywords/variants 16, recipe sequence 16, costs 8, room details 64, actions 64, narration lines 64, entity capacity max 1024, target_ids 8, ResourceInt 32-bit bounds, ARTIFACT_MAX_BYTES 4 MiB; checks.ex:24 `@enclosing 3` (nesting depth bookkeeping).
- **Mechanism tables**: COMPASS (decision.ts:204, from room.schema), barrier `MOVES` transitions (rules/barrier.ts:24-29), check order (target, cooldown, costs, check), target `normalize` stop-words (target.ts).
- **Host/telemetry**: trace.ts:73 OBSERVED 1000, :77 CAP 5000, :89 WRITE 2; authority.ts:209 `*1000` (µs); session.ts:21 ID_PREFIX.
- **UI layout/animation**: joystick.ts (ZOOM 2.6, CANCEL 6, TAP_MS 500, STAIR), MapDrawing.tsx, Footer.tsx, Turn.tsx, Book.tsx, pages.tsx sizes, paper.ts colours.
- **Test-only**: all `*.test.ts` seeds and fixtures (faults.test.ts SEEDS, saves.test.ts SEED, etc.).

## 3. Presenters baking world values

Repo-wide grep for `3600|86400|% 24` (excluding node_modules, tests, docs, fixtures) found only the kernel/Elixir rows above, mobile `model.ts`, and the `loka play` CLI (`kernel/ts/play`).

| id | path:line | baked value | should come from |
|---|---|---|---|
| P1 | mobile/app/book/model.ts:77-78 | `branch(t)` = double-hour branch from 3600 s per hour, `% 24` | cartridge calendar (W5/W6) via GameView, ideally a `time_label` text key/bindings |
| P2 | removed | the wait offer (whole hours, 3600 step) was removed with Wait ([record](decisions/owner-decision-untimed-lantern-2026-10-02.md)) | calendar (hours_per_day, units_per_hour) and `world.wait` (W16) |
| P3 | mobile/app/book/pages.tsx:15-29 | English DikuMUD band phrases ("is leaking guts"...) and colour tiers at cuts 80/40 | text.json band keys (`band.<key>`) and per-band tone from W13 |
| P4 | mobile/app/book/model.ts:59-64; pages.tsx:183 | `hp` is the condition pool (phrase shown on hp only) | `resources.json <pool>.condition: true` or `world.condition_pool` |
| P5 | mobile/app/book/model.ts:51-55 | story ends when every journal quest is resolved/failed/abandoned | a cartridge ending (story point / `world.ending`); already an OWNER item in the comment |
| P7 | kernel/ts/play/text.ts:224-231 (`loka play` CLI) | `clock()` "day N, HH:MM" from 86400/3600/24/60 | calendar (W5/W6) |
| P8 | kernel/ts/play/text.ts:99-103; play/main.ts:99 | `wait [hours]` 1..24, converted with `* 3600` | calendar units_per_hour / hours_per_day; `world.wait.max` (W16) |
| P9 | kernel/ts/play/text.ts:239-246 | status line lists exactly `hp`, `ma`, `mv` (other pools never shown) | iterate `world.resourceSpecs` (as view.ts does) |
| P6 | DONE | the fixed RNG seed `[1,2,3,4]` and world context of every new game: the host draws both per lineage ([#129](https://github.com/lorecrafting/lokacore/pull/129)) | not a cartridge value |
