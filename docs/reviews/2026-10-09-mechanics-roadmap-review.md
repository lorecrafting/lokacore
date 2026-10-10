# Mechanics toolbox review: gaps, merges, order, risks

Read-only, main at `fdf8b4cf`, 2026-10-09. Sources: `docs/MECHANICS-TOOLBOX.md` (the table has **48** rows, not 35), `docs/system/mechanics.md`, `docs/system/architecture.md` (composition), `docs/archive/decisions/owner-decision-emergence-2026-09-25.md`, `docs/archive/LATER-MECHANICS.md`, `docs/decisions/owner-decision-mechanics-toolbox-2026-10-08.md`, `docs/decisions/owner-decision-fixed-time-2026-10-03.md`, `docs/decisions/owner-decision-story-realm-shared-mechanics-2026-10-04.md`, `kernel/ts/src/mechanics/`.

## 1. Gaps

The toolbox is strong on *features* and thin on *shared vocabulary*. The emergence decision's own example ("fire acts on anything `burnable`; a wooden locked door is burnable") cannot happen with today's rows: nothing gives things properties, nothing lets a status land on a thing or an NPC, and NPCs have no attributes (`mechanics.md` row 2: "NPCs have no attributes"). Rows marked **E** generate the most emergence.

| Gap | Why it matters | Composes with | Size |
|---|---|---|---|
| **G1 Property tags on items, barriers and rooms** (burnable, metal, wooden, sharp, liquid-holding, fragile) **E** | Principle 2: verbs act on properties, not entity lists. Without it rows 12, 19, 21, 29, 40 each invent a private flag. | 3 slots, 12 traps, 19 tool gate, 21 durability, 29 reagents, 40 material, G4 | S (schema + compiler parity) |
| **G2 Damage kinds and resistances** (physical/fire/cold/poison; per-body resistance) **E** | One vocabulary for spells, materials, traps and armour; the alternative is row 40 as a one-off. | 7, 17, 29, 39, 40; `combat/round_attack.ts` | S-M |
| **G3 Statuses and attributes on NPCs and things** **E** | Row 1 applies to the player body only; row 2 reads only the player. Allies (6), song (42), boss (39), traps on guards (12), poisoned wells, burning doors all need it. Realm: every player is a body like an NPC. | 1, 2, 6, 12, 39, 42, G4 | M (status rows keyed by body; save recovery) |
| **G4 Generic "use X on Y" verb** resolved by G1 properties **E** | Today every interaction is a per-detail recipe (`seek_wisp.json`, `pick_lock.json`). Pour water on fire, oil on hinge, poison on blade: nobody authors the pairs. | action_recipe, 1, 12, 18, 29, 30 | M |
| **G5 Opposed checks** (actor skill/attribute vs target's) | Rows 13, 14, 16, 33 all need "my pick vs this lock", "my sneak vs that guard's perception"; a fixed threshold per detail scales badly. | 5, 13, 14, 16, 33, G3 | S once G3 exists |
| **G6 Noise and smell perception** **E** | Perception is light-only (`mechanics/light/shared.ts`). Principle 3 example "noise wakes a guard"; combat and lockpick failures should be audible. | 9, 16, 34, 37 | M |
| **G7 Ownership relation** on items, containers and rooms **E** | Rows 24, 25, 33, 34 and the Realm (principle 4: houses, guild halls) each need "who owns this"; one `owner` relation plus a `stolen` provenance beats three. | 24, 25, 33, 34, 22 | S-M |
| **G8 Group primitive** (leader, members, co-move, shared credit) | Escort, hireling (22), pet (45), mount (43) each re-implement follow; the Realm needs parties (story/realm decision: "party credit needs an explicit contract"). | 6, 22, 23, 43, 45 | M |
| **G9 Social verbs**: say/whisper/shout with range, emotes | Principle 6, nothing in the table. Shout composes with G6. Single-player value: keyword talk to NPCs (MUD heritage). | dialogue, G6, topics | S-M |
| **G10 Player-written text**: write a note, sign or book | Readable exists; a `write` verb producing a readable instance is small. Principle 4 "world remembers players". | readable, G7 | S |
| **G11 NPC disposition** (hostile/wary/friendly) read by combat, dialogue, shops | Row 15 is standing as an int fact; what is missing is the derived hostility that makes guards attack, shops refuse, and NPC factions fight each other. | 15, 6, 9, 34 | S |
| **G12 Force/bash a barrier** | Every lock then has four answers (key, pick, bash, spell): the cheapest emergence in the list. | 2 strength, 13, G1 fragile | S |
| **G13 Hunger/thirst/fatigue drains** | A deep RPG needs the drain; it is one row 1 declaration (negative per-tick status) plus food `cures`. Content, not engine; worth a sampler. | 1, food, liquid, rest | S (content) |

Not gaps: dual wield/two-handed/shield (fold into row 3, carry checkpoint c1-equipment in `ROADMAP.md`); repair (row 20 service); trainers (row 4 option); alignment and titles (15, 46); player time-skip (forbidden by fixed-time decision).

## 2. Merges and splits

**Merge**

- **7 + 40 + G2** into one "damage model" row: same file (`combat/round_attack.ts`), same sampler.
- **18 + 42 into row 1 content** once G3 lands: a potion is an edible whose `applies` lists a status; a song is `status.apply` to listeners. Both are declarations, not engines.
- **33 + 34**: theft is one offense kind; "witnessed offense" must be generic (assault, trespass on G7 property) or trial/jail only ever handle theft.
- **22 + 23** on G8: hire = join group plus a wage job; splitting them produces a hireling with no reason to leave.
- **24 + 25** on G7: a bank is an owned container at a service NPC plus a money account.
- **32 into transport content**: once D10 visited-map exists, fast travel is an authored route gated on `visited`.
- **47 into row 4** as a cartridge option; **46** is `fact` counters plus a journal view, content-sized.
- **26 is probably content**: three levers in order is an int fact plus reaction rules; confirm before engine work (`LATER-MECHANICS` C2-C02 "no puzzle DSL").

**Split**

- **6 (L)**: 6a target choice in the same room; 6b NPC-vs-NPC damage and credit (needs G3); 6c several foes with pack plan. 6a alone unblocks 17.
- **29 (L)**: 29a cast admission (word, learned gate, level, attributes, reagents, mana: all existing recipe cost/check plus `answerFits`); 29b effects (status.apply, damage kind, light); learning by quest already exists (D1/D2).
- **20 (L)**: escrow custody first (inputs leave the player exactly once), claim/cancel second.
- **37, 43, 48 (L)**: as `LATER-MECHANICS` already proposes (trigger/aftermath; terrain cost/mount; export/import).

## 3. Proposed order after batch M2

Principle: vocabulary rows first (they are small and every later row reads them), then the rows that make a dungeon-crawl sampler possible (the Barrow King list in `LATER-MECHANICS.md`), then economy and law. Batches of ~3 that touch different kernel files; the one shared file is noted.

| Batch | Rows | Why now |
|---|---|---|
| M3 vocabulary | **G1+G2+7+40** (round_attack, item schema); **5+G5** skill growth with an opposed check (skills.ts, action_recipe); **8** loot (population/birth, death) | Cheapest emergence; 5 is the MUD core and unblocks 13/14/16/33; 8 makes every fight worth fighting |
| M4 dungeon | **11** hidden+search (movement/rule); **10** time windows (calendar, policy); **30** rope (movement/rule, resource) | Barrow-King-style content needs all three; 11 and 30 share movement/rule, run serially |
| M5 G3 | **G3** NPC statuses and attributes (status rows, attributes/shared); **13** lockpicking + **G12** bash (barrier); **18** potions as row-1 content (food) | G3 before 6, 12, 39, 42 or each re-does it |
| M6 social | **15+G11** reputation tiers and disposition (fact, policy, commerce); **14** dialogue checks (dialogue/rule); **G9** say/emote (new) | Chapter-2-style NPC conflict; 14 reads G5 |
| M7 combat | **6a/6b/6c** (round_flow, behavior); **12** traps (barrier, status.apply); **G6** noise (light/shared) | 6 is L: give it the batch; traps and noise are separate files |
| M8 magic | **29a/29b** spells (action_recipe, knowledge, resource); **G4** use-on (action_recipe, shared with 29a: serial); **19** tool-gated harvest (containment/harvest) | Owner decision 5 needs 1, 2, 4 done; 29 is the row with the most composition surface |
| M9 gear | **17** ranged (round_attack, movement/shared); **21** durability (equipment, action_recipe); **27+28** identify and curse (knowledge, equipment: serial with 21) | Chapter-2 crown and ring content |
| M10 companions | **G8** group primitive (escort); **22+23** hireling and wages on G8; **9** random encounters (population/settle, schedule) | 9 introduces RNG into populations: isolate it |
| M11 economy | **G7** ownership; **24+25** property and bank on G7; **20a/20b** escrow (service, job) | Realm economy foundations |
| M12 world | **37** events (split); **38** protect; **39** boss phases (behavior, G3) | Needs 6, 9, 10 |
| M13 law | **33+34** theft and witnessed offense (G6, G7); **16** sneak (light/shared, behavior); **41** perishable | 16 before 33: a thief needs stealth |
| M14 tail | **35/36** trial and jail; **43/44** mounts and race; **31** weather as a room status (G3) plus description variant; **45** pet on G8 | Content-heavy, single consumers each |
| M15 meta | **46/47** in row 4; **48** carry-over; **G10** write; **26** if not content | 48 last: it freezes the export contract |

Rows 4 and 5 are the MUD identity (attribute points, skills by use); keeping 5 in M3 right behind M2's row 4 means the Character page tells the full progression story at the first owner demo.

## 4. Risks

- **Row 17 sampler contradicts owner answer 2.** Table text "bow hits a foe one room away" vs the decision "starts with a same-room first strike; adjacent rooms later" (`owner-decision-mechanics-toolbox-2026-10-08.md` §2). Rewrite the sampler before briefing.
- **Row 32 "for a fee and elapsed time"** must not jump the clock: `owner-decision-fixed-time-2026-10-03.md` forbids player-driven time skips. Make it a transport job over real elapsed time or instant with no clock change.
- **Rows 20, 31, 41, 23 rely on real elapsed time** (72 s per game hour): players wait for real; only the `?dev=1` clock (answer 3) shortens tests. Author durations in minutes, not hours.
- **Rows 3 and 4 both become attribute writers.** `mechanics.md` attributes@1: "no training/equipment attribute writer is installed"; architecture forbids duplicating a writer. Decide once: row 3 affects are read-at-use (as row 2's derived stats), row 4 is the only durable writer to `state.characters`. Row 4 adds character-scope state (level, unspent points): a save row and `save.md` recovery section, not just facts.
- **Row 2b (loka-kgd.8) touches resource bounds.** `mechanics.md` attributes@1: "a new op would take resource@2, re-deriving every v2 lock and hash." Keep it a derived maximum read at use, not a new op. The same warning applies to a mana regen change in 29.
- **G3 changes the status save row** (keyed by body, not "the player"): do it before rows 6, 12, 39, 42 or migrate four consumers.
- **Row 9 breaks population determinism.** Populations are "bounded and RNG-free"; the simulator keeps curated regression seeds (`architecture.md` two kernels). RNG births must be opt-in per cartridge so the Chapter 1 E1 recorder (owner answer 4) and the demo corpus stay green. General rule for every row: new behaviour behind a cartridge field, as `world.derived` did.
- **Row 6b ally kills and quest credit** need the explicit party-credit contract the story/realm decision demands; `combat/credit.ts` assumes the player is the killer.
- **Row 29 incantation input.** Owner answer 5 wants spoken words; the Book has a riddle letter bank, no free text. Decide the Book UI rule (letter bank vs typed) in the brief; it is a `book-ui.md` change.
- **Row 48** is a save/export contract (`LATER-MECHANICS` continuity boundaries); rows 3, 4, 27 define what is portable, so it must stay last.
- **Row 26 and 46** risk engine work for what is content; the toolbox rule "one slice = one row" should allow "done: content only".

## 5. Top five recommendations

1. **Add the vocabulary rows before more consumers**: property tags, damage kinds, and statuses/attributes on NPCs and things (G1, G2, G3). They are small, and they are what turns 48 features into a world where fire opens a wooden door nobody wrote a rule for.
2. **Ship skill growth with an opposed check (5 + G5) right after row 4.** Class-free points plus skills by use is the owner's stated identity; opposed checks then make lockpicking, persuasion, sneaking and theft one mechanic with four samplers.
3. **Re-rank toward a dungeon crawl**: 11 hidden passages, 30 rope, 10 time windows, 8 loot, 12 traps before 15, 16, 17. That gives a Barrow-King-like sampler in two batches and proves composition early.
4. **Split 6, 29 and 20, and add a group primitive (G8) before hirelings, pets and mounts**; merge 7+40, 18+42, 22+23, 24+25, 33+34, and fold 32, 46, 47 into existing rows. Net: fewer, sharper rows.
5. **Fix the two decision conflicts (17 ranged sampler, 32 fast-travel clock) and adopt one rule for every row: new behaviour is opt-in by cartridge field**, so Chapter 1's recorder and the seeded corpus keep passing without per-row migration.

Skipped: I did not open every kernel file named in the table (file-sharing calls in section 3 are from the table's Reuse column plus `ls`), and I did not verify whether player disengage from combat or armour reduction already exist. Risk: batch file-overlap claims may be off by one file; check at briefing.
