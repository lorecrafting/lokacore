# Pass 1 analysis: cause families and checks

This file tags each row of the [triage](triage.md) with two values:

- **Family**: the class of authoring mistake behind the row.
- **Caught by**: the cheapest rail that would have caught the row before a playtest.
  - `check`: a deterministic check from the table below (a loader lint, a kernel test or a sim test).
  - `walk`: a scripted Book walk that asserts the page.
  - `playtest`: only a reader judges it (taste, a spec choice or a WAD ruling).

The triage has 70 rows, after merges by root cause. Two dropped findings are not tagged.
"Caught by" names a rail that does not exist yet unless a check below says "exists".

## Families

| Family | Meaning | Rows | check | walk | playtest |
|---|---|---|---|---|---|
| PROMISE | Text promise not kept: a sign, description or journal says what the content does not do | 13 | 0 | 11 | 2 |
| NONE | No authoring fault: a spec choice, a WAD ruling or taste | 9 | 0 | 0 | 9 |
| SILENT | Silent state change: an action or reaction changes state and writes no line | 9 | 8 | 1 | 0 |
| VERB | Verb or label composition: one word with two meanings, or a label that reads wrong | 9 | 3 | 0 | 6 |
| BOOK | Book presentation: layout, units or glyphs | 7 | 0 | 0 | 7 |
| PAGE | Off the page: the offer or the result is not on the page the player looks at | 7 | 0 | 5 | 2 |
| REFUSAL | Refusal hidden or misnamed: the offer vanishes or the reason word is wrong | 6 | 3 | 3 | 0 |
| WIRING | Data wiring: an over-broad match, an orphan item, a band or a variant order | 5 | 4 | 0 | 1 |
| HIDDEN | Hidden state: the rule depends on a value the page never shows | 5 | 0 | 2 | 3 |
| **Total** | | 70 | 18 | 22 | 30 |

PROMISE (13 rows) is the largest, and a check cannot decide whether prose is true: only a walk that tests each promise can.
SILENT (9 rows) is nearly all decidable by a check: a state write with no narration is visible in the data.
M2b (the silent ignite) is ruled: spell effects and kills write a line (owner question Q11).

## Candidate deterministic checks

"Runs where" names the existing rail to extend:

- loader: cartridge validation in `kernel/ts/src/content/`.
- kernel: the showcase tests in `kernel/ts/test/`.
- sim: `npm run test:sim:showcase`.
- walk: `mobile/app/walkthrough/toolbox_showcase.walk.ts` in `book-e2e.yml`.

| # | Check | Inspects | Runs where | Cost | Rows it would have caught |
|---|---|---|---|---|---|
| 1 | A policy that refuses the player names a `reason` | Policy definitions with a player refusal | loader | S | M1 |
| 2 | Every kernel refusal code has a Book reason word | Kernel unavailable codes against the reason words in `mobile/app/book/words.ts` (`cooldown` has none) | Book test (`mobile/app/book/`) | S | R1, R2 |
| 3 | A reaction that writes state has a `narrate` line or says it is silent | Reactions with `status.apply` or `fact.set` ops | loader | S | T1, T4 |
| 3b | A hostile NPC has an `engage` line | NPC definitions with hostile behaviour | loader | S | C2a |
| 4 | An action that commits a change yields a narration record | Every offered action in the sim; the delta against the records | sim | M | M2b, M3, M7, R5, W3 |
| 5 | A readable has a title; an action verb has an `action.*` label key | Item and verb definitions against Book label keys | loader | S | T5, UH, E6a |
| 6 | The top (normal) band starts below the maximum; no description variant shadows a later one | Band tables and description variant guards | loader | S | UK, W1 |
| 7 | Every item has a source and a sink; a policy tag match table is pinned | Item references, fill sources, tag queries | loader + kernel snapshot | S-M | M8a, M8c |
| 8 | Every offer reachable in a room is on the room page, a refusal shows its reason, and a state variant or readout the content defines is drawn | The walk's room pages against the kernel offer list and view | walk | M | E1, T3, R4, R6, E6b, E8, E9, M10a, M10c, UA, UO |
| 9 | Sign promises are data, and the walk reaches each promised outcome | Each sign's declared promises, then the walk | walk | M-L | E3, E4, E6c, E10a, M2a, M5, M6, T2, W2, F1, F2 |

Checks 1, 3, 3b, 5 and 6 are cheap loader lints that cover 9 rows.
Check 9 is the only rail for most PROMISE rows; the rest stay with the playtest.

## Rows

| Row | Triage class | Family | Caught by | Finding |
|---|---|---|---|---|
| R1 | UI-BREAK | REFUSAL | check | Every resource refusal reads "too exhausted"; the fence's honest-goods refusal reads "not now". |
| R2 | UI-BREAK | REFUSAL | check | A refused World offer vanishes; `cooldown` has no reason word. |
| R3 | UI-DRIFT | VERB | playtest | One `too_heavy` code means both "this item" and "your load". |
| R4 | WAD | PAGE | walk | Door Open is drawn only on the Map. |
| R5 | UI-BREAK | SILENT | check | Say and Shout are accepted with no line. |
| R6 | UI-BREAK | SILENT | walk | Death in a cast-opened fight shows no rounds and no fall. |
| E1 | DUP | HIDDEN | walk | "Wanted" is a fact with no token; the guard's line is not drawn. |
| E2 | WAD | PROMISE | playtest | The sign does not warn that the watchman bars the stair. |
| E3 | GAMEPLAY-CONTENT | PROMISE | walk | The fence "never lets go" but resells. |
| E4 | GAMEPLAY-CONTENT | PROMISE | walk | "For trying it all again" but the purse never refills. |
| E5 | WAD | NONE | playtest | Money is finite by design. |
| E6a | GAMEPLAY-CONTENT | VERB | check | The open label reuses the choice label: "Pay the fine (3 pennies) the clerk". |
| E6b | DUP | PAGE | walk | The jailer's prompt repeats on every open. |
| E6c | GAMEPLAY-CONTENT | PROMISE | walk | "Or you sit" has no time-served path. |
| E8 | GAMEPLAY-ENGINE | REFUSAL | walk | A Take refused for permission is hidden; the sign promised "the words say why". |
| E9 | DUP | REFUSAL | walk | A move refused for position reads "not now". |
| E10a | GAMEPLAY-CONTENT | PROMISE | walk | The sign omits the penny the forge charges. |
| E10b | TASTE | NONE | playtest | The smith's knife has no weapon block. |
| E10c | TASTE | NONE | playtest | Generic "no output" text. |
| E11 | WAD | BOOK | playtest | An NPC's stock sits under "Held". |
| E13 | GAMEPLAY-CONTENT | PROMISE | playtest | The charge text names the Undercroft for theft anywhere. |
| E14 | UI-BREAK | VERB | playtest | Take on a living NPC is a theft with a Take label. |
| E15 | UI-DRIFT | HIDDEN | playtest | No balance on shop pages; "can't afford" has no number. |
| M1 | GAMEPLAY-CONTENT | REFUSAL | check | The flamma policy has no `reason`, so "not now". |
| M2a | GAMEPLAY-CONTENT | PROMISE | walk | The sign says lux lights the lantern on the sill; it lights only a held one. |
| M2b | GAMEPLAY-ENGINE | SILENT | check | The spell ignites with no line. |
| M3 | GAMEPLAY-ENGINE | SILENT | check | A spell kill writes no hit or kill line; the Book says "A wight leaves." |
| M5 | WAD | PROMISE | walk | The golem sign does not hint that the trial is a Drop. |
| M6 | GAMEPLAY-CONTENT | PROMISE | walk | The journal says she "owes" the word she already gave; the reason text is static. |
| M7 | GAMEPLAY-ENGINE | SILENT | check | An item's burning status is never narrated. |
| M8a | GAMEPLAY-CONTENT | WIRING | check | The oil policy matches any `metal` item, so oiling the lantern opens the gate. |
| M8c | GAMEPLAY-CONTENT | WIRING | check | The dry flask has no fill source (orphan content). |
| M8d | GAMEPLAY-ENGINE | WIRING | playtest | Every liquid is drinkable, so "Drink the oilcan". |
| M9 | WAD | PAGE | playtest | The grimoire can be read only once held. |
| M10a | DUP | PAGE | walk | Dialogue history is never reset. |
| M10b | WAD | NONE | playtest | "Journal updated" inside a dialogue is specified. |
| M10c | GAMEPLAY-CONTENT | REFUSAL | walk | The errand dialogue is offered while active and refuses "not now". |
| C2a | GAMEPLAY-CONTENT | SILENT | check | Three hostile NPCs have no `engage` line. |
| C2b | WAD | HIDDEN | playtest | The opponent's HP band is on the status line only. |
| C2c | WAD | NONE | playtest | The status line stays locked on an ended Combat page. |
| C3a | DUP | VERB | playtest | "Wear" for a wield slot. |
| C3b | WAD | NONE | playtest | Death does not restore hunger and thirst. |
| T1 | GAMEPLAY-CONTENT | SILENT | check | Every lever pull logs the same line; step, reset and solve say nothing. |
| T2 | GAMEPLAY-CONTENT | PROMISE | walk | "The goblins run"; out of combat they only cower. |
| T3 | GAMEPLAY-CONTENT | HIDDEN | walk | The dial digits have no readout. |
| T4 | GAMEPLAY-CONTENT | SILENT | check | Plate re-poisoning applies a status with no line. |
| T5 | GAMEPLAY-CONTENT | VERB | check | A readable with no title is named "Read". |
| F1 | WAD | PROMISE | walk | Hunger re-applies on every climb; the sign says "the climb". |
| F2 | WAD | PROMISE | walk | "Try the quern" with no verb; the trial is Take against the carry cap. |
| H3 | UI-DRIFT | BOOK | playtest | A learned skill still shows its requirement. |
| W1 | WAD | WIRING | check | A `visited_count` variant shadows the tide variant. |
| W2 | GAMEPLAY-CONTENT | PROMISE | walk | "Every door open" while the moon door is shut. |
| W3 | WAD | SILENT | check | The rope drop prints no line. |
| L1 | DUP | VERB | playtest | Two Talk cards; a sell clause on a buy row. |
| UA | UI-BREAK | PAGE | walk | The result line falls below a seven-row Word block. |
| UB | DUP | HIDDEN | playtest | Placeholder status glyphs. |
| UC | DUP | BOOK | playtest | The blind position cycle. |
| UF | UI-DRIFT | PAGE | playtest | The Map repeats the World log, doubles exits and lists the dead. |
| UH | UI-BREAK | VERB | check | No `action.talk` or `action.fish` key: "Talk the jailer", "Cast the rod the pond". |
| UI | UI-DRIFT | BOOK | playtest | Counts drawn as meters ("pennies 10 / 100"). |
| UK | UI-BREAK | WIRING | check | The "normal" band starts at 100%, so mv 99 is a warning. |
| UL | TASTE | BOOK | playtest | Same-name people get one Whisper row each. |
| UM | DUP | BOOK | playtest | An authored "Leave" choice. |
| UN | TASTE | BOOK | playtest | Durations in whole minutes ("1440m"). |
| UO | UI-DRIFT | PAGE | walk | All records join into one line; the "Opened." fallback. |
| UP | TASTE | NONE | playtest | The earthly-branch hour glyph. |
| UQ | WAD | NONE | playtest | The running head above the title. |
| UR | UI-DRIFT | VERB | playtest | "Put the lantern in your corpse"; no detail-page order rule. |
| US | WAD | NONE | playtest | A corpse keeps Inside. |
| UT | DUP | VERB | playtest | Shop wording gap. |
