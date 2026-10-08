# Later-story ending table and planning proof note

2026-10-04. Canonical selectors/text for the [PM-selected future policy](decisions/pm-decision-later-story-reconciliation-2026-10-04.md); source-only draft awaiting independent docs review. A planning agent supplied the supporting design at merged main `6d9712ef`. Narrative text fixes semantic distinctions for review; final literary copy still needs normal prose approval.

This is future content policy, not frozen runtime schema or certification. The factored tables below define the complete disjoint selectors and literal semantic review text. The five base rows below preserve the current three child outcomes. The legal and reputation tables are independent selectors: concatenate exactly one paragraph from each table in **base → legal → Priory/Fen reputation → Crown reputation** order. They never assign child/allegiance/king history. This gives 135 disjoint presentation rows. Their predicates cover a conservative envelope of 6,615 well-typed inputs (5 pairs × 3 legal contexts × 21 × 21 reputation values). The coverage check is not a claim that every precise numeric reputation value is an authored reachable fixture.

## Typed inputs and production points

| Input | Exact chosen domain, default and producer |
|---|---|
| `village.child_status` | Existing-intent instance enum missing/rescued/stays/lost, as corrected by current content decision. Q2 writes one terminal outcome. Later chapters import it; it is immutable there. Missing is never finale-ready. |
| `chapel.allegiance` | Existing-intent instance enum unknown/prior/fox. Q3 ring/refusal writes it once. Later chapters preserve history. S7/S26 and reputation do not rewrite it. |
| `barrow.king_status` | **Future instance enum waiting/king_slain**, default waiting in Chapter 2. Q4 terminal King defeat is its sole live producer. Chapter 3 validated import or explicit no-prior fiction starts king_slain. No living/spared/bound king completion exists under this choice. |
| `player.wanted.crown` | **Future player boolean**, default false; witnessed Crown offense or declared escape offense sets true. Atomic fine or the still-current served sentence clears it. Archive `player.wanted` meant per-faction state, not one global reputation integer. |
| `sentence_active` | A table shorthand with an exact future backing: actor/jurisdiction sentence row `{id, status, due_at}`; status active means true, no row or released/escaped/interrupted_by_death means false. Trial creates no sentence until the jail branch commits. One active Crown sentence maximum. This is not a new persisted duplicate boolean. |
| `faction.priory_fen` | **Future selected player integer −10..10**, positive Priory/negative Fen, proposed default 0. Not an installed field or current M15 change; reconcile intended Q3/side-quest writers at their consumer. Carry through explicit future `memory.priory_fen` port; no recomputation from allegiance. |
| `faction.crown` | **Future player integer −10..10**, default 0; S6/S14 earn, witnessed S18 incurs the selected penalty. It is reputation, independent of wanted. No generic score-to-crime conversion. |
| `Q5 readiness` | Valid imported/default history + Chapter 3 market-square arrival + next-dusk event occurred + real legal scene anchor + alive/safe + no competing mandatory scene. Missing prerequisites defer. Completion additionally needs final acknowledgement. |

Dotted fact names are authored names mapped by the current compiler to underscore keys; the future slice must declare their typed FactSpecs and exact registered sentence row/op schemas. This document does not pretend the archived YAML or these planning tables can already compile as a cartridge.

## Base outcome (all rows require king_slain)

| ID | Child | Bell | Fox / fen | Final memory text |
|---|---|---|---|---|
| `rescued_fox` | rescued | fox | free / warded | Wren is home with Elspeth. Vesper remains free, and the ward holds the fen. The Barrow King is slain. Ashmere lights its lanterns beside a river kept within its banks. |
| `rescued_prior` | rescued | prior | bound / flooded | Wren is home with Elspeth. Vesper remains bound by the bell, and water still covers the low fen. The Barrow King is slain. Ashmere celebrates the child's return while the Priory watches the flooded paths. |
| `stays_fox` | stays | fox | free / warded | Wren lives in the fen by choice and carries messages between Vesper and Ashmere. Vesper remains free, and the ward holds. The Barrow King is slain. Elspeth receives Wren's words beneath the lanterns; the child has not come home. |
| `stays_prior` | stays | prior | bound / flooded | Wren lives in the fen by choice and still sends messages home. The bell binds Vesper, and water covers the low paths. The Barrow King is slain. Elspeth keeps a lantern for the child who chose to stay; Ashmere follows the Priory while Wren keeps a different promise. |
| `lost_prior` | lost | prior | bound / flooded | Wren is still lost. The bell binds Vesper, and the low fen remains flooded. The Barrow King is slain, but his fall cannot undo the child's loss. Elspeth lights a lantern for Wren, and Ashmere remembers the absence. |

**New fifth policy:** stays/prior keeps Wren alive and staying in the fen after the later binding of Vesper. Wren still sends messages; the village follows the Priory. It is not rescued, lost or the free-fox/Fen-folk ending. This is explicitly chosen prose/aftermath because the archive never supplied it. The prior/flooded common state preserves the bell-flood consequence instead of silently reversing it when the King dies.

## Legal context

| ID | Crown wanted | Active sentence | Required real scene anchor | Paragraph |
|---|---|---|---|---|
| `clear_free` | false | false | `village_green` | You stand openly among the village lanterns; the Crown has no outstanding claim against you. |
| `wanted_free` | true | false | `village_green` | You watch from the edge of the green, still wanted by the Crown. The lanterns do not settle that debt. |
| `jailed_wanted` | true | true | `jail` | Harrowgate's lanterns shine beyond the jail window. News of Ashmere reaches you here; your sentence continues. |

false wanted + active sentence is invalid, not a fourth ending. Wanted/free is reachable and must remain distinct from jailed/wanted. An actor in dungeon_cells has a valid detained history but no admitted window scene until returning to jail. An actor in trial, dead, fighting, or elsewhere waits for a valid anchor. The ending is pending and cannot be failed just because the event happened offscreen.

## Faction paragraphs

| Field | Inclusive values | Paragraph |
|---|---|---|
| `faction.priory_fen` | -10..-1 | The Fen-folk speak warmly of what you have done for them; the Priory remains wary. |
| `faction.priory_fen` | 0..0 | Neither the Priory nor the Fen-folk claims your loyalty. |
| `faction.priory_fen` | 1..10 | The Priory welcomes your service; the Fen-folk keep their distance. |
| `faction.crown` | -10..-1 | Harrowgate remembers your dealings with disfavor. |
| `faction.crown` | 0..0 | Harrowgate has yet to favor or condemn your record of service. |
| `faction.crown` | 1..10 | Harrowgate remembers your service with favor. |

A favored but wanted player is deliberately possible: bounty/ore service earns Crown reputation, then a witnessed theft or escape creates an outstanding offense. A disfavored but legally clear player can pay the fine or serve the sentence without erasing reputation. Faction text describes social opinion, not acquittal or a new bell choice.

## Green and inn variants

| Base ID | Green | Inn rumor |
|---|---|---|
| `rescued_fox` | Wren stands beside Elspeth beneath the lanterns; beyond the green the fen is quiet. | The child came home, the fox kept its freedom, and the dead king will trouble neither again. |
| `rescued_prior` | Elspeth holds Wren close beneath the lanterns; the Priory keeps watch toward the flooded fen. | The child came home and the king is dead. The bell still binds the fox; the low paths have not drained. |
| `stays_fox` | A message from Wren hangs beside Elspeth's lantern; a small fox mark faces the fen. | Wren chose the fen and still sends word. The fox is free, and Ashmere is learning to listen. |
| `stays_prior` | Elspeth leaves space beside her lantern for Wren's next message; the flooded fen remains beyond the watch. | Wren stayed willingly. Binding the fox did not bring the child home, though messages still reach Elspeth. |
| `lost_prior` | One lantern stands beside Elspeth for the child who never returned; floodwater glints beyond the village. | The king is dead, but Wren is still lost. No victory has brought the child back. |

## Reachability producers

- **rescued_fox:** Escort Wren home, finish Q2 turn-in, refuse the bell in Q3, acknowledge dawn; defeat King and acknowledge high_pass; reach market_square and return to green for Lantern Night.
- **rescued_prior:** Reach and escort Wren home before ringing; finish Q2, ring in Q3, acknowledge dawn; Q4 defeat/turn-in/high_pass; Chapter 3 road arrival then Lantern Night.
- **stays_fox:** Reach Wren, answer Vesper, choose carry-message and report that choice; refuse bell; acknowledge stays dawn; Q4 defeat/turn-in/high_pass; Chapter 3 road arrival then Lantern Night.
- **stays_prior:** Reach Wren first, choose carry-message and resolve stays; then ring the bell (loss condition was only before reaching Wren); acknowledge stays/prior dawn; Q4 defeat/turn-in/high_pass; road arrival then Lantern Night.
- **lost_prior:** Find tracks, accept Q3, ring before reaching Wren; Q2 resolves lost and Q3 prior; acknowledge tragic dawn; Q4 remains available, then king defeat/turn-in/high_pass; road arrival then Lantern Night.

- **clear_free:** Commit no witnessed Crown offense, or pay Brann's fine, or finish a real sentence; travel to village_green.
- **wanted_free:** Witnessed S18 theft without subsequent arrest, or complete the physical jail escape and return via fence_alley and the ordinary road to Ashmere. Avoid Brann's watch_house.
- **jailed_wanted:** After road arrival, enter watch_house Crown-wanted, resolve S19 to jail, and meet Lantern Night with an unexpired sentence at the jail window. Timing the arrest before the scheduled dusk is legal elapsed-time play, not a clock skip.

Reputation producers remain the named side-quest choices (S7/S26 and M15 consumers) and
Crown service/offense/resolution paths (S6/S14/S18/S19). Their archived numeric reward
paths are not current proof. The single-axis/range choice is future schema requiring
explicit reconciliation with M15 and versioned continuity; exact score/sign reachability
needs actual authored inputs and focused behavior proof. Essential Q4 turn-in, S25 lesson,
S19 resolution and Q5 remain available across reputation values. For a no-prior S7 start,
author one unspent charm at tide_flats; an imported charm disposition prevents a second
charm/award. Declare that optional disposition port before implementing its import.

## Defaults and import mapping

| Start | Child / bell / king | Other relevant initial state |
|---|---|---|
| Chapter 2 without Chapter 1 | rescued / fox / waiting | Priory/Fen 0, Crown 0, wanted false, no sentence; S8 unresolved; no ring snapshot; memory.vault false. Q4 must actually be played. |
| Chapter 3 without prior chapters | rescued / fox / king_slain | Priory/Fen 0, Crown 0, wanted false, no sentence; S8 unresolved; no ring snapshot; memory.vault false. Earlier chapters are not credited as completed. |
| Chapter 2 with valid Chapter 1 | exact imported child/bell; waiting | Import declared reputation if supported; optional undeclared-in-older-source reputation defaults 0 only under an explicit compatible schema. Never replace a terminal child or bell history with skip defaults. |
| Chapter 3 with valid Chapter 2 | exact imported child/bell/king_slain | Same declared reputation and optional-item policies; Chapter 3 law starts clear/0, since Chapter 2 has no Crown law. No sentence, trial, scheduler job or NPC world row imports. |
| Chapter 3 with only Chapter 1 record | refuse this import selection; offer explicit no-prior start or Chapter 2 | Do not silently mix Chapter 1 facts with a fabricated Chapter 2 completion. An owner-selected direct-skip adapter would be a separate future decision. |

Declared semantic ports: `memory.village_ending` enum rescued/stays/lost → `village.child_status`; `memory.fox_fate` free/bound → fox/prior allegiance; `memory.barrow_king` king_slain → king state; future optional `memory.priory_fen` integer → reputation; `memory.vault` bool → vault discovery. These mappings must be reconciled with the merged Chapter 1 export schema at CC-M01, not implemented through an unversioned rename. `memory.chapter_1_guild_tilt`, if retained by that schema, is a separate narrative memory, never a replacement for exact reputation or a class permission.

A selected import is validated for campaign, source exact compatible release/hash/schema, lineage, declared keys and complete mandatory history. Malformed/unknown child, allegiance, king or missing mandatory key refuses atomically; “prior optional” does not turn malformed supplied data into a no-prior start. Unknown fields are rejected, optional defaults apply only where declared. Existing destination saves never re-import on reopen; source and destination pins remain separate. Ring/crown custody, seal memory, post-ending checkpoint and no-prior item defaults
follow [the decision's item policies](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#1-king-in-the-chamber-vault-after-defeat).
These are future CC-M03 encodings, without implicit whole inventory or prior-world import.

## Guard ordering and terminal record

1. Validate the source/start schema and actual fact types/ranges. Reject invalid imports before constructing a partial destination.
2. Reconcile real elapsed time and due work, including sentence expiry and health, through ordinary authority order.
3. Require the selected valid history pair and king_slain for Chapter 3 finale eligibility. Missing/unknown/waiting remains an unfinished story; a corrupt imported completed record refuses, never becomes rescued/fox by fallback.
4. Require Q5's event/readiness and actual anchor. Resolve prior mandatory scenes first. Require a live actor and no unresolved unsafe combat. Trial-pending prevents final presentation. Active confinement requires wanted and a physical jail-room body; wrong position waits for legal movement, never creates a duplicate body.
5. Select exactly one base row, one legal row and each faction row. Keep a durable scene presentation revision and its input snapshot. This is a consequence-free narration selection before acknowledgement, not early completion.
6. If time, arrest, release, death or another admitted action changes relevant legal/location state, invalidate that continuation and re-present the appropriate still-pending variant at a legal anchor. A stale acknowledgement cannot commit text describing the wrong context. Do not restart consequences or pause the clock.
7. At final acknowledgement, revalidate the current presentation revision/inputs, then atomically complete Q5, reach its terminal story point and store one final memory/export occurrence. A retry/reopen produces no second completion. The final record contains exact base ID, child/allegiance/king, wanted/legal context and the two numeric faction inputs used to render it. Later living-world reputation changes do not rewrite the acknowledged historical record.

Canonical final base memory is a **new future** `memory.campaign_ending` enum of these five IDs; keep `memory.village_ending` as the Chapter 1 child outcome. Put the chosen legal context and numeric input snapshot in the typed final continuity occurrence, not in a pile of duplicated mutable derived facts. `memory.wanted`, if exported, is a boolean snapshot of Crown wanted at that acknowledgement, not a mutable command to arrest a future character. Archive names do not establish those shapes; this decision does.

## Unreachable or nonterminal inputs

- lost/fox has no legitimate producer: loss requires ringing before reaching Wren and Q3 then resolves prior. Late side quests do not rewrite that history.
- missing or unknown cannot complete Chapter 1; therefore cannot be a valid completed import or admitted finale. Local in-progress states remain valid during their own chapter.
- waiting can exist in Chapter 2 but cannot export its completion. No alternate completed king result is invented.
- a clear actor with an active Crown sentence is invalid under the selected sentence semantics. Trial pending and an active sentence simultaneously are invalid for the same offense/occurrence.
- any fractional/out-of-range faction score, unknown enum, missing required history key or malformed sentence reference is invalid data, not a branch with best-effort defaults.
- reputation sign does not make a child/allegiance combination unreachable. It neither repairs lost nor turns stays into rescued. Optional affiliation flags, housing, rings, S28 and king-crown possession do not select the final base outcome.

## Planning validation limits

The adviser reported a private standard-library check that exhaustively selected all 6,615 accepted fact tuples against 135 disjoint predicates. It also enumerated the 441 lost/fox tuples for each legal context and the clear+active-sentence tuples and confirmed zero matches across 3,528 invalid tuples. Its red controls remove stays/prior (a gap) and duplicate rescued/fox (an overlap), and both failed selection in that private run. Literal spot checks independently pin stays/prior and lost/prior memories and the three legal contexts. This validates the planning table only: playable story paths, renderer text, byte schemas, key drops, imported item provenance, clock, custody and durable acknowledgement still need the future behavior tests in the decision draft.

This developer has not run that private checker or game tests on this repository draft.
No checker, JSON expansion or new test framework is added by this docs change.
