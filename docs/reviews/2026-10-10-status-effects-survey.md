# Status effects survey: is the status engine general enough?

Read-only research, main at `cf2242fa` plus `origin/toolbox/batch-m8` (G4 use-on, W21 fear, traps)
and `origin/toolbox/m8-spells` (29a), 2026-10-10. Owner question (paraphrased): survey every kind
of status effect found in MUDs, roguelikes, tabletop and CRPGs (LegendMUD blind hides the room;
flying changes movement cost and crosses oceans; a five-element spell system where lightning on a
wet target amplifies) and say whether the status engine needs more modification to carry them, or
whether it is all content already. Not an implementation plan.

Sources read: `protocol/cartridge.schema.json` `StatusDefinition`, `protocol/policy.schema.json`,
`protocol/reaction.schema.json`, `protocol/entity.schema.json` (`Tag`, `DamageKind`, `Resistances`,
`Cue`), `kernel/ts/src/mechanics/status/`, `policy.ts`, `reaction.ts`, `light/shared.ts`,
`senses.ts`, `movement/`, `water/shared.ts`, `combat/round_attack.ts`, `combat/behavior.ts`,
`combat/round_flow.ts`, `attributes/shared.ts`, `death/sequence.ts`, `commands/actions.ts`,
`view/resources.ts`, `view/view.ts`, `description_variant/rule.ts`, `lib/loka/content/status.ex`,
`lib/loka/core/compose_status.ex`, [mechanics](../system/mechanics.md) rows 1, 2, 2c, G1, G2, G3,
G6, W6, W8, [the toolbox](../MECHANICS-TOOLBOX.md) (every row incl. M8 to M15 and Settle), and the
M8 branch sections for G4 and W21.

## 0. What the status engine is today

One shape, `StatusDefinition` (`protocol/cartridge.schema.json`): `duration` (seconds or
`"permanent"`), `tick_every`, one `resource` and a signed `per_tick`, `label`, three `narration`
keys, optional `modifies [{attribute, modifier}]` (row 2c), optional `cues` (row G6), and on the
M8 branch `fear: true` (row W21). One row per holder and status
(`kernel/ts/src/mechanics/status/shared.ts` `statusKey`, `applyStatus`), holders are the player's
body, a living NPC or an item (`holds`, line 95; rooms, barriers and details are refused), a
reapplication while active refreshes `ends_at` only, `immune` on an NPC or item definition skips
the apply, and a cure (`cures` on an edible or liquid; on M8 the use recipe step `status.cure`)
ends it. Readers that exist: the attribute readers (`attributes/shared.ts` `modifiers`, row 2c),
the GameView conditions (`view/resources.ts` `conditionViews`), the W6 description variants through
the `status_active {subject: "target"}` leaf, the G6 cue sources, the M8 fear reader
(`combat/behavior.ts` `afraid`, read by `round_flow.ts` `maybeFlight`), and the G4 use-recipe
policy (the target item's status). Events: `status_ticked`, `status_expired`; no `status_applied`,
and a cure emits nothing.

Three facts drive most of the verdict below:

1. **The engine reads a status in five places and nowhere else.** Movement, light, combat damage,
   action admission, target visibility and NPC perception do not look at status rows. Each new
   "kind" of effect is one small reader in the one module that owns the behaviour, not a change to
   the status row.
2. **`status_active` reads the action's target only** (`policy.ts` line 88:
   `ctx.target !== undefined && currentStatus(world, ctx.target, p.status)`), and a reaction's
   `when` is evaluated with no target (`reaction.ts` line 113:
   `holds(then, actor, rule.when.root, { steps, cause })`). So today no reaction can ask "does the
   event's subject hold `wet`?" and no action policy can ask "does the actor hold `blind`?". This
   one leaf gap blocks every status-pair interaction and every self-gated verb.
3. **No `status_applied` event.** Combos that fire when a second status lands (wet then shocked)
   have no trigger; the tick and expiry events exist, the apply does not.

## 1. Taxonomy, grouped by what the status must touch

Drawn from LegendMUD (blind, fly, sanctuary, stun, mesmer), the Diku/ROM/Merc lineage (affects:
blind, invisible, detect invis, detect magic, detect evil, infravision, poison, plague, sleep,
curse, haste, slow, sanctuary, protection, charm, pass door, flying, berserk, calm, faerie fire,
weaken, swim), Discworld (TPA/shield, ethereal, hallucination), Achaea/IRE (over 100 afflictions
with a cure matrix: paralysis, asthma, clumsiness, impatience, anorexia, slickness, prone, writhe
chains, and defences such as insomnia, deathsight, levitation, waterbreathing), NetHack (blind,
hallucination, stun, confusion, lycanthropy, polymorph, levitation, water walking, flying, telepathy,
see invisible, sliming, stoning, strangulation, food poisoning, cursed sticky items), DCSS
(haste/slow, might, agility, brilliance, berserk and its exhaustion, confusion, petrifying, silence,
corrosion, mesmerised, fear, flight, regeneration, sticky flame, poison, Olgreb's toxic radiance,
clouds on tiles), Cogmind (corruption, overheating, part damage), D&D 5e (blinded, charmed,
deafened, exhaustion levels, frightened, grappled, incapacitated, invisible, paralyzed, petrified,
poisoned, prone, restrained, stunned, unconscious), Divinity: Original Sin 2 (surfaces: water,
blood, oil, poison, fire, ice, electrified, cursed and blessed variants; combos: wet + lightning =
stunned, water + cold = frozen, oil + fire = burning spread, water on fire = steam, bless cures
curse), Pillars of Eternity (afflictions by attribute, inspirations as counters, interrupts), Ultima
(sleep, poison, paralyze, negate magic, protection, invisibility, quickness, polymorph).

| Group | What the status must touch | Examples | Engine today |
| --- | --- | --- | --- |
| A | A numeric pool over time (DoT, HoT, drain, regen change) | poison, plague, bleed, regeneration, hunger, blessing, exhaustion drain | row 1: `per_tick` on one `resource`; regen rate change deferred |
| B | An attribute | might, weaken, agility, Pillars afflictions, D&D exhaustion stat penalties | row 2c `modifies` |
| C | A derived stat directly | +hit, +damage, +armor, carry, hp max | row 2 tables only through attributes; direct stat modifier open (Beads `loka-kgd.34`) |
| D | What the holder perceives | blind, deaf, see invisible, infravision, detect magic, hallucination, darkness (room) | B4 light only: `dark()`; no status reader |
| E | How others perceive the holder | invisible, hidden, sneak, camouflage, faerie fire, pass door | `visible()` light-based; NPC `perception.discovered` fact; rows 16, W15 planned |
| F | Movement and terrain | fly, levitate, water walk, water breathing, haste/slow, mv cost change, cross ocean/chasm/air, feather fall, swim | `fare()` fixed cost; D6 water routes; row 30 climb; row 43a terrain planned |
| G | Which verbs the holder may use | silence (cast/say), paralysis/stun/sleep (all), entangle/grapple (move), charm/confuse (random), fear (flee), berserk (attack only), mesmer | combat filters the set (`actions.ts` `resolved`); position gates scattered; fear (W21) is a bespoke reader |
| H | Combat numbers | sanctuary/protection, damage reflection, resist or vulnerability by kind, weapon buff, armor, shield, dodge | G2 `resistances` static on NPC definition; player has none; no status reader in `dealt` |
| I | Social and dialogue | charm, disguise, reputation mask, tongues, intimidated | G11 disposition (facts), W15 recognition, W16 languages planned |
| J | Items | cursed sticky item, enchant, corrosion, durability | rows 28, 21, 27 planned; item statuses exist (G3) |
| K | Transformation | polymorph, lycanthropy, shapes that change verbs and texts | W6 variants cover text; verbs and attack profile not |
| L | Stacking, refresh, intensity | poison I to III, DCSS stacking durations, exhaustion levels 1 to 6 | one row per holder and status; refresh resets end; no intensity |
| M | Contagion and spread | plague by contact, fire to co-present burnables, Olgreb's radiance | W1 tick reactions + `status.apply`; M8 `co_present` for NPCs |
| N | Environment to status | wet, oiled, burning, frozen, electrified surfaces; weather exposure | W25 exposure (sky + room tags); G1 tags; room statuses refused |
| O | Status-pair interactions | wet + lightning amplifies, fire + oil intensifies, water cures burning, cold + wet = frozen, bless cures curse, five-element cycles | `cures` (one-way end); no pair table; `status_active` unreadable in a reaction `when` |
| P | Statuses on rooms and items, not bodies | burning door, dark room spell, consecrated room, electrified floor | items yes (G3); rooms and barriers refused |
| Q | Auras (affect co-present bodies) | sanctuary aura, toxic radiance, bard song, leader's fear | row 42 one rule per listener; M8 `co_present` (NPCs only, on an event) |
| R | Dispel, cleanse, immunity windows | cure matrix, dispel magic, bless removes curse, immunity after cure | `cures`, `status.cure`, `immune` static; no timed immunity |
| S | Death and persistence | survives death, cleared by death, permanent scars, lycanthropy persists | W8 permanent; death clears others |
| T | Visibility of the status to the player | hidden fuses (NetHack stoning count), hidden curses, unknown potions | every player status is listed in `conditions` |

## 2. Per category: content today, planned row, or a new engine piece

Legend: **(a)** pure content on main or the M8 branch; **(b)** a planned toolbox row covers it;
**(c)** a new general engine piece, with the smallest shape, where it goes, parity cost and size
(S under a day, M a few days, L a week). "TS-only" means the loader (`kernel/ts/src/content/`) and
the Elixir compiler check (`lib/loka/content/status.ex`, `leaf_refs.ex` or `policies.ex`) each take
the new field, but no composer or save row changes; "composer parity" means
`lib/loka/core/compose_status.ex` and `protocol/fixtures/status_composition.json` change too.

### A. Pools over time

**(a)** Poison, disease, bleed-like drains, hunger and thirst (G13), exposure (W25), HoT and
buffs as positive `per_tick`: all content on row 1. Two pools at once is two statuses.
**(c)** A true regen-rate modifier ("regeneration doubles the standing rate") was deferred in row
1. Shape: `modifies_regen {resource, multiplier_percent}` on the status, read where
`resource.ts` picks `spec.regen.by_position[position]` (lines 176 and 210). TS-only. **S.** Low
priority: a positive `per_tick` already does the player-visible job.

### B. Attributes

**(a)** Row 2c covers buffs and debuffs on every attribute reader (`stat_compare`, recipe checks,
derived stats, NPC `npcValue`). Known limit: an hp-maximum attribute (con) modifier faults in a
same-advance edge (Beads `loka-kgd.50`); content avoids con until then.

### C. Derived stats directly

**(b)/(c)** Protection, armor and weapon buffs want a direct `hit_chance`, `damage`, `hp_max` or
`carry_grams` modifier. Open item in Beads `loka-kgd.34`. Shape: allow `modifies[i].stat` as an
alternative to `attribute`, summed where `derived()` is added to the authored number
(`attributes/shared.ts` line 96 and its callers in `round_attack.ts` `attackProfile`). TS-only.
**S.** Until then a +str status is the armor buff; readable and good enough for most content.

### D. What the holder perceives (blind, deaf, see invisible, darkness)

**(c)** Nothing reads a status here. `dark()` (`light/shared.ts` line 84) is
`room.dark_description && !darkSight(ancestry) && !illuminated`; `describe()`
(`description_variant/rule.ts` line 51) picks `dark_description` first; `visible()` and `sight()`
(`movement/rule.ts` line 46) follow `dark()`. Smallest general piece: a status field
`perception: {sight?: "blind" | "dark_sight", hearing?: "deaf"}`, read in exactly two places:
`dark()` returns true when an active status on the body says `blind` (so the room shows its
`dark_description` or, when it has none, a new engine fallback key, and contents and exits vanish
as in darkness today), and `darkSight()` returns true for a `dark_sight` status (infravision as a
buff, the ancestry flag's twin). `deaf` is read once in `senses.ts` (`sound` cues do not reach a
deaf listener). TS-only (loader and `status.ex` accept the enum). **S.** LegendMUD blind falls
out of `dark()` because the engine already has a "you cannot see this room" path: no new view
code. *Not covered:* detect magic, detect evil, telepathy have no object in this engine (no
magic flags on items, no alignment); see E for see-invisible. Hallucination (random names) is
procedural prose, against Trap 4: author one `confused` variant set with W6 instead.

### E. How others perceive the holder (invisible, hidden, sneak)

**(b)** Row 16 (sneak and hide, M13) and W15 (recognition and disguise, M13) are the planned
rows; W15 already says "a disguise is a status". **(c)** The general piece underneath both is a
status field `concealment: "invisible" | "hidden"` read by `visible()` (`light/shared.ts` line
95) for the player seeing an NPC, and by NPC perception (`disposition.ts` `engage` and the
C4/G11 hostility paths) for an NPC seeing the player, with a `see_invisible` perception value in
D cancelling it. Row 16's brief should adopt this shape so sneak is "apply `hidden` on a passed
check, end it on a failed one" rather than a private flag. TS-only. **S** for the field and the
two readers; the check loop is row 16's own work.

### F. Movement and terrain (fly, levitate, water, haste, slow)

**(b)** Row 43a (terrain movement costs, M14) is where per-exit or per-room costs land. **(a)**
Water breathing already exists as D6's `water.admission` (a skill gate, a mass cap, an `entry_cost`
and a breath deadline job). **(c)** The general piece: a status field
`movement: {cost_percent?, passes?: [terrain tag]}`. `cost_percent` multiplies in `fare()`
(`movement/shared.ts` line 80, where `flee_multiplier` already multiplies: haste 50, slow 200,
flying 50). `passes` names room or exit tags the holder may cross: an exit or destination room
tagged `water`, `air` or `chasm` (new `Tag` members, G1's closed set) refuses `movementPlan`
(`movement/sequence.ts` line 125, next to `passage`) unless an active status on the body, or an
ancestry, lists that tag in `passes`; `climb.fall` (`movement/shared.ts` line 60) is skipped by a
`feather_fall`-style pass on the climb exit. Water breathing as a status is the same field:
`passes: [water]` is read where D6's skill gate is (`water/shared.ts` line 40), as an alternative
admission. TS-only; the tags and the field need `status.ex` and `exits.ex` checks. **M** (two
readers plus the terrain tags; 43a's cost table is separate but should take the same tags).
Levitate over a trap plate is a trap-row (12) `when: not status_active self levitating` once O's
leaf exists.

### G. Which verbs the holder may use (silence, paralysis, sleep, entangle, charm, fear, berserk)

**(c)** The one piece that unlocks the most. Today combat already filters the composed action set
to `['flee', 'stand', 'look', 'scan', 'bandage']` (`commands/actions.ts` `resolved`, line 166),
and position gates are scattered over eight call sites (`standing(` in movement, combat, water,
transport, expedition, crow, patrol). Smallest general shape: a status field
`blocks: [command type]` (the `CommandPayload.type` enum: `move`, `attack`, `perform`, `say`,
`shout`, `whisper`, `talk`, `take`, …) and `allows: [command type]` (the inverse: berserk allows
`attack` and `flee` only). `resolved()` filters the set by the union of the body's active statuses'
`blocks`, so every advertised action, `refusal` and the GameView agree with one line; the fixed
combat list stays. `silence` is `blocks: [say, shout, whisper, perform]` (29a spells are `perform`
recipes with a `spell` target and a `cast` command: add that type). `paralysis`, `stun` and
`sleep` block every acting verb; `entangle` blocks `move` and `flee`. TS-only (the loader and
`status.ex` check the names against the command enum). **S.** *Random behaviour* (confusion moves
a random direction, charm attacks an ally) is not a block; it is a substituted outcome. The
general shape is a status field `confuses: true` read once in `moveSequence` to draw the
direction from the authority RNG the way `flee()` does (`combat/flee.ts` line 38). **S**, but
each confused verb is its own reader; recommend `move` only. *Fear forcing the player to flee* is
`blocks: [attack]` plus the fear line; W21's NPC reader stays as is. *Charm as "NPC fights for
you"* is row 6b's `allies` list read at the round: `allied: true` on a status held by an NPC,
read where `ally()` is (`combat/shared.ts`). **S** once G's field exists; recommend later.

### H. Combat numbers (sanctuary, reflection, resistances, vulnerabilities)

**(a)** Resistances and weaknesses by `DamageKind` and material tag exist on NPC definitions
(G2). **(c)** Three readers are missing and all sit in `round_attack.ts`:

- `resistances` on a status, summed with the definition's in `dealt()` (line 105, where
  `npc.resistances` is read), and read for the player too (`dealt` returns `crit` unchanged for
  the player today). This is sanctuary (`physical: 50`), fire shield (`fire: 100`), the five
  elements' vulnerabilities (`wet` declares `lightning: -100`) and D&D's petrified. TS-only;
  `status.ex` reuses the G2 `Resistances` check. **S.**
- `kind` on a status's own tick (poison ticks are `poison` damage, so a poison-resistant NPC
  takes less): `amount()` in `status/job.ts` line 78 applies the same percent. TS-only. **S.**
  Optional.
- Reflection ("the attacker takes N percent of what it dealt"): a second `resource.adjust` in
  `injure()`; a new `reflects_percent` field. **S** but adds a death path for the attacker inside
  the victim's round; recommend after 6b's credit model settles.

Dodge and block are already attack-profile numbers (`defend`); a status `modifies` on dex covers
"agility". Sanctuary as a *room* property exists (`RoomDefinition.sanctuary`, read by
`combat/shared.ts` line 46 and `disposition.ts` line 84): a consecrate spell wants the room-status
piece in P.

### I. Social and dialogue

**(b)** Disguise is W15 (a status changing displayed identity); tongues are W16 (a `language` on
readables and dialogue with a comprehension skill: "comprehend languages" is a status that grants
the skill fact's effect, so W16's reader should accept `status_active self` as an alternative to
the skill). Charm as a dialogue unlock is content: a dialogue choice `when: status_active {subject:
self, status: charmed}` on the NPC, which needs O's leaf. Reputation masks are G11 disposition
reads plus the same leaf. Nothing else new.

### J. Items (cursed, enchant, corrosion)

**(b)** Rows 28 (curses: "cursed ring refuses remove until blessed"), 21 (durability), 27
(unidentified). Row 28's cleanest form is an item-held status (G3 already allows item holders):
`cursed` on the ring with `blocks: [remove]` evaluated for the item's wearer, and a `bless` use
recipe with `status.cure`. That needs G's `blocks` to also be read for statuses on items the body
wears (one more loop in `resolved()`), so row 28 becomes content. Enchant is row 3's affects: a
status on the item whose `modifies` applies to its wearer is a one-line extension of
`modifiers()` (`attributes/shared.ts` line 68: also sum active statuses on worn items). **S.**

### K. Transformation (polymorph, lycanthropy)

**(a)/(b)** Texts: W6 variants on `status_active` cover "a wolf-shaped Maud" and the player's
Character line. **(c)** The verb and number changes are G (`blocks`/`allows`), H (`resistances`)
and a status `attack` profile override read where `attackProfile()` picks the wielded weapon or
`player_attack` (`round_attack.ts`): `modifies_attack: AttackProfile`. **S.** Lycanthropy's
"transforms at full moon" is content: a `clock_hour` reaction with `when: sky {lunar: full}`
applying `wolf_form`, expiry at duration. A full "shape changes the whole body" (new slots, new
inventory rules) is out of scope (section 3).

### L. Stacking, refresh, intensity

**(a)** Refresh-never-stack is the engine rule (rows 1, 18); different statuses sum (2c); "poison I,
II, III" is three statuses with a reaction on the first's tick applying the second, and each one's
`cures` includes the lower (content; verbose but exact). D&D exhaustion levels are six statuses
the same way. **(c)** A general `stacks: {max, per_stack}` would need the row to carry a count
(a save contract change, composer parity, recovery rules, and a view change): **M** and the only
status extension here that touches the foundation. Recommend not building it: the three-status
pattern covers every cited game's intensity ladder and keeps Trap 11 (status rows only for things
with state) trivially true.

### M. Contagion and spread

**(a)** Fire spread is W22's content on `status_ticked` + `status.apply`; plague by contact is an
`entity_entered_room` reaction `when: npc_present carrier` applying `plague` to the entrant, both
already on main. **(a, M8)** The leader's death frightening the room is `co_present` (NPC holders).
**(c)** `co_present` applies to NPCs only and never to items or the player's body; a spread that
should reach co-present *things* (fire to every `burnable` item in the room) authors one rule per
item today. Widening `co_present` to items that pass a `when` on the holder needs O's `self` leaf
first, then an `items: true` flag in `statusStep` (`reaction.ts`, the M8 `present`/`npcsIn` loop).
TS-only. **S.** Recommend after W22 shows how many per-item rules the showcase needs.

### N. Environment to status (wet, oiled, burning, frozen, electrified)

**(a)** "Entering the river makes you wet": an `entity_entered_room` reaction on the room applying
`wet` (G3 holders: player and NPCs), ending by duration or at a fire's heat (a `status_ticked`
reaction on `warm_fire` curing it needs the cure step on a reaction: see R). Oiled: the G4 `oil`
recipe's entity fact today; as a status it is `status.apply` from the use outcome's
`action_completed`, which lands on the doer, not the target: the reaction subject table gives a
use recipe's target to `fact.assign` and `event.emit` but `status.apply` follows "the actor's body"
for `action_completed` and `custom_event`. **(c)** Let `status.apply` take `subject: "target"` on
a custom or action event (the `subject_id` the recipe already emits): one branch in `subject()`
(`reaction.ts` line 173). TS-only. **S.** Weather-driven wetness is W25's shape (a `clock_hour`
reaction with `sky {weather: rain}` and `exposed`). **Surfaces as room state** (an electrified
floor that shocks every entrant for a while) need P.

### O. Status-pair interactions (the five-element question)

This is where the engine falls short of DOS2 and the owner's example, and the gap is one leaf and
one event, not a table:

1. **`status_active` needs a `self` subject** (the actor) and a `subject` reading on a reaction's
   cause: `status_active {subject: "self" | "target" | "subject", status}`. `self` is
   `bodyOf(actor)`; `subject` is the cause event's subject as `reaction.ts` `SUBJECT` already
   resolves it, passed into `holds` as `ctx.target` (today `sequence()` passes none). Change:
   `policy.ts` line 88 (three cases) and `reaction.ts` line 113 (pass
   `target: subject(cause, body)`). TS-only; `policies.ex` and `leaf_refs.ex` accept the enum.
   **S.** This leaf alone makes every "A while B" rule content: `when: status_active {subject:
   subject, status: wet}` on a `status_ticked {status: shocked}` reaction doubles the damage by
   applying `shocked_hard` and curing `shocked`.
2. **A `status_applied` event**, the twin of `status_ticked`, emitted by `applyStatus` on a first
   application (the `first` test `statusStep` already computes). Then "lightning lands on a wet
   body" is `{on: {event: status_applied, status: shocked}, when: status_active {subject:
   subject, status: wet}, apply: [{status.apply amplified}, {status.cure shocked}]}`. One event
   kind in `protocol/event.schema.json` and `event_registry.json`, one `emit` in `reaction.ts`
   `statusStep` and in `status/job.ts` for apply paths that are not reactions (there are none
   today: every apply is a reaction step). TS plus the registry; no composer change. **S.**
3. **`status.cure` as a reaction step** (M8 allows it only on use recipes): "water cures burning",
   "warmth cures wet", "bless cures curse" each need a reaction to end a status on the subject.
   Same helper (`cureOps`), one branch in `sequence()`. TS-only. **S.**

With these three, a pair table is unnecessary: a status is a node, a reaction on
`status_applied`/`status_ticked` with a `status_active subject` condition is an edge, and
`cures`/`status.cure` are the overcoming edges. The five-element generating and overcoming cycles
are ten reactions (section 4). *Intensity* (lightning on wet does double) is a second status with a
bigger `per_tick`, as in L. *Check*: today's `status_active` in a reaction `when` is always false
(no target is passed), so no current content depends on the present semantics; the change is
additive.

### P. Statuses on rooms and barriers

**(c)** `holds()` (`status/shared.ts` line 95) and the composer's `HOLDERS`
(`foundation/compose_status.ts`, mirrored in `lib/loka/core/compose_status.ex`) refuse rooms and
barriers; the row key already carries any `EntityId`, and rooms have ids (`world.rooms[id]`), but
barriers have none (row G3: "a door that burns is an item"). Smallest piece: add `room` to
`HOLDERS` (both composers and `protocol/fixtures/status_composition.json`: composer parity, the
one foundation touch in this survey), let `status.apply` take `room: <key>` and the subject
`room_id` of `entity_entered_room`/`item_dropped`, and add `status_active {subject: "room"}` to
O's leaf. Readers that then become content: a darkness spell (`dark_description` shown while the
room holds `darkened`: one test in `dark()`), consecration (`sanctuary` while `consecrated`: one
test in `combat/shared.ts` line 46), an electrified or burning floor (an `entity_entered_room`
reaction `when: status_active {subject: room, status: electrified}` applying `shocked` to the
entrant: pure content once the leaf exists), smoke (G6 `cues` on the status already work from a
holder's room). Room ticks change no pool (as item ticks do). **M** for the holder; the three
readers are S each. Barriers stay items (W22's "a burnt barrier takes G12's broken state" is a
`status_expired` reaction setting the fact `opens_when` reads). Recommend building the room holder
when the showcase or 29b first needs a room spell; the item-holder trick covers fire today.

### Q. Auras

**(a)** Row 42 (one rule per listener with `npc_present`) and M8 `co_present` (every NPC in the
event's room) cover songs, a leader's death and a shout. **(c)** A *continuous* aura ("every body
in the paladin's room is protected while she stands there") is a tick: a status on the paladin
whose `status_ticked` reaction applies `protected` to co-present bodies with a short duration
that lapses when she leaves. Content once `co_present` reaches the player's body (one flag, M8's
loop excludes the body today: `never on the player's body`). **S.** DCSS's toxic radiance is the
same pattern with a drain. Nothing else needed.

### R. Dispel, cleanse, immunity windows

**(a)** `cures` on edibles and liquids, `status.cure` on use recipes (M8), static `immune` lists.
**(c)** `status.cure` as a reaction step (O.3) is the dispel for spells (29b casts a recipe whose
`action_completed` reaction cures), potions (a `drank` reaction) and shrines
(`entity_entered_room`). A cure-all ("dispel magic ends every status tagged `magical`") wants a
status `tags` list and `status.cure {tag}`: **S** on top of O.3; recommend only when a cartridge
has more than a handful of dispellable statuses. Timed immunity after a cure ("cannot be
re-poisoned for a minute") is content: the cure reaction applies `poison_immune` (a no-tick status)
and the poison applier's rule has `when: not status_active {subject: subject, status:
poison_immune}`: pure content once O.1 exists. Achaea's cure matrix (one herb per affliction) is
a `cures` list per food or liquid: content.

### S. Death and persistence

**(a)** W8 `permanent` survives the same-body return; everything else is cleared
(`death/sequence.ts` lines 78 and 205). Lycanthropy persisting through death is W8. An NPC's
death clears all of its statuses (G3), including a permanent scar: fine for single-player (the NPC
replacement is a new body). Nothing new.

### T. Visibility of the status to the player

**(c)** Every active status on the body is listed in GameView `conditions`
(`view/resources.ts` line 49). NetHack's hidden fuses (stoning in five turns, an unknown curse)
want a `hidden: true` on the status: `conditionViews` skips it and `statusStep` suppresses its
applied line; the tick narration stays (the player feels it) or is authored empty. TS-only. **S.**
Low priority: a single-player Book UI mostly wants to show its conditions (Trap 12 accessibility
argues for words, not mystery), so recommend it only for authored "unknown affliction" puzzles.

### Rows that already cover a need (no engine work beyond the above)

12 traps (M8: a status on the plate's victim), 16 sneak (E's `concealment`), 21 durability, 27
unidentified, 28 curses (J), 29b spell effects (`status.apply`, damage kind, light), 41 decay
(content on G3 + W1), 43a terrain costs (F's tags should be shared), W9 sleep vulnerability (the
`sleep_multiplier` already reads position; a `sleep` status is G's `blocks` plus a `modifies` on
dodge), W15 recognition/disguise, W16 languages, W22 fire (content). None of these rows needs a
status engine change that the list in section 3 does not already make.

## 3. Verdict

The status *row* is general enough: duration, permanent, tick, modifiers, cues, immunity, cure,
holders on bodies and things, writer-group sharing and recovery are all in place and need no
redesign. What is thin is the set of *readers* and one *leaf*: the engine reads statuses in five
places, and every effect class in the taxonomy that is not yet content wants exactly one more
reader in the module that owns the behaviour, plus the ability to ask "does X hold S?" from a
reaction and an action policy. No pair table, no intensity counter and no new save row are needed.

Ranked by how many taxonomy groups each unlocks (all TS plus a compiler check unless marked):

| # | Extension | Where | Size | Unlocks |
| --- | --- | --- | --- | --- |
| 1 | `status_active {subject: self \| target \| subject}` and pass the cause's subject into a reaction's `when` | `policy.ts:88`, `reaction.ts:113` | S | O (all combos), I (charm, masks), N (surfaces), R (immunity windows), G-adjacent gates; today the leaf is always false in a reaction |
| 2 | `status_applied` event (first application only) | `reaction.ts` `statusStep`, `event.schema.json`, `event_registry.json` | S | O (lightning on wet at the moment it lands), M, Q |
| 3 | `status.cure` as a reaction step (M8 has it on use recipes only) | `reaction.ts` `sequence` | S | O (overcoming edges), R (dispel, potions, shrines), N (warmth dries) |
| 4 | `blocks: [command]` / `allows: [command]` on a status, filtered once in the resolved action set | `commands/actions.ts:166` | S | G (silence, stun, paralysis, sleep, entangle, berserk, player fear), J (cursed items refuse remove), K (forms) |
| 5 | `resistances` on a status, summed in `dealt()` and read for the player too | `combat/round_attack.ts:105` | S | H (sanctuary, shields, vulnerabilities), O (wet is lightning-weak), K |
| 6 | `perception: {sight: blind \| dark_sight, hearing: deaf}` read in `dark()`, `darkSight()` and the sound cue reach | `light/shared.ts:84`, `attributes/shared.ts:109`, `senses.ts` | S | D (blind, infravision, deaf); E's see-invisible half |
| 7 | `movement: {cost_percent, passes: [tag]}` plus `water`, `air`, `chasm` tags on rooms or exits | `movement/shared.ts:80`, `movement/sequence.ts:125`, `water/shared.ts:40`, `entity.schema.json` `Tag` | M | F (fly, levitate, haste, slow, water walk, water breathing, feather fall); shares tags with 43a |
| 8 | `concealment: invisible \| hidden` read by `visible()` and NPC engagement | `light/shared.ts:95`, `disposition.ts:84` | S | E (invisible, hidden, sneak as row 16's shape, faerie fire as its cure) |
| 9 | Room as a status holder (`HOLDERS` + `status.apply room` + `subject: room`) | `foundation/compose_status.ts`, `lib/loka/core/compose_status.ex`, fixture; readers in `dark()`, `combat/shared.ts:46` | M (composer parity) | P (darkness, consecration, surfaces), N |
| 10 | `subject: "target"` on `status.apply` for action and custom events; `co_present` reaching the player's body and items | `reaction.ts:173`, the M8 `statusStep` loop | S | N (oil the winch as a status), Q (continuous auras), M (fire to every burnable) |

Lower, when a cartridge asks: `modifies[i].stat` (C, open in `loka-kgd.34`), `modifies_regen`
(A), `modifies_attack` (K), `hidden: true` (T), `confuses` (G random move), `reflects_percent`
(H), status `tags` with `status.cure {tag}` (R). Each is S and sits behind one reader.

Items 1 to 5 together are about a day and a half of engine work and turn the whole of O, G, H and
most of I, N, R into content; they are the recommended first slice, ideally before 29b so spell
effects are authored against them. Items 6 to 8 are the senses and movement readers the
owner's two LegendMUD examples need. Item 9 is the only one with composer parity and should wait
for a concrete room spell.

### Recommend never supporting

- **A stack or intensity counter on the row** (L): a save contract change for what three statuses
  express exactly; Trap 11 and recovery stay simple.
- **Random-outcome gating beyond a confused move** (G): charm redirecting attacks, random speech,
  hallucinated names are procedural outcomes in a single-player authored text game (Trap 4, Trap
  5); author the one `confused` variant set and `blocks` instead.
- **Detect magic, detect evil, telepathy, deathsight** (D): nothing in the engine carries the
  property they would reveal; adding alignment or "magical" flags for a detection buff is a new
  domain, not a status reader.
- **Pass door and full polymorph** (F, K): walking through a closed barrier bypasses the barrier
  contract; a body with new slots and inventory rules is a second character model. Fly over a
  barrier is a `passes` tag on the exit, not a barrier bypass.
- **PvP-oriented afflictions and cure races** (Achaea's hundred-affliction matrix): built for
  player-versus-player timing; a single-player Book has nobody to race.
- **Statuses on exits or barriers as holders** (P): barriers have no `EntityId` by design (G3);
  keep "a door that burns is an item" and the W22 broken-state fact.

## 4. Worked examples

Each is the content an author would write once the numbered extensions exist; **today** marks what
already works on main or the M8 branch.

### LegendMUD-style blind (needs 6, 4; optional 1)

```json
{
  "key": "blind",
  "duration": 120,
  "tick_every": 120,
  "resource": "hp",
  "label": "condition.blind",
  "perception": { "sight": "blind" },
  "blocks": ["read", "scan"],
  "narration": {
    "applied": "narration.blind.applied",
    "tick": "narration.blind.tick",
    "expired": "narration.blind.expired"
  }
}
```

A `drank {kind: inkwater}` or `attack_result` reaction applies it (**today**: row 1 shape, applier,
expiry, the Conditions line). With 6, `dark()` is true while it is active, so the room shows its
`dark_description` (or the engine's "You cannot see." fallback), contents and exits are hidden as
in darkness, and `scan` sees nothing (**today** darkness does all of this for an unlit room). With
4, `read` and `scan` are refused with the blind line. An NPC or item `cures: [blind]` (a healer's
eyedrops) ends it (**today**). W6 variant "Maud squints at you" on `status_active {subject:
target}` (**today**). With 1, a dialogue choice `when: status_active {subject: self, status:
blind}` offers "Ask where you are".

### Fly over an ocean room with a movement cost (needs 7)

Rooms `shore`, `open_sea` (tags `["water", "exposed"]`), `far_isle`. **Today**: exits and the mv
pool exist; `world.movement.cost` is one fixed fare; D6's water routes handle diving, not crossing.
With 7, `open_sea` refuses `move` for a body that holds no status or ancestry with `passes:
[water]` ("The sea is too deep to wade"), and a status:

```json
{
  "key": "flying",
  "duration": 600,
  "tick_every": 600,
  "resource": "mv",
  "label": "condition.flying",
  "movement": { "cost_percent": 50, "passes": ["water", "chasm"] },
  "cues": [{ "sense": "sound", "text": "cue.wingbeat", "range": 1 }],
  "narration": { "...": "..." }
}
```

applied by the 29a `cast fly` recipe's `action_completed` reaction (**today** once 29a lands)
lets the body cross and halves each move's mv fare. Expiry over `open_sea` is content: a
`status_expired {status: flying}` reaction `when: has_tag {subject: room, tag: water}` (**today**)
applies `drowning` (hp −2 every 10 s) and, with 3, cures `flying`; D6's deadline job is the
precedent for a harsher "you sink" rule if wanted. The wingbeat cue reaches the next room
(**today**, G6 on a status).

### Five elements with wet + lightning amplification and the two cycles (needs 1, 2, 3, 5)

Statuses `wood`, `fire`, `earth`, `metal`, `water` (the five "charged" states a spell leaves on its
target), plus `wet` (environment) and `shocked`, `shocked_hard`:

- **Vulnerability (needs 5).** `wet` declares `resistances: {lightning: -100}` (one new
  `DamageKind`, `lightning`, G2's closed set): a lightning bolt's `attack` on a wet body already
  deals double through `dealt()`. **Today** the same table exists on NPC definitions only.
- **Amplified status on landing (needs 1, 2, 3).**
  ```json
  {
    "key": "shock_on_wet",
    "on": { "event": "status_applied", "status": "shocked" },
    "when": { "op": "status_active", "subject": "subject", "status": "wet" },
    "apply": [
      { "op": "status.apply", "status": "shocked_hard" },
      { "op": "status.cure", "status": "shocked" },
      { "op": "status.cure", "status": "wet" }
    ]
  }
  ```
  `shocked_hard` has twice the `per_tick` and `blocks: ["move", "attack"]` (4): DOS2's stun.
  **Today** none of this fires: no `status_applied`, `status_active` is false in a `when`, and no
  reaction cures.
- **Generating cycle (wood → fire → earth → metal → water → wood; needs 1, 2).** Five reactions of
  one shape: `on status_applied {status: fire}`, `when status_active {subject: subject, status:
  wood}`, apply `fire_blaze` (a stronger fire) and cure `wood`. Trap-free: one rule per edge, no
  procedural table.
- **Overcoming cycle (water → fire, fire → metal, metal → wood, wood → earth, earth → water;
  needs 3).** Five reactions: `on status_applied {status: water}`, apply `status.cure fire`; or
  simpler, `fire.cures: [water]`-style lists if the engine lets a status declare `cures` the way
  edibles do (a fourth S item: `StatusDefinition.cures`, applied in `applyStatus`; it is the
  same `cureOps` call). **Today** the one-way cure exists only on food, drink and use recipes.
- **Elemental spells (29a + 29b).** Each spell is a recipe whose `action_completed` reaction
  applies its element to the target (needs 10 for a target other than the caster, or 29b's own
  target rule); the reagent, mana and word gates are 29a (**on the branch**). Water poured from a
  bucket on a burning thing is **today's** G4 `quench`.

What the author never writes: a pair table, an intensity counter, a damage formula. Ten edge
rules and eight status files are the whole system, and the showcase's W22 fire is already the
first edge.

Skipped: no code was run or built; the Elixir composer and content checks were read for shape,
not executed. Risk: line numbers cite main at `cf2242fa` and the M8 branch heads; the M8 merge
will move `reaction.ts` lines.
