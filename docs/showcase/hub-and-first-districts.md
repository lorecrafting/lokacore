# Showcase plan 1: hub, body, world and social districts

District brief for `cartridges/toolbox_showcase` ([showcase](../SHOWCASE.md), Beads `loka-y6yg`),
written by Fable for an Opus developer to build and an Opus reviewer to check against. Base: `main`
plus batch M6 (PR #363). It uses only installed mechanics; every field named here has a sampler
precedent, cited per item, and the developer copies shapes from those samplers. A step that turns
out to need engine code is a finding against the toolbox row, not showcase work.

Conventions. Room, item, NPC and fact ids are the snake_case names below. Text keys and the words
themselves are the developer's, except the four signpost texts, given in full. The player's hp pool
runs 1 to 10 with no regeneration (exposure sampler: a drain alone never kills; the combat district
lowers the minimum to 0 when death arrives). Times are the game clock; one game hour is 3600
logical units and 72 real seconds (`real_elapsed`, rate 50), so one real minute is 3000 units.

## Build split

Two developer slices, one PR each:

1. **Slice A: hub, body, world.** The manifest, calendar, pools, attributes, derived carry,
   statuses, garments, the hub inn, the Fell Road and Tidewater Steps, their tests.
2. **Slice B: social.** Low Wardle: facts, NPCs, dialogues, the letter quest and scene, Tam's
   schedule and rumour, codex, pick and force, the recap threshold; it also adds Wat's letter
   dialogue (`dialogues/wat_letter.json`) to the shepherd slice A created.

Pins: one kernel test per district (`kernel/ts/test/showcase_body.test.ts`, `showcase_world.test.ts`,
`showcase_social.test.ts`) walking the guided steps below and asserting each expected outcome; a
content-hash fixture as the samplers keep (`kernel/ts/test/exposure.test.ts` canonical hash); the step
tables double as the walkthrough for a recorder recipe. Tests pick world context ids whose per-day
weather sequence gives each step the day it needs, as `exposure_sampler`'s tests do (weather is a hash
of world id and day, [row 31](../system/mechanics.md#derived-sky-weather-season-and-tide-toolbox-row-31)).

## Manifest (slice A)

- `requires.kernel_api.at_least` 1.47; capabilities: everything the samplers below require
  (movement, containment, equipment, resource, fact, policy, reaction, status, schedule, calendar,
  tags, description_variant, variety, knowledge, action_recipe, check, skills, attributes, liquid,
  readable, topics, quest, dialogue, scene, barrier, death, position, commerce; the compiler names
  any missing one).
- `entry`: `crossroads_inn`; `world.death.shrine`: `crossroads_inn`.
- `time_policy`: `real_elapsed`, rate 50, `recap_after_minutes` 30 (slice B adds the field;
  `recap_sampler/cartridge.json`).
- `calendar`: start 25200 (07:00 day 1), 3600 units per hour, 24 hours, 4 subdivisions;
  `weather` `clear` 2, `frost` 1, `rain` 1 (`wet`), `gale` 1, `heat` 1, `drought` 1
  (`exposure_sampler`, `needs_sampler`); `season` period 691200 (eight days): `spring` 0,
  `summer` 172800, `autumn` 345600, `winter` 518400; `tide` period 43200: `low` 0, `high` 21600;
  `lunar` period 345600: `new` 0, `full` 172800 (`sky_sampler`, `time_sampler`).
- Pools: `hp` 1..10 start 10 gain 0; `mv` 0..100 start 100; `hunger` and `thirst` 0..10 start 10,
  each with its own band words (`needs_sampler/resources.json`).
- Attributes: `str` 10, `dex` 10, `cha` 6 (`persuade_sampler/attributes.json`).
- `world.derived.carry_grams`: base `carry.max_grams` 5000, term `str` per_point 1000, pivot 10
  (`derived_sampler/cartridge.json`): str 10 carries 5000 g, str 13 carries 8000 g.
- Skills: `intimidate` untaught, growth `[1, 2]`; `pick` untaught, growth `[1]`
  (`persuade_sampler`, `barrier_sampler`).
- Statuses ([row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1),
  [row 2c](../system/mechanics.md#status-modifiers-toolbox-row-2c); `exposure_sampler/statuses`,
  `buffs_sampler/statuses`, `needs_sampler`): `chilled`, `soaked`, `windburnt`, `overheated`
  each hp -1 every 7200 for 9000; `hungry` hunger -1 every 3600 for 86400; `thirsty` thirst -1
  every 3600 for 86400; `parched` thirst -1 every 1800 for 5400; `might` modifies str +3 for 3600,
  no `per_tick`; `inspired` modifies dex +2 for 1800, no `per_tick`.
- Liquids: `water` cures `thirsty` and `parched`; `draught` (the potion kind, `drank {kind}`
  reaction applies `might`; `buffs_sampler/liquids/potion.json`).

## Hub: the Crossroads Inn (slice A)

One room, `crossroads_inn`, the entry and the death shrine. Exits: north `fell_gate` (body), east
`shore_steps` (world), south `village_green` (social); west is reserved for the combat district
(no exit yet; the sign says so).

- **Hob**, the innkeeper, stays in the inn (no schedule). `short_variants`: "Hob, asleep over the
  bar" while `time_window {from: 0, to: 6}` ([row W6](../system/mechanics.md#entity-description-variants-toolbox-row-w6);
  `variants_sampler/npcs/guard.json`).
- **sign_hub**, a readable item with no topic (`codex_sampler/items/carters_note.json` without
  `topic`), text:

  > Three roads leave this inn. North, the Fell Road: what weather, hunger and a strong drink do
  > to a body. East, Tidewater Steps: tide, moon, night, a hidden stair and a cliff. South, Low
  > Wardle: a village that remembers what you did and talks about it. Each road starts with a
  > signpost like this one. A fourth road, west, is not cut yet. Nothing here is a trap: when a
  > door will not open, the words in the room say why.

- **waterskin** (vessel, 4 units of `water`, `needs_sampler`) and a **loaf** (edible, `mv` +5,
  cures `hungry`, `needs_sampler/items/bread.json`) on the bar.

Expected: a new character starts here at 07:00 day 1 with hp 10, hunger 10, thirst 10, str 10,
dex 10, cha 6; the room lists three exits; before 06:00 Hob's name reads the asleep variant.

## Body district: the Fell Road (slice A)

Rows: 1, 2c, 18, 42, G3, G13, W6, W25 (and W25 dry). W8 scars are not merged; see Later.

### Rooms and map

| Room | Tags | Exits | Holds |
|---|---|---|---|
| `fell_gate` (sign; a stone shelter) | none | south `crossroads_inn`, north `fell_top`, east `the_fold` | `sign_body`; `cloak` (`warm`), `oilskin` (`waterproof`), `hat` (`cool`), `scarf` (`windproof`), each on its own slot so all four can be worn (`exposure_sampler/items`) |
| `fell_top` (open moor) | `exposed` | south `fell_gate`, east `shepherd_hut`, west `still_room` | nothing |
| `shepherd_hut` | none | west `fell_top` | **Wat**; `hut_loaf` (as the inn's loaf); `trough_skin` (waterskin, 4 units of `water`) |
| `still_room` (Orla's brewhouse) | none | east `fell_top` | **Orla**; `cask` (vessel, 3 doses of `draught`, `buffs_sampler/items/vial.json`); `lute`; `quern` (7000 g); detail `knucklebones` (rating 11); detail `hearth` |
| `the_fold` (sandbox) | `exposed` | west `fell_gate` | one of each garment, a second cask (3 doses), a second lute, two loaves, a full waterskin, **Drover** (str 12), detail `fold_bones` (rating 11), detail `fold_hearth` |

`fell_top` description variants, one per weather phase, say in words what the sky is doing and
what to wear ([trap 12](../MECHANICS-TOOLBOX.md#traps)).

### Signpost (`sign_body`, readable in `fell_gate`)

> The Fell Road. North of here the moor is open to the sky. Go up in frost, rain, gale or heat
> without the right garment from these pegs and your body pays by the hour; come back under this
> roof and it stops on its own. The climb makes you hungry and thirsty: Wat's hut, east on the
> top, has bread and a trough. Orla's still room, west, has a draught that makes you strong for an
> hour (try the quern), and a lute (try the knucklebones after a song). The fold, east of here,
> is the same sky with everything on one shelf.

### NPCs, items, reactions

- **Wat** (shepherd): hp 10 gain 0, `attributes {str: 12}`; `daily_schedule` 8 `fell_top`, 9
  `shepherd_hut`; `room_line_variants` and `description_variants` on
  `status_active {subject: target, status: chilled}` ("Wat, blue-lipped and shivering, ...").
  Reaction `wat_frost`: `on {event: entity_entered_room, room: fell_top, npc: wat}`, `when sky
  {weather: frost}`, `apply status.apply chilled` (lands on the entrant; the `npc` entrant filter
  is [row W3](../MECHANICS-TOOLBOX.md#ranked-toolbox)'s, merged by batch M6; no `has_tag room`
  or `wearing` in this rule, since those read the player). Same shape for `rain` to `soaked`.
- **Orla** (brewer): stays in `still_room`; `attributes {dex: 11}`; `description_variants` on
  `status_active inspired` ("Orla hums as she works").
- **Drover** (sandbox): `attributes {str: 12}`; recipe `shove_drover` at detail `fold_post`,
  check `{kind: opposed, attribute: str, npc: drover}`, policy `npc_present {npc: drover}`
  (`npc_attr_sampler`): passes only under `might` (13 ≥ 12).
- Exposure reactions for the player, two per condition (`entity_entered_room` into `fell_top`
  and `clock_hour`), each `when all(sky {weather}, has_tag {tag: exposed, subject: room}, not
  wearing {tag})`: frost/`warm`/`chilled`, rain/`waterproof`/`soaked`, gale/`windproof`/`windburnt`,
  heat/`cool`/`overheated` (`exposure_sampler/reactions`). Dry: `drought` with no garment leaf,
  applying `parched` (`needs_sampler`). The same ten rules name `the_fold` as a second
  `entity_entered_room` room (one rule per room, or one with the room omitted if the shape allows;
  `clock_hour` rules need no room).
- Needs: reaction on `entity_entered_room` into `fell_top` applying `hungry` and `thirsty` (two
  steps, one rule; `needs_sampler`).
- Potion: reaction `on {event: drank, kind: draught}` applies `might` (`buffs_sampler/reactions/potion.json`).
- Song: recipe `play_song` at `hearth` (policy `has_item lute`, success emits a custom event as the
  sampler does, `tip`: "A song reaches whoever is in the room with you."); reactions on
  `action_completed {action: play_song}`: one applying `inspired` to the performer, one with
  `when npc_present {npc: orla}` applying it with `npc: orla` (`buffs_sampler/reactions`). The
  sandbox twin `play_fold_song` at `fold_hearth` with the same reactions for the player only.
- Knucklebones: recipe `throw_bones` at `knucklebones`, check `{kind: opposed, attribute: dex}`
  against the detail's rating 11 (`skills_sampler`), success and failure lines.

### Guided loop and expected outcomes

Day 1 is a frost day in the test's world; the day 2 branch is rain.

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | In `fell_gate`, read `sign_body`. | The text above; no topic granted. | |
| 2 | North to `fell_top` at 07:00 with no garment worn. | `chilled` applied (its applied line); Character page shows the condition; `hungry` and `thirsty` applied in the same receipt; the room's frost variant shows. | statuses x reactions; sky x exposure x equipment |
| 3 | Wait to 09:00 (two game hours, 7200). | One chilled tick: hp 9; hunger 8 and thirst 8 after two need ticks; the 08:00 `clock_hour` refreshed `chilled` silently (no second applied line). | statuses x reactions |
| 4 | South to `fell_gate` at 09:00; wait to 11:30. | No refresh under the roof: the 09:00 refresh set the end to 11:30 (32400 + 9000); the 11:00 tick puts hp at 8; at 11:30 the expired line, with no cure. The developer pins these two times from row 1's refresh rule in the test. | |
| 5 | Wear `cloak`, north to `fell_top`. | Nothing applies (the `not wearing warm` leaf fails); the frost variant still shows. | sky x exposure x equipment |
| 6 | Same step on a rain day wearing only the cloak, then wearing the oilskin. | `soaked` applies with the cloak; nothing with the oilskin. | sky x exposure x equipment |
| 7 | Stand on `fell_top` across 08:00 on the frost day. | Wat arrives at 08:00; the `wat_frost` rule chills him (no player line, [row G3](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3)); his room line reads the shivering variant; at 09:00 he leaves for the hut; at 10:00 his tick puts him at hp 9; at 10:30 the variant stops. | NPC status x variants x schedule |
| 8 | East to `shepherd_hut`; eat `hut_loaf`; drink from `trough_skin`. | Eat ends `hungry` (mv +5, hunger pool unchanged); Drink ends `thirsty`; both conditions leave the Character page. | |
| 9 | West to `still_room`; take `quern`. | Refused: 7000 g over the 5000 g carry. | potion x derived carry |
| 10 | Drink from `cask`; take `quern`. | `might` applied; Character page str 13; carry 8000 g; the take succeeds. A second dose at once moves the end, never stacks (str stays 13). | potion x derived carry |
| 11 | `throw_bones` before any song. | Failure line (dex 10 < 11). | |
| 12 | `play_song` (holding the lute), then `throw_bones`. | Song line plus the tip once; `inspired` on the player and on Orla (her humming variant); dex reads 12; the throw passes. 1800 later both expire. | statuses x reactions |
| 13 | Drought day: `fell_top`. | `parched` applied; a drink from the trough skin ends it; the next `clock_hour` on the moor applies it again. | sky x exposure x equipment |

Sandbox `the_fold`: everything above in one exposed room: wear any mix of garments and watch
which condition lands by the day's weather; drink, play, shove the Drover (passes only under
`might`), throw the fold bones.

### Later (not in this slice)

W8 permanent scars: the first `status_ticked` of Wat's `chilled` applies a `duration: permanent`
`chilblained` status with a room-line variant; the batch that lands W8 adds it here.

## World district: Tidewater Steps (slice A)

Rows: 10, 11, 30, 31, W6, W7.

### Rooms and map

| Room | Tags | Exits | Holds |
|---|---|---|---|
| `shore_steps` (sign; the shingle) | `exposed` | west `crossroads_inn`, north `cliff_path`, east `sea_cave` through barrier `tidegate`, south `tide_pools` | `sign_world`; `net` (item, `description_variants` on `sky {weather: rain}`: "sodden"); detail `horizon` |
| `cliff_path` | none | south `shore_steps`, north `cliff_top` | **Idony** |
| `cliff_top` | `exposed` | south `cliff_path`, down `smugglers_stair` (climb face `{item: rope, damage: 3, fell}`), east `tide_pools` through barrier `moon_door` | `rope` |
| `smugglers_stair` | none | up `cliff_top` (plain), down `sea_cave` (plain) | nothing |
| `sea_cave` | none | west `shore_steps` through `tidegate`, up `smugglers_stair` with `hidden_until {fact: stair_found, equals: true}` | detail `cleft` |
| `tide_pools` (sandbox) | `exposed` | north `shore_steps`, west `cliff_top` through `moon_door`, east `sea_cave` (plain, no gate) | `spare_rope`; detail `pool_cleft` |

Barriers (`time_sampler/barriers`): `tidegate` `initial: closed`, `opens_when sky {tide: low}`;
`moon_door` `initial: closed`, `opens_when sky {lunar: full}`. Both rooms on each side say in
their description why the door is shut (a `sky` variant).

### Signpost (`sign_world`, readable in `shore_steps`)

> Tidewater Steps. The cave east opens only at low tide; once open it stays open. The cliff path
> north climbs to a drop you can only take safely with the rope that lies at the top. Down there
> a stair leads back into the cave. The cave hides a shortcut up to that stair; you will only find
> it by searching after dark. The door on the cliff top opens under a full moon. Look about here
> more than once: the words change, and by your third visit the shore knows you. The pools south
> are all of this with every door open.

### NPCs, items, recipes

- **Idony** (the watcher): stays on `cliff_path`; `short_variants` "a dozing watcher" while
  `time_window {from: 0, to: 6}`, `description_variants` on `sky {season: winter}`
  (`variants_sampler`).
- `shore_steps`: `description_variants` on `visited_count {room: shore_steps, at_least: 3}`
  (the familiar one-liner, first in the list), then one per season, then `sky {weather: rain}`
  (`variety_sampler/rooms/garden.json`; first match wins, so the tier sits first).
- Recipe `look_about` at `horizon`, narration key with two `alternates` (three lines in all;
  `variety_sampler/cartridge.json`).
- Recipe `search_cleft` at `cleft`: policy `time_window {from: 20, to: 23}`, success
  `fact.assign stair_found true`, `tip`: "Searching costs nothing; some things only show in the
  dark." (`hidden_sampler/recipes/search_panel.json`, `quest_sampler` tip). Sandbox twin
  `search_pool_cleft` with an empty policy assigning the same fact.
- Facts: `stair_found` (player bool).

### Guided loop and expected outcomes

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | Read `sign_world`; `look_about` twelve times; step west into the inn and back (visit 2 of the shore). | All three lines appear; the same command ids give the same lines on replay. | |
| 2 | Open `tidegate` at 07:00 day 1. | Refused `invalid_state` (tide high from 06:00 to 12:00: 21600..43200 of the 43200 cycle); the room's high-tide variant says so; no Open offered. | tide x hidden x night x climb |
| 3 | North twice to `cliff_top`; move down without the rope. | The move happens; the fall line; hp 7 (10 - 3); the player is on `smugglers_stair`. | tide x hidden x night x climb |
| 4 | Up (plain), take `rope`, down. | No fall, no line, hp 7. | |
| 5 | Down to `sea_cave`; `search_cleft` at 10:00. | Unavailable (outside the window); a typed `search` is refused; the cave's Exits list only west. | tide x hidden x night x climb |
| 6 | Wait to 12:00; open `tidegate`; west. | Opens at low tide; this is the shore's third visit, so its description is the familiar one-liner. | visit tiers |
| 7 | Wait to 20:00; east (the gate stays open at high tide); `search_cleft`. | Success line plus the tip once; Exits now list up; the map links the cave to the stair; a move up succeeds. | tide x hidden x night x climb |
| 8 | On a winter day at 03:00 pass Idony. | Her name reads the dozing variant; after 06:00 the base; her description reads the winter variant. | |
| 9 | Wait to the first full moon (172800 from the lunar origin: day 3, 00:00); open `moon_door` on `cliff_top`; east. | Opens; the player is in `tide_pools`; at a new moon the Open is refused and the cliff's variant says why. | |

Sandbox `tide_pools`: the pool cleft searches at any hour; the spare rope; every door reachable
without a gate; the room's description has one variant per weather, season and tide phase so the
dev clock shows each.

## Social district: Low Wardle (slice B)

Rows: 13, 14, 15, 46, G11, G12, W2, W3, W10, W23, W24, W27 and the quest-and-scene loop
(quest@1, dialogue@1, scene@1).

### Rooms and map

| Room | Exits | Holds |
|---|---|---|
| `village_green` (sign) | north `crossroads_inn`, east `warden_gate`, west `church`, northeast `mill`, south `moot_hall` | `sign_social`; **Nell** (baker, shop); **the Reeve**; `apple`; `letter` on detail `moot_stone` (an item lying in the room) |
| `warden_gate` | west `village_green`, east `tollhouse` through barrier `toll_gate` | **Warden**; **Tam** at 07:00 (his cart) |
| `tollhouse` | west `warden_gate`, north `mill` through barrier `tollhouse_door` (`wooden`, `fragile`), east `moot_hall` through barrier `iron_door` (`metal`) | `strongbox` (container whose lid `opens_when fact_compare strongbox_picked true`, holding `mill_ledger`); details `strongbox_lock` (rating 1), `tollhouse_door` (rating 5), `iron_door` (rating 5) |
| `mill` | southwest `village_green`, south `tollhouse` through `tollhouse_door` | detail `millwheel` |
| `church` | east `village_green` | `parish_roll` (readable, topic `parish`); detail `lectern` |
| `moot_hall` (sandbox) | north `village_green`, west `tollhouse` through `iron_door` | **Bess** (alewife); `hall_strongbox` (lock rating 1); barrier `hall_cupboard` (`wooden`, `fragile`, rating 5) to a one-detail closet room `hall_closet`; `hall_roll` (readable, topic `parish`); detail `hall_lectern` |

### Signpost (`sign_social`, readable in `village_green`)

> Low Wardle. The village keeps one score for you and each person keeps their own: help the Reeve
> or curse him and watch Nell's prices and the Warden's temper change; give someone the apple and
> see who warms to you. Talk your way past the Warden, or lean on him; what fails today passes
> with practice. Tam the carter goes to the mill at ten and comes to the green at eleven, unless
> it rains; what he saw there he tells whoever he meets, and only then will Nell talk about it.
> Read what you find and think at the church lectern. The Reeve has a letter for Wat on the fell;
> he wants it there within twenty minutes of your clock, and the moor will not wait either. Come
> back after a long absence and the page opens with what you missed. The moot hall, south, has it
> all behind one door.

### Facts (`standing_sampler/facts.json`, `scoped_facts_sampler`, `codex_sampler`)

- `wardle_standing`: instance int -2..2, default 0 (the village faction).
- `trust`: player int 0..2, `per_subject: true` (one value per NPC).
- `knows_fire`: instance bool, `per_subject: true` (entity fact; the rumour).
- Player bools: `warden_lets_pass`, `strongbox_picked`, `tollhouse_forced`, `hall_box_picked`,
  `hall_cupboard_forced`, `letter_late`, `topic_parish_known`, `topic_fire_known`,
  `topic_mill_known`, `topic_heir_known`, `topic_walker_known`.
- Topics (`topics/*.json`): `parish`, `fire`, `mill`, `heir`, `walker` ("Wardle walker").

### NPCs and dialogues

- **Nell**: shop `bread` buy 4 sell 1, `buy_discount {friendly: true, 1/2, minimum 1}`;
  `disposition` hostile at `wardle_standing` -2, friendly at 1 or 2
  (`standing_sampler/npcs/peg.json`). Dialogues in key order: `nell_rumour` (policy
  `fact_compare {fact: knows_fire, subject: target, equals: true}`; no quest) with the checked
  choice `press` (`check {key: press_nell, kind: opposed, skill: intimidate, rating: 2,
  failure}`, sequence `fact.assign topic_fire_known true`) and `leave`; then `nell_talk` (empty
  policy, one `leave` choice) so Talk always opens something.
- **The Reeve**: dialogue `reeve_talk` (no quest): `accept` (`accept: carry_letter`), `help`
  (`fact.adjust wardle_standing +1`), `wrong` (`fact.adjust wardle_standing -2`), `leave`;
  `description_variants` on `fact_compare letter_late true` ("The Reeve does not look up.").
- **Warden**: hp 5 gain 0, `attack {chance 0, 1..1}`, `attributes {cha: 5}`; `disposition`
  hostile when all(`wardle_standing` -2, `trust` 0 at `subject: target`), `engage` line
  (`standing_sampler/npcs/guard.json`). Dialogue `warden_talk` (no quest): `reason` (`check` cha
  against `npc: warden`, sequence `fact.assign warden_lets_pass true`), `lean` (`check` skill
  `intimidate` rating 1, same sequence), `leave` (`persuade_sampler/dialogues/guard.json`).
  Barrier `toll_gate` `opens_when fact_compare warden_lets_pass true`.
- **Tam**: `room: warden_gate`; `daily_schedule` 10 `mill`, 11 `[{when: sky {weather: rain},
  room: church, goal: "Tam makes for the church porch out of the rain."}, village_green]`,
  15 `warden_gate` (`schedule_sampler/npcs/maud.json`).
- **Wat** (slice A's NPC): dialogue `wat_letter` with `quest: carry_letter`, roles `wat` and
  `letter`, policy `quest_state {quest: carry_letter, state: objectives_complete}`; choices
  `deliver` (`hand_over {item: letter, to: wat}`) and `burn` (narration only)
  (`ashmere_scene/dialogues/bram.json`). No checked choice here (row 14 forbids one in a quest
  dialogue).
- **Bess** (sandbox): shop as Nell's; disposition as Nell's; dialogue `bess_talk` (no quest):
  `praise` (+1 standing), `insult` (-2 standing), `boast` (`check` cha rating 1: passes),
  `lean` (`check` intimidate rating 3: fails until level 3 is never reached with growth
  `[1, 2]`; shows a check that practice cannot beat), `leave`.

### Reactions, recipes, quest, scene

- Gift: `on {event: item_acquired, item: apple}` `apply fact.adjust trust +1` (the holder is the
  subject; `standing_sampler/reactions/gift_apple.json`).
- Rumour (`rumour_sampler/reactions`): `tam_sees` `on {entity_entered_room, room: mill, npc: tam}`
  `apply fact.assign knows_fire true` (unnamed: the entrant); `tam_tells_nell`
  `on {entity_entered_room, room: village_green, npc: tam}` `when fact_compare {knows_fire, npc:
  tam}` `apply fact.assign {knows_fire, npc: nell, value: true}`.
- Badge: five reactions, one per `entity_entered_room` into `village_green`, `warden_gate`,
  `tollhouse`, `mill`, `church`, each `when all(visited_count at_least 1 for the five rooms, not
  topic_walker_known)` `apply fact.assign topic_walker_known true` (`codex_sampler/reactions`).
- Pick: recipe `pick_strongbox` at `strongbox_lock`, check opposed skill `pick`, policy
  `strongbox_picked false`, success assigns it; no jam (`barrier_sampler/recipes/pick_lock.json`).
- Force: `force_tollhouse_door` at `tollhouse_door`, check opposed `str`, policy all(`has_tag
  {barrier: tollhouse_door, tag: fragile}`, `tollhouse_forced false`), success assigns
  `tollhouse_forced`; barrier `opens_when fact_compare tollhouse_forced true`.
  `force_iron_door` at `iron_door` with `has_tag {barrier: iron_door, tag: fragile}` (never holds).
  Sandbox twins on `hall_strongbox` and `hall_cupboard`.
- Deduction: recipe `think_lectern` at `lectern`, policy all(`topic_parish_known`,
  `topic_fire_known`, not `topic_heir_known`), success assigns `topic_heir_known`
  (`codex_sampler/recipes/deduce_smugglers.json`); sandbox twin at `hall_lectern`.
- Quest `carry_letter` (`quest_sampler/quests`, `ashmere_scene/quests`): no `offer` (dialogue
  accept only); objective `current_state` `has_item letter`; `deadline {after: 60000, outcome:
  late}` (twenty real minutes); `journal` texts with `hints.active` after 5 ("The Fell Road runs
  north from the inn.") and 10 ("Wat keeps the hut east of the fell top."), `hints.objectives_met`
  after 5 ("Wat will take it from your hand; talk to him."); `outcomes` `delivered`, `burned`, `late`.
- Story point `letter_fate`: outcomes `delivered` {`wat_letter`, `deliver`} and `burned`
  {`wat_letter`, `burn`} (`ashmere_scene/story_points`).
- Scenes (modal, two `narrate` steps, `await_ack`, `end`): `letter_read` on `{story_point:
  letter_fate, outcome: delivered}`, `letter_ash` on `burned` (`ashmere_scene/scenes/bell_rung.json`).
- Scene-end reactions (`ashmere_scene/reactions/bell_after.json`): on `fact_changed
  scene_letter_read` equals -1 `apply fact.adjust wardle_standing +1`; on `scene_letter_ash`
  equals -1 `apply fact.adjust wardle_standing -2`.
- Deadline: `on {quest_failed, quest: carry_letter, outcome: late}` `apply fact.assign letter_late
  true` and `fact.adjust wardle_standing -1` (`quest_sampler/reactions/late.json`).

### Guided loop and expected outcomes

Day 1 is a dry day with frost (the letter run crosses the fell); the rain branch is day 2.

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | Read `sign_social`; buy bread from Nell. | Costs 4; standing 0, Nell wary. | disposition x commerce x dialogue |
| 2 | Talk to the Reeve: `help`. | Standing 1; Nell friendly; bread now 2; Nell's shelf shows the price. | disposition x commerce x dialogue |
| 3 | Talk to the Reeve: `wrong` twice. | Standing -1 then -2 (clamped); Nell refuses to trade and to talk (`invalid_state`, the shelf's reason); walking east the Warden's engage line opens an encounter (hp 5, chance 0: no damage; Flee or wait; the combat district owns the rest). | disposition x commerce x dialogue |
| 4 | Fresh world: give the Warden the apple; `wrong` twice; walk east. | Warden trust 1, so no engagement; Nell still hostile. Give Nell the apple instead in another run: her trust 1, the gift reaction names no NPC and lands on whoever holds it. | |
| 5 | Fresh world: Talk to the Warden: `lean`. | Failure line, conversation closes, intimidate use 1 (level 1). Talk again: `lean` passes (1 ≥ 1), use 2 (level 2), `warden_lets_pass` true; `toll_gate` opens. (`reason` passes at once: cha 6 ≥ 5.) | dialogue checks |
| 6 | East; `pick_strongbox`. | First pick fails (level 0 < 1), second passes; the lid opens; take `mill_ledger`, read it: Lore lists "The mill". | |
| 7 | `force_iron_door`; `force_tollhouse_door`. | Iron: unavailable and refused (not fragile); wooden: passes (10 ≥ 5), the door opens north to the mill. | locks (pick and force) |
| 8 | Be at the mill at 10:00, the green at 11:00 (dry day). | 10:00 Tam arrives at the mill (`knows_fire` on Tam); 11:00 he arrives on the green and Nell's `knows_fire` turns true; Talk to Nell now opens `nell_rumour`; `press` passes (level 2 ≥ 2) and Lore lists "The fire". On the rain day, standing in the mill at 11:00 shows "Tam makes for the church porch out of the rain.", Nell learns nothing, and `nell_talk` opens instead. | rumour x dialogue check x codex; schedule cases x sky |
| 9 | Church: read `parish_roll`; `think_lectern`. | Lore lists "The parish"; the Journal's Lore shows the deduction card (from "The parish" and "The fire"); performing it grants "The heir" once, then the card is gone. Having walked green, gate, tollhouse, mill and church, "Wardle walker" is already listed from the fifth room. | visit tiers x codex badge |
| 10 | Talk to the Reeve: `accept`; take the `letter`. | Quest active, then `objectives_complete` on the take; Journal shows "Time left" counting from 60000; at 5 real minutes (15000 units) the first hint, at 10 the second. | quests x deadlines x hints |
| 11 | North to the inn, north to the fell with no cloak (frost). | `chilled` applies and ticks while the countdown runs; the Journal shows both the condition and the time left. | deadlines x exposure |
| 12 | East to Wat before 60000: `deliver`. | The letter moves to Wat; quest resolved `delivered`; story point reached; scene `letter_read` runs (two lines, acknowledge); on its end standing +1; the Journal shows the `delivered` text. `burn` instead: scene `letter_ash`, standing -2, Wat keeps nothing. | scenes x dialogue x reactions |
| 13 | Fresh world: accept, then wait 60000. | `quest_failed late`; `letter_late` true; standing -1; the Reeve's description reads the cold variant; the Journal shows the `late` text and no time left. | quests x deadlines x hints |
| 14 | Accept at 07:00 day 1, then an elapsed settlement of three real hours (150 game hours). | The next page opens with one collapsed recap block: Tam's arrivals and departures as seen from the green (each with its count), the quest's late outcome line, the chilled tick lines if the player stood on the fell; two real minutes away shows no block. | deadlines x schedules x away recap |

Sandbox `moot_hall`: Bess's shop, praise and insult to swing the standing and her prices, a check
that passes (`boast`), a check practice never beats (`lean` 3), a box to pick, a cupboard to
force, a roll to read and a lectern to think at.

## Matrix cells this slice covers

Filled in [SHOWCASE.md](../SHOWCASE.md#pairwise-mechanic-matrix): statuses x reactions; sky x
exposure x equipment; disposition x commerce x dialogue; deadlines x schedules x away recap; quests
x deadlines x hints; scenes x dialogue x reactions; hidden exits (the senses and traps part is later);
and the new rows this batch makes possible (rumour x dialogue check x codex, visit tiers x codex
badge, tide x hidden x night x climb, potion x derived carry, NPC status x variants x schedule,
deadline x exposure). Combat x loot x levelling x death waits for the combat district.

## Open questions for the PM

1. The hp pool minimum 1 (no death anywhere in this cartridge) is the exposure sampler's floor;
   the combat district brief lowers it to 0 and re-pins the exposure numbers then.
2. Step 4 of the body loop: the developer pins the exact chilled tick count from
   [row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1) (ticks at 7200 after
   each refresh) rather than the estimate in the table; the reviewer checks the arithmetic.
3. `time_window {from: 20, to: 23}` for the night search: if the window may wrap past midnight,
   widen it to 20:00 to 05:00; otherwise the sign's "after dark" stands as 20:00 to 22:59.
