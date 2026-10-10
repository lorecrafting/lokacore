# Mechanics review 2: what makes the world feel alive

Read-only, main at `fdf8b4cf` plus `origin/docs/toolbox-rerank` (PR #346), 2026-10-09. Builds on the
[first review](2026-10-09-mechanics-roadmap-review.md) and the re-ranked
`docs/MECHANICS-TOOLBOX.md` (G1-G13, S1-S4, R1). Sources read: `docs/system/mechanics.md`,
`architecture.md` (composition), `book-ui.md`, `save.md`, `cartridge.md`, the emergence, toolbox
and fixed-time decisions, `docs/archive/LATER-MECHANICS.md`, `docs/archive/spec/21-composable-world-primitives.md`
(§6, §16, §17, catalog rows), `protocol/*.schema.json`, `kernel/ts/src/mechanics/*`.

## 0. What the engine can and cannot say today (the facts the proposals rest on)

- **Policy leaves** (`protocol/policy.schema.json`): `all/any/not`, `target_present`, `has_item`,
  `quest_state`, `fact_compare`, `time_window`, `barrier_state`, `stat_compare`, `resource_compare`,
  `escort_state`, `light_off`. No leaf reads a status, a visited room, an observation, a skill level,
  a tag, an owner, weather or a count.
- **Reaction triggers** (`mechanics/reaction.ts`, mechanics.md reaction@1): only `fact_changed`,
  `entity_entered_room`, `quest_resolved`. The event vocabulary is larger (`event.schema.json`):
  `attack_result`, `entity_died`, `item_dropped`, `item_acquired`, `barrier_changed`,
  `check_failed/passed`, `drank`, `poured`, `filled`, `rested`, `scene_ended`, `shooed`,
  `custom_event`. Reactions cannot see 13 of 16 events. Reaction `apply` is `fact.assign`,
  quest activate/resolve/fail, `status.apply` (row 1). The actor is always the player
  (`status.apply` on an NPC entry is skipped by rule).
- **Fact scopes** (`mechanics/fact.ts`): `player` and `instance` (world). Per-NPC trust is a
  player-scoped int fact named per NPC (`maud_trust`): one fact definition per NPC per feeling.
- **Knowledge** (`mechanics/knowledge/shared.ts`): visited rooms and "last observed NPC at
  room/time", player to NPC only. Nothing records what an NPC saw.
- **Description variants** (`description_variant/rule.ts` `describe`): room and detail text is the
  first variant whose `when` holds, plus `dark_description`. NPC `short`/`room_line`/`description`
  and item descriptions are fixed keys.
- **Narration** (`cartridge.md` Text): one key, one string. No alternates; the hundredth
  "You walk north" is the first.
- **Calendar** (`mechanics/calendar.ts`): solar and lunar phase cuts are derived from the clock,
  never stored. Precedent for any derived environmental state (spec 21 `tide@1`).
- **Statuses** (`mechanics/status/shared.ts`): player body only (`ponytail:` note in the file),
  per-tick resource amounts; no stat modifier (row 1 note: "rate modifiers deferred").
- **Save** (`save.md`): `state_row` sections, trace capped at 5000 rows, observations 1000.
  New state = new rows + recovery section; derived state = free.
- **Time**: 72 s real per game hour, so a game day is about 29 real minutes and a 30-day
  season about 14 real hours of play. Schedules already cycle visibly within one session.

Two findings on the adopted table before the additions:

- **Row 18 and 42 cannot be "content only on row 1" as written.** Row 1 statuses change a
  resource per tick; "+3 str for an hour" and a song buff need a status that modifies a derived
  stat (row 2's formula) or an attribute. That is engine work (below as **2c**), not content.
- **Row 31 weather as a stored room status** is the expensive shape (rows + jobs per room);
  the derived-cut shape below (**W5**) is smaller and replay-safe. Row 31 should be rewritten,
  not built.

## 1. New mechanics (beyond G1-G13, S1-S4, R1)

Ids are provisional (`W` = world memory and atmosphere). Emergence: high = other rows gain
behaviour with no code; medium = one or two consumers; low = self-contained.

| Id | Mechanic | Why it matters for immersion | Composes with | Size | Risk | Emergence |
|---|---|---|---|---|---|---|
| **W1** | **Reactions on every registered event**: `entity_died`, `attack_result`, `item_dropped/acquired`, `barrier_changed`, `check_failed/passed`, `drank/poured/filled`, `rested`, `scene_ended`, `status` tick/expiry (new event), with declared actor attribution per event (the killer, the dropper, the entering body) and NPC-actor deliveries | The emergence decision's principle 3 ("noise wakes a guard", "fire spreads") is a reaction on an event the reaction system cannot see. D8 crow scavenging had to be bespoke code because `item_dropped` is not a trigger. This is the one change that turns most of M7, M12 and the rows below into content | G6 noise, 12 traps, 33 witness, 37b aftermath, 38 protect, 39 boss phases, 6b credit, W2, W3, W8, W9, W21, W22, companion opinions | S-M (`reaction.ts` is 190 lines; the work is actor attribution and budgets, which already exist) | Delivery budgets and FIFO-to-quiescence already bound chains; the risk is defining who "owns" an NPC-caused delivery (today: the command actor). Decide once: the event's declared subject | **high** (the highest in this review) |
| **W2** | **Entity- and pair-scoped facts**: fact scopes `entity` (one NPC or thing) and `pair` (NPC × character), read by `fact_compare`/`fact.adjust` exactly as today | "The world remembers you" (principle 4) is per-NPC memory: times met, trust, fear, debt, saw-me-steal, knows-my-name, last-met-at (an int clock fact). Today each is a player-scoped fact per NPC, which does not survive N players × M NPCs in the Realm | 15 standing, G11 disposition, 22 loyalty, 45 pet loyalty, G7 grants (a grant is a pair bool), W3 rumour, W15 recognition, companions with opinions (a pair int adjusted by W1 reactions) | S-M (scope resolution in `fact.ts`, key shape, compiler parity, a save section keyed by scope) | Save growth is bounded by declared facts × touched pairs; only changed facts have rows (fact@1 already) | **high**: it is the generic "memory" primitive, and it needs no new ops |
| **W3** | **Rumour by co-presence** (content on W1+W2): a reaction on an NPC `entity_entered_room` whose `when` reads an entity-scoped fact on a co-present NPC and assigns it on the entrant; optional decay by a clock fact | NPCs that talk to each other on their schedules; the innkeeper has heard about the mill by evening because Ada walks past at 17:00. Deterministic (schedules), bounded (co-presence, no broadcast), visible (dialogue policies read the fact) | schedule@1, dialogue policy, W2, W10, G9 shout range (a shouted word spreads one room) | S once W1+W2 (sampler + a mechanics.md clause) | Trap if made global; keep spread a reaction between co-present NPCs only | **high** |
| **W4** | **Sense cues (projection only)**: a room, detail, entity, fuel source or active status declares `cues` {sense: sound/smell/heat, text key, range in rooms, `when` policy}; the view lists cues reaching the actor's room; D9's bell cue becomes one instance | Text is the only medium that can do smell and distant sound well. "Hammering from the east", "smoke on the wind", "someone is fighting next door" (a cue on an open encounter) tell the player the world runs without them. Zero authority state, zero save cost | light (heard in the dark), schedule (`time_window` cue), combat (encounter cue), G6 (same declaration read by NPC perception), 31/W5 weather cues | S-M (schema + `view/`; cue range is a bounded adjacency walk under `query_steps`) | None to determinism; keep range ≤ 2 to bound the walk | medium-high (merge with G6: one `senses` row, two readers) |
| **W5** | **Derived environmental cuts: weather, season, tide** computed from (seed, day, authored tables) like solar/lunar cuts; policy leaf `sky {weather|season|tide}`; replaces row 31's stored status | Rain, frost, fog and a season name in the status line, room variants that read them, a torch that will not light in rain (G1 `exposed` tag), mud that slows the road (43a), a cold drain on exposed rooms in winter (G13 status.apply on entry) | 10 time windows, 31, 41 perishable (summer spoils faster), 43a terrain, G13, W4 cues, description variants | S (one more cut table in `calendar.ts`, one leaf, one view label) | None: derived, never stored or ticked; a per-day hash of the seed gives variety without touching the authority RNG stream | **high** per unit cost |
| **W6** | **Entity-level description variants**: `describe()` applied to NPC `short`/`room_line`/`description` and item names/descriptions, plus policy leaves `status_active {body, status}` and `position {body}` | "Maud, bruised, wipes the counter" at 22:00 and after the raid; "a notched sword"; "a dull ring" until identified; a sleeping guard; a scarred stranger. Reactive text is what a text RPG has instead of animation | 27 unidentified, 28 cursed, 21 durability, 16 hidden, W8 scars, W15 recognition, G3 NPC statuses, W5 | S (reuse `describe`; two leaves) | Authoring cost per variant; keep base text mandatory | medium-high |
| **W7** | **Narration variety and visit tiers**: a text key may hold alternates chosen by a hash of (command id, key), never the authority RNG; a `visited_count {room, compare}` leaf so the first visit gets the long description and the tenth a line | Repetition is the fastest immersion killer in text; every MUD veteran knows the wall of identical "You walk north". Visit tiers also fix Book scroll length on familiar rooms | description variants, D10 visited rooms (count needs one int per visit row or a counter), every narration key | S (catalogue shape + `view/`; replay-safe by construction) | Alternates must be authored as equals in meaning: a review rule, not engine work | low (quality, not emergence) but top-3 in felt value |
| **W8** | **Permanent statuses: wounds, scars, marks** (row 1 option `duration: permanent`, survives same-body return; cured only by `cures`) with a Character-page line and W6 variants | The body keeps history: a near-death leaves a scar that NPCs mention and intimidation reads (via 2c). Death today clears every status; a permanent class is a one-line exception | row 1, G3, W1 (apply on `attack_result` when `resource_compare hp < n`), 2c, W6, 14 intimidation | S | Death-clear exception must be explicit in `death/sequence.ts`; keep scars cosmetic plus modifiers, never gates | medium |
| **W9** | **Sleep vulnerability and dream hooks**: sleeping bodies take the authored multiplier and cannot act; wake on damage once (spec 21 `position@1` LATER); any presentation-only scene may start from a `rested` reaction with a `when` | Sleep stops being a position label: where you sleep matters (inn vs fen), and dreams become a reusable content hook ("after you killed the hound you dream of hounds") instead of one Lantern scene | position@1, combat round, scene presentation_only (B9), W1 `rested`, G13 fatigue | S | Fixed-time rule: sleep never skips time; only rates and vulnerability change | medium |
| **W10** | **Conditional schedules**: a `daily_schedule` hour maps to `[{when, room}, ..., room]`, first holding wins (the description-variant pattern applied to movement); optional `goal` text key for the view ("Maud hurries to the Green") | NPCs that go somewhere else because of what happened: the mother to the Green while the child is lost, the smith to the inn when stock is empty, guards to the gate on a raid. This is 80 % of "NPC needs and goals" at 10 % of the cost; full drives (spec 21 `drives@1`) are a trap (section 4) | schedule@1, policy leaves (facts, W2 pair/entity facts, W5 weather, `resource_compare` on NPC pools via G3, `population_count` from W12), W3, 37a events | S (`schedule/behavior.ts`, schema, compiler) | None: a job still moves one NPC once; `when` is evaluated at the job | **high** |
| **W11** | **Stock-sensitive prices**: an offer may declare a bounded price table by units on hand (sell low when flush, buy high when empty); later an NPC-to-NPC commerce job moves stock between providers on a schedule (spec 21 L4 row) | Scarcity you can see and use: fish is cheap at the fen and dear in town; a raid that empties the chandler's shelf shows in prices. Realm principle 5 needs it; Story needs only the derived price | commerce@1 price, containment stock, W10 (restock trips), S3 settlement, 20b jobs, 41 perishable | S for price-by-stock (derived, no state); M for trade jobs | Trade jobs are the first NPC-to-NPC item transfers: conservation invariants must cover them | medium (high with trade jobs) |
| **W12** | **Population plans reading populations**: leaf `population_count {plan, compare}` so a plan's births/wander `when` can read another plan's living count; optional `prey` slot: a hunting job that moves one predator toward a prey room | Food chains with two leaves: kill the hounds and deer fill the fen; pelts flood the market (W11); a flourishing hound pack empties it. Visible, deterministic, cheap | population@1 (bounded, RNG-free plans already), W10, W11, 9 encounters, S4 raids | S-M (leaf S; prey hunt M) | A quest that needs a population must declare a floor; plans are already bounded above | medium-high |
| **W13** | **Tracks and trails** (spec 21 `track@1`): an accepted body transfer may write a decaying trail (entity-scoped fact on the exit with a clock); a `track` check reveals the next exit; W5 rain ages trails faster; a `hunt` behaviour reads the same trails to pursue a fled player | Tracking a wounded hound or being hunted through the fen is the kind of play MUDs never had and text does better than graphics. The same vocabulary serves the player and the NPC | 5 skills, G5 opposed check, 16 sneak (a sneaking body leaves no trail), W5, W2 entity facts, C4 flight, population behaviour | M | Trail rows per exit per actor: cap by decay and per-actor count; hunt must stay within plan bounds | **high** |
| **W14** | **Writing group additions**: journal notes and map pins written through a kernel command into a player-scoped section (no entity), and **letters by job** (spec 21 `mail@1`): a timed job (20b) that places a readable instance (G10) in a declared container for the player | Players of text games keep notebooks; a Book that cannot be written in is a prop. A letter waiting at the inn after a quest is the world writing back. Both are small once G10 and 20b exist | G10 readable instances, 20b jobs, G7 ownership (inbox container), Journal view, D10 map | S + S | Free text in commands: the trace already redacts player words; Realm needs moderation (R1 scope). Keep the letter bank out of it: notes use the keyboard | low-medium (letters medium: NPCs react to replies via W1) |
| **W15** | **Recognition and displayed identity** (spec 21 `recognition@1`): the name the view shows for an NPC or player is a variant keyed by a pair fact (`knows_name`); a disguise is a status that changes displayed identity; guard arrest (33/35) reads recognition, not the wanted fact | Introductions are principle 6; a Realm where everyone is "Raymond" at first sight is a chat room, and a Story where the hooded stranger has a name on the first look wastes a reveal | W2 pair facts, W6 variants, G3 statuses, 33/34 wanted, 16 sneak, G9 introduce verb | M | Realm identity rules (spec 21 §6) must be the owner's; do the Story subset only | medium (high in the Realm) |
| **W16** | **Languages and literacy**: a readable or dialogue may declare a `language`; comprehension is a skill fact (row 5); unknown shows an authored unreadable key | Lore that must be earned (learn the old tongue to read the barrow walls) is a strong discovery loop in a text world | 5 skills, D2 book Read, readable@1, 27 identify (a sage translates) | S | Content cost is the whole cost: one language per cartridge at most, or it becomes a chore | low-medium |
| **W21** | **Fear and morale for NPCs**: a `fear` status (G3) applied by shout/intimidate (14, G9) or by a reaction on an ally's `entity_died` (W1) to the co-present pack; combat behaviour reads it to flee or surrender | Enemies that break when their leader falls, villagers who scatter when the wights come, a guard who steps back from a scarred veteran. C4 flight is the seed; this makes it vocabulary | G3, W1, 6c pack plan, C4 flight, 14, G9, W8 | S once G3+W1 | None beyond G3 | **high** |
| **W22** | **Fire (integration sampler, content only)**: `burning` status on things (G3) whose tick reaction (W1) applies to co-present `burnable` things (G1); a burnt barrier takes G12's broken state; water poured (G4) cures | The emergence decision's own example and the proof that G1+G3+G4+W1 compose: "fire opens a wooden door nobody wrote a rule about". It is the demo to show the owner | G1, G3, G4, G12, W1, W4 (smoke cue), light | S (content) | Spread must hit the delivery budget, not loop; the sampler is the red control for budgets | the flagship |
| **2c** | **Status modifiers on derived stats and attributes**: a status may declare `modifies {stat or attribute, amount}` read by row 2's formula and attributes@1 at use (no durable writer) | Needed by 18 potions, 42 song, W8 scars, 28 curses, 3 affects already do it for items: statuses should use the same read-at-use path | rows 1, 2, 3; G3 | S | The first review's warning: read at use, never a second durable attribute writer | medium (unblocks three content-only rows that are not content-only today) |

Not proposed, and why: **full NPC drives/needs simulation** (trap, section 4); **procedural room text** (trap);
**player time skip or sleep-to-morning** (fixed-time decision); **real-time hunger on NPCs**
(G13 on G3 gives it for free when a cartridge wants it); **ghost walk on death** (spec 21 row;
corpse custody already chosen); **stances, parry** (combat tuning, `docs/design/provisional-story-mechanics.md`
owns them); **achievement toasts** (46 covers); **voice/narrator persona switching** (one voice,
one Book: a style rule, not a mechanic).

## 2. Refactors, merges and reshuffles of the adopted table

**Foundation primitives that many rows share** (each is small; build them before their consumers):

1. **W1 all-event reactions** is the shared base of 12, 33, 37b, 38, 39, 6b, G6, W2-W3, W8-W9, W21-W22.
   With it, **39 boss phases (L) becomes content**: a reaction on `attack_result` with
   `resource_compare hp ≤ 60 %` that applies a status and a `population.spawn` step (one new apply
   step), another at 25 % that assigns a fact a conditional schedule (W10) reads to withdraw.
   **38 protect becomes content**: `entity_died` of the named defender → `quest.fail`. **37b aftermath**
   becomes content: reaction on the event's own `fact_changed`. M12 shrinks from L+M+M+L to one M
   (37a trigger/spawn) plus three content rows.
2. **W2 entity/pair fact scopes** is the shared "memory" primitive for 15, G11, 22, 45, G7 grants,
   W3, W15. Build it in the same batch as 15, before G7: a grant row and a pair fact are the same
   thing, so G7 should not invent "saved grant rows".
3. **Policy leaf set, designed once**: the table adds leaves row by row (`owner/role/holder` in G7,
   opposed checks in G5, tags in G1). Decide the naming, the compiler parity scaffolding and the
   `holds()` dispatch shape in G1's slice, then each row adds its leaf under that shape. Candidate
   leaves: `has_tag`, `status_active`, `position`, `visited`/`visited_count`, `observed`,
   `skill_compare`, `owner`, `role`, `population_count`, `sky`, `group_member`, `wearing`.
4. **Entity description variants (W6)** are the shared presentation primitive for 27, 28, 21, 16,
   W8, W15: do W6 before M9 gear or each of 27/28/21 invents its own name override.
5. **Derived calendar cuts (W5)** replace row 31 and feed 10, 41, 43a, G13.

**Merges**

- **G6 + W4 → one `senses` row**: one `cues`/`emits` declaration read by the view (player) and by
  perception (NPC). Two readers, one vocabulary; shipping G6 alone leaves the player deaf while
  guards hear.
- **31 → W5** (rewrite the row text: derived cut, not stored status; keep id 31).
- **41 perishable + corpse decay + dropped-item cleanup → "decay" content on G3**: a status with
  expiry on a thing, whose expiry reaction (W1) transfers it to the terminal consumed holder (D4's
  roomless holder already exists). One mechanic, three samplers.
- **G10 + W14 → the writing group** in M15: notes, signs, books, letters by job.
- **18, 42 → content on 2c**, not on row 1 (correct the Status column).
- **46 collections + lore codex**: the Journal's lore tab lists known topics (topics@1 already
  projects them) and read readables; one view slice.

**Splits and reshapes**

- **G3** is the row the most new rows depend on (W6, W8, W21, W22, 2c, decay). Keep it in M5 but
  pull it to the front of the batch, and include the `status` tick/expiry **event** so W1 can trigger
  on it; otherwise fire cannot spread.
- **9 random encounters**: keep, but make the RNG draw a per-plan option so W12 ecology (RNG-free) and
  9 (RNG) do not share a plan.
- **15 + G11**: define disposition as a derived read of a pair fact (W2) plus a faction instance fact;
  no third store.

## 3. Revised batch order

Principle unchanged (vocabulary first, then a dungeon crawl, then social), with the two
foundations (W1, W2) placed before their consumers and the cheap atmosphere rows (W5, W6, W7)
placed early because they are visible in every later sampler demo. Batches of about three
touching different kernel files.

| Batch | Rows | Change from #346 |
|---|---|---|
| M3 vocabulary | G1+G2 (round_attack, item schema; **design the leaf set here**); 5+G5 (skills, action_recipe); 8 loot; **W1 all-event reactions** (reaction.ts) | + W1 |
| M4 dungeon and atmosphere | 11 hidden; 10 time windows + **W5 derived sky (replaces 31)** (calendar, policy); 30 rope; **W7 narration variety and visit tiers** (view, text catalogue) | + W5, W7; 31 moves up as W5 |
| M5 statuses | **G3 first, with the status event**; **2c status modifiers**; 13+G12; 18, 42, G13 as content on 2c/row 1; **W6 entity variants** (description_variant, view) | + 2c, W6; 18/42 re-based |
| M6 social and memory | **W2 pair/entity facts** (fact.ts); 15+G11 on W2; 14 dialogue checks; G9 say/emote; **W10 conditional schedules** (schedule/behavior); **W3 rumour** (content) | + W2, W10, W3 |
| M7 combat | 6a/6b/6c; 12 traps (content-heavy now, on W1); **G6+W4 senses**; **W21 fear** (content on G3+W1); **W8 scars** | + W4 merge, W21, W8 |
| M8 magic and use-on | 29a/29b; G4 use-on; 19 harvest; **W22 fire sampler** (content: the composition demo) | + W22 |
| M9 gear | 17 ranged; 21 durability; 27+28 (on W6) | unchanged |
| M10 companions | G8 group; 22 hireling (loyalty on W2); 9 encounters; **W9 sleep and dream hooks** | + W9 |
| M11 economy | G7 locks (grants on W2); 24 property+bank; 20a/20b escrow; **W11 price by stock** | + W11 |
| M12 world | 37a trigger/spawn (M); 37b, 38, 39 as content on W1 (+ `population.spawn` apply step); **W12 ecology leaf**; **W13 tracks** | 39/38/37b demoted to content; + W12, W13 |
| M13 law | 16 sneak; 33 offense (witness on W1 + senses); **W15 recognition**; 41 decay (content on G3) | + W15 |
| M14 tail | 35/36 trial and jail; 43/44 mounts and race; 45 pet (loyalty on W2); 32 | 31 gone (M4) |
| M15 meta and writing | 46 collections + lore tab; 47; **G10 + W14 writing group** (notes, signs, letters by job); 26; **W16 languages**; 48a/b/c last | + W14, W16 |
| Settle, Realm | S1-S4 (S3 gains W10 schedules and W11 trade jobs), R1 | unchanged |

Net effect: M12 loses two L rows; M3-M6 gain five S rows that every later sampler demo shows.

## 4. Traps: immersive on paper, costly in this engine

1. **Stored, ticking environment.** Weather as a room status with jobs (row 31 as written) means
   rows and jobs per room per change, save recovery sections, and a replay surface. Derive it (W5).
   The same applies to temperature, tide, plant growth: derive from the clock, never tick.
2. **Full NPC needs simulation (drives).** Hunger/sleep/money scores arbitrating between goals
   produce cascades that are hard to author, hard to test and invisible unless the player follows an
   NPC for a game day (29 real minutes). Conditional schedules (W10) give the visible 80 %.
   Revisit drives only for the Realm, with a simulator corpus of their own.
3. **Global rumour or omniscient NPCs.** If a fact spreads to every NPC at once, witness (33), sneak
   (16) and memory (W2) lose their point. Spread only by co-presence on schedules (W3).
4. **Procedural prose.** Generated room text reads like generated room text; the Book's authored
   voice is the product. Variety (W7) and variants (W6) over authored lines; no grammar engine.
5. **Narration variety that consumes the authority RNG.** One extra draw shifts every later roll and
   breaks the curated regression seeds. Choose alternates by a hash of ids (W7), never by `rng`.
6. **Real-time drains at 72 s per game hour.** Hunger "one point per hour" ticks every 72 real
   seconds; fatigue by real time punishes long sessions. Author drains in real minutes, gentle,
   and never let fatigue gate actions (fixed-time decision: rates change, the clock does not).
7. **Unbounded memory.** Pair facts across N players × M NPCs in the Realm, trail rows per exit per
   actor (W13), cue walks (W4): cap each by declaration (facts are declared; trails decay; range ≤ 2).
8. **Permanent consequences as gates.** Scars, reputation and rumours that lock content multiply
   authoring paths and make the recorder corpus brittle. Keep them as lines, prices and dispositions;
   gates stay on quest facts.
9. **Free text in the Book.** Notes and signs want a keyboard; the Book's letter bank is for riddles.
   The trace redacts player words already, but the Realm needs moderation before any player text is
   shown to another player (R1 territory).
10. **Ecology that can starve a quest.** A plan that reads another plan's count (W12) can hit zero
    for a population a quest needs; declare floors in the plan, as bounds already exist above.
11. **Status on every thing (G3) by default.** Rows only for things with state is the existing
    fact@1 rule; keep it for statuses or the save grows with the world, not with play.
12. **Accessibility regressions in atmosphere.** Cues, weather and fear must be text with the sign in
    the words (the conditions rule already says so); never colour-only tones or sound-only cues.

## 5. Top seven recommendations

1. **Let reactions see every event (W1) in M3.** It is a small change to one file, and it turns
   boss phases, protect objectives, aftermaths, witness, fear, fire and NPC memory into content.
   Nothing else in this review returns as much per line.
2. **Add entity and pair fact scopes (W2) as the one "memory" primitive**, in M6 before G7 and 15:
   NPC trust, loyalty, grants, recognition and rumour are all the same pair fact, read by the
   `fact_compare` leaf the dialogue system already has.
3. **Derive weather, season and tide from the calendar (W5) and rewrite row 31**; ship it with time
   windows in M4. It is the cheapest "the world has a life of its own" signal in the status line.
4. **Make text react (W6, W7) early**: NPC and item lines with variants, narration alternates by
   id hash, long-then-short room descriptions. A text RPG's immersion is mostly the text; these
   are S-sized and show in every sampler afterwards.
5. **Correct rows 18 and 42**: they need status modifiers on derived stats (2c), a small engine row in
   M5 behind G3, not "content only on row 1".
6. **Conditional schedules (W10) instead of a needs simulation**, and rumour by co-presence (W3) on top:
   NPCs that go somewhere else because of what happened, and tell each other.
7. **Prove composition with a fire sampler (W22) at the end of M8**: burning spreads to burnable things,
   a wooden door burns open, water cures it, smoke is a cue next door. If that sampler is content
   only, the vocabulary rows are right; if it needs engine code, the rows are not finished.

Skipped: I did not open `view/view.ts`, `schedule/behavior.ts` or `population/settle.ts` line by line
(claims about them come from mechanics.md, the schemas and exports), and I did not size the Elixir
compiler parity for new fact scopes or leaves. Risk: W1 actor-attribution rules may be larger than
S-M if some events lack a clean subject; check `event.schema.json` payloads at briefing.
