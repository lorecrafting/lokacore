# Mechanics review 3: the player's seat

Read-only, main at `ecfbfa95`, 2026-10-10 (Beads `loka-kgd.31`). Builds on [review 1](2026-10-09-mechanics-roadmap-review.md)
and [review 2](2026-10-09-mechanics-review-2.md); same Traps. Sources: `docs/MECHANICS-TOOLBOX.md`,
`docs/system/mechanics.md` (quest@1, containment@1 `give`, schedule@1, topics), `docs/system/book-ui.md`
headings, `protocol/quest.schema.json`, `kernel/ts/src/mechanics/schedule/`, the fixed-time,
background-time and single-difficulty decisions, `docs/archive/spec/21-composable-world-primitives.md`.

The lens: a player of a single-player, chapter-based, book-metaphor text RPG. Not the engine's
elegance (reviews 1 and 2), but what that player misses on a Tuesday evening with the Book open.

## 0. What a player would feel is thin

| Dimension | Today | Covered by a ranked row | Gap after the table |
|---|---|---|---|
| Onboarding | Chapter 1's authored opening; no hint anywhere when a quest stalls | – | **yes**: the first stuck player closes the Book (W23) |
| Agency | verbs are rich (give, pour, wear, knock, read); NPCs do not react to a gift | 14, G4, G9, 15 | gifts: content on W1+W2 under row 15 |
| Feedback | status line, conditions, level and skill lines; a 3-hour absence replays every tick line | W6, W7 | **yes**: no "while you were away" (W27) |
| Pacing | fixed time, 72 s per hour; one hard-wired deadline (S2 `quest.deadline`) | 10, 20b, 37a | **yes**: generic quest deadlines (W24); row 44 becomes content on it |
| Discovery | details, readables, topics, Knock, map; topics are listed, never used by the player | 11, 46, W16, 26, W13 | deduction: content and a Journal affordance under 46 |
| Social | per-NPC trust, dialogue hub; no memory primitive yet | W2, 15, G11, W3, W10, W15 | none beyond the table |
| Consequence | quest outcomes, death custody, village reactions (D9); NPCs walk through locked doors | 33, W8, W21, G7 | **yes**: locks the player pays for mean nothing to NPCs (W26) |
| Mastery | skills by use, levels, derived stats; no reason to dress for the world | 5, G5, 2c, 21, 29 | exposure (W25) gives clothing a job; repair closes 21's loop |
| Accessibility | sign-in-the-words rule, label-in-name, Trap 12 | every text row | none: a Book UI rule, not a mechanic |
| Replay | chapter carry-over, outcome-keyed journal | 48a-c, 47, 46 | none: one difficulty by owner decision; no modes |

## 1. PM candidates

| Candidate | Verdict | Where | Reason |
|---|---|---|---|
| Hints when stuck | **keep** as a row | W23, M5 | missing; the one onboarding mechanic; S; one difficulty stays (hints are authored per stage, never a toggle) |
| Clue deduction (combine known topics) | **merge** | row 46 | topics are player-scoped bool facts, so `all(fact_compare a, b)` already deduces; what is missing is the player's affordance: the lore tab offers two known topics and a recipe grants the third. One journal slice, already row 46's |
| Exposure: cold or heat by weather, clothing and drains | **keep** as a row | W25, M5 | composes 31 `sky` + G1 `exposed` + G13 drain + a `wearing` leaf (G1's candidate list); the only row that makes clothing matter; Traps 1 and 6 respected (derived cold, gentle real-minute drain) |
| Gifts to NPCs (affinity) | **merge** | row 15 (content on W1, W2) | `give` exists and emits `item_acquired` with the NPC as holder; a W1 reaction on it adjusts a W2 pair fact; no engine row |
| Quest deadlines with authored failure | **keep** as a row | W24, M5 | `quest.deadline` exists hard-wired to one trust fact and a fixed logical time (S2); generalise to `{after or at, outcome}` with the penalty as a W1 reaction; S |
| Status immunities | **merge** | row G3 | one `immune` list on a definition checked by `status.apply`: a line in G3's slice, not a row |
| Repair (row 21 counterpart) | **merge** | row 21 | durability without repair is a punishment loop; a smith service on `mechanics/service/` restores it for a fee inside row 21 |
| NPCs respect locks and use doors | **keep** as a row | W26, M11 after G7 | scheduled NPCs jump to the listed room and wander never checks a barrier; a lock the player buys (24) must stop an NPC or property is theatre; M, opt-in per schedule |

## 2. New rows

| Id | Mechanic | Why a player misses it | Composes with | Size | Trap check |
|---|---|---|---|---|---|
| **W23** | **Hints when stuck**: a quest journal stage may declare `hints [{after (real minutes), text}]`; the Journal shows the first whose time since the stage began has passed; an action may declare a `tip` shown once (an engine fact `seen_tip_<key>`) | the first player who cannot find the panel exit stops playing; authored hints keep the Book's voice | quest@1 journal, `view/quest_journal.ts`, the dev clock proves the reveal; needs a new `started_at` on the quest instance row (save contract change; W24 shares it) | S-M | no RNG, no mode (one difficulty); timing is real elapsed, never a skip |
| **W24** | **Quest deadlines**: `deadline {after or at, outcome}` on a quest; expiry fails the instance with the outcome (journal `outcomes[outcome]`), the W1 quest event carries it; the Journal shows time remaining | a world that runs while you sleep (background-time decision) needs stakes a player can read; today one chapter has one deadline by bespoke fields | quest lifecycle, engine jobs, W1 reactions (trust penalty, guard reaction), 38 protect, 44 race | S | Trap 8: the failure is an outcome, not a gate; fixed time: the clock, not the player, runs it |
| **W25** | **Exposure** (owner: cold, hot, damp, windy, dry): leaf `wearing {tag}` and tags `warm`, `cool`, `waterproof`, `windproof` (closed set, G1 rule); trigger (PM ruling): `entity_entered_room` and a new `clock_hour` event from one engine calendar job per world rescheduling on each game-hour boundary, so the drain starts within one game hour and depends on no other status ticking; content per condition: a reaction on either trigger whose `when` is all(`sky` condition, room `exposed`, not wearing its tag) applies a short drain that refreshes while the conditions hold and expires by itself in shelter; `dry` needs no tag: a thirst drain any drink ends | weather that only changes a room line is wallpaper; a cloak you reach for on a frosty fell is immersion the player does | 31 sky, G1 tags, G13 drains, row 3 slots, W6 ("shivering"), 43a mud later; `clock_hour` serves W10 and 37a too | S-M engine + M content (not split: one leaf, four enum entries, one hourly job, five authored tables) | Traps 1 (derived), 6 (gentle, real minutes), 12 (each condition is a label in words) |
| **W26** | **NPCs use doors**: a schedule or wander step with `walks: true` is refused when the destination is not reachable within `query_steps` through exits whose barriers are open, closed, or locked with a key the NPC holds (G7 `traverse` applies to NPCs as to the player); a key-holder's passage opens and re-locks the barrier (`barrier_changed`); a refused step retries at the next listed hour; without the flag schedules jump as today | locking your hut and finding the thief inside breaks the contract of row 24; guards who stop at a gate they cannot open are a consequence the player can see | G7 locks, W10 schedules, population wander, W1 `barrier_changed`, 33 trespass | M | Trap 2: no needs, one bounded walk; Chapter 1 unchanged (opt-in) |
| **W27** | **Away recap**: after an elapsed settlement longer than an authored threshold (real minutes), the next page opens with one collapsed block grouping the settlement's receipt narrations by kind with counts, then the normal page; nothing stored | the owner wants players used to a world that runs without them; forty tick lines are the opposite of a welcome back | status ticks and expiry (row 1), W24 deadlines, W10 moves seen in the room, `view/` | S-M (view) | Trap 12: text; replay-safe: built from receipts the reply already carries |

Not proposed, and why: **difficulty or hint toggles** (one difficulty, owner decision); **sleep to
morning** (fixed time); **confirm dialogs for risky actions** (Book UI polish, not a mechanic: Beads
polish queue); **achievement toasts** (46); **emotes** (Realm value; trimmed from G9 below);
**NPC needs** (Trap 2); **companion banter** (content on W10 and W6).

## 3. Cuts, demotions and moves

| Row | Change | Reason |
|---|---|---|
| 44 race objective | demote to **content only on W24** and schedule@1; drop the 43b dependency | "before the cart arrives" is a deadline plus a scheduled NPC; mounts make it winnable, not possible |
| G9 social verbs | move to M7 beside W21; **emotes deferred to the Realm** | in single-player, say and shout exist for fear (W21) and rumour range (W3); an emote nobody reads is Realm value |
| 36 jail | resolves by fine or escape, no served sentence (owner); L to M; stays after 35 | a sentence at 72 s per game hour is dead real time |
| 46 lore codex + deduction | up from M15 to **M6** | discovery is the text RPG's core loop and the row is S with its only dependency done |
| 26 puzzles | up from M15 to **M8** with G4 | the two agency verbs ship together; no dependency |
| 32 fast travel | up from M14 to **M10** | pacing: the sampler world grows past walking distance around companions and encounters |
| 21 durability | gains repair | see section 1 |
| G3, 15 | gain immunities, gifts | see section 1 |

Nothing cut outright: every remaining row has a consumer in a later row or a sampler.

## 4. Batch order from M5

Table order within a batch is the build order; rows in one batch touch different kernel files.

| Batch | Rows | Change |
|---|---|---|
| M5 statuses and onboarding | G3 (+immunities), 2c, 13, G12, 18, 42, G13, **W25 exposure**, W6, **W23 hints**, **W24 deadlines** | + W25, W23, W24 |
| M6 memory and discovery | W2, 15 (+gifts), G11, 14, W10, W3, **46 lore and deduction**, **W27 away recap** | + 46 (from M15), W27; G9 out |
| M7 combat | 6a, 6b, 6c, 12, G6, **G9** (say, shout), W21, W8 | + G9 (from M6) |
| M8 magic and use-on | 29a, 29b, G4, **26 puzzles**, 19, W22 | + 26 (from M15) |
| M9 gear | 17, 21 (+repair), 27, 28 | unchanged |
| M10 companions and travel | G8, 22, 9, W9, **32 fast travel** | + 32 (from M14) |
| M11 economy and property | G7, **W26 NPCs use doors**, 24, 20a, 20b, W11 | + W26 |
| M12 world | 37a, 37b, 38, 39, W12, W13 | unchanged |
| M13 law | 16, 33, W15, 41 | unchanged |
| M14 tail | 35, 36 (fine or escape), 43a, 43b, 44 (content on W24), 45 | 32 out |
| M15 meta | 47, G10, W16, 48a, 48b, 48c | 46, 26 out |
| Settle, Realm | S1-S4, R1 | unchanged |

## 5. Owner decisions on the open questions

Asked on #354; the owner answered 2026-10-10, verbatim: "keep hints, fine or escape for jail, page
block, cold hot damp windy dry".

1. **Hints (W23)**: kept as written, opt-in per cartridge, authored per stage.
2. **Jail (36)**: resolves by paying the fine or escaping; no served sentence. Row reworded, L to M,
   stays after 35.
3. **Away recap (W27)**: a page block at the top of the next page, not a Journal entry.
4. **Exposure (W25)**: five conditions, cold, hot, damp, windy, dry, each from the derived sky on
   exposed rooms; tags `warm`, `cool`, `waterproof`, `windproof`; `dry` is a thirst drain any
   drink ends, so it needs no tag. Resized to S engine + M content; not split.

Skipped: I did not open `view/view.ts` or `quest/lifecycle.ts` line by line (claims rest on
mechanics.md and the schemas). The Opus review confirmed a quest instance stores no activation time
(`foundation/compose_quest.ts`), so W23 adds `started_at` and W24 shares it. Risk: W26's reachability walk must stay
inside `query_steps` or wander jobs get slower with the world, not with play.
