# Showcase plan 4: the Homestead district

District brief for `cartridges/toolbox_showcase` ([showcase](../SHOWCASE.md), Beads `loka-y6yg.19`),
written by Fable for an Opus developer and an Opus reviewer. Base: `main` after PR #403 (Homestead
batches A and B merged in #402 and its predecessor; the toolbox table still reads `in progress` for
the `.108.*` rows, a doc drift the build slice may fix in passing). Only installed mechanics: rows
.108.7 craft, .108.8 skill prerequisites, .108.11 skill tree view, .108.9 self-build with S2 to S5
built rooms (paid raise, raze), .108.6 furnishing, .108.5 gifting and barter, .108.3 fishing, .108.4
cooking and .108.10 self-cooking, .108.1 farming; the hens of .108.2 live in the sandbox. Every
shape has a sampler precedent, cited per item; a step that needs engine code is a
[toolbox finding](#toolbox-findings).

Conventions as in [plan 1](hub-and-first-districts.md): snake_case ids, the developer's words except
the signpost, the game clock (07:00 day 1 is 25200; a game hour 3600 and 72 real seconds). Two
cartridge-wide facts matter here:

- **No recipe `duration`.** The showcase's `time_policy` is `real_elapsed`, and a recipe with a
  `duration` is refused at load (`INVALID_TIME_POLICY`, `kernel/ts/src/content/cartridge.ts`). The
  `fish` (60) and `chop` (600) durations of the samplers are dropped; nothing else changes.
- **Seasons are days.** The showcase season period is four days (spring day 1, summer day 2, autumn
  day 3, winter day 4), so the farm's sowing gate is `not sky {season: winter}`, not `spring`.

## The hub has two faces left

The compass is six-way (`protocol/room.schema.json`) and the inn's four compass faces are taken, so
only `up` and `down` remain for four new districts. Owner order is Homestead, economy and law, magic,
traps; the two cellar-and-loft districts take the inn's faces, and the two outdoor ones hang one
step from the inn on a district sign room that still has a free face:

| District | Plan | Link | Hub sign sentence (`readable.sign_hub`, appended in build order) |
|---|---|---|---|
| Homestead | 4, this plan | `fell_gate` gains west `holding_lane` | "Through the Fell gate and west, the Holding: learn a trade, raise a hut with your own timber, furnish it, farm, fish, cook, and trade with a farmer who remembers a gift." |
| Economy and law | [5](economy-law-district.md) | `crossroads_inn` gains down `undercroft` | "Down the cellar steps, the Undercroft: a shelf whose price moves, a smith who takes your ore on trust, a bank with two counters, a strongroom you can buy, and a purse you can lift, seen or unseen." |
| Magic and use-on | [6](magic-district.md) | `crossroads_inn` gains up `loft` | "Up the ladder, the Loft: a hedge-wizard, three words that cost ash and breath, a dark crypt with something in it, and a golem that minds the weather." |
| Traps | [7](traps-district.md) | `drill_yard` gains down `sapper_stair` | plan 7 rewrites the last sentence |

"Four roads leave this inn." becomes "Four roads, a ladder and a cellar stair leave this inn."
(plan 5 or 6, whichever builds first). If the PM would rather every district open from the inn
itself, the alternative is a second hub room, which this plan does not recommend: a room with no
mechanics in it.

## Build order for plans 4 to 7

One build slice per district, in owner order: 4 Homestead, 5 economy and law, 6 magic, 7 traps.
**They run in sequence, never in parallel:** every slice edits `cartridge.json` (capabilities,
`world`, `speech`), `resources.json`, `facts.json`, `text.json`, `map_positions.json`, the hub sign
text and `protocol/fixtures/toolbox_showcase_hash.json`; plans 5 and 6 both edit
`rooms/crossroads_inn.json`. Each slice branches from `main` after the previous one merges. A
slice's kernel test file is its own; the hub pin in `showcase_body.test.ts` (exit count) changes
in plans 5 and 6 only.

## Manifest changes (this slice)

- Capabilities: add `service`, `construction`, `replenish`, `craft` (the names the compiler asks
  for; `craft_sampler/cartridge.json`, `build_sampler/cartridge.json`, `farm_sampler/cartridge.json`).
  `requires.kernel_api.at_least` stays 1.102 (every Homestead floor is 1.101 or 1.102).
- `world.construction {max_total: 2}` (`craft_sampler`): one hut on the lane's site, one on the
  sandbox's.
- Pool `mana`: none here. No new pool; mv and pennies carry the loop.
- Skills, each with `profession` (`craft_sampler/skills`), in the Character page's skill tree
  ([hs-14](../system/mechanics.md#skill-tree-view-homestead-hs-14)):
  - "Woodcraft": `whittling` (growth `[1, 2]`), `carving` (prerequisite `skill_compare whittling
    at_least 2`, growth `[2]`), and one `hidden` elite skill with a prerequisite on `carving`
    ([owner decision](../decisions/owner-decision-hidden-elites-secret-2026-10-15.md)): it is named
    nowhere the player can read until they qualify, so this plan names it only under
    [Pins](#pins-the-build-writes).
  - "Forestry": `woodcutting` (growth `[1, 2]`), `carpentry` (prerequisite `skill_compare
    woodcutting at_least 2`, growth `[2]`).
  - "Kitchen": `cooking` (growth `[2, 4]`; `kitchen_sampler/skills/cooking.json`).
  Levels are whatever skills@1 derives from `growth` and the use count; the thresholds above are
  the samplers', so their pins (carving teachable after the first carve, since whittling is taught at level 1,
  `cook_feast` at two uses) carry over unchanged. If a freshly taught skill reads below the level `chop` wants, the
  build gates `chop` on the learned fact instead and notes it (finding 2).
- Statuses: `hearty` (3600, `modifies str +2`; `kitchen_sampler/statuses/hearty.json`), `fed`
  (3600, `modifies str +1`, the kitchen sampler's shape, **not** the pen's), `well_rested` (the
  `furnish_sampler/statuses` shape: 3600, five ticks of mv +2 before its end), `growing` (86400, tick 3600,
  hp -1 on the plot: the plot has no pool, so the tick writes nothing, [row G3](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3)),
  `watered` (43200, no `per_tick`), `withered` (permanent, cured by sowing), `spoiling` on fish
  (`fishing_sampler`), `laid`/`fed` for the hens in the sandbox (`pen_sampler`, renamed `hen_fed`
  to avoid the kitchen's `fed`).
- Facts: `regard` (player, int -1..1, `per_subject`; `gift_sampler` `trust`, renamed because the
  showcase's `trust` is 0..2), `gifted_apple`, `gifted_rat`, `traded_knife` (player bool),
  `owns_plot`, `owns_pen` (player bool), `sown_at` (clock stamp, `farm_sampler/facts.json`).
- Tags used from the closed set: `rod`, `water`, `bed`, `rug`, `wooden`, `burnable`.

## Rooms and map

Sealed holders (no exits, never entered) hold the yields: `woodpile` (8 `log`s), `timber_yard`
(custody for the raise), `larder` (3 `turnip`s, 3 `stew_hearty`, 1 `feast`, the escrow custody),
`pond_deep` (`trout_01`, `trout_02`, `eel_01`, `salmon_01`), `midden` (spoil sink and seed return),
`stall` (barter custody).

| Room | Exits | Holds |
|---|---|---|
| `holding_lane` (sign) | east `fell_gate`, west `carpenter_shop`, south `farm_yard`, up `holding_croft`; **site** `{directions: [north], blueprints: [hut_plain, hut_timbered]}` (`craft_sampler/rooms/lane.json`) | detail `sign_homestead`; detail `plot_stakes` (rating 1; the raise recipe's target) |
| `carpenter_shop` | east `holding_lane` | **the carpenter**; detail `saw_bench` (rating 1); `axe`; `cot` (tag `bed`, 3000 g); `rug` (tag `rug`); 2 `stick`s |
| `farm_yard` | north `holding_lane`, west `glade`, east `pond`, south `farm_kitchen` | **the farmer**; `plot` (container, 20000 g, `immune: [growing]`, `locks {get, put}` on `owns_plot`, description variants on `time_since sown_at` 3600 and 64800 and on `withered`; `farm_sampler/items/plot.json`); `sack` (holds `seed_01`); `watering_can` (vessel, water 4); `holding_apple`; `dead_rat` |
| `glade` | east `farm_yard` | detail `oak` (rating 1; `chop`); 3 `pelt`s on the frame |
| `pond` | west `farm_yard` | detail `pond_water` (tag `water`); `rod` (tags `rod`, `wooden`) |
| `farm_kitchen` | north `farm_yard` | **the cook**; detail `hearth` (rating 1 for `cook_stew`, 2 for `cook_feast`) |
| `holding_croft` (sandbox) | down `holding_lane`; **site** `{directions: [north], blueprints: [hut_plain]}` | **hens** (population `hens`, `pen_sampler/populations/hens.json`: home `holding_croft`, cap 4, floor 2, `birth_when population_count hens at_least 2`); `trough`, `grain_01`; `nest` (container, `locks.put` on `owns_pen`); a second `plot` on `owns_plot`, a second `sack`; `croft_pool` (tag `water`), a second `rod`; 2 `stick`s; a second `cot`; detail `croft_hearth` |

The built huts are rooms the engine creates north of each site (`origin: built`, shared-world: one
structure per site direction, [S2](../system/mechanics.md#built-rooms-toolbox-row-s2-foundation)).
Blueprint `hut_timbered`: `max_per_owner 1`, `variants [{when: item_present {tag: rug}, description}]`
(`build_sampler/blueprints/hut.json` plus the `furnish_sampler/rooms/hut.json` variant). `hut_plain`:
`max_per_owner 1`, no variant.

### Signpost (`sign_homestead`, readable in `holding_lane`)

> The Holding. The carpenter west teaches the knife, the axe and the saw, and sells a plain hut if
> you would rather pay than learn; the stakes by this sign mark where a hut goes, and only one goes
> there. Carve sticks till your hand is steady and she will teach you carving; fell the oak in the
> glade twice and she will teach you the saw. Two timbers raise a hut, and a cot dropped in it makes
> a night's rest worth more. The farmer south likes an apple and not a dead rat, and trades a knife
> for two pelts without a penny passing. The pond east of her yard bites by the hour and the weather;
> the cook south of the yard turns two fish into a stew for a penny, or teaches you to do it at her
> hearth. Up the croft is the same again with hens in it.

### NPCs, services, recipes, reactions

- **The carpenter**: stays; dialogues in key order (hs-14 filters a choice when the talk opens):
  `carpenter_lessons` with choices `whittling` (free, `skill.acquire whittling`), `woodcutting`
  (free), `carving` (policy `skill_compare whittling at_least 2`, `lesson_payment` 2 pennies,
  `skill.acquire carving`), `carpentry` (policy `skill_compare woodcutting at_least 2`, 2 pennies),
  the hidden skill's choice (policy its prerequisite; no `label` on this dialogue, hs-14's load
  check), and `leave`. Services (`craft_sampler/services`, `build_sampler/services`):
  `raise_hut_plain` price 5 `benefit {kind: build, blueprint: hut_plain, site: holding_lane,
  direction: north}`; `raze_hut` price 2 `benefit {kind: raze, site: holding_lane, direction:
  north}`; `raise_croft_hut` and `raze_croft_hut` for the sandbox site.
- Recipes (`craft_sampler/recipes`): `carve_spoon` at `saw_bench` (policy `skill_compare whittling
  at_least 1`, check `{kind: opposed, skill: whittling}` against rating 1, `craft.consume {items:
  [stick_01..04], quantity: 1, to: midden, reason: craft.carve_spoon.needs}`, `craft.yield {items:
  [spoon_01, spoon_02], from: woodpile}`; a failure consumes the stick and yields nothing); `chop`
  at `oak` (policy `all(has_item axe, skill_compare woodcutting at_least 1)`, check opposed
  `woodcutting`, yield 4 `log`s from `woodpile`); `saw` at `saw_bench` (policy `skill_compare
  carpentry at_least 1`, check opposed `carpentry`, consume 2 logs to `woodpile`, yield 1 `timber`
  from `timber_yard`); `raise_timbered_hut` at `plot_stakes` (policy `skill_compare carpentry
  at_least 2`, consume `timber_01`, `timber_02` quantity 2 to `timber_yard`, reason
  `craft.raise.needs`, success `build {blueprint: hut_timbered, direction: north}`).
- Furnishing (`furnish_sampler`): reaction `cot_rest` `on {event: rested}` (no room filter: the leaf
  reads the sleeper's room) `when item_present {tag: bed}` `apply status.apply well_rested`.
- **The farmer**: `room_line_variants` on `fact_compare {regard, npc: farmer}` 1 (warm) and -1
  (cold); reactions `farmer_likes_apple` `on {item_acquired, item: holding_apple}` `when
  fact_compare {gifted_apple false, npc: farmer}` `apply [fact.adjust regard +1, fact.assign
  gifted_apple true]`, `farmer_hates_rat` likewise with -1 (`gift_sampler/reactions`); service
  `knife_for_pelts` price 0, `benefit {kind: entitlement, fact: traded_knife, escrow {items:
  [pelt_01..03], quantity: 2, custody: stall, output: knife_01}}` (`gift_sampler/services`); service
  `buy_plot` price 3 `{entitlement: owns_plot}` and `buy_pen` price 3 `{entitlement: owns_pen}`
  (`farm_sampler/services/buy_plot.json`; priced 3 so the loop's pennies last).
- Farming (`farm_sampler`): reaction `sow` `on {item_acquired, item: seed_01}` `when all(not sky
  {season: winter}, not has_item seed_01)` (the seed put into the plot, which holds it) `apply
  [status.cure withered, status.apply {growing, item: plot}, fact.stamp sown_at, replenish.run
  spent_furrow]`; `water` use recipe (tool `{tag: liquid_holding, liquid: water}` on the plot,
  policy `status_active {subject: target, status: growing}`, `status.apply {watered, item: plot}`);
  reactions on `status_expired growing`: `ripen` `when status_active {subject: subject, status:
  watered}` moves `turnip_01` from `larder` to the plot and the seed to `midden` (`item.move`),
  `wither` otherwise applies `withered`; `replenish seed_return {items: [seed_01], from: midden, to:
  sack, cap 1, count 1, every 172800}`.
- Fishing (`fishing_sampler`): `fish` use recipe (tool `{tag: rod}` on `pond_water`, policy `has_tag
  {subject: target, tag: water}`, check `{kind: luck, chance: 50}`, `cooldown` 600, success
  `event.emit bite`); reactions on `custom_event bite`: `trout` `when time_window {from: 6, to: 18}`
  `replenish.run trout`, `eel` for the night window, `salmon` `when sky {weather: rain}`; the three
  replenish entries move one fish each from `pond_deep` to the player's room, `cap` 1; `spoiling`
  on each fish (86400) whose expiry moves it to `midden`; a nightly job returns fish from `midden`
  to `pond_deep` (`cap` 4).
- Cooking (`kitchen_sampler`): the cook's service `stew` price 1 `{entitlement: ordered, escrow
  {items: [trout_01, trout_02, eel_01, salmon_01], quantity: 2, custody: larder, ready_after: 300,
  output: stew_plain_01}}`; `stew_plain_01` `edible {resource: mv, amount: 10, applies: [fed]}`;
  dialogue `cook_lesson` with `cooking` free; recipes at `hearth`: `cook_stew` (policy
  `skill_compare cooking at_least 1`, check opposed `cooking` against rating 1, consume 2 fish to
  `larder`, yield `stew_hearty_01..03` from `larder`; eating one applies `hearty`), `cook_feast`
  (`skill_compare cooking at_least 2`, three fish, yields `feast_01`).

## Guided loop and expected outcomes

The test's world has day 1 clear (the trout) and day 2 rain (the salmon branch). Pennies start 10.
Skill levels below are the samplers' pins; the build pins the derived level after each use.

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | North from the inn, west from `fell_gate`; read `sign_homestead`; open the Character page. | The text. The skill tree lists Woodcraft (Whittling, Carving locked), Forestry (Woodcutting, Carpentry locked), Kitchen (Cooking); no other row, no other name. | skill tree view |
| 2 | Talk to the carpenter: `whittling`, `woodcutting`; `carving` is not offered; take the axe, the two sticks, the cot, the rug. | Two `skill.acquire`; the tree reads Whittling level 1, Woodcutting level 1; the `carving` choice is absent from the opened talk (hs-14) and a forged choose is `invalid_state`. Carry: axe + cot + rug + sticks under 5000 g (the build sizes them). | skill prerequisites x dialogue |
| 3 | `carve_spoon` three times at the saw bench. | First: success (taught Whittling 1 meets the bench's rating 1), a stick to `midden` (minted ids decide which; the build pins it), a spoon held (likewise pinned), `uses_whittling` 1, Whittling 2 in the tree. Second: success, the other spoon held, `uses_whittling` 2, Whittling 3. Third: `invalid_state`, offer reason `craft.carve_spoon.needs` (no stick). | craft x skill growth |
| 4 | Talk: `carving` (2 pennies). | Accepted now: pennies 8, Carving level 1 "qualified"; a second `carving` is `invalid_state`. The hidden skill's row and choice now appear (see Pins). | skill prerequisites x hidden elite |
| 5 | South, west to the glade; `chop` twice; back to the shop; Talk: `carpentry` (2); `saw` twice. | Each chop yields 4 logs (8 held, the woodpile empty; a third chop is `invalid_state`); Woodcutting 2 after the first, 3 after the second, so `carpentry` is accepted: pennies 6. Each saw consumes 2 logs and yields a timber: 2 timbers, 4 logs; Carpentry 2 after the second saw. | craft x skill trees |
| 6 | Lane: `raise_timbered_hut`. | Both timbers to `timber_yard`; a room north of the lane (`origin: built`, title the blueprint's), the Exits list north; `raise_hut_plain` at the carpenter now refuses `service.site_taken`; a second `raise_timbered_hut` offers reason `service.site_taken` (it comes before the spent timbers' `craft.raise.needs`) and the perform is `invalid_state` (`craft.test.ts` second raise); `max_per_owner` 1 is not reached here. Branch (fresh world, no lessons): `raise_hut_plain` for 5 builds the plain hut (pennies 5); `raise_timbered_hut` then refuses `service.site_taken`; at 4 pennies the service is `insufficient_resource`. | self-build x built rooms x services |
| 7 | North into the hut; drop the rug; drop the cot; Rest; wait 3600. | The hut's description reads the rug variant while the rug lies there, the base line once taken; `rested` fires `cot_rest`: `well_rested` applied (its line), five ticks of mv +2 by 3600, the Conditions ring shows Well rested until then. Rest in the lane with the cot there: the same (the leaf reads the room, not the owner, hs-6's limit); rest in the hut with the cot in hand: nothing. | furnishing x rest x variants |
| 8 | Carpenter: `raze_hut` (2). | Pennies 4; the north exit is gone, the hut's `built` row carries `razed_at`; the cot and rug, if left inside, are gone with it (the build pins where they go: finding 3); `raise_hut_plain` is offered again. Branch: raze with the player's corpse inside refuses `service.occupied`; a stranger (a second character in the test) refuses `permission_denied`. | raze x ownership |
| 9 | Yard: Give the apple to the farmer; Give the rat; the glade's three pelts, then `knife_for_pelts`. | Apple: `regard` 1, the warm room line; rat: 0, base line. Pelts: with one, `not_owned` / `service.missing_inputs`; with two, the knife held, two pelts in `stall`, pennies unchanged, no job; again: `invalid_state` `service.order_open`. Rat first in a fresh world: -1, the cold line. | gifts x pair facts x barter |
| 10 | Pond at 07:00 day 1: take the rod; `fish` on the water; `fish` again at once; take the trout; wait 600; `fish`; take the trout; wait 600; `fish`. | Seed fixed so the first cast passes: a trout lands in the room (minted ids decide which; the build pins it), `spoiling` on it; the second cast is `cooldown`; the third (passing) lands the other trout (had the first stayed in the room, `cap` 1 would land nothing); the fourth (passing) lands nothing: the deep has no trout left. At 22:00 a passing cast lands the eel; on day 2 (rain) at 10:00 the salmon as well. A failing seed lands nothing. Rod in a worn sack: `invalid_state`. | fishing x time window x sky x replenish |
| 11 | Kitchen: `stew` with one fish held; with two; claim at once; wait 300; claim; Eat. | One: `service.missing_inputs`. Two: pennies 3, both fish in `larder`, `ordered` true. Claim at +299: `service.not_ready`; at +300 the stew held; Eat: mv +10, `fed` (str 11), the Conditions ring shows Fed; str 10 again at +3600. | escrow x cooking x status modifiers |
| 12 | Talk to the cook: `cooking`; with two fresh fish (the restocked deep, next day), `cook_stew`; Eat. | `cook_stew` at one fish: `craft.cook_stew.needs`; at two: `stew_hearty_01` held, fish to `larder`, `uses_cooking` 1; Eat: `hearty`, str 12; with `fed` still active str 13 (both modifiers read at use). `cook_feast` is unavailable until Cooking 2 (two uses) and three fish. | self-cooking x skill trees x status modifiers |
| 13 | Yard: `buy_plot` (3); put the seed into the plot at 08:00 day 1; `water` it at +43201; wait to +86400; take the turnip. | Before buying, Put on the plot is `permission_denied`. Sown: `growing` on the plot, `sown_at` stamped; the plot reads shoots at +3600, heavy at +64800; watered after the midpoint ripens: at +86400 `turnip_01` in the plot, the seed in `midden`; never watered, or watered at +43200 exactly: `withered`, no turnip. The seed is back in the sack at +172800 and a second sowing cures `withered`. Day 4 (winter): the seed put in the plot sprouts nothing. | farming x statuses x replenish x locks |

Sandbox `holding_croft`: hens that lay once fed (`grain_01` in the trough: `hen_fed` on each, the
nest holds 2 eggs at +14400 and 3 from +28800, eggs edible mv +2; two more hens born at +43200;
the grain returns at +86400), a second site for the plain hut, a second plot and pool, sticks and a
cot, and the croft hearth for cooking what the pool gives.

## Item loops

Sticks (2 per room, scrap to `midden`), spoons (2, from the woodpile; inert), logs (8, consumed by
the saw back to the woodpile and chopped out again: a loop with a cap of 8), timbers (2, consumed
by the raise into `timber_yard` and never returned: two raises per world unless the sandbox site is
used), huts (max_total 2, razed for 2 pennies), fish (4, spoil to `midden`, nightly return, cap 4),
stews (3 hearty, 1 feast, 1 plain: eaten, never refilled), turnips (3, one per harvest), seed (1,
returns every two days), apple and rat (one each), pelts (3; two leave for good), knife (1, once
per character: the entitlement stays true), eggs (3 per laying, cap 3 in the nest), hens (cap 4,
floor 2). Pennies only leave this district (lessons 4, hut 5, raze 2, stew 1, plot 3, pen 3): a
player who spends them all earns more in [plan 5](economy-law-district.md). Nothing creates an item.

## Realm checklist

Per-player: every skill, `regard`, `gifted_*`, `traded_knife`, `owns_plot`, `owns_pen`, `ordered`,
`sown_at`. Shared-world: the huts (one per site direction; a second character meets
`service.site_taken`), the plot and nest items (two owners in a Realm would share one plot,
[seam 9](../decisions/owner-decision-realm-seams-2026-10-13.md#the-seams)'s known gap, stated here,
not solved), the fish, logs and sticks, the hens (a per-world population; Realm audience `public`).
Delays are logical units (300, 600, 3600, 43200, 86400, 172800); no device clock; the e2e advances
time through the dev panel's control (`?dev=1`, [builders guide](../BUILDERS-GUIDE.md)) or its
`Date.now` override, never a player verb.

## Pins the build writes

- `kernel/ts/test/showcase_homestead.test.ts` homestead 1 to 13 as above, including: the exact
  tree rows before and after each lesson; the first carve's success and stick consumption;
  `service.site_taken`, `insufficient_resource`, `service.occupied` and the stranger's
  `permission_denied`; the five `well_rested` ticks; `regard` after each gift; the barter with no
  job row; the fixed passing and failing fishing seeds (as `fishing.test.ts` `PASS` and `FAIL`); the
  stew at +299 and +300; str 10, 11, 12, 13; the plot's three descriptions, the +43200 boundary and
  the winter refusal.
- **The hidden elite skill** (the one place this plan names it): `joinery`, `hidden: true`,
  prerequisite `skill_compare carving at_least 1`, profession "Woodcraft". Pins: before step 4
  the tree has no Joinery row, the carpenter's opened talk has no `joinery` choice, the GameView and
  the receipts carry no `joinery` string; after step 4 the row reads locked-or-qualified per hs-14
  and the choice appears. A load-check control: a `label` on `carpenter_lessons` is
  `SCHEMA_VIOLATION` at `dialogues/carpenter_lessons.label`.
- `protocol/fixtures/toolbox_showcase_hash.json` (held by `test/loka/content_showcase_test.exs`).
- `showcase_body.test.ts`'s `fell_gate` exits (west added, if a pin counts them).
- Book e2e `mobile/app/tests/showcase_homestead.e2e.ts`, the happy path in the real UI at phone
  width: the two free lessons (Talk cards), Take, three Carve cards, the Carving lesson, two Chop,
  the Carpentry lesson, two Saw, Raise, north into the new room, Drop the cot, Rest, the Conditions
  ring listing Well rested, Give the apple (the Give card, Beads `loka-x6t.31` closed), the barter
  offer, Cast the rod (a use card), the stew offer and Claim, Eat, the ring listing Fed. Every verb
  here is a card; the day-long farm step is kernel-only in the e2e (the dev clock covers it in play).

## Blind AI playtest focus

Can the player find the trade path from the sign alone (carve twice, then ask again)? Does the
locked skill read as a goal or a wall? Does the raze feel safe (did they lose the cot)? Does the
farmer's warmth read without a number? Does the Conditions ring make sense with three conditions
on it (Fed, Hearty, Well rested) at once? Does the fishing cooldown read as "wait" or "broken"?

## Matrix cells this plan adds

Rows in [SHOWCASE.md](../SHOWCASE.md#pairwise-mechanic-matrix), all `planned (plan 4)`: craft x
skill growth x skill prerequisites x hidden elite; self-build x built rooms x services x raze;
furnishing x rest x variants; gifts x pair facts x barter; fishing x time window x sky x
replenish; escrow x cooking x status modifiers; farming x statuses x locks x replenish.

## Toolbox findings

1. **Built-room reactions have no room key.** A reaction's `room` filter and a `status.apply
   {room}` name an authored room, so nothing can fire only in the player's own hut; the cot
   reaction reads the sleeper's room by `item_present` instead, which is also true in the lane.
   A `room: built {site, direction}` filter, or an `owner` leaf, would close it (kin of hs-6's
   "the leaf does not check ownership").
2. **Taught level.** If `skill.acquire` leaves a skill at level 0 until its first use, `chop`'s
   sampler gate (`at_least 1`) refuses a fresh woodcutter; the build then gates on the learned fact
   and says so here. The samplers do not pin a taught, unused level.
3. **Items in a razed room.** [S5](../system/mechanics.md#built-rooms-s5-raze-and-tombstone) does not say where
   a razed room's floor items go; the build pins what happens to the cot and files a row if they
   vanish (a hidden sink) rather than return to the site.
4. **Doc drift.** `docs/MECHANICS-TOOLBOX.md` rows `.108.*` read `in progress` after #402 merged;
   `mechanics.md` says Give is not in the Book (`loka-x6t.31` is closed).
