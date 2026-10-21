# Showcase playtest pass 1: triage (loka-y6yg.34)

Analyst: triage (Opus), read-only, 2026-10-21, main at 642c9c7bf. I root-caused the rows by reading the code and content in four parallel research forks. I reproduced nothing. Rows that rest on code reading alone are marked "(inferred)".

Inputs:
- `sweep1-report.md` (S1 rows G/U). It was played at 1331 px, so its U rows count only where sweeper A or B confirmed them at 390 px. Its G rows are behaviour findings and stand.
- `sweepA-report.md` (A rows, B-UI rows).
- `sweepB-report.md` (B rows, U/B-U rows).

Classes: GAMEPLAY-CONTENT, GAMEPLAY-ENGINE, UI-BREAK, UI-DRIFT, TASTE, WAD (working as designed), DUP.

Excluded as already filed: room-line variants not drawn (loka-x6t.71), NPC page conditions (loka-x6t.70), the Word bar hiding spells in a fight (loka-x6t.69), bank-then-work-off (loka-y6yg.36), and the sign word "mana" vs the Book's "ma". The "mana" mismatch does not occur in the law district: `readable.sign_law` uses neither word.

Dropped at 390 px: S1-U7 (focus ring; it is `:focus-visible` only) and S1-U10 (chip reorder; chips follow the projected `spell_words` order).

## Counts (after merging by root cause)

| Class | n |
|---|---|
| GAMEPLAY-CONTENT | 19 |
| GAMEPLAY-ENGINE | 5 |
| UI-BREAK | 8 |
| UI-DRIFT | 7 |
| TASTE | 5 |
| WAD | 16 |
| DUP | 10 |
| **Total** | **70** (plus 2 dropped) |

## Cross-cutting roots (one row each; the district rows point here)

| id | Reports | Root cause (evidence) | Class | Fix | Size | Files |
|---|---|---|---|---|---|---|
| R1 | S1-G7, B-B7, S1 fence "(not now)" | The Book maps every `insufficient_resource` to "too exhausted" (`mobile/app/book/words.ts:67,71`; rendered at `model.ts:147`). So lux at ash 0, "Pay the fine (3 pennies)" at 2p (`kernel/ts/src/mechanics/dialogue/shared.ts:126`) and short shop rows all say "too exhausted". `UnavailableReason.message` exists (`kernel/ts/src/contracts.gen.ts:270`) but is never filled with the resource. The fence refusing honest goods is `invalid_state` and shows as "not now" (`words.ts:63`). The brief asks "is it clear why the fence will not buy the beeswax?", and the answer is no. | UI-BREAK | The kernel names the unpaid resource in the reason ("no ash", "3 pennies"). The fence refusal gets a message key `shop.not_stolen`. Stopgap: change the offer word to "not enough". | M (stopgap S) | `kernel/ts/src/view/view.ts`, `mechanics/resource.ts`, `commerce/shared.ts`, `words.ts`, `text.json` |
| R2 | A-A2, A-A8, A-A11, B-B3 (part) | The World and place buttons keep only available offers: `.filter((a) => a.available)` (`mobile/app/book/buttons.ts:197`). So a craft refused with `too_heavy` ("Chop wood") or `cooldown` ("Cast the rod") disappears with no reason given. `cooldown` also has no REASON word (`words.ts:60-69`). | UI-BREAK | Show unavailable World and place offers as `<ActionCard label reason/>` (BOOK-UI-COMPONENTS.md:13). Add REASON `cooldown: "not yet"`. | M | `buttons.ts`, `pages.tsx`/`sections.tsx`, `words.ts`, `docs/system/book-ui.md` |
| R3 | A-A2, B-B3, A-A7 | One kernel code, `too_heavy`, covers both "this item is too heavy" and "your load is full" (`kernel/ts/src/mechanics/containment/shared.ts:94,268,278`). The spec prescribes the single word for both (`book-ui.md:322-325`). Both sweepers held about 8 items, so the golem-yard items, the quern, the pelt and the rat were refused by the load cap. That is partly playtester load. | UI-DRIFT (spec) | A new kernel code `over_load`, worded "more than you can carry". | S spec + S kernel | `containment/shared.ts`, `words.ts`, `book-ui.md` |
| R4 | A-A1, B-B10 (crypt gate) | Door actions (Open the lever door, dial door, crypt gate) are drawn only on the Map (`buttons.ts:73-80`, `sections.tsx:143-174`; the World `place` group excludes directional offers, `model.ts:123-130`). The spec says so: "Map retains … legal door actions" (`book-ui.md:67`). | WAD, owner/spec question | Owner: should a door's Open also show on World? If yes, it needs a designer ruling, a book-ui.md:67 edit and `model.ts`. | M | `book-ui.md`, `model.ts`, `sections.tsx` |
| R5 | S1-G14, A-A12 | Speech is accepted with no narration (`kernel/ts/src/mechanics/speech/rule.ts:30`), and `OUTCOME` has no `spoken` entry. The `gil_hears` reaction only sets a fact. So typed Say and Shout "ware" are both silent. | UI-BREAK | The Book echoes `You say "…".` / `You shout "…".` from the press input. Optional: content adds a line when Gil hears. | S | `words.ts` or `presenter.ts`; optional `reactions/gil_hears.json` |
| R6 | B-B1, S1-G9, B-UI U4 | Death in a fight opened by a cast was silent: no round lines, no "You fall.", and a stray refusal on Flee. Probable cause (inferred): the background path reads only `game.lastNarration()` per state update (`mobile/app/book/presenter.ts:56-75`), so round and death receipts between frames can be lost. A's Attack-opened fight did show round lines. Spec: `book-ui.md:452-461`. Related, not duplicates: loka-x6t.26 (death outside combat, Book side) and loka-3w3q (engine: death outside a round narrates nothing). | UI-BREAK | First a repro test (cast flamma, let rounds tick to death). Then route every receipt since the last narration id. | M | `presenter.ts`, possibly the kernel narration API |

## Economy and law (Undercroft)

| id | Reports | Root cause | Class | Fix | Size | Files |
|---|---|---|---|---|---|---|
| E1 | S1-G1, S1-U1/B-U1 (wanted token) | The brief's cue is the guard's room line while wanted (`docs/showcase/economy-law-district.md`, playtest focus). That content exists (`npcs/guard.json:43-55` `room_wanted`, `npcs/watchman.json:40-52`) but variants are not drawn. "Wanted" is a fact, not a status, so no icon can exist (`docs/system/mechanics.md:3234,3248`). See also loka-kgd.174 (every pool and status is visible). | DUP loka-x6t.71 | x6t.71 brings back the guard and watchman lines. Owner question: should content also apply a `wanted` status, which would give it an icon? | S content | `statuses/`, `reactions/charge.json` |
| E2 | S1-G2 | The watchman turns hostile on `wanted` with `attack.chance 0` (`npcs/watchman.json:21-39`), so he cannot kill. The reporter's fear was unfounded. His warning is his room line (x6t.71). | WAD (brief NPC table) | Add a sign clause: "the watchman bars the stair to the wanted". | S | `text.json` (`readable.sign_law`) |
| E3 | S1-G3, B-B8 | The fence offers include `buy` (`npcs/fence.json:27-44`), as the brief specifies. `ShopOffer.buy` is required (`contracts.gen.ts:527`), so he cannot be a buy-only shop. The Book shows "sold out" for offers he holds none of (`words.ts:72-77`). The sign ("keeps a hand on what he buys") and `npc.fence.description` ("never lets go", `text.json:934`) contradict the content. | GAMEPLAY-CONTENT | Owner choice: reword the sign and description to "resells at a markup" (S), or make `buy` optional so he never resells (M engine). | S / M | `text.json`; or contracts, `commerce/shared.ts` |
| E4 | S1-G4 | The brief gives one purse each and no replenish for stolen-offer items (Custody). The sign promises "for trying it all again". The mark's text still says "purse in plain sight" after the lift (`text.json:971-972`). | GAMEPLAY-CONTENT | Sign: "a purse to try once". Add a mark variant after the lift (it shows once x6t.71 lands). Owner: a refill would need a custody exception. | S | `text.json`, `npcs/mark.json` |
| E5 | S1-G5 | The money is finite by design: the fence is never refilled and "work-off is not a source" (brief, Item loops). | WAD | Owner question: add a money source? | — | — |
| E6a | S1-G6 | The open label reuses the choice label (`dialogues/clerk_fine.json:36`), and the Book appends the NPC name (`buttons.ts:62`). The result is "Pay the fine (3 pennies) the clerk". | GAMEPLAY-CONTENT | Give the dialogue its own open label, e.g. "Settle the fine with". | S | `clerk_fine.json`, `text.json` |
| E6b | S1-G6, B-B9 | The prompt is added to the NPC detail log on every open, and that log survives across Talks (`logs.ts:78-81`, `received.ts:118-121`). | DUP loka-x6t.19 | — | — | — |
| E6c | S1-G6 | `trial.charge` and `dialogue.jailer.prompt` promise "or you sit" (`text.json:271,1312`), but the only free exit is `work_off` when broke (`dialogues/jailer_broke.json`). | GAMEPLAY-CONTENT | Owner choice: reword to "pay, or work it off if your purse is empty" (S), or add an hourly "served" reaction (M). | S/M | `text.json` / `reactions/` |
| E8 | S1-G10 | For Take the view keeps only `not_present` and `too_heavy` (`kernel/ts/src/view/invariants_view.ts:106`). A Take refused with `permission_denied` (`action_lists.ts:128-137`) is hidden, so the page shows the empty Note (`Menu.tsx:91`). The sign promised "the words say why". | GAMEPLAY-ENGINE | Project Take as unavailable with `permission_denied`, worded "not yours". | M | `invariants_view.ts`, `words.ts`, pins |
| E9 | S1-G11 | A move refused because of position is `invalid_state`, shown as "not now". | DUP loka-x6t.29 | — | — | — |
| E10a | S1-G12 | `services/forge_claim.json:7` charges 1p, as the brief specifies. The sign does not mention the penny. | GAMEPLAY-CONTENT | Sign: "…for a penny". | S | `text.json` |
| E10b | S1-G12 | `items/smith_knife.json` has no weapon block. The brief does not promise one. | TASTE | Optional: a weapon profile like the farm knife. | S | `items/smith_knife.json` |
| E10c | S1-G12 | The generic `service.no_output` text (`text.json:1250`). One knife per world is by design (brief 20b). | TASTE | Reword to "the smith makes one knife". | S | `text.json` |
| E11 | S1-G13 | A living NPC's items are listed under **Held** by spec (`book-ui.md:320`; `Menu.tsx:58`). The "Back to container" label is already filed. | WAD (+ DUP loka-x6t.68) | Designer taste. | — | — |
| E13 | B (charge) | `trial.charge` is fixed text naming the Undercroft (`text.json:1312`), but theft applies across the whole cartridge. | GAMEPLAY-CONTENT | "seen stealing" with no place. | S | `text.json` |
| E14 | B-B2 | Specified: Take on a living NPC's Held list is the steal (`book-ui.md:320`, brief row 33). The verb hides the risk. | UI-BREAK (spec-caused) | Owner/designer: label it "Lift" and add a risk note. Needs a book-ui.md change. | M | `book-ui.md`, `buttons.ts`, `item-pages.ts` |
| E15 | S1-U5, B-U5 | The spec does not say to show the balance, and "can't afford" carries no number (`words.ts:74`). | UI-DRIFT (spec silent) | Designer: a balance Note on shop, bank and service pages. | S | `Npc.tsx`, `book-ui.md` |

## Magic (Loft) and combat

| id | Reports | Root cause | Class | Fix | Size | Files |
|---|---|---|---|---|---|---|
| M1 | B-B7 | `recipes/flamma.json` has an `npc_present wight` policy with no `reason`, although `ward.json` uses one (loka-j64e). So the refusal reads "not now". | GAMEPLAY-CONTENT | `"reason": "reason.flamma"`, worded "Only where the dead stand". | S | `recipes/flamma.json`, `text.json` |
| M2a | S1-G8, B (partly) | The sign says lux "lights the lantern on the sill", but `light.ignite` acts only within reach (held), as the brief's 29b says. | GAMEPLAY-CONTENT | Sign: "lights the lantern in your hand". | S | `text.json` (`readable.sign_magic`) |
| M2b | S1-G8 | The spell keeps the ignite ops but drops their lines (`kernel/ts/src/mechanics/action_recipe/spell.ts:65-70`). The brief says "no ignite line", so this needs an owner yes. | GAMEPLAY-ENGINE | Append the `lit` narration. | S | `spell.ts`, `kernel/ts/test/showcase_magic.test.ts` |
| M3 | S1-G9, B-B6 | Spell damage runs `deathSequence` but writes no hit or kill line. The Book infers "A wight leaves." from the view diff (`words.ts:126-137` `comings`). | GAMEPLAY-ENGINE | Push `combat.npc_died` on a kill. `comings` skips an NPC that leaves a corpse. Add a burn clause to `narration.flamma`. | S | `spell.ts`, `words.ts`, `text.json` |
| M5 | B-B3 | The trial is a Drop (`reactions/drench.json` etc., `on item_dropped`), per `docs/showcase/magic-district.md` step 9. Nothing hints at Drop, and the "too heavy" refusals are R3 (load). | WAD; the sign misleads | Sign: "set rain down by it, then a spark…". Owner: or author a "Douse the golem" use-pair. | S | `text.json` |
| M6 | B-B4 | The errand resolves on the read (WAD, brief step 3). `errand_reward.json` sets `ward_taught` with no line. `quest.errand.done` says she "owes you the third word". `reason.ward` is static text, so it says "Needs a second level" even at level 2. | GAMEPLAY-CONTENT | Rewrite `quest.errand.done` ("…she has given you the third: ward") and `reason.ward` ("Needs level 2 and CHA 7"). Add a handover narrate. | S | `text.json`, `reactions/errand_reward.json` |
| M7 | B-B5 | `statusStep` narrates `observed` only for NPC holders (`kernel/ts/src/mechanics/status/shared.ts:295-298`), so the bier's `burning` is never shown (brief toolbox finding 4, unfiled). The Quench refusal came after the 180 s burn had ended (inferred). | GAMEPLAY-ENGINE | Narrate observed and expired lines for visible items. Add lines to `statuses/burning.json`. Item conditions on the item page are an item twin of x6t.70. | M | `status/shared.ts`, `burning.json`, `text.json`, Book item page |
| M8a | B-B10 | `recipes/oil_winch.json` policy is `has_tag target metal`, and the lantern is tagged `metal`. So "Oil the lantern" sets `gate_oiled`, which is a real bug. | GAMEPLAY-CONTENT | A `winch` tag on `gate_winch`, and narrow the policy to it. | S | `oil_winch.json`, `items/gate_winch.json` |
| M8c | B-B10 | `items/lamp_oil.json` (the dry flask) has no fill source and is not in the brief. It is orphan content. | GAMEPLAY-CONTENT | Delete it, or fill it with 1 oil. | S | `items/lamp_oil.json`, `npcs/hedge_wizard.json` |
| M8d | S1-G15, B-B10, B-U3 | Every liquid must have a positive `drink_amount` (`docs/system/mechanics.md:1167`; `liquids/oil.json`), so "Drink the oilcan" is offered. | GAMEPLAY-ENGINE | Owner: add `potable: false` to the liquid schema. | M | liquid schema, `liquids/oil.json` |
| M9 | B-B11 | `readable@1` reads held items only (`kernel/ts/src/mechanics/readable/rule.ts:28-31`). One read gives flamma and level 2, per brief steps 3-4. | WAD | Optional room line: "lies open; take it to read". | S | `text.json` |
| M10a | B-B9 | The dialogue history is never reset. | DUP loka-x6t.19 | — | — | — |
| M10b | B-B9 | "Journal updated" inside a dialogue is specified (`book-ui.md:257`). | WAD | — | — | — |
| M10c | B-B9 | `dialogues/wizard_errand.json` is still offered while the errand is active, so `accept` refuses with "not now". | GAMEPLAY-CONTENT | Add a `quest_state errand not active` policy and a short `wizard_waiting` line. | S | `dialogues/`, `text.json` |
| C2a | A-A13 | Only `npcs/warden.json` and `watchman.json` author `engage`. Spec: engage comes first (`book-ui.md:452`). | GAMEPLAY-CONTENT | Add `engage` lines for the raider, the wight and the attic wight. | S | `npcs/*.json`, `text.json` |
| C2b | S1-U4, A-B9 | The HP band is on the status line only, by spec (`book-ui.md:81`). Related: loka-x6t.15. | WAD | Designer: an opponent condition word in the first block. | — | — |
| C2c | B-U4 | The status line stays locked on the ended Combat page (`book-ui.md:461`). | WAD | — | — | — |
| C3a | A-A17 | "Wear a training sword". | DUP loka-x6t.20 | — | — | — |
| C3b | A-A17 | `death.restore` lists only hp and mv (`cartridge.json:200-203`). | WAD | Owner: also restore hunger and thirst? | S | `cartridge.json` |

## Traps and hub regression

| id | Reports | Root cause | Class | Fix | Size | Files |
|---|---|---|---|---|---|---|
| T1 | A-A1 | All three pulls use one `narration.lever` line (`text.json:791`). The step and reset reactions narrate nothing. No aside appears when `lever_stage` is 3. Door Open on Map only is R4. | GAMEPLAY-CONTENT | Add `narrate` to the step and reset reactions. Add a lever_hall aside "the north door's bolts stand drawn" when solved, and one for the dial when all three wheels are right. | S | `reactions/lever_*.json`, `rooms/lever_hall.json`, `text.json` |
| T2 | A-A3 | `afraid` is read only on a pack member's combat turn (`mechanics.md:2491`). The sign says "the goblins run". The two-on-one-row part is UO. | GAMEPLAY-CONTENT (sign) | Sign: "…break and run once you strike". | S | `text.json` |
| T3 | A-A4 | The wheel variants exist ("It shows 3", `text.json:213-222`), but the Book strips fixture links (`pages.tsx:143`, `model.ts:139`). No projection exists for room-detail descriptions (`book-ui.md:33-37`). The pool details (W1) are unreachable for the same reason. | GAMEPLAY-CONTENT (stopgap); engine/spec long term | Add 30 lever_hall asides on `fact_compare wheel_n equals k`, worded "The first wheel shows k". Owner: should room details be projected? | M (L engine) | `rooms/lever_hall.json`, `text.json` |
| T4 | A-A5 | A status refresh is silent by spec (`mechanics.md:667,1956`). The plate reactions only `status.apply` and never `narrate`. | GAMEPLAY-CONTENT | Add `narrate` "A needle in the plate bites." to plate_springs, cellar_springs, plate_bites and cellar_bites. | S | `reactions/{plate,cellar}_*.json`, `text.json` |
| T5 | A-A18 | `sapper_note` and the slate have a `readable` with no `title`, so the Book names them from the label "Read". "1 doses" is DUP loka-x6t.29. | GAMEPLAY-CONTENT | Add the titles "The sapper's note" and "The slate", and the labels "Read the note" and "Read the slate". | S | `rooms/plate_passage.json`, `rooms/lever_vault.json`, `text.json` |
| F1 | A-A6 | `needs_enter` fires on every entry to fell_top with no `when` (`reactions/needs_enter.json`). The brief asks for this (`hub-and-first-districts.md:137`). | WAD | Owner: change the sign to "every climb", or add a once-per-day guard. | S | `text.json` or the reaction |
| F2 | A-A7 | The trial is Take against the carry cap: 7000 g against 5000, or 8000 under might (hub doc:162-163). The tester was over 8000 g with his load (R3). | WAD + playtester load | Sign: "try to lift the quern". | S | `text.json` |
| H3 | A-A15, A-B11 | A learned skill still shows its requirement and teach line (`skills.tsx:31,53`, `Npc.tsx:170`). The spec's acquired format keeps `<requirement>` (`book-ui.md:1086`). The teach refusal's "not now" is DUP loka-x6t.17. The wording is related to loka-x6t.24. | UI-DRIFT (spec change) | A learned skill shows "learned" with no requirement. | S | `skills.tsx`, `Npc.tsx`, `book-ui.md` |
| W1 | A-A9 | The tide shows only through the shore's high-tide variant, so a low-tide "Opened." is correct (hub doc:210-214). Latent flaw: the `visited_count ≥ 3` variant comes before the tide one. | WAD (+ S content fix) | Put `sky {tide: high}` before `visited_count`. | S | `rooms/shore_steps.json` |
| W2 | A-A10 | The sign says "every door open", but `moon_door` is a shared barrier (hub doc:187-190, 203). | GAMEPLAY-CONTENT | Sign: "…the cave open from this side; the moon door still keeps the moon". | S | `text.json` |
| W3 | A-A14 | No rope line is specified (hub doc step 4). Going down without the rope costs 3 hp (step 3). The look-about lines are random alternates. | WAD + playtester misread | Optional: "You go down the rope hand over hand." | S | `rooms/cliff_top.json`, `text.json` |
| L1 | A-A16 | `nell_talk` and `nell_rumour`/`nell_ash` each give a Talk card. The buy-row sell clause is shop wording. | DUP loka-x6t.18, loka-x6t.13 | — | — | — |

## Book UI (390 px confirmed)

| id | Reports | Root cause | Class | Designer / spec | Fix | Size | Files |
|---|---|---|---|---|---|---|---|
| UA | S1-U2, A-B1, B-U2 | The spec puts the Word block before the log (`book-ui.md:1065-1066`; `pages.tsx:134-135`). In Market Row the Word block is about 7 rows, so the result line falls two screens down. The footer overlap is not in the code (`Book.tsx:175`, `pages.tsx:221`; probably the web viewport height, needs a repro). | UI-BREAK (spec-caused) | Designer ruling; edit book-ui.md Word bar and BOOK-UI-COMPONENTS.md:131 | Log above the Word block, or fold the Word rows behind one Control. | M | `pages.tsx`, `WordBar.tsx`, both docs |
| UB | S1-U1, A-B2, B-U1 | Placeholder glyphs (`glyphs.ts:4-8`). The wanted part is E1. | DUP loka-x6t.63 | Designer (x6t.63) | Raise x6t.63's priority. | L | — |
| UC | S1-U3, A-B13, B-U3 | The cycle is the owner's C1 ruling (`book-ui.md:102-104`). Only the missing line is a defect. | DUP loka-x6t.22 | — | — | S | — |
| UF | S1-U6, A-B3, B-B12 | (1) The Map draws the whole World log (`sections.tsx:198`). (2) An exit card and its door state line both draw (`sections.tsx:150-161`). (3) Where lists every `known_npcs` entry, dead ones and same-name repeats included (`sections.tsx:224-236`, `buttons.ts:97-102`). | UI-DRIFT (1, 2); UI-BREAK in part (3, dead listed) | Designer on (1) and (2); a book-ui.md Where clause ("living only") | Drop the log from the Map. Skip the door line when the exit's reason is the door. The kernel leaves dead NPCs out of `known_npcs`. | M | `sections.tsx`, kernel view, `book-ui.md` |
| UH | S1-U8, A-B6, B-U8 | (1) There is no `action.talk` in showcase `text.json`, so the bare default "Talk" gets the name appended (`buttons.ts:62`); ashmere authors "Talk to". (2) `action.fish` is "Cast the rod" plus the target name. (3) The Note and a refused card draw together (`Menu.tsx:90-91`; spec `book-ui.md:321-324`). | UI-BREAK | No | Add `"action.talk": "Talk to"` and `"action.fish": "Fish in"`. Hide the Note when a refused card shows. | S | `cartridges/toolbox_showcase/text.json`, `Menu.tsx` |
| UI | S1-U9, A-B11, B-U9 | Every pool is drawn `cur / max` (`sections.tsx:63`). The spec says counts "show plain" (`book-ui.md:82`). | UI-DRIFT | Designer: which pools are counts | Pennies and ash as bare numbers. | S | `sections.tsx`, `resources.json`? |
| UK | A-B4 | The mv bands are `100 normal, 25 warning` (`resources.json`). The kernel picks the first band with `pct ≥ at` (`kernel/ts/src/view/resources.ts:41-43`), so mv 99 shows the warning colour. Hunger and thirst have the same flaw. | UI-BREAK (content) | No | Move "normal" to about 50%. | S | `cartridges/toolbox_showcase/resources.json` |
| UL | A-B5 | `WordBar.tsx:33-41` draws one row per id. The spec says same-name people "share that title" (`book-ui.md:1069`), which is ambiguous. | TASTE | Designer | One merged row, or a distinguishing title. | S | `WordBar.tsx` |
| UM | A-B7, B-U2 | An authored "Leave" choice. | DUP loka-x6t.21 | — | — | S | — |
| UN | A-B8 | "Whole minutes" is specified (`book-ui.md:1024`), so "1440m". | TASTE (spec change) | book-ui.md edit | Hours at 2 h or more. | S | `StatusIcon.tsx`, `book-ui.md` |
| UO | A-B10, A-A3 | `words.ts:120` joins all records into one line. That breaks "one Text per line" (`BOOK-UI-COMPONENTS.md:140`). "Opened." is the OUTCOME fallback (`words.ts:47`). | UI-DRIFT | No | One log line per narration record. | S | `words.ts`, `presenter.ts` |
| UP | B-U1 | The earthly branch hour glyph is specified (`BOOK-UI-COMPONENTS.md:145`; `model.ts:179-181`). | TASTE | Designer, with loka-x6t.14 | A line that names the hour. | S | — |
| UQ | B-U2 | The running head above the title is specified (`BOOK-UI-COMPONENTS.md:129`). | WAD | — | — | — | — |
| UR | B-U3 | The order follows `buttonsOf` (`buttons.ts:84-110`), and the spec has no ordering rule. The kernel offers `put` into a corpse. "Drink oil" is M8d. Close to loka-x6t.54. | UI-DRIFT | Designer ordering rule; book-ui.md Detail-page order | No put into corpses. Order: the room's purposeful verb first. | S-M | kernel containment offers, `buttons.ts`, `book-ui.md` |
| US | B-U4 | "A corpse … keeps Inside" is specified (`book-ui.md:320`). | WAD | — | — | — | — |
| UT | B-U5 | A known gap. | DUP loka-x6t.13 | — | — | — | — |

## Proposed slices

Gameplay content. These touch the cartridge only, and each fits about 2 plan steps or 3 rooms.

| Slice | Rows | Size | Files |
|---|---|---|---|
| GC1a Trap door puzzles | T1, T3 | M | `rooms/lever_hall.json`, `rooms/lever_vault.json`, `reactions/lever_*`, `text.json` |
| GC1b Trap plates and labels | T4, T5, T2 (sign) | S | `rooms/plate_passage.json`, `reactions/{plate,cellar}_*`, `text.json` |
| GC2a Loft words | M1, M2a, M6, M10c | S | `recipes/flamma.json`, `dialogues/wizard_*`, `reactions/errand_reward.json`, `text.json` |
| GC2b Loft oil and golem | M8a, M8c, M5 (sign), M9 (optional) | S | `recipes/oil_winch.json`, `items/gate_winch.json`, `items/lamp_oil.json`, `text.json` |
| GC3 Law signs and lines (BLOCKED on Q1-Q3 for E3, E4 and E6c; E2, E6a, E10a, E10c and E13 can go now) | E2, E3 (reword), E4, E6a, E6c (reword), E10a, E10c, E13 | S | `text.json`, `dialogues/clerk_fine.json`, `npcs/mark.json` |
| GC4 Hub and combat content | C2a, W1, W2, F2, UK, UH (1, 2), optional W3 and C3b | S | `npcs/{raider,wight,attic_wight}.json`, `rooms/shore_steps.json`, `resources.json`, `text.json` |

Gameplay engine. These are kept apart from the content slices.

| Slice | Rows | Size | Files |
|---|---|---|---|
| GE1a Spell kill line | M3 | S | `kernel/ts/src/mechanics/action_recipe/spell.ts`, `mobile/app/book/words.ts`, `showcase_magic.test.ts` |
| GE1b Spell ignite line (BLOCKED on Q11) | M2b | S | `spell.ts`, `showcase_magic.test.ts` |
| GE2 Item status lines | M7 | M | `kernel/ts/src/mechanics/status/shared.ts`, `statuses/burning.json`, Book item page |
| GE3 Named refusals (`over_load` part BLOCKED on Q7) | R1, E8, R3 (`over_load` code) | M | `kernel/ts/src/view/{view,invariants_view}.ts`, `commerce/shared.ts`, `containment/shared.ts`, `words.ts`; pairs with loka-x6t.17 |
| GE4 Death receipts | R6 (repro first) | M | `mobile/app/book/presenter.ts`, kernel narration API; with loka-3w3q and loka-x6t.26 |
| GE5 Undrinkable liquids (BLOCKED on Q12) | M8d | M | liquid schema, `liquids/oil.json` |
| GE6 View offers | UF (3): leave dead NPCs out of `known_npcs`; UR: no `put` into corpses | S-M | kernel view (`known_npcs`), kernel containment offers, pins |

Book UI, grouped by component. "Designer" means a Fable ruling is needed first. "Spec" means a docs/system/book-ui.md change.

| Slice | Rows | Designer | Spec | Size | Files |
|---|---|---|---|---|---|
| UI1 World page order and log | UA, UO, R5 (speech echo) | yes (UA) | yes (Word bar order) | M | `pages.tsx`, `WordBar.tsx`, `words.ts`, `presenter.ts`, BOOK-UI-COMPONENTS.md |
| UI2 Refused offers on World (wording part BLOCKED on Q7) | R2 (+ cooldown word) | yes | yes (unavailable place offers; `book-ui.md:322` wording with R3) | M | `buttons.ts`, `pages.tsx`, `words.ts` |
| UI3 Map page (R4 part BLOCKED on Q6) | UF (1, 2), R4 | yes | yes (Where living-only; `book-ui.md:67` if R4) | M | `sections.tsx`, `model.ts` (kernel part in GE6) |
| UI4 Detail pages (E14 BLOCKED on Q5) | UH (3), E14 (Lift), UR (order rule), E15 (balance), x6t.68 | yes (E14, UR, E15) | yes | M | `Menu.tsx`, `buttons.ts`, `item-pages.ts`, `Npc.tsx` (kernel part in GE6) |
| UI5 Status and Character | UI, H3, UN, UP; UB stays loka-x6t.63 | yes | yes (counts, acquired skill, durations) | S-M | `sections.tsx`, `skills.tsx`, `StatusIcon.tsx` |
| UI6 Combat page | C2b (HP or condition word); after GE4 | yes | maybe | S | `Combat.tsx`; with loka-x6t.15 |

UH (1, 2) and UK go in GC4 because they are cartridge-only.

## Owner and spec questions

1. Fence: reword the text to say he resells (S), or make him a true buy-only shop (engine M)? (E3)
2. Yard purse: refill it (needs a custody exception) or change the sign to "try once"? (E4)
3. Jail: make "or sit" real time served, or change the text to "work it off"? (E6c)
4. "Wanted": is the guard's line after x6t.71 enough, or should content add a status token? (E1)
5. Take on a living NPC's Held list: label it "Lift" with a risk note? (E14)
6. Door Open on the World page, overriding `book-ui.md:67`? (R4: lever, dial, crypt gate)
7. Show unavailable World offers with a reason, and a separate "more than you can carry" code? (R2, R3)
8. Project room-detail descriptions so fixture links open, or use content asides as the stopgap? (T3)
9. Hunger: every climb (as the brief says) or once a day? Should death restore hunger and thirst? (F1, C3b)
10. Golem: keep Drop and fix the sign, or author "Douse"? (M5)
11. Spell ignite and kill lines, against the brief's "no ignite line" (magic-district.md step 2)? (M2b, M3)
12. Should liquids get `potable: false`? (M8d)
13. Should the Combat page show hp or a condition word? (C2b)
14. Money: add a source, or keep the strongroom as a single-attempt lockout? (E5)

Not checked: none of these rows were reproduced live. R6 (the death path), E6b (the jailer printing twice) and the UA footer overlap are inferred from the code. The research cost was about 500k tokens across four forks plus the analyst.
