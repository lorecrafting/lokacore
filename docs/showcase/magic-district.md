# Showcase plan 6: the magic and use-on district

District brief for `cartridges/toolbox_showcase` ([showcase](../SHOWCASE.md), Beads `loka-y6yg.19`),
written by Fable for an Opus developer and an Opus reviewer. Base: `main` after
[plan 5](economy-law-district.md) merges ([build order](homestead-district.md#build-order-for-plans-4-to-7)).
Only installed mechanics: rows 29a (cast admission), 29b (spell effects), G4 (use X on Y), SR1 to
SR3 (status readers), SR4 and SR5 (blocks and resistances on a status), 4 (levelling), G6 (cues),
light@1 and the fire of W22 as the showcase smithy already authors it. Not planned: SR6 to SR9
(perception, concealment, room statuses, movement on a status) and rows 27 and 28; they are
[later](#later). Every shape has a sampler precedent, cited per item; a step that needs engine code
is a [toolbox finding](#toolbox-findings).

Conventions as in [plan 1](hub-and-first-districts.md). Reagents are pools, not items
([29a](../system/mechanics.md#spell-cast-admission-toolbox-row-29a), Beads `loka-kgd.83`), so the
loop gathers ash at a hearth. No room here is `exposed`; nothing reads the sky.

## Link from the hub

`crossroads_inn` gains `up` to `loft`; the hub sign gains the sentence in
[plan 4's table](homestead-district.md#the-hub-has-two-faces-left) and the "Four roads" sentence gains
"a ladder": "Four roads, a ladder and a cellar stair leave this inn." The hub pin's exit count rises by one.

## Manifest changes

- Capabilities: add `light` (`spell_effects_sampler/cartridge.json`); `tags`, `liquid`, `status`,
  `reaction`, `quest`, `attributes` are declared.
- Pools (`spells_sampler/resources.json`): `ma` 0..5 start 5 gain 0 with `regen {every: 3600,
  by_position {standing 1, sitting 1, resting 2, sleeping 2}}` (the mv shape; one breath an hour);
  `ash` 0..5 start 0 gain 0. Attribute `cha` already exists (6); no `wis`.
- Spells, each `target {kind: spell, word, learned}` (`spells_sampler/recipes`): `lux` (learned
  `lux_known`; `costs [{ma, 2}, {ash, 1}]`; step `light.ignite {item: lantern}`), `flamma`
  (learned `flamma_known`; `costs [{ma, 1}]`; policy `npc_present {npc: wight}`; step `damage
  {npc: wight, kind: fire, amount: 8}`), `ward` (learned `ward_taught`; `costs [{ma, 1}]`;
  policy `all(level_compare {at_least: 2}, stat_compare {cha, at_least: 7})`; `reason:
  reason.ward` ("Needs a second level and more presence"); step `status.apply warded`). No spell
  has a `duration` (the showcase is `real_elapsed`; a timed spell is also refused in a fight).
- Recipe `gather_ash` at `hearth` (`resource.adjust {ash, by: 1}`); `attic_hearth` twin.
- Statuses: `warded` (600, tick 150, resource mv, `resistances {physical: 50}`; `ward_sampler`),
  `hushed` (120, `blocks ["say", "shout", "cast"]`), `wet` (600, tick 300, mv, `modifies str -1`),
  `shocked` (120, tick 60, hp -1), `stunned` (120, tick 60, hp -3), `warm` (600, tick 300, mv,
  `modifies str +1`) (`elements_sampler/statuses`). `burning` and `spent` exist (the smithy).
- Facts: `lux_known`, `flamma_known`, `ward_taught`, `gate_oiled` (player bool);
  `topic_flamma_known` for the grimoire (topics@1). Quest `errand` (`spells_sampler/quests`):
  objective `fact_compare flamma_known true`, outcome `done`.
- `world.levelling.kills`: `wight` 10, `attic_wight` 10; no entry for the golems (0).
- Items: `lantern` (`fuel {kind: source, capacity: 36000, initial: 36000, rate: 1}`, no supply:
  it burns once per world, ten game hours; `spell_effects_sampler/items/orb.json`), `loft_bucket`
  (`liquid_holding`, water 4), `oilcan` (`liquid_holding`, oil 2), `gate_winch` (tag `metal`, lying
  on the stair), `bier` (tags `wooden`, `burnable`, in the crypt), `rain_bucket`, `spark_jar`,
  `yard_torch` (the elements set, no tags needed), `grimoire` (readable, topic `flamma`, in the
  reading room), the attic twins.
- Liquid `oil` (`use_sampler/liquids`).

## Rooms and map

| Room | Exits | Holds |
|---|---|---|
| `loft` (sign) | down `crossroads_inn`, north `reading_room`, east `crypt_stair`, west `golem_yard`, up `loft_attic` | detail `sign_magic`; **the hedge-wizard**; detail `hearth`; `lantern`; `loft_bucket`; `oilcan` |
| `reading_room` | south `loft` | `grimoire`; reaction `hush` on entry (`ward_sampler/reactions/blessing.json`) |
| `crypt_stair` | west `loft`, down `crypt` through barrier `crypt_gate` (`initial: closed`, `opens_when fact_compare gate_oiled true`, tags `metal`) | `gate_winch`; the smoke cue from the crypt reaches here (range 1) |
| `crypt` | up `crypt_stair` through `crypt_gate` | `dark_description`; **the wight**; `bier` |
| `golem_yard` | east `loft` | **the golem**; `rain_bucket`; `spark_jar`; `yard_torch` |
| `loft_attic` (sandbox) | down `loft` | detail `attic_hearth`; `attic_lantern`; a second bucket, jar and torch; **the attic wight** (lit room, no gate); **a second golem**; an `attic_bier` |

### Signpost (`sign_magic`, readable in `loft`)

> The Loft. The hedge-wizard knows three words and will give you the first for nothing: "lux"
> lights the lantern on the sill, and costs two breaths of mana and a pinch of ash from the hearth
> here. The second word is in the book in the reading room north, where nothing may be spoken
> aloud for a while after you walk in. The third she gives for an errand, and it is no use to you
> until you have grown a level and some presence. East, a gate rusted shut: oil from the can on the
> winch and it swings; below it is dark, and what stands in the dark will not be seen, or struck,
> until you carry a light. Fire burns what is wooden down there; the bucket puts it out. West, a
> stone golem that does not mind rain, nor a spark, but minds both together; a torch dries it. Up
> the ladder is all of it under a lit roof.

### NPCs, dialogues, reactions, use pairs

- **The hedge-wizard**: stays; dialogues in key order: `wizard_lux` (policy `fact_compare
  lux_known false`; choice `teach`: `fact.assign lux_known true`); `wizard_errand` (policy
  `fact_compare ward_taught false`; `accept: errand`; `leave`); `wizard_done` (policy `ward_taught
  true`; `leave`). Reactions `errand_done` `on fact_changed flamma_known` `when quest_state {errand,
  active}` `apply quest.resolve {errand, done}`; `errand_reward` `on quest_resolved {errand, done}`
  `apply [fact.assign ward_taught true, experience.grant 30]` (`spells_sampler/reactions/apprentice_reward.json`;
  30 is the showcase's first level threshold).
- **The wight**: `room: crypt`; hp 0..8 start 8 gain 0; `attack {chance 100, 2..2}`; `resistances
  {fire: 50}`; no disposition (`spell_effects_sampler/npcs/wight.json`). **The golem**: `room:
  golem_yard`; hp 0..20 start 20; no `attack` (never a fight; the sampler's golem).
- `hush`: `on {event: entity_entered_room, room: reading_room}` `apply status.apply hushed`.
- Elements (`elements_sampler/reactions`): `drench` `on item_dropped rain_bucket` `apply
  status.apply {wet, npc: golem}`; `spark` (`spark_jar`, `shocked`); `kindle_golem` (`yard_torch`,
  `warm`); `shock_on_wet` `on status_applied shocked` `when status_active {subject: subject, status:
  wet}` `apply [status.apply stunned, status.cure shocked, status.cure wet]`; `warmth_dries` `on
  status_applied warm` `apply status.cure wet`.
- Fire: `flamma_sparks` `on {event: action_completed, action: flamma}` `apply status.apply
  {burning, co_present: true, tag: burnable}` (the smithy's `kindle.json` shape); the existing
  `fire_spreads` and `quench` (tool `{tag: liquid_holding, liquid: water}` on a burning item) serve
  the crypt unchanged.
- Use pair `oil_winch`: `target {kind: use, tool: {liquid: oil}}`, policy `has_tag {subject:
  target, tag: metal}`, success `fact.assign gate_oiled true` (`use_sampler/recipes/oil.json`).

## Guided loop and expected outcomes

Any day; fresh world at 07:00. Mana 5, ash 0, cha 6, level 1. R is the round clock of the crypt
fight (rounds at +150, +300).

| # | Step | Expected | Matrix cells |
|---|---|---|---|
| 1 | Up; read `sign_magic`; the Word bar. | The text. `spell_words` is empty (nothing learned); no chip. | |
| 2 | Talk: `teach`, then `accept` (the errand); `cast lux`; `gather_ash`; take the lantern; `cast lux`. | `lux_known` true, the errand active (Journal); the Word bar shows "lux, cast" unavailable: `insufficient_resource` (ash 0); after the gather ash 1; the cast: ma 3, ash 0, the lantern lit (its fuel ticking), the spell's line and no ignite line. A cast without the lantern held: the pools still spent, nothing lit (29b: "otherwise it writes nothing and the spell still succeeds"). | spells x reagents x light |
| 3 | North into the reading room; `cast lux` (ash gathered first); `say` anything; wait 120; read the grimoire. | `hushed` applied on entry (120, the Conditions line); the cast and the say: `invalid_state`, the chips unavailable; after 120 the chips return. The grimoire: `topic_flamma_known`, `flamma_known` true; "flamma, cast" appears, available (ma 1); the errand resolves `done` in the same proposal. | command blocks x spells; readables x learned gate |
| 4 | Back in the loft: the Word bar; Raise. | `ward_taught` true, experience 30, level 2, one `level_up` line, one point; "ward, cast" reads unavailable with reason `reason.ward` (cha 6). Raise `cha`: 7; the chip is available. The loop accepts before reading on purpose: whether a quest whose objective already holds resolves at activation is unpinned anywhere, so no step relies on it. Read before accepting: the errand resolves on the next loft climb, not in the read (an accepted engine limit). | quests x levelling x spell gates |
| 5 | `cast ward`. | `warded` on the caster (600), its applied line; ma 2; events `status_applied`, `action_completed`, `fact_changed`; a second cast at once: `action_completed` only (a refresh lands nothing). | spell effects x statuses |
| 6 | East; down. `oil_winch` with the oilcan on the winch; Open; down with the lit lantern. | The move down: `exit_closed`. The use card "Oil the winch" lists the pair; performed: `gate_oiled` true, the oilcan's oil unchanged (`loka-kgd.78`); Open `opened`; the oilcan on the bier (not metal): `invalid_state`; the bucket as a tool on the winch: `invalid_target`. In the crypt the lit room lists the wight; the branch without the lantern lit reads the `dark_description` and lists no one. | use-on x barriers x light |
| 7 | `cast flamma`; one round; Flee; down; `cast flamma`. | The first cast: wight 4 (8 fire at 50), the fight opens; `flamma_sparks` sets the `bier` burning (its applied line), `cues` in `crypt_stair` lists the smoke. Round 1: the wight's blow is 1 under `warded` (2 at 50; the player's unarmed blow lands nothing). Flee: one candidate (up), no RNG. Down again: the wight is passive (no disposition). The second cast: wight 0, `entity_died` with the caster's body as killer, experience 40 (level 2 still: 100 not reached), the corpse; a third cast: `invalid_state`. | spell damage x resistances x death credit; spells x fire x cues |
| 8 | Quench: the loft bucket on the burning bier. | The use card "Quench the bier"; the fire ends, the smoke cue gone, the bucket's water unchanged; a second quench `invalid_state`. Left alone instead: the bier's `burning` runs 180 and `fire_spreads` finds no other burnable (the lantern is metal: the build tags it). | use-on x fire |
| 9 | West to the golem yard: drop the rain bucket, then the jar; wait 60. Take the bucket back and drop it; drop the torch; drop the jar. | After bucket and jar: applied lines "golem shocked", "golem stunned"; `wet` false, `shocked` false, `stunned` true (SR1 read the subject's `wet`, SR2 fired on the landing, SR3 cured both); golem hp 17 at +60. Fresh branch, jar alone: "golem shocked" only, hp 19 at +60. Bucket then torch: `warm` true, `wet` false; then the jar: `shocked` true, `stunned` false. | status readers x reactions x NPC statuses |

Sandbox `loft_attic`: a second hearth, lantern and wight under a lit roof (no gate, no dark), a
second golem and the bucket, jar and torch; every word works here and the fight can be fought
without a light.

## Item loops

Ash: gathered by hand, spent by `lux`, capped at 5 held. Mana: regen one an hour. The lantern:
36000 units of fuel, no supply (one lighting per world; the attic has the second). Oil and water:
never consumed by a use (`loka-kgd.78`), so the bucket and can are inert caps. The wights die once
(10 experience each, no drops). The golems have no `kills` entry and nothing to drop: a dropped jar
can be picked up and dropped again until the golem dies, and that earns nothing. Nothing creates an
item.

## Realm checklist

Per-player: `lux_known`, `flamma_known`, `ward_taught`, `gate_oiled` (the gate opens on a player
fact: in a Realm each character oils it; the barrier state itself is world state, so the first
Open holds for all, a seam 6 note), the pools, the quest. Shared-world: the wights (die once per
world), the golem's statuses, the bier and its fire. The quest resolves for the actor whose read
changed the fact (seam 2). Delays in logical units; no device clock.
Checked against the M2 build: the four facts are `player`-scoped in `facts.json`; the golems'
`wet`, `shocked`, `stunned` and `warm`, the bier's `burning` and `spent` and the lanterns' fuel
sit on world entities, so one character's drop or quench holds for all.

## Pins the build writes

- `kernel/ts/test/showcase_magic.test.ts` magic 1 to 9: `spell_words` at each stage with its
  reason codes; the pool arithmetic (ma 5, 3, 2 after ward, 1 and 0 after the bolts; ash 0, 1, 0 and 1
  after the hushed gather, never spent again); the lit and dark crypt listings; `hushed`'s `invalid_state` and its end; the errand's
  resolve on the read and the 30 experience; the wight at 4 then 0 with the caster as killer;
  the warded blow of 1; the bier's `burning` and the stair's smoke cue; the quench with water
  unchanged; the elements chain's hp 17 and 19.
- `protocol/fixtures/toolbox_showcase_hash.json`; `showcase_body.test.ts`'s hub exit count.
- Book e2e `mobile/app/tests/showcase_magic.e2e.ts`, the happy path at phone width: the Talk
  card, the Word bar's "lux" chip refused then cast after Gather, the hushed chips, Read, Accept,
  Raise, "ward", the use card "Oil the winch", Open, down, "flamma", Flee, down, "flamma", "Quench
  the bier", the three Drops in the yard. The Word bar hides every chip while a fight is open
  (`mobile/app/book/buttons.ts` `wordless`), so the Flee-and-return is how the Book casts twice;
  the kernel pin also casts the second bolt inside the fight (29b: a bolt is cast between rounds).

## Blind AI playtest focus

Does the player find the ash before trying "lux" twice? Does the hush read as the room's rule
rather than a broken bar? Is the dark crypt understood as "bring the light" from the sign alone?
Does the Flee-and-return feel like the game or like a workaround (the finding below)? Do the
golem's three lines make the rule guessable?

## Matrix cells this plan adds

Rows in [SHOWCASE.md](../SHOWCASE.md#pairwise-mechanic-matrix), all `planned (plan 6)`: spells x
reagents x light x dark room; command blocks x spells x readables; quests x levelling x spell
gates; spell damage x resistances x death credit; spells x fire x use-on x cues; status readers x
reactions x NPC statuses.

## Later

SR6 and SR8 (a blind or invisible fight), SR7 (a flying crossing), SR9 (a room darkened by a
spell), row 27 (an unidentified ring) and row 28 (a cursed one) fit this district's sandbox once a
brief wants them; none is a pair the toolbox lacks, so no finding.

## Toolbox findings

1. **The Book hides Cast in a fight** while the kernel admits it (29b "In a fight"; `wordless` in
   `buttons.ts`). A bolt-caster must flee and return. A polish Bead for the designer: show the
   Word bar's spell chips while engaged, as Attack and Flee are shown.
2. **Spell targets are authored NPCs only**: `damage {npc}` cannot name a spawned pack member, so
   no spell reaches plan 7's goblins (29b's known limit).
3. **A gate on a player fact** (`gate_oiled`) is the only way a use pair opens a door, since a use
   target cannot be a barrier (G4); the `barrier.set` reaction step (W22) could replace the fact
   with a reaction on `action_completed {action: oil_winch}`: the build may use either and says
   which. Built: the fact, so the Open stays a separate step the player must take.
4. **No applied line for an item or NPC status** (built, M2): the bier's `burning` and the golem's
   statuses land without a narrated line; the pins read the statuses (steps 7 and 9).

Build notes (M2): "flamma, cast" is listed after the read but unavailable (`invalid_state`) until
the wight is in the room (its policy is `npc_present`); ward's landing records `status_applied`
and `action_completed` (no `fact_changed`); the wights strike `physical` 2 so `warded` halves it
to 1; the attic wight is fought with Attack (finding 2: flamma names the crypt wight only); the
carry limit (5000 g) sets the loft bucket to one unit of water and the rain and attic buckets to
500 g; the Book e2e is the walk `3-magic` in `toolbox_showcase.walk.ts` (the e2e harness has no
showcase cartridge).
