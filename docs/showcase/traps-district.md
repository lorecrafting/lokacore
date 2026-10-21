# Showcase plan 7: the traps district

District brief for `cartridges/toolbox_showcase` ([showcase](../SHOWCASE.md), Beads `loka-y6yg.19`),
written by Fable for an Opus developer and an Opus reviewer. Base: `main` after PR #403. Only
installed mechanics: rows 12 (traps), W21 (fear), 26 (puzzles), 1 and G6 (a status with a cue),
SR4 (fear reads the pack's turn), 6c (a pack), G9 (shout) and the combat district's sword. Every
shape has a sampler precedent, cited per item; a step that needs engine code is a
[toolbox finding](#toolbox-findings). Build order and shared files: [plan 4](homestead-district.md#build-order-for-plans-4-to-7).

Conventions as in [plan 2](combat-district.md): snake_case ids, the developer's words except the
signpost, the game clock (07:00 day 1 is 25200; a game hour 3600; a round 150). The player hits
only with Aldous's sword (plan 2's belt and braces), so the loop starts in the drill yard.

## Link from the hub

`drill_yard` gains `down` to `sapper_stair` (the six-way compass leaves the inn no free face: see
[plan 4](homestead-district.md#the-hub-has-two-faces-left)). The hub sign's last sentence, "Nothing
here is a trap: when a door will not open, the words in the room say why.", becomes:

> Nothing here is a trap, except under the Drill Yard, where the sign says so first; when a door
> will not open, the words in the room say why.

and the drill yard sign gains one sentence: "A stair goes down from this yard to the sappers'
cellars." (`combat-district.md`'s `sign_combat` text; combat 1 pins the key, not the words).

## Manifest changes

- `speech.phrases: ["ware", "begone"]` (`speech_sampler/cartridge.json`; needs kernel_api 1.98,
  the showcase is at 1.102). This also puts Gil's `ware` on the Book's Word bar: [matrix row](../SHOWCASE.md#pairwise-mechanic-matrix)
  "say and shout x keyword dialogue" loses its kernel-only note (Beads `loka-kgd.72` closed by #391).
- Capabilities: none new (movement, inspectable_detail, action_recipe, check, skills, status,
  reaction, population, speech, barrier, liquid, readable are declared).
- Status `poisoned` ([row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1);
  `traps_sampler/statuses/poison.json`): `duration` 7200, `tick_every` 1800, `resource` hp,
  `per_tick` -1, label "Poisoned", a `cues` entry (smell, range 0, "a sweet, wrong smell on your
  own breath"; the `bleeding` shape). Status `afraid` (`fear_sampler/statuses/afraid.json`):
  `duration` 600, `tick_every` 60, `resource` hp, `fear: true`, no `per_tick`, label "Afraid".
- Skill `disarm`: growth `[1]`, empty qualification (`traps_sampler/skills/disarm.json`). Not
  hidden: nothing in this district is an elite profession.
- Liquid `bitters`: `cures: [poisoned]` (`needs_sampler` `water`'s shape).
- Facts: `plate_found` (player bool); `plate_sprung`, `plate_disarmed` (instance bool); `lever_stage`
  (instance int 0..3); `wheel_1`, `wheel_2`, `wheel_3` (instance int 0..10); `cellar_found`
  (player), `cellar_sprung`, `cellar_disarmed` (instance) for the sandbox (`traps_sampler/facts.json`,
  `puzzles_sampler/facts.json`). Instance scope is right: a sprung plate and an open door are world
  state ([Realm seam 6](../decisions/owner-decision-realm-seams-2026-10-13.md#the-seams)).
- `world.levelling.kills`: `den_goblin` 10, `chief` 10, `cellar_goblin` 10, `cellar_chief` 10.

## Rooms and map

| Room | Exits | Holds |
|---|---|---|
| `sapper_stair` (sign) | up `drill_yard`, north `plate_passage`, east `lever_hall`, down `sapper_cellar` | detail `sign_traps`; detail `flagstones` (aliases `flagstones`, `plate`; `rating` 1; description variants on `plate_found` and `plate_disarmed`, `traps_sampler/rooms/antechamber.json`) |
| `plate_passage` | south `sapper_stair`, north `chief_den` | detail `sapper_note` (readable, no topic: "First, then second, then third.") |
| `lever_hall` | west `sapper_stair`, north `lever_vault` through `lever_door`, east `dial_vault` through `dial_door` | details `lever_a`, `lever_b`, `lever_c` (alias `lever`), `wheel_1`, `wheel_2`, `wheel_3` (alias `wheel`, one description variant per digit 1 to 9; `puzzles_sampler/rooms/hall.json`) |
| `lever_vault` | south `lever_hall` through `lever_door` | detail `vault_slate` (readable: "Three. One. Two.") |
| `dial_vault` | west `lever_hall` through `dial_door` | `bitters_skin` (vessel, 2 doses of `bitters`) |
| `chief_den` | south `plate_passage` | **the chief**; population `den_goblins` (home) |
| `sapper_cellar` (sandbox) | up `sapper_stair` | detail `cellar_flags` (rating 1; its own search and disarm recipes on `cellar_*` facts); the cellar plate springs on entering this room; `cellar_skin` (2 doses of `bitters`); **cellar chief**; population `cellar_goblins` (home; area `[sapper_cellar, sapper_stair]`) |

No room is `exposed` and nothing reads the sky. Barriers `lever_door` `initial: closed`,
`opens_when fact_compare lever_stage equals 3`; `dial_door` `initial: closed`, `opens_when all(wheel_1
equals 3, wheel_2 equals 1, wheel_3 equals 2)` (`puzzles_sampler/barriers`).

### Signpost (`sign_traps`, readable in `sapper_stair`)

> The Sappers' Stair. The flagstones here hide a plate that the passage north steps on: search
> this floor before you walk it, and disarm what you find; a clumsy hand sets it off, and it bites
> the same whether you find it or not. Its poison wears off in two hours, or at once with the bitters
> locked behind the dial east. The three levers in the hall east have an order, written on a note
> past the plate; the dial's numbers are on a slate behind the lever door. North of the plate a
> chief keeps two goblins. Shout "begone" and the goblins break and run once you strike; kill the
> chief and they run too. Down these stairs is a cellar with all of it, and the plate there is
> under your feet already.

### Trap, puzzles, pack

- Trigger `plate_springs`: `on {event: entity_entered_room, room: plate_passage}`, `when
  all(plate_sprung false, plate_disarmed false)`, `apply [status.apply poisoned, fact.assign
  plate_sprung true]` (`traps_sampler/reactions/plate.json`; lands on the entrant, an NPC too, but
  a goblin fleeing south onto an armed plate is not poisoned (known limit: pack flight moves it by
  `entity.transfer`, which emits no `entity_entered_room`), [row 12](../system/mechanics.md#traps-trigger-disarm-and-reset-toolbox-row-12)).
- Reset `plate_rearms`: `on {event: clock_hour}`, `when plate_sprung true`, `apply fact.assign
  plate_sprung false` (`rearm.json`; the showcase already emits `clock_hour`).
- Failed disarm `plate_bites`: `on {event: check_failed, check: disarm_plate}`, `when plate_sprung
  false`, `apply status.apply poisoned` (`disarm_failed.json`).
- Recipes at `flagstones`: `search_floor` (alias `search`, priority 10, policy `plate_found false`,
  success `fact.assign plate_found true`); `disarm_plate` (alias `disarm`, priority 5, policy
  `all(plate_found true, plate_disarmed false)`, check `{key: disarm_plate, kind: opposed, skill:
  disarm}` against the detail's rating 1, success `fact.assign plate_disarmed true`, empty failure;
  `traps_sampler/recipes`). The sandbox twins on `cellar_flags` and `cellar_*` facts; the cellar
  trigger's `room` is `sapper_cellar`.
- Levers: `pull_a` (alias `pull`, success `fact.assign lever_stage 1`), `pull_b`, `pull_c`
  (success emits nothing; their steps are reactions); reactions in this key order, since a reset
  keyed after its step is [row 26](../system/mechanics.md#sequence-and-combination-puzzles-toolbox-row-26)'s
  red control: `lever_b_reset` (`on action_completed {action: pull_b}`, `when not(lever_stage
  equals 1)`, assign 0), `lever_b_step` (same trigger, `when lever_stage equals 1`, assign 2),
  `lever_c_reset` (`when not(lever_stage equals 2)`, assign 0), `lever_c_step` (`when lever_stage
  equals 2`, assign 3). The solve order is `lever_a`, `lever_b`, `lever_c`: `pull_a`'s recipe sets
  stage 1 and so always restarts the order.
- Wheels: `turn_wheel_n` (alias `turn`, success `event.emit wheel`); reactions `wheel_n_turn`
  (`on action_completed {action: turn_wheel_n}`, `fact.adjust wheel_n +1`) then `wheel_n_wrap`
  (`when wheel_n equals 10`, assign 0), the wrap keyed after the turn (`puzzles_sampler/reactions`).
- Feedback lines (API 1.103; asides 1.91): `lever_b_step` and `lever_c_step` narrate first
  `narration.lever_bolt` ("Behind the north door, a bolt slides back.", `pull_a` keeps its own clank) and each reset
  `narration.lever_reset` ("... the bolts clatter home."); `plate_springs`, `plate_bites` and their
  cellar twins narrate `narration.needle` ("A needle in the plate bites.") before the status. Thirty
  readout reactions `wheel_n_x_shows_k` (`on action_completed {action: turn_wheel_n}`, `when wheel_n
  equals k`, `narrate narration.wheel_n.k`, "The first wheel shows 3.") are keyed `x_` so they sort
  after the turn and the wrap and read the wrapped value. `lever_hall` asides: "The north door's bolts
  stand drawn." at `lever_stage equals 3`, "The east door's bolts stand drawn." at wheels `[3, 1, 2]`.
  The note and the slate carry readable titles `detail.<id>.title` ("The sapper's note", "The slate")
  and labels "Read the note", "Read the slate".
- **The chief**: `room: chief_den`; hp 0..2 start 2 gain 0; `attack {chance 100, 1..1}`; `immune:
  [afraid]` (`npc_status_sampler/npcs/golem.json`); no disposition.
- `den_goblin`: `spawn_template: true`, room `chief_den`, hp 0..6, `attack {chance 100, 1..1}`;
  bundle `den_goblins {npc: den_goblin, item: ear, corpse: npc_corpse}`; plan `den_goblins`: home
  `chief_den`, area `[chief_den, plate_passage]`, cap 2, day and night targets 2, `night_start` 20,
  `night_end` 6, `replacement_delay` and `wander_interval` 8640000, `pack {flight_below_percent 25,
  flight_fare 0, narration}` with `enemy_fled` keyed `south` and `north` (plan 2's built plans).
  `cellar_goblin`, `cellar_goblins` and `cellar_chief` are the same shapes with home `sapper_cellar`.
- Reaction `begone`: `on {event: spoken, word: "begone", loudness: "shout"}`, `apply status.apply
  afraid` (`fear_sampler/reactions/begone.json`: lands on each hearer within one exit; the chief is
  immune). Reaction `chief_fell`: `on {event: entity_died, victim: chief}`, `apply status.apply
  {status: afraid, co_present: true}` (`leader_fell.json`); `cellar_chief_fell` likewise.

## Guided loop and expected outcomes

Any day. A fresh world at 07:00: Talk to Aldous, `learn`, wield the sword (combat 2; str 10, so
the sword deals 2). T is the clock when the trap bites in step 2; the test never elapses time
except where a step says so, so T is also the clock through step 6.

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | Down from the drill yard; read `sign_traps`; `disarm` before any search. | The text above. `disarm_plate` is unavailable and a typed `disarm` is `invalid_state` (policy `plate_found`); the Exits list north, east, up, down. | |
| 2 | `search_floor`; `disarm_plate` once. | `plate_found` true, the flagstones' found variant. The disarm fails (disarm 0 against 1): `check_failed`, then `plate_bites`: `poisoned` applied (generation 1, `ends_at` T + 7200), its line, the Conditions line shows Poisoned and `cues` lists the smell from the player's own room; `plate_sprung` still false; hp 10. | traps x statuses; senses x traps |
| 3 | `disarm_plate` again. | Success (disarm 1 after one use, growth `[1]`): `plate_disarmed` true, the disarmed variant; a third `disarm` is `invalid_state`. | traps x skill growth |
| 4 | North into `plate_passage`; read `sapper_note` (a fixed room detail). | No status change (`plate_disarmed` true); `plate_sprung` false; the note's text. | |
| 5 | Back south, east; `pull_a`, `pull_c` (wrong order); Open north; then `pull_a`, `pull_b`, `pull_c`; Open north; read `vault_slate`. | `pull_a` sets 1; `pull_c` fires `lever_c_reset` (1 is not 2: assign 0), then `lever_c_step` reads 0 and does nothing: `lever_stage` 0 and Open north `invalid_state`. After A, B, C: 3, Open north `opened`, the slate's text. Pulling `lever_c` again now resets to 0 and the open door stays open (a barrier once open stays open; row 26's known limit, named on the slate). | puzzles x barriers |
| 6 | Three turns of `wheel_1`, one of `wheel_2`, one of `wheel_3`; Open east; one more turn of `wheel_3`; Open east; take `bitters_skin`; Drink. | First Open `invalid_state`; wheels `[3, 1, 2]`, Open `opened`; the skin held; Drink ends `poisoned` with no tick (hp 10), one dose left; the Conditions line is empty. Ten turns of one wheel read 0 again (the wrap). | puzzles x barriers; cure x statuses |
| 7 | Branch from step 1's state (undisarmed): north; south and north again at once; wait to the next `clock_hour`; south then north. | First entry: `poisoned` (generation 1, `ends_at` entry + 7200), `plate_sprung` true; second entry changes nothing. At the hour `plate_sprung` false; the re-entry refreshes `ends_at` to re-entry + 7200, generation still 1 (row 1: a refresh moves only the end). Left alone from the first entry: ticks at +1800, +3600, +5400 (hp 9, 8, 7), the expired line at +7200. | traps x statuses x reset |
| 8 | From step 6: north twice to `chief_den` (disarmed plate); `shout begone`; Attack the lower-id goblin; two rounds. | The shout: `afraid` on both goblins (`ends_at` +600), nothing on the chief (immune) or the player; the goblins' room lines read an afraid variant (W6, the developer's words). Round 1: the player hits goblin A (6 to 4); A flees south before its blow. Round 2: B flees before the player strikes. Both stand in `plate_passage` (the disarmed plate is quiet: no `poisoned` row on either), the encounter is `closed`, hp 10. | fear x pack x shout |
| 9 | Fresh den (a new world through steps 1 to 6 with no shout): Attack the chief; one round. Then Attack goblin A; two rounds. | The chief falls at the player's blow (2 damage, hp 2): `entity_died`, experience 10, `chief_fell` puts `afraid` on both goblins (co-present, living; not on the player); the encounter closes. Then the same flight as step 8: A at 4, both in `plate_passage`, hp 10. Calm control (a third world, nobody afraid, the chief left alone): after two rounds on A the player is at 8 and A at 2, both goblins still in the den (one pack member strikes per round, plan 2 step 9). | fear x pack x death |

Sandbox `sapper_cellar`: the plate is under the player's feet on arrival (poisoned at once, unless
`cellar_disarmed` was set on an earlier visit, which needs a search and a disarm from inside), the
bitters are on the floor, a second chief and pack wait for a shout or a blow. A goblin that flees
up the stair onto the sign room is passive there, as plan 2's pit goblins are in the yard.

## Item loops

Two bitters skins, two doses each, emptied by Drink and refilled by nothing (cap 4 doses per
world). Goblin ears fall with the pack and the pack returns in a hundred days (plan 2's cap). The
note and the slate are readables that stay where they are. Nothing creates an item.

## Realm checklist

Per-player: `plate_found`, `cellar_found`, the skill. Shared-world: the plates' `sprung` and
`disarmed` facts, the lever and wheel facts and the two doors (one world, one door; row 12's
"any entrant springs it" is the limit a Realm would meet). The two chiefs are authored NPCs that
die once per world (shared-world; a per-instance chief would be a population). Delays are logical
units (7200, 600, the `clock_hour` job); no device clock.

## Pins the build writes

- `kernel/ts/test/showcase_traps.test.ts` traps 1 to 9 as above: the `invalid_state` before the
  search; the failed disarm's generation and `ends_at` and the `cues` entry; the success after one
  use; `lever_stage` 0 after the wrong order and 3 after A, B, C; wheels `[3, 1, 2]` and the wrap;
  the cure with no tick; step 7's refresh (generation 1, new `ends_at`) and its tick times; both
  goblins in `plate_passage` with no status row after the shout and after the chief's death; the
  calm control; the hub sign's key unchanged (combat 1 pins the drill yard sign key).
- `protocol/fixtures/toolbox_showcase_hash.json` (held by `test/loka/content_showcase_test.exs`).
- Book e2e `mobile/app/tests/showcase_traps.e2e.ts`, the happy path in the real UI at phone width:
  Aldous's Talk and the wield, down, Search and Disarm cards (twice), north, Read the note, the
  three Pull cards, Open, Read the slate, five Turn cards, Open, Take, Drink, north twice, the
  Word bar's Shout chip "begone", Attack, and the two "flees" lines. Every verb here is a card or a
  chip; nothing is kernel-only.

## Blind AI playtest focus

Does the player search before walking the passage, or learn by being bitten? Does the player find
the note before pulling the levers? Does "begone" read as something to shout, from the
sign alone? Does the Poisoned line say what it is and how long, in words, without a colour?

## Matrix cells this plan adds

[SHOWCASE.md](../SHOWCASE.md#pairwise-mechanic-matrix): the "traps x statuses x combat; fear x
pack x shout; use-on x fire; puzzles" row is split: traps x statuses x reset x senses (plan 7);
fear x pack x shout x death (plan 7); puzzles x barriers x readables (plan 7); use-on x fire goes
to [plan 6](magic-district.md). The traps half of "hidden exits x senses x traps" is plan 7.

## Toolbox findings

1. **No reaction opens a barrier**, so a lever pulled after the solve resets the stage while the
   door stays open ([row 26](../system/mechanics.md#sequence-and-combination-puzzles-toolbox-row-26)'s
   known limit; the slate says so). Beads `loka-kgd.96`'s `barrier.set` step landed with W22, so
   a later brief may make the door shut again on a reset; not planned here.
2. **Surrender is deferred** (Beads `loka-kgd.80`): fear only makes a pack member flee.
3. **Doc drift**: `combat-district.md` "The pack and Beads loka-6ql4" and the SHOWCASE matrix note
   "kernel-only until the Book input" are stale (both Beads closed); this plan's SHOWCASE edit
   fixes the matrix line, the combat plan is left as history.
