# World parameters: engine mechanics, cartridge numbers

**Rule:** [AGENTS.md, Mechanics vs numbers](../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently)
([owner decision](decisions/owner-decision-world-parameters-2026-10-02.md)). A world value may also
be an engine default that a cartridge can override; encoding constants stay in the engine with the
safety budgets (section 2); a presenter bakes no world value (section 3). Reviewers reject a change
that adds one; a slice that moves a value below cites its id.

This inventory was taken at origin/main 675b2d7 (audit, 2026-10-02). R6P Untime (#110) then replaced
P1's HH:MM with the double hour's earthly branch (it still assumes a 24-hour day, so it belongs to
W6) and removed P2's wait list. When a row moves to content, mark it DONE with the PR.
The original inventory and counts remain a dated audit, not a current completion claim.
[Current reconciliation](decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md#current-mechanics-policy)
supersedes W3/W4/W16 duration/wait recommendations for opted-in elapsed profiles; legacy
play-time contracts stay frozen. W5/W6/W8/W19/W20 are implemented by B1; the dated audit table below records their original findings.

Scope read: `kernel/ts/src/**` (all rules, view, actions, dialogue, quest, reaction, policy, behavior, resource, compose, fresh), `lib/loka/**` (compiler + core twins), `mobile/app`, `mobile/authority`, plus the numeric bounds in `protocol/*.schema.json` that fix world values.
Method: ast-grep `kind: number` sweep (plus a 0/1 pass over every rule and ActionSet file) over kernel + mobile (ts and tsx), numeric grep over lib/loka, jq sweep of schema `minimum/maximum/maxItems`, then a read of every rule for implicit values (a missing `time.advance` = a hard-coded zero cost).

Legend, "today": **HC** hard-coded; **DEF** engine default a cartridge can override; **CT** already content.
Priority: **C1** before chapter one; **TM** with the time-model slice; **L** later.

## 1. World parameters found

| id | value | path:line | what it controls | today | recommendation | prio |
|---|---|---|---|---|---|---|
| W1 | DONE [#131](https://github.com/lorecrafting/lokacore/pull/131) | kernel/ts/src/mechanics/movement/rule.ts:75 | mv each move costs | DEF: engine default 1 mv, cartridge override `cartridge.json world.movement.cost` | LATER: per-exit `cost` in room exits, per-room `terrain` tag to cost table (spec 00 §4.1: average of two rooms; 00 §11 chapter three) | — |
| W2 | DONE [#131](https://github.com/lorecrafting/lokacore/pull/131) | kernel/ts/src/mechanics/movement/rule.ts:75 | which pool pays a move | DEF: engine default `mv`, cartridge override `world.movement.cost = {resource, amount}` | none | — |
| W3 | no `time.advance` (0 s) | kernel/ts/src/mechanics/movement/rule.ts:54 | game time a move takes | HC (zero) | Historical recommendation `world.movement.duration`; superseded for elapsed profiles: no action-time jump | TM |
| W4 | 0 s for look, scan, examine, take, drop, give, open, close, lock, unlock, talk, choose, close_choice, accept_quest | kernel/ts/src/mechanics/description_variant/rule.ts:12, :19; mechanics/movement/rule.ts:31; mechanics/containment/rule.ts:45, :50, :57; mechanics/barrier/rule.ts:41; mechanics/dialogue/rule.ts:63, :84, :117; mechanics/quest/rule.ts:10 | time cost of each engine verb | HC (zero) | Historical duration knobs superseded for elapsed profiles; nonzero recipe durations rejected. Costs remain separate (W15) | TM |
| W5 | B1 | calendar@1 `units_per_hour` | length of a game hour | CT in current chapter | authored in `cartridge.json calendar` | — |
| W6 | B1 | calendar@1 `hours_per_day` | day wrap of schedules and windows | CT in current chapter | compiler and loader check authored-hour bounds | — |
| W7 | B1 | `calendar.start` | world start time | CT in current chapter | multi-day starts are allowed; historical cartridges may omit calendar | — |
| W8 | B1 | `resources.json <pool>.gain_every` | legacy gain interval | CT in current chapter | opted fractional `regen.every` remains separate | — |
| W9 | gain hp 5, ma 4, mv 18 | lib/loka/content/resources.ex:16-18 | regen per tick | DEF (resources.json) | keep as overridable default; document in cartridge guide | — |
| W10 | hp 0..20 start 20; ma 0..100 start 100; mv 0..82 start 82 | lib/loka/content/resources.ex:16-18 | pool bounds and start values | DEF (resources.json; ashmere_road overrides hp/mv) | keep as overridable default | — |
| W11 | hp/ma/mv always added; resource@1 + schedule@1 always required | lib/loka/content/resources.ex:141-152 (`def requires`, `specs`) | whether a world has these pools at all | HC (cannot opt out, only re-tune) | allow `resources.json "<pool>": null` (or `world.pools`) to drop a default pool | L |
| W12 | rest/position multipliers: absent | kernel/ts/src/mechanics/resource.ts:5 (ponytail note); spec 00 §4 row "Regeneration" (sleep +1/2, rest +1/4, sit +1/8, hunger 1/4) | regen while resting/sleeping/hungry | missing | when added: `resources.json <pool>.regen.by_position.{sleeping,resting,sitting}`, `regen.hungry`; never in kernel | TM (shape) / R7 (values) |
| W13 | DONE [#131](https://github.com/lorecrafting/lokacore/pull/131) | kernel/ts/src/view/view.ts:173 (used :197) | condition band of every pool in GameView | DEF: engine default 04 §15 table with tones, cartridge override `world.bands`, per pool `resources.json <pool>.bands: [{at_percent, key, tone}]`; band text `band.<key>` in text.json | none | — |
| W14 | luck die `100` (uniform [0,100)); schema `chance` max 99 | kernel/ts/src/mechanics/action_recipe/rule.ts:118; protocol/action.schema.json RecipeCheck.chance.maximum 99 | odds scale of a luck check | HC (percent scale) | acceptable mechanism (percent); per-recipe `chance` is CT. Optional later `check.out_of` | L |
| W15 | recipe `duration`, `cooldown`, `costs`, check `chance`/`difficulty`/`resource` | mechanics/action_recipe/rule.ts:61-77, :117-122 | perform time, cooldown, cost, odds/DC | CT (per recipe) | none | — |
| W16 | wait: no max, no min step, no extra regen | kernel/ts/src/mechanics/schedule/rule.ts:44-47 | how far one wait may jump; rest effect | HC (unbounded) | Historical `world.wait.max` superseded for elapsed profiles: no player Wait route/alias; position recovery belongs to M2 | TM |
| W17 | player body has no capacity, no weight | kernel/ts/src/runtime/fresh.ts:28, :37 (body never gets a `capacities` row); kernel/ts/src/mechanics/containment/rule.ts:44-47 (take never checks) | inventory limit / carry weight | HC (unlimited) | `cartridge.json world.body.capacity`; later `weight` on items + `world.body.carry` (spec 00 §4 "Encumbrance", STR cap) | L |
| W18 | NPC/item capacity default `Infinity` | kernel/ts/src/mechanics/containment/rule.ts:58 | how many items an NPC accepts when undeclared | DEF (per-entity `capacity` is CT) | keep | — |
| W19 | B1 | `daily_schedule` hour keys | when NPCs move | CT in current chapter | bounds use the authored day | — |
| W20 | B1 | `time_window` hour endpoints | dusk/dawn conditions | CT in current chapter | bounds use the authored day | — |
| W21 | engine verb, talk and quest-offer priority `0` | kernel/ts/src/commands/actions.ts:111, :142; mechanics/dialogue/shared.ts:135, :156 | presentation order of engine verbs | HC | `world.verbs.<verb>.priority` (same block as W4) | L |
| W22 | lock/unlock need `key_item` | kernel/ts/src/mechanics/barrier/rule.ts:81-84 | key rule | CT (key_item per barrier); the rule itself is mechanism | none | — |

Audit counts (2026-10-02): 22 rows. HC 12 (W3-W6, W8, W11, W14, W16, W17, W19-W21; W14 acceptable as mechanism, so 11 to move), DEF 6 (W1, W2, W9, W10, W13, W18), CT 3 (W7, W15, W22), missing 1 (W12). Priority: C1 3 (W1, W2, W13; all DONE in #131), TM 9 (W3-W6, W8, W12, W16, W19, W20), L 5 (W7, W11, W14, W17, W21).
At that audit, the only `time.advance` producers: mechanics/action_recipe/rule.ts:75-77 (recipe duration) and mechanics/schedule/rule.ts:47 (wait); every other verb is instantaneous.

### Spec-pinned rows (need a spec/schema amendment before code)
- W1/W2: 00 §4 amendment 2026-09-25 ("1 MV per move from R5, terrain R8") and resource.schema ResourceSpec description; amended 2026-10-02 (#131).
- W5/W6/W19/W20: B1 amended calendar@1 and the schedule/window schemas; compiler and loader validate bounds against the authored calendar.
- W8: B1 added `ResourceSpec.gain_every`; the current chapter authors its gain interval.
- W13: 04 §15 bands amendment 2026-10-01; amended 2026-10-02 (#131).
Correction to the brief: regeneration timing does exist (fixed hourly tick, foundation/compose.ts:89 and compose.ex:110); only rest/position multipliers are missing.

### Spec values still to come (land them as content, not kernel)
From docs/archive/spec/00-first-cartridge-design.md: terrain cost table and "average of two rooms, rounded down" (:301), mounted halves (:301), position regen bonuses and hunger quarter (:323), encumbrance STR cap halving regen (:341), sleeping takes double damage (:342; also 21 §position@1 :1606), node regrow 3 days (:415). The rounding/averaging rule is mechanism; every number and table is cartridge data.

## 2. Excluded constants (not world settings)

- **04 §5.4 composition budgets**: `LIMITS` (query_steps 32768, events 4096, operations 4096, deliveries 8192, reaction_depth 32, created_jobs 64, pending_jobs 1024, due_jobs_per_advance 1024, selector_cardinality 1024, scene_auto_advances 64, output_bytes 1 MiB), kernel/ts/src/contracts.gen.ts. Safety, spec-frozen.
- **RNG budget** `DRAWS = 8`, mechanics/action_recipe/rule.ts:103. Safety budget for rejection sampling.
- **Encoding/hash/id**: foundation/canonical.ts:10-20 (SAFE 2^53-1, MAX_DEPTH 128, surrogates), lib/loka/core/canonical.ex:10, :161; sha256.ts (all); foundation/id_source.ts:34-43 (UUIDv8); rng.ts / rng.ex (xoshiro constants); `INTENT_DIGEST_VERSION`.
- **Schema sizes**: aliases/keywords/variants 16, recipe sequence 16, costs 8, room details 64, actions 64, narration lines 64, entity capacity max 1024, target_ids 8, ResourceInt 32-bit bounds, ARTIFACT_MAX_BYTES 4 MiB; lib/loka/content/checks.ex:24 `@enclosing 3` (nesting depth bookkeeping).
- **Mechanism tables**: COMPASS (runtime/decision.ts:205, from room.schema), barrier `MOVES` transitions (kernel/ts/src/mechanics/barrier/rule.ts:39-44), check order (target, cooldown, costs, check), target `normalize` stop-words (target.ts).
- **Host/telemetry**: trace.ts:73 OBSERVED 1000, :77 CAP 5000, :89 WRITE 2; authority.ts:202 `*1000` (µs); session.ts:21 ID_PREFIX.
- **UI layout/animation**: joystick.ts (ZOOM 2.6, CANCEL 6, TAP_MS 500, STAIR), MapDrawing.tsx, Footer.tsx, Turn.tsx, Book.tsx, pages.tsx sizes, paper.ts colours.
- **Test-only**: all `*.test.ts` seeds and fixtures (faults.test.ts SEEDS, saves.test.ts SEED, etc.).

## 3. Presenters baking world values

Repo-wide grep for `3600|86400|% 24` (excluding node_modules, tests, docs, fixtures) found only the kernel/Elixir rows above, mobile `model.ts`, and the `loka play` CLI (`kernel/ts/play`).

| id | path:line | baked value | should come from |
|---|---|---|---|
| P1 | mobile/app/book/model.ts:146-150 | `branch(t)` = double-hour branch from 3600 s per hour, `% 24` | cartridge calendar (W5/W6) via GameView, ideally a `time_label` text key/bindings |
| P2 | removed | the wait offer (whole hours, 3600 step) was removed with Wait ([record](decisions/owner-decision-untimed-lantern-2026-10-02.md)) | calendar (hours_per_day, units_per_hour) and `world.wait` (W16) |
| P3 | DONE | Content catalog supplies `band.<key>` phrases; projected W13 tone selects the palette in the touch presenter ([#141](https://github.com/lorecrafting/lokacore/pull/141), [review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-03-c1-touch-review.md)) | text.json and world.bands |
| P4 | mobile/app/book/model.ts:141; sections.tsx:32 | `hp` is the condition pool (phrase shown on hp only) | `resources.json <pool>.condition: true` or `world.condition_pool` |
| P5 | mobile/app/book/model.ts:51-55 | story ends when every journal quest is resolved/failed/abandoned | a cartridge ending (story point / `world.ending`); already an OWNER item in the comment |
| P7 | kernel/ts/play/text.ts:226-233 (`loka play` CLI) | `clock()` "day N, HH:MM" from 86400/3600/24/60 | calendar (W5/W6) |
| P8 | kernel/ts/play/text.ts:101-105; play/main.ts:99 | `wait [hours]` 1..24, converted with `* 3600` | calendar units_per_hour / hours_per_day; `world.wait.max` (W16) |
| P9 | kernel/ts/play/text.ts:241-248 | status line lists exactly `hp`, `ma`, `mv` (other pools never shown) | iterate `world.resourceSpecs` (as view.ts does) |
| P6 | DONE | the fixed RNG seed `[1,2,3,4]` and world context of every new game: the host draws both per lineage ([#129](https://github.com/lorecrafting/lokacore/pull/129), [Simulator evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-02-c1-host-simulator/README.md)) | not a cartridge value |

M1-A installs the opt-in content-owned elapsed rate contract ([decision](decisions/pm-decision-m1-a-elapsed-contract-2026-10-04.md)); it installs no rate default or clock conversion. M1-B owns driver/remainder and sampler rate; M1-C retains the calendar/period/recovery follow-ons. Existing W rows are not marked DONE by this contract-only slice.
