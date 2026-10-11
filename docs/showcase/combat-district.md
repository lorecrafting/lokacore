# Showcase plan 2: the combat district

District brief for `cartridges/toolbox_showcase` ([showcase](../SHOWCASE.md), Beads `loka-y6yg`),
written by Fable for an Opus developer to build and an Opus reviewer to check against. Base: `main`
after batch M7 (PR #366) with slices A (#365) and B (#367) built. It uses only installed mechanics;
every field named here has a sampler precedent, cited per item, and the developer copies shapes from
those samplers. A step that turns out to need engine code is a finding against the toolbox row, not
showcase work. Batch M8 (traps, fear, use-on, puzzles) is not on `main`: its pairs are listed under
[Later](#later-after-m8) and not planned.

Conventions as in [plan 1](hub-and-first-districts.md): snake_case ids, the developer's words except
the signposts, the game clock (one round is 150 units; one game hour 3600). Two cartridge-wide
changes this district makes, both scheduled by plan 1:

- **The hp pool's minimum becomes 0** (`resources.json`; plan 1 settled question 1). Death needs a
  positive-to-zero transition ([death@1](../system/mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation)).
  Consequence for the body district: a drain can now kill (a negative tick to 0 runs the death
  sequence with no killer, [row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1));
  the plan 1 steps never fall below 7, so no body or world pin changes, and the climb's "never
  below 1" is the climb's own rule ([row 30](../system/mechanics.md#rope-and-climb-toolbox-row-30)).
- **Every attackable NPC's hp minimum is 0.** Only NPCs with an `attack` are attackable
  (`attackRefused`, `kernel/ts/src/mechanics/combat/shared.ts`); the Warden already has minimum
  0, and the new NPCs below declare it, so no hit reaches Beads `loka-2lvx` (an NPC at minimum 1
  faults on a hit below 1). Wat keeps minimum 1 and Nell and Bess declare no hp: none has an
  `attack`.

## The `world.combat` constraint

The cartridge has one `world.combat` block and the social district needs `player_attack.chance 0`
so the Warden can never be killed (`showcase_social.test.ts` social 2-3). The combat district keeps
that block unchanged and makes the player dangerous another way, with two belts and braces:

1. **The player hits only with a wielded weapon.** The attack profile that strikes is the usable
   wielded weapon's, else `player_attack` ([row 2](../system/mechanics.md#stats-derived-from-attributes-toolbox-row-2);
   [C1](../system/mechanics.md#c1-training-and-armed-defense-selected-contract)). Aldous's lesson
   acquires the `blade` skill and hands over the `training_sword` (`weapon.attack` chance 100,
   damage 2, `kind: physical`; `damage_sampler/items/iron_sword.json`, C1's
   `tobin_swords.json` `skill.acquire` + `receive`). Unarmed, in every district, the player still
   lands nothing. No `world.derived.hit_chance` table: it would lift the unarmed chance too.
2. **The Warden resists `physical` 100** (`resistances`, [row G2](../system/mechanics.md#damage-kinds-resistances-and-critical-hits-toolbox-row-g2)):
   a sword hit on him is `hit: true, loss: 0`, narrated as a hit, before and after crits and the
   derived damage bonus (order: damage, crit, resistance). The engagement holds, Flee and the talk
   path stay as social 2-3 pins them. The combat signpost says his mail turns every blade (no trap).

`world.derived.damage` (str, per_point 1, pivot 10, divisor 1; `levelling_sampler/cartridge.json`)
is added: it changes both damage bounds of whichever profile strikes, so a Raise or `might` bites
harder with the sword and changes nothing unarmed (chance 0 never deals the unarmed 1).

## Manifest changes

- `requires.kernel_api.at_least` 1.48; capabilities add `population` (the pit's pack),
  `sense_cue` (the boar's cue) and `speech` (say and shout). Levelling needs no capability
  (attributes@1 is declared).
- `world.combat` adds `target_choice: true`, `allies: ["gil"]` and the narration keys `ally_hit`
  and `ally_miss` (`targets_sampler/cartridge.json`); `player_attack` is unchanged.
- `world.levelling`: `thresholds [30, 100]`, `points_per_level 1`, `kills` raider 10, boar 30, tilt boar 30,
  goblin 10, `level_up` text (`levelling_sampler`). A `kills` entry on the goblin spawn template
  is the first such use; experience follows the victim's definition
  ([row 4](../system/mechanics.md#experience-and-levelling-toolbox-row-4)), so it should count. If
  the compiler refuses a template there, drop the entry and pin the pack's experience as 0 (a
  toolbox finding).
- `world.death_credit`: `[{npc: raider, room: gate_yard, fact: raider_slain}]` (`targets_sampler`).
- `world.derived.damage` as above. No `hp_max` table (Beads `loka-kgd.50`).
- Statuses ([row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1),
  [row W8](../system/mechanics.md#permanent-statuses-toolbox-row-w8); `scars_sampler/statuses/scar.json`):
  `bleeding` hp -1 every 900 for 1800, with a `cues` entry (smell, range 0, "the iron smell of
  your own blood"; a status cue is active from the holder's room,
  [row G6](../system/mechanics.md#sense-cues-sound-smell-and-heat-toolbox-row-g6)); `gored`
  `duration: "permanent"`, no `per_tick`, label "Gored".
- Skill `blade`: label, requirement, empty qualification, no growth (`damage_sampler/skills/swords.json`).
- Facts: `raider_slain` (player bool, the death-credit fact); `gil_warned` (player bool).
- Pool `hp` minimum 0 (above).

## Hub changes

`crossroads_inn` gains west `drill_yard`. The inn description's "the west wall has no door yet"
becomes a gate west to the drill yard, and the hub signpost's "A fourth road, west, is not cut
yet." becomes:

> West, the Drill Yard: a sword lesson, a boar that marks you, a pack that fights as one, and a fall
> you come back from with what you learned.

The hub pin's exit count rises to four. The build slice edits `text.json` `readable.sign_hub` and
`room.crossroads_inn.description` (the "Three roads" wording) and adds the five new rooms to
`map_positions.json`.

## Rooms and map

| Room                                   | Exits                                                                            | Holds                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `drill_yard` (sign)                    | east `crossroads_inn`, north `boar_run`, west `gate_yard`, south `goblin_pit`    | detail `sign_combat`; **Aldous** (holds `training_sword`); `poultice` on detail `bench` (edible, `mv` +1, `cures: [bleeding]`; `scars_sampler/items/salve.json`)                                                                                                                      |
| `boar_run`                             | south `drill_yard` (the only exit, so Flee is deterministic: one candidate, no RNG) | **the boar**                                                                                                                                                                                                                                                                                           |
| `gate_yard`                            | east `drill_yard`, south `tilt_yard`                                             | **Gil** (ally), **the raider**                                                                                                                                                                                                                                                                         |
| `goblin_pit`                           | north `drill_yard`                                                               | population `goblins` (home; see [the pack](#the-pack-and-beads-loka-6ql4))                                                                                                                                                                                                                             |
| `tilt_yard` (sandbox)                  | north `gate_yard`                                                                | **tilt boar** (`tilt_boar`: its own definition with the boar's fields, its own `tilt_tusk` and `tilt_purse`, its own `kills` entry of 30, and a leaf in `boar_gore`); `tilt_cask` (vessel, 3 doses of `draught`: `might`, as the still room's); `tilt_poultice`; population `tilt_goblins` (a second pack, home here, area `[tilt_yard, gate_yard]`)                                                                 |

No combat room is `exposed`, so no weather drain lands; no door is gated; rooms are not sanctuaries.

### Signpost (`sign_combat`, readable in `drill_yard`)

> The Drill Yard. Aldous teaches the blade and lends the sword that goes with it; without a sword in
> hand your blows land nothing, here or anywhere. North, a boar is penned: you can hear it grunt
> from this yard. It gores: a wound that bleeds for a while and a scar that stays, even past your
> death. The poultice on the bench stops the bleeding; nothing takes the scar away. West, Gil keeps
> the gate with a raider in it; shout "ware" from here and Gil hears you through the wall, and he
> fights beside you once you strike. Aldous pays a bounty on the raider, but only to one who takes
> it before the raider falls. South is a pit with two
> goblins who fight as a pack: in a pack you choose which one you hit. A kill that ends a fight earns
> experience (in a pack, the last goblin standing); thirty points make a level and a point to raise a stat, and raised strength bites harder. When you
> fall you wake at the inn with your level, your scar and your skill; what you carried waits on your
> corpse where you fell. The Warden in Low Wardle wears mail no blade gets through. The tilt yard,
> south of the gate, has all of it and a draught.

### NPCs, items, dialogues, reactions

- **Aldous** (drill-master): stays in `drill_yard`; no `attack`. Dialogues in key order, as
  Nell's: `aldous_lesson` (policy `fact_compare skill_blade false`; roles `teacher` and `sword`;
  choice `learn`: `sequence [skill.acquire blade]`, `receive {item: sword, from: teacher}`, no
  `lesson_payment`; `leave`), then `aldous_talk` (policy `fact_compare raider_slain false`; `bounty`
  with `accept: bounty`, `leave`), then `aldous_yard` (policy `fact_compare raider_slain true`; its
  own prompt and `leave` only, so no bounty is offered once the raider is dead), and `aldous_steel` with `keyword: "steel"` (one `leave` choice; its prompt is the
  answer; Talk never lists it, [row G9](../system/mechanics.md#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half);
  `speech_sampler`). `description_variants` none.
- **The boar**: `room: boar_run`; hp 0..8 start 8 gain 0; `attack {chance 100, 2..2}`;
  `immune: [bleeding, gored]` (`npc_status_sampler/npcs/golem.json`); `drops: [{tusk, 100},
  {purse, 50}]` with `tusk` and `purse` `location {in: npc, npc: boar}` (`loot_sampler/npcs/rat.json`);
  `cues: [{sense: sound, text: cue.boar, range: 1}]` (`senses_sampler/npcs/sentry.json`; a dead
  NPC's cues are silent); `short_variants` none.
- **Gil** (the ally): `room: gate_yard`; hp 0..10 gain 0; `attack {chance 100, 1..1}`;
  `description_variants` on `fact_compare gil_warned true` ("Gil has his spear up; he heard you
  call."). Listed in `world.combat.allies`; never an Attack target; takes no combat damage
  ([row 6b](../system/mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b)).
- **The raider**: `room: gate_yard`; hp 0..3 gain 0; `attack {chance 100, 1..1}`; no disposition
  (passive until attacked; it is the death-credit NPC).
- **Goblins**: `npcs/goblin.json` `spawn_template: true`, hp 0..6 gain 0, `attack {chance 100,
  1..1}`; bundle `goblins {npc: goblin, item: ear, corpse: npc_corpse}`; plan `goblins`: home
  `goblin_pit`, area `[goblin_pit, drill_yard]`, cap 2, day and night targets 2, `night_start` 20,
  `night_end` 6, `replacement_delay` 86400, `wander_interval` 8640000 (one hundred days: the pack
  never wanders in play), `pack {flight_below_percent 25, flight_fare 0, narration ...}` with
  `enemy_fled` keyed `north` (`targets_sampler/populations/goblins.json`). A goblin below 25%
  (hp 1) tries to flee north into the yard before its blow and stays there, passive. `tilt_goblins`
  is the same plan with home `tilt_yard`.
- **Warden**: adds `resistances {physical: 100}`; nothing else changes.
- `training_sword`: `slot: wield`, `weapon {skill: blade, attack {chance 100, 2..2, kind:
  physical}}`, `tags [metal, sharp]`, 600 g, `location {in: npc, npc: aldous}`.
- Reaction `boar_gore`: `on {event: attack_result, hit: true}`, `when any(npc_present {npc: boar},
  npc_present {npc: tilt_boar})`,
  `apply [status.apply bleeding, status.apply gored]` (`scars_sampler/reactions/bite.json`). The
  status lands on the event's target: the player when the boar strikes, the boar (immune, so
  nothing) when the player or Gil strikes it. `attack_result` has no attacker filter, so
  `npc_present` is what keeps the raider's and the goblins' blows clean (they never share a room
  with the boar).
- Reaction `gil_hears`: `on {event: spoken, npc: gil, word: "ware", loudness: "shout"}`, `apply
  fact.assign gil_warned true` (`speech_sampler/reactions/watchman_alarm.json`).
- Quest `bounty` (`levelling_sampler/quests/cull.json` shape; no `offer`, dialogue accept only):
  objective `current_state fact_compare raider_slain true`; journal texts; outcome `done`.
  Reactions `bounty_done` `on fact_changed raider_slain` `when quest_state {bounty, active}`
  `apply quest.resolve {bounty, done}`, and `bounty_reward` `on quest_resolved {bounty, done}`
  `apply experience.grant 20`. `DialogueChoice.availability` takes only times, so the
  gate is the two dialogue policies: once `raider_slain` is true Talk opens `aldous_yard` and the
  bounty can no longer be accepted (it could never resolve). The `when` keeps a raider killed with
  no bounty taken from faulting the round (`precondition_failed`; combat 11).

### Guided loop and expected outcomes

Any day: no combat room is exposed and nothing here reads the sky. Every attack is chance 100 or 0,
so no step but the purse drop depends on the seed. The player carries the inn's `waterskin` from
step 1. Times are relative to the Attack that opens each fight (rounds at +150, +300, ...; odd
rounds player first, even rounds opponent first, the ally after both). Moves cost 1 mv (the engine
default) and Flee 2, so mv is below 100 from step 1 on; no step pins an mv value.

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | West from the inn; read `sign_combat`. | The text above. GameView `cues` lists the boar's grunt with direction north; in the inn (two exits away) and in `gate_yard` none. | senses cues x combat |
| 2 | Talk to Aldous: `learn`; wield the sword; `say steel`; Talk: `bounty`. | `skill_blade` true, the sword received and worn in `wield`; Talk now opens `aldous_talk` (the lesson's policy fails). `say steel` opens `aldous_steel` (`choice_opened`); Talk never lists it; the same say in `gate_yard` is `spoken` only. `bounty` activates the quest (Journal active). | lesson x weapon; say x dialogue keyword |
| 3 | `say ware`, then `shout ware`, in the yard. In a separate branch (before any yard shout), `shout ware` from the inn. | After the say `gil_warned` is false (a say reaches the actor's room only); after the shout true, and Gil's description in `gate_yard` reads the warned variant. The inn branch: still false (two exits from Gil). The fact never resets, hence the branch. | shout x reactions x variants |
| 4 | West; Attack the raider; round 1. | Player hits 2 (raider 1); the raider hits (hp 9); Gil hits 1 and the raider dies: `entity_died` with Gil as killer and the player credited; `raider_slain` true; `bounty` resolves `done` in the same proposal; experience 10 + 20 = 30, level 2, one `level_up` line last, 1 unspent; the raider's corpse is public and empty; Talk to Aldous then opens `aldous_yard` (Leave only). (Gil's own blow emits `attack_result`; `boar_gore` does not fire: no boar here.) | allies x kill credit x quest x levelling |
| 5 | Raise `str`. | str 11, unspent 0, no Raise offered; the sword's derived damage is 3 (2 + floor(1 x (11 - 10) / 1)). | levelling x derived damage |
| 6 | Remove the sword (held, not wielded); east, north to the run; Attack the boar unarmed; five rounds. | In the run the cue has no direction. Round 1: the player's blow misses (chance 0); the boar hits 2: hp 7, `bleeding` and `gored` applied lines; the Character page shows Bleeding (with its tick) and Gored (no time, no tick); the bleeding's smell cue shows from the player's own room. Rounds 2 to 5: hp 5, 3, 1, 0 at +750 (the last loss clamped to 1); no bleed tick falls before it (+1050). `player_died`; the encounter closes; the body is in `crossroads_inn` at hp 10, mv 100, standing; `gored` is still active (W8) and `bleeding` is gone (the return clears every other status); experience 30, level 2, str 11 unchanged (no penalty: row 47 is later); the player corpse in the run holds the sword and the waterskin; the boar is at 8. | combat x death; scars x death; statuses x death; levelling x death |
| 7 | Back to the run; take the sword and the waterskin from the corpse; wield the sword. | Both Takes succeed (owner's corpse); the boar is passive outside combat (no hostile disposition). The corpse stays, empty. | death x containment |
| 8 | Attack the boar (sword, damage 3); three rounds. | Round 1: boar 5; the boar hits 2 (hp 8, `bleeding` applied again, generation 2, its line; `gored` already active, nothing written, no line). Round 2 (boar first): hp 6; boar 2. Round 3: boar 0 before it strikes: `npc_died`, experience 60 (no level: 100 not reached), drops rolled after the round's draws: the corpse holds `tusk` (chance 100) and, by seed, `purse`. `cues` no longer lists the grunt. At str 10 the same fight is four rounds and four strikes (hp 2). Eat the `poultice`: `bleeding` ends with no tick, mv +1, `gored` stays. Variant without it: ticks at +1050 (hp 5) and +1950 (hp 4), expiry at +2100 (the round-2 refresh). Take the tusk. | combat x loot x levelling; bleed status x cure x immune; senses cues x combat |
| 9 | South to the pit (hp 6, sword, str 11); Attack goblin A (the lower id); Attack goblin B; four rounds. | The first Attack admits both goblins (`helper_joined` line); the second writes `encounter.target` (`primary_changed` line), no round. Round 1: B 3, A strikes (hp 5). Round 2: B strikes (4), B dies at the player's blow; the roster still holds A, so no credit and no experience (Beads `loka-lpq6`). Round 3: A 3, A strikes (3). Round 4: A strikes (2), A dies: the encounter closes, experience 70 (80 once `loka-lpq6` is fixed: re-pin then). Without the switch the first blow would have landed on A. | target choice x pack x kill credit |
| 10 | With the sword, in the social district at standing -2: walk east into the Warden's engage; wait one round; Flee. | The player's blow is a hit with loss 0 (resist 100), the Warden stays at hp 5 and the encounter holds; Flee has one candidate (the toll gate is shut), so no RNG; social 2-3 unchanged. | disposition x resistances |

Sandbox `tilt_yard`: a second boar, a second pack, a poultice and a cask of draught: under `might`
(str 11 + 3) the sword deals 2 + 4 = 6 and the boar falls in two blows; Gil is not here, so the
pack is fought alone. Known limit until Beads `loka-x2gv` lands: a `bleeding` tick due in the same
advance as a combat round on the player (fighting within 900 of a boar's bite without the poultice)
rejects that wait; the guided loop never does this.

## Built (slice C, Beads `loka-y6yg.3`; the pit, Beads `loka-y6yg.10`)

Steps 1 to 10 are built and pinned by `kernel/ts/test/showcase_combat.test.ts` (the pit after the
`loka-6ql4` fix). Differences from the text above:

- The sandbox pack (`tilt_goblins`) is not built: it waits for an attacker filter on
  `attack_result` (Beads `loka-kgd.79`), because `boar_gore` reads only `npc_present tilt_boar`
  and would wound the player (bleeding and gored) on any goblin hit in `tilt_yard`. The tilt
  signpost clause stays "has a second boar, a poultice and a draught".
- The pit's plan has `replacement_delay` 8640000, not 86400: the loader requires
  `wander_interval <= replacement_delay`, and the wander interval keeps the pack from wandering in
  play. A pack killed stays gone for a hundred days. `enemy_fled` names `north` and `south` (the
  loader wants every exit inside the area, from both rooms).
- Step 9 experience is 70 while Beads `loka-lpq6` is open (B's kill pays nothing).
- `aldous_lesson` has `learn` only: a second choice makes it a hub that reopens, and the compiler
  refuses a repeatable `receive` (OUTCOME_MISMATCH). `aldous_talk` is a hub: after `bounty` the
  player leaves with Leave the conversation (`close_choice`).
- `gored` declares `tick_every` 60 and `resource` hp (the schema requires both, as `scar`); with no
  `per_tick` it never ticks, and the Character page row has no end and no next tick.
- The poultice is a room item in `drill_yard` ("by the bench"); no item location names a detail.
- `tilt_boar` has no cue: at range 1 it would be heard in `gate_yard`, against step 1.
- `combat.npc_hit` and `combat.npc_miss` no longer name the Warden's cudgel (every foe uses them).

## The pack and Beads `loka-6ql4`

A population plan owns a wander-and-replacement job whose successor is at most the next night
boundary away (`nightBoundary`, `kernel/ts/src/mechanics/population/shared.ts`), and an elapsed
advance that crosses that successor faults `nonfuture_job` (Beads `loka-6ql4`: "any cartridge with
a pack and a player wait does"). This cartridge's pins already settle days in one elapsed command
(`showcase_world.test.ts` world 8 to day 4, `showcase_social.test.ts` social 14 150 hours). A large
`wander_interval` does not help: the night boundary bounds the successor regardless. So **the two
pack populations (step 9 and the sandbox pack) wait for `loka-6ql4`**; the build slice
checks the issue first and, if it is still open, builds everything else, leaves `goblin_pit` and
`tilt_yard` without their plans, and files the pit as a follow-up slice. This is a toolbox finding
against rows 6a and 6c for this cartridge.

## Pins the build slice writes

- `kernel/ts/test/showcase_combat.test.ts` walking combat 1 to 10 and asserting each expected
  outcome above, including: `cues` with and without direction and their absence after the kill;
  the two statuses' Character page shapes; `gil_warned` false after a say, true after a shout,
  false after a shout from the inn (its own branch); the raider's `entity_died` killer and
  credited ids; experience 30 then 60 then 70 and exactly one `level_up` line in step 4; the
  statuses, experience and corpse contents after the death in step 6; the `primary_changed` write
  without a round (step 9); the deterministic Flee and the Warden at hp 5 after a sword hit. For the purse the test fixes one seed where it drops and one where it does not
  (as `loot_sampler`'s test), stating both; every other number is fixed by the rules.
- The compiled answer `protocol/fixtures/toolbox_showcase_hash.json` (held by
  `test/loka/content_showcase_test.exs`).
- `showcase_body.test.ts`'s hub pin: four exits.
- No Book test: cues, Raise cards and condition lines are existing Book elements (cue wording and
  the Attack choice wording are pending the designer, Beads `loka-kgd.65`, `loka-x6t.14`); say and
  shout have no Book input yet (`loka-kgd.72`), so steps 2 and 3 are kernel-only and the recorder
  recipe skips them.

## Matrix cells this plan covers

Fills in [SHOWCASE.md](../SHOWCASE.md#pairwise-mechanic-matrix): combat x loot x levelling x
death, and the new rows this batch makes possible: target choice x pack x kill credit; allies x
kill credit x quest; scars x death x same-body return; bleed status x cure x immune; senses cues x
combat; say and shout x keyword dialogue x reactions; lesson x weapon x derived damage; disposition
x resistances (the Warden). The senses half of "hidden exits x senses x traps" is shown here by the
boar's cue; the traps half waits for M8.

## Later (after M8)

Not planned here; rows for the next brief once M8 is on `main`: traps x statuses x combat (row 12:
a plate in the pit that poisons once); fear x pack x shout (W21 x 6c x G9: the second goblin flees
when the first falls, or at a shout); use-on x fire x doors (G4, W22); sequence puzzles (26).

## Mechanics wanted and not found (toolbox findings)

1. `attack_result` has no attacker filter (`FILTERS`, `kernel/ts/src/mechanics/reaction.ts`), so a
   wound that one foe inflicts is authored by `npc_present` plus `immune` on the foe; two foes
   that share a room cannot inflict different wounds.
2. Pack kill credit (Beads `loka-lpq6`): only the last goblin standing earns experience.
3. A pack population in a cartridge with long waits (Beads `loka-6ql4`, above).
4. No reaction step moves an NPC (Beads `loka-kgd.22`): Gil cannot come when called; he stands
   where the fight is.
