# Later mechanics: provisional chapter queues

**Lookahead only; no authorization to start ahead of the Missing Child queue.**
The PM selected separate C2, C3 and CC candidates under the existing
[mechanics delegation](decisions/owner-decision-autonomous-mechanics-2026-10-03.md),
informed by read-only Astra planning at merged main `6d53e8a`. The active
[M1–M23 queue](NEXT-MECHANICS.md) keeps its identifiers and priority;
[ROADMAP](ROADMAP.md) owns delivery status. This page proposes future boundaries,
not installed behavior, frozen contracts or release dates. Five future story policies are
[PM-selected, with implementation/review pending](decisions/pm-decision-later-story-reconciliation-2026-10-04.md);
other content unknowns remain open.

There are **29 mechanic candidates, 10 content-reuse batches and five continuity/product
boundaries** below. These are not 44 promised PRs: large candidates must split before
implementation, and reuse may make an extension content-only. **E** is an extension
of an existing or planned subset; **N** introduces a semantic invariant, without implying
a new package; **C** is content composition; **P** is product/platform work.
Small/medium/large are relative lift. Reuse dependencies are targets to verify at
briefing, not a claim that every M group or registered capability is installed.

Sources: **A** = [first-cartridge design](archive/spec/00-first-cartridge-design.md)
§§3–5,11; **Q** = [quests/dialogue/scenes](archive/spec/06-quests-dialogue-actions-scripting.md)
§§3,6,10,33–39,42–43; **P21** = [primitive catalog](archive/spec/21-composable-world-primitives.md)
§§8–18,21,24–28; **K** = [campaign continuity](archive/spec/07-offline-storypacks-to-mmo.md#15-campaigns-sequels-and-single-player-expansions).
They supply historical consumers, not current gameplay policy. Names/prose are historical
placeholders. A §5 lists Q1–Q5 plus S1–S28 (33 actual rows), while its summary says
28; [A §7](archive/spec/00-first-cartridge-design.md#7-scope) leaves that total open.
Use the ten chapter-two and thirteen chapter-three rows below, without resolving that mismatch.

Every acceptance/red control is a **future proof design**, not an executed test. Fixture
numbers and sample words are controlled examples, not campaign tuning or Legend formulas.
Before implementation, PM selects the actual beat and resolves its remaining OPEN decisions, amends
[active specs](system/README.md), pins literal answers and bounded files, and follows
[WORKFLOW](WORKFLOW.md). Apply a proposed mutation to existing focused tests first;
add a distinct regression only if the break survives. Normal required checks and fresh
independent review still apply. No tests, simulator runs or implementation review are claimed here.

## Quest → needed mechanics

### Chapter two — The Barrow King

| Actual quest | Concrete storyline demand | Candidate/reuse map | Selected future policy / remaining unknowns |
|---|---|---|---|
| **Q4 The Barrow King** | Aldric/Sedge offer; lock/hidden entry; traps/silver wights; aura/summon/chamber withdrawal; crown drop, turn-in and high-pass ending. | C2-M01–04/10; crown C2-M05/07; optional C2-M09/11; M9/M10/M16/M17/M20/M21/M22; C2-C05, CC-M01. | Selected future chamber fight and post-defeat vault ([decision §1](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#1-king-in-the-chamber-vault-after-defeat)); loot-key reachability and encodings remain implementation work. |
| **S7 Sedge's Bargain** | Choose Sedge or Aldric as fox-charm recipient; exclusive faction result. | C2-C01; M13/M15/M20 and custody. | Charm source/recovery for players skipping chapter1; whether already-spent charm imports must be represented. No barter necessary. |
| **S8 The Unburied Ledger** | Discover hidden room; readable clue; item-order shrine puzzle; first fen ring. | C2-M01/05; C2-C02; M12/M20. | Selected sole first-ring award ([decision §2](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#2-first-ring-from-s8-matching-ring-in-chapter-three)); shrine/items/order remain null. This ledger is not automatically S2/S18's item. |
| **S12 Dagny's Price** | Maud offers hireling; pay/hire, orders, loyalty, ongoing wages. | C2-M14A/B; M14/M16/M18/M20. | Price/period, departure behavior, wages during absence, death/dismissal and what “turn_in” means are null. |
| **S13 The Miller's Ghost** | At mill at night, gather three clues; weapon at well bottom; accusation/trial-style choice writes `mill.killer`. | C2-M02; C2-C03; M9/M10/M12/M13/M20/M21. | Killer identity, two clues, accusation consequences and NPC permanence are null. “Ghost” supplies no player ghost-walk requirement. |
| **S20 The Pup** | Discover at hound_run; adopt/feed/train/grow; companion fights and can die. | C2-M15, C2-M14A orders, M1/M11/M14/M16/M5/M6. | Training progression and feeding penalties are null; archive five-day age is proposed content tuning. |
| **S21 Wight Night** | Full moon wights emerge from pit and attack north gate; defend/assist; faction and gate damage aftermath. | C2-M11–13; M6 multiple-combatant/M16/M17/M20/M22. | Named protected defender, objective interval, gate-damage rule and repeat/reward policy are null. |
| **S25 Words in the Scriptorium** | Local Maren/books; identify; learn ward/light and perform their combination exercise. | C2-M06/08/09; C2-C04; M12/M13/M19. | Selected chapter-local teacher/pair ([decision §3](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#3-one-local-maren-and-lesson-per-artifact)); cast effect/qualification/cost tuning remains future work. |
| **S26 Sanctuary** | Public Aldric blessing clears crown curse; optional Priory reputation rite. | C2-M07; C2-C04; M15/M19/M20. | Selected non-consuming blessing available to either bell history; reputation never rewrites it ([decision §1](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#1-king-in-the-chamber-vault-after-defeat)). Fees/effects remain content tuning; no room spell implied. |
| **S28 The Sealed Vault** | Crown-custody first unlock; flooded gallery; identify cursed treasure; acknowledged inscription grants vault memory and matching-ring mine lead. | C2-M05–07; C2-C05; M9/M10/M12/M20. | Selected one-shot seal and honest local reward ([decision §§1–2](decisions/pm-decision-later-story-reconciliation-2026-10-04.md)); no pair requirement/award. Safe deep/flooded corpse return and typed imports need implementation proof. |

### Chapter three — The King's Road

| Actual quest | Concrete storyline demand | Candidate/reuse map | Selected future policy / remaining unknowns |
|---|---|---|---|
| **Q5 The Fen Ward** | Road arrival→next-dusk Lantern Night; five immutable child/bell histories with independent legal/faction aftermath and real jail-window variant. | C3-C05; C2-M12; M20/M21/M22/M23; CC-M01/02. | Selected [ending table](LATER-ENDINGS.md), pending indefinitely after event; actual Green/jail anchors and acknowledged export require future implementation. |
| **S5 The Armorer's Test** | Dunstan requests ore/forge job/durability test; awards steel sword. | C3-M01–03; M7/M18/M20. | Ore quantity, job duration, whether forged sword is tested or separately rewarded, pass condition and quality are null. |
| **S6 Bounties** | Vane daily eligible kill/loot count; pennies and Crown standing. | C3-C01; M15/M17/M20. | Target kinds, count, caps, credit ownership and evidence item policy are null. |
| **S11 The Toll Bridge** | At King's Road bridge choose speech, bribe or sneak; durable bridge fact. | C3-C02; C3-M05; M13/M18/M19. | Permission duration, bribe/toll differences and alternate route details are null. |
| **S14 Ore for the Crown** | Kell daily ore quota using pickaxe and resource seams; cave-in exposure. | C3-M01; C3-C01; M15/M20. | Node yield and quota/cap values are null; not an independent quota subsystem. |
| **S15 The Cave-In** | Automatic day6 mine event; survive, dig out, rope/protect miners; turn-in. | C3-C03; C2-M02/03/12/13; M20. | Protected identities, dig work semantics, timing/participation if player never entered mine and failure recovery are null. |
| **S16 A Roof of One's Own** | Josse sells empty_cottage; save pennies, purchase and furnish. | C3-M12; M18/M20. | Furniture recipe/stock and access details are null. Archive500 pennies remains tunable content. Mortgage/banking simulation unnecessary. |
| **S17 The Fence's Password** | Nix password/hidden alley; steal/fence; Cutpurse affiliation. | C3-C04; C2-M01; C3-M05–07; M13/M18/M20. | Password, required theft, affiliation benefits null. Guild class lock is not silently adopted. |
| **S18 Steal Back the Ledger** | Peg sends player to moneylender's ledger; sneak/hide/pickpocket; witness/wanted clean-or-Crown result. | C3-C04; C3-M05–07; M20. | Exact holder/ledger identity, evidence and law penalty mapping null. Earlier ledgers are not automatically the same unique item. |
| **S19 Trial at Harrowgate** | Local Brann/watch_house arrest/trial; evidence/faction choice; fine or real jail; served release/physical escape. | C3-M08/09; C3-C04; M12/M15/M21. | Selected physical one-body custody ([decision §4](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#4-physical-jail-one-body-and-real-routes)); crime/fine tuning and typed sentence/M5 seams remain future work. |
| **S22 Finch's Riddle Contest** | Offered three-round answers; reward song and pennies. | C3-M13; M13 letter bank/M20 sequence. | Riddles, failure/retry and song effect null. No new riddle engine. |
| **S23 Fish for the Table** | Maud repeatable fish delivery; rod/bait, spoilage, smoking recipe. | C3-M01/04; M11/M20. | Yield, reward, quantity, repeat interval and how recipe is first acquired null. Avoid requiring the quest reward recipe to meet its first turn-in. |
| **S24 Hew's Race** | Race cart to Harrowgate on foot or horse using terrain costs; horse discount. | C3-M10/11; M18/M20. | Route/start/finish/tie, cart speed, rented versus bought mount and discount extent null. Foot path must be winnable if advertised. |

## Chapter two — The Barrow King: mechanic candidates

| Candidate | Mechanic and exact storyline consumer | Reuse/prerequisites; smallest playable result; lift | Acceptance / red control seam |
|---|---|---|---|
| **C2-M01** E | Hidden passage discovery: Q4 ossuary→flooded_gallery and hidden_treasury; S8 hidden-room ledger. A §§3,4.1. | M9/M20 authoritative discovery, M12 readables, existing connections. Search reveals one authored connection and enables that exact route. **Small–medium**; content-only if M9 already supplies all semantics. | Hidden/unfound route: forged Move refuses; after discovery it succeeds. Mutate admission to check only topology; first result must fail. No new generic search engine. |
| **C2-M02** E | Rope/climb traversal: Q4 barrow-mouth descent; S13 well_shaft→well_bottom murder weapon. A §§3,4.1. | M3 mass, M7 check, M8 damage, M5 recovery, normal movement. One supported descent with rope and explicit no-rope outcome. **Medium**. | Controlled no-rope failure leaves actor at authored landing with exactly the authored damage once; valid rope route succeeds. Remove rope requirement/check branch. Fixture damage/landing await PM selection. Route back without lost gear is mandatory. |
| **C2-M03** E | Trap activation/disarm or avoidance: Q4 barrow_passage trap. A §§3,4.1. | M7/M8, M22 consequences, barrier state. One trap with revealed state, one trigger and one legal avoidance path. **Medium**. | For a selected one-shot trap, first crossing triggers once, return crossing triggers zero times, including reopen. Remove spent-state write; second trigger must fail acceptance. Reset policy is content, not inferred for every trap. |
| **C2-M04** E | Material-sensitive damage: Q4 silver against barrow wights. A §§4.4–4.5. | Actual M6 armed/multiple-actor follow-up, M7 eligibility, M8 damage. One silver/non-silver distinction with a reachable source. **Medium**. | Two controlled attacks differing only in material have separately hand-fixed HP results. Drop material modifier or apply it twice; oracle must fail. Exact numbers/order are a new Loka contract, not a Legend equation. |
| **C2-M05** E | Finger slots and item affects: S8 first fen ring, Q4 crown chill aura; S28 leads to chapter-three matching ring. A §§4.4,5. | Existing equipment subset; M8 status and M2 interval settlement for affected rates. One ring deliberately uses either finger with one bounded affect. **Medium**. | Controlled PER10 + ring2→12, remove→10, same ring moved between fingers→12, never14. Mutate removal/duplicate affect. Fixture values are not campaign tuning; selected real ring identities follow the decision. |
| **C2-M06** N | Item identity knowledge: S25 Maren/book identification, S28 unknown cursed treasure. A §§4.4,5; P21 §28. | M12/M13/M19. Identifying one item definition changes the player's knowledge and projection; its actual mechanics already apply while unknown. **Medium**. | Unknown display hides real name/affect; identification reveals both; save/reopen retains knowledge. Remove authoritative knowledge check from projection; pre-identification output must fail. No generic lore encyclopedia. |
| **C2-M07** E | Curse/no-remove and blessing: S26 crown rite; S28 cursed equipment. A §§4.4,5; [selected policy §1](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#1-king-in-the-chamber-vault-after-defeat). | C2-M05, M8/M19/M15. Real cursed crown remains usable as held key; public blessing clears curse without consuming it or changing bell history. **Medium**. | Forged voluntary remove/drop/give refuses while worn; after blessing succeeds. Death transfers exactly one real crown and removes its affect. Mutate voluntary admission or forced custody handling. If payment is selected, failed payment changes neither funds nor curse. |
| **C2-M08** E | S25 ward/light learning through local Maren; S4 ward topic stays distinct. A §§4.3,5; [selected lesson](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#3-one-local-maren-and-lesson-per-artifact). | M7 acquisition/qualification, M12/M13/M19. Teach missing learned identities through existing teacher semantics. **Medium**. | Already-known light plus lesson yields ward and light once, without another light fee/grant; unqualified cast remains refused. Mutate duplicate-learning or qualification guard. Acquisition/effect tuning is brief work. |
| **C2-M09** N | S25's selected ward + light exercise; no Q4/vault cast prerequisite. A §§4.3,5; P21 §28. | C2-M08; M7/M8 resources/status, M9 if selected effect needs it. One compiled pair/effect; **medium–large**, split dispatch from combat effect if needed. | Known pair resolves one selected effect; undeclared ward + chill refuses with zero cost/RNG. Delete pair validation. Effect/target/duration still require literal adopted brief; no full spell grammar. |
| **C2-M10** E | Q4 boss aura, half-health summon, quarter-health withdrawal within kings_chamber; terminal defeat produces one crown. A §4.5 amended by [selected policy §1](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#1-king-in-the-chamber-vault-after-defeat). | M6 multiple actors, M8/M16/M17/M22, C2-M03/04; narrow reachable loot-key validation. Aura→summon then withdrawal/drop may split. **Large**. | Fixture maximum HP100, HP60→49 summons once,49→24 withdraws without crossing vault barrier; lethal hit wins; retry/reopen yields one crown. Mutate latch/crossing or place King/drop behind crown lock. Compiler negative control rejects circular loot-key route. |
| **C2-M11** E | Moon window: Q4 alternate isle_shrine↔standing_stones transport; S21 full-moon trigger. A §§3,4.2. | M1-C calendar, M19 transport, M22. One derived moon window shared by portal projection and traversal. **Medium**. | At authored opening boundary portal admits; at exclusive close refuses; no player Wait bypass. Mutate boundary comparison. An always-reachable non-portal Q4 route prevents waiting from becoming the only campaign route. |
| **C2-M12** E | Phased world-event composition: S21 Wight Night's wight-pit surge→north-gate defense→aftermath. A §§3,4.7; Q §39. | C2-M11, M16/M17/M22, real multiple-actor combat. Small ordinary state-machine/reaction composition with event identity; no new manager/authority. **Large**, split trigger/spawn from terminal aftermath if needed. | One full-moon event observed before/after restart has one event instance and one authored spawn bundle; repeated reconciliation does not respawn it. Remove occurrence identity/latch. Later cycles follow explicit repeat policy. |
| **C2-M13** E | Protect objective: S21 defense tracks a named living defender through the event; gate damage is a separate outcome fact. A §5; P21 §28. | M20 survive/event operators, C2-M12. Resolve success/failure from the selected protected identity at close, then reward once. **Medium**. | Protected actor alive at close→success; actor dead→failure even if all attackers died. Replace predicate with player-alive check. Exact protected identity and gate-damage condition are null until authored; do not assume a gate is a living actor. |
| **C2-M14A** E | Hired companion and orders: S12 Maud offers Dagny for hire; follow/stay/attack/guard. A §§2,4.5,5. | M16 legal follow/arbitration, M18 payment, M6 multiple combatants, M14 relationship. Pay once, bind existing Dagny, use Follow/Stay first; add Attack/Guard only with actual multi-combat. **Medium–large**. | Hire retry yields one Dagny and one payment; Stay prevents following across the next move; stale order after separation refuses. Remove ownership/relationship check. No new party authority or generic command language. |
| **C2-M14B** E | Wage/loyalty lifecycle: S12 ongoing wages and Dagny's loyalty. A §5. | C2-M14A, M1/M14/M18. One wage interval settles once and an explicit insufficient-funds branch changes service. **Medium**. | Fixture funds5, wage2, two due intervals→funds1 and two paid records; third follows selected leave/stay refusal policy, never negative. Remove due-occurrence settlement. No unlimited offline debt or automatic possessions seizure. |
| **C2-M15** N | Pet growth/feeding/death: S20 hound pup at hound_run raised, fed, trained, fights. A §§4.5,5; P21 §28. | M1/M11/M14/M16, C2-M14A orders, M5/M6 NPC life. Adopt one pup; derived age selects one growth stage; feed/training actions expose chosen order. **Large**, split lifecycle from combat adoption. | At controlled growth boundary one existing pup becomes adult, no second actor; dead pup stays dead after later age boundaries. Remove life guard from growth. Exact age/feed penalties/training outcomes are content choices; no mandatory pet-resurrection system. |

## Chapter two content batches — reuse without new engine families

| Candidate | Consumer and smallest playable result | Dependencies / lift | Acceptance / red control seam |
|---|---|---|---|
| **C2-C01** C | S7 Sedge's Bargain: give the one fox charm to Sedge or Aldric; commit one faction branch. | M13/M15/M20/M22 and actual item handoff. **Small**. It is not barter. | One charm, choose Sedge: charm has one recipient; Aldric branch cannot later award too. Remove terminal exclusivity. Standalone-start charm provenance must be authored. |
| **C2-C02** C | S8 Unburied Ledger: discover hidden room, read ledger, perform authored shrine item sequence, receive one ring. | C2-M01/05, M12/M20 sequence/custody. **Small–medium**. Sequence items/order/location remain null. | Literal selected sequence A,B,C succeeds; A,C,B does not; repeated last input grants no second ring. Remove sequence ordering guard. No puzzle DSL. |
| **C2-C03** C | S13 Miller's Ghost: discover at old_mill at night, retrieve well-bottom weapon plus two authored clues, accuse in a choice scene. | C2-M02, M9/M10/M12/M13/M20/M21. **Medium**. No law or playable ghost needed. | Three distinct selected clues enable the intended accusation; collecting one clue three times does not. Remove distinct evidence/current-knowledge gate. Killer and two other clues remain null. |
| **C2-C04** C | S25 one local Maren/ward-light lesson; S26 public non-consuming blessing and optional reputation rite. | C2-M06–09, M13/M15/M20/M21; [selected policies](decisions/pm-decision-later-story-reconciliation-2026-10-04.md). **Medium**. | Chapter two finishes lesson without Harrowgate; chapter three contains one Maren and preserves knowledge. Blessing never rewrites child/bell history. Mutate off-map teacher, duplicate word or history write. |
| **C2-C05** C | Q4 defeat/turn-in→safe high_pass; S28 unlatched vault, inscription memory and mine-shrine lead. | Selected C2-M01–04/10 route/encounter, C2-M05–07 crown/vault; M9/M10/M12/M20–22 and CC. **Medium**; magic remains optional. | King defeat alone exports nothing before final acknowledgement. S28 completes without ring pair/S8, awards no first-ring duplicate; first unlock permits crown-free corpse return through selected safe route. Mutate acknowledgement, pair gate or seal relock. |

## Chapter three — The King's Road: mechanic candidates

| Candidate | Mechanic and exact storyline consumer | Reuse/prerequisites; smallest playable result; lift | Acceptance / red control seam |
|---|---|---|---|
| **C3-M01** E | Tool-gated resource harvest: S14 Kell's ore quota, S5 forge ore, S23 rod/bait fishing. A §§4.6,5. | M17-C nodes, M7 checks, M3 custody/load, M20 repeats. First one ore seam needing a held pickaxe; fishing adds consumed bait only if existing recipes cannot. **Medium**. | Without pickaxe zero ore and no depletion; with it one authored yield and one depletion; replay zero extra. Remove tool check. Node quantity/regrowth differs from animal spawn. |
| **C3-M02** N | Timed service custody/completion: S5 smithy forge job. A §4.6; P21 §14; release service.escrow_jobs. | M1 elapsed, M18/M19 transactions, containment/provenance. One forge slot, one job, explicit cancel/failure, eventual claim. **Large**; freeze custody before recipe output. | Fixture inputs2 ore leave player exactly once; crash/retry still has one job holding2 ore or one settled output, never both player ore and output. Delete escrow transfer/settled marker. Waiting consumes real elapsed; no skip or new independent clock. |
| **C3-M03** E | Forge recipe and wear condition: S5 Dunstan's ore→steel sword test explicitly uses durability. A §§4.4,4.6,5. | C3-M02, M6 equipped-use consequence, M7 chosen craft check, M18. A forge transformation plus one durability decrement/broken behavior; **large** if together, split A forge recipe / B wear; repair remains a later selected smithy service. | Controlled condition2, two committed uses→0 and unavailable attack; retry second use stays0. Remove broken-item eligibility. Recipe fixture separately checks2 ore→1 sword, no restored ore. Quality bands/salvage need their own actual selected consumer. |
| **C3-M04** E | Perishable food and smoking transformation: S23 fish for Maud, bait/rod, spoilage and recipe. A §§4.4,5. | C3-M01, M1/M11, immediate recipe or C3-M02 only if smoking truly occupies a job. One raw fish expires by absolute origin time; one smoke action prevents it. **Medium**. | Raw fish at exclusive expiry is spoiled after transfer/reopen; smoked fish remains edible. Reset timestamp on transfer; boundary case must fail. No universal crafting taxonomy. |
| **C3-M05** N | Sneak/hide affects perception and movement: S11 sneak past Marl, S18 unseen approach to moneylender. A §§4.6,4.8,5. | M7/M8/M9 perception, M16 behaviors, M1 expiration. One visible/hidden state and one checked sneaking traversal. **Medium**. | With controlled observer perception, hidden actor is omitted from observer targets while authoritative location remains unchanged; failed sneak reveals. Remove perception policy from observer targets. Exact odds and reveal triggers are new selected Loka rules. |
| **C3-M06** N | Theft/stolen provenance and fence acceptance: S18 steal ledger; S17 Nix buys stolen goods. A §§4.6,5; P21 §28. | C3-M05, M7/M18, containment. One NPC-held item transfers on successful theft and gains stolen provenance; fence can accept it. **Medium**. | Successful controlled attempt moves one ledger and marks it stolen; failure moves none; retry no second item. Remove target-custody or provenance write. Access to NPC inventory remains limited to admitted theft, not ordinary Take. |
| **C3-M07** N | Witnessed offense→jurisdiction wanted: S18 clean versus Crown penalty; S17 theft consequence. A §§4.6,5; P21 §§16,28. | C3-M05/06, M15/M22. One offense kind, perceiving local NPC witnesses, one Crown wanted state. **Medium**. | Unseen theft yields zero witnessed offenses; one seeing NPC yields one Crown wanted change; blind/nonlocal observer yields zero. Replace witness predicate with all-room NPCs or omniscience. Do not add disguise first. |
| **C3-M08** E | S19 trial triggered by co-located Brann/Crown-wanted actor at watch_house, or voluntary settlement. A §§2,4.6,5; [selected policy §4](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#4-physical-jail-one-body-and-real-routes). | C3-M07, M16 admission, M21 bound continuation. One local trial, revalidated at commit. **Medium**. | Wrong jurisdiction/location/dead defendant refuses; pending trial does not admit another arrest. Reopen binds same identities. Mutate legal/life/location recheck. No forced escort subsystem. |
| **C3-M09** N | S19 real jail/cells sentence; tunnel to fence_cellar/fence_alley; legal release or escape. | C3-M08, M1/M5 custody/recovery, C2-M01 discovery, selected held-pick qualification. [Physical policy §4](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#4-physical-jail-one-body-and-real-routes). **Large**; split admission/custody from release/escape. | One body and unchanged possession identities; fine never imprisons; due releases once, escape cancels old sentence without stale wanted clearance. Status death retains wanted and recoverable corpse; forged confinement bypass refuses. Mutate cancellation/custody/life admission. No player clock skip. |
| **C3-M10** N | Mounted traversal and terrain costs: S24 race on foot or horse; Hew's horse sale/rental. A §§3,4.1,5; P21 §28. | M3/M16/M18/M19, M7 if ride qualification chosen. One horse with rider co-location, road-only admission and declared cost. **Large**, split terrain cost / mount relation if necessary. | Mounted road move moves rider and horse once; fen/mine refusal moves neither and spends zero; dismount leaves horse at correct place. Remove mounted mode check or one co-location update. Never infer Diku average/half formula as adopted. |
| **C3-M11** E | Race objective and cart route: S24 reach Harrowgate before Hew's cart. A §4.8,5; P21 §28. | C3-M10, M1/M16 route work, M20 event/window. Cart follows authored route; finish credit compares ordered arrival events. **Medium**. | Controlled player-arrival event before cart→win; after→lose; tie has one selected deterministic result. Mutate event order comparison. Horse discount granted once; no invented race need in chapter two. |
| **C3-M12** N | Property ownership/access: S16 buy empty_cottage from Josse and furnish it. A §§3,4.6,5. | M18 payment, containment/equipment-like slots, barriers, M2 rest. One purchase, chest and furniture slot; no building editor. **Medium**. | Fixture funds600, price500→100 and one owner; duplicate request stays100; a distinct second purchase refuses. Remove ownership predicate. Death/jail does not transfer house ownership. |
| **C3-M13** E | Learned song and instrument-gated room effect: S22 Finch's three-round riddle contest rewards a song; A §4.9 describes songs as buffs. | M13 riddle reuse, M7 knowledge, M8 timed status, equipment/perception. One rewarded song used with instrument on eligible current listeners. **Medium**. | No instrument→no cost/effect; with it one declared effect per eligible listener; replay/overlap follows chosen stacking rather than last-writer-wins. Remove instrument or stacking check. Song lyrics and buff still null. |

## Chapter three content batches — reuse after those mechanics

| Candidate | Consumer and smallest playable result | Dependencies / lift | Acceptance / red control seam |
|---|---|---|---|
| **C3-C01** C | S6 Bounties and S14 Ore for the Crown: distinct eligible kills/ore deliveries, daily windows/caps, Crown reward. | M15/M17/M20; C3-M01 for mining. **Small–medium**. | Same kill/ore cannot earn twice; next authored window permits a new eligible contribution. Use one killed actor/two replayed events as duplicate control. No quota engine. |
| **C3-C02** C | S11 Toll Bridge: dialogue, fee/bribe or sneak branch sets crossing fact. | M13/M18/M19; C3-M05 for sneak. **Small**. | Failed payment yields no crossing permission; selected paid crossing charges once. Remove atomic permission/payment dependency. Historic toll3 is content proposal, not engine constant. |
| **C3-C03** C | S15 deep_shaft cave-in: dig/rope/protect and usable return route; chapter-three mine content also exposes matching-ring shrine retrieval. | C2-M02/03/12/13, M1/M8/M9/M10/M20/M22. **Medium**; ring retrieval is content, not another mechanic. | Miner dead at close fails despite player escape; selected rescue succeeds. Mine ring custody/return follows water/corpse route proof. Mutate miner-life condition or blocked recovery route. Dig duration only if actual labor requires it. |
| **C3-C04** C | S17 Fence's Password, S18 Ledger and S19 trial scene: password/hidden access, theft, evidence/faction choice, fine/jail. | M12/M13/M15/M20/M21; C3-M05–09. **Medium**, author as separate quests. | Three real branches: unseen ledger return, witnessed arrest, lawful resolution; wrong password does not reveal exit. Test actual outputs, not script text. Cutpurse affiliation remains a story flag absent a separately adopted skill gate. |
| **C3-C05** C | Q5 next-dusk Lantern Night, five base histories, Green/rumors and actual jail-window presentation. | C2-M12, M20/M21/M22/M23, C3-M09, CC and [canonical ending table](LATER-ENDINGS.md). **Medium–large**. | Controlled history/legal/faction inputs select the exact table row; stays/lost never become rescued, wanted/free never becomes jailed. Stale context acknowledgement refuses; valid final acknowledgement exports once. Mutate child collapse, legal selector or acknowledgement guard. |

## Cross-chapter continuity and product seams

| Candidate | Consumer / minimum result | Prerequisites; classification / lift | Acceptance / red control seam |
|---|---|---|---|
| **CC-M01** E | Acknowledged chapter completion→declared continuity export. Chapter1 dawn exports actual rescued/stays/lost plus allegiance; chapter2 high_pass adds king status; chapter3 Lantern Night finalizes. Q4/Q5 are the later consumers. A §11, K. | M20/M21-C/M22-C, durable receipt/report foundation. Add only the missing export-record subset at actual end. **Medium**. | Final player Continue accepted and committed, host reply lost→one identical export on reopen/retry; before that final player acknowledgement→zero completion export. Delete occurrence identity/transactional coupling. M21/M22 retain ownership of chapter1 finale semantics. |
| **CC-M02** N | Optional-prior starts for Q4/Q5 using declared imports or explicit defaults. [Ending/default table](LATER-ENDINGS.md#defaults-and-import-mapping). | CC-M01, versioned exact release/hash/schema/lineage ports, normal new-save transaction. **Large**; split validation from durable admission. | Valid imported stays/prior or lost/prior is preserved; malformed selected import refuses atomically; reopen applies once. Remove validation/consumed identity or overwrite history with skip defaults. No predecessor world copy. |
| **CC-M03** E | Q4/Q5 transfer of declared learned knowledge plus selected held first-ring/crown snapshots, with separate resolution/seal memories. [Item policy](decisions/pm-decision-later-story-reconciliation-2026-10-04.md). | CC-M02, M7/equipment/provenance; exact compatible definitions/encoding and deduplication remain future brief work. **Medium–large**. | Valid held instance imports once; resolved S8 with absent ring never mints replacement; valid import never also receives default crown. Unsupported definition refuses/maps explicitly, without silent loss. Mutate dedup/default selection. Earlier pin intact. |
| **CC-C01** C | Q4/Q5 chapter manifests compile whole accumulated map, open crypt/priory gate then road, preserve revisitable Ashmere and earlier ending reactions. A §11. | Compile-time content selection/references, CC-M02, existing activation/barrier facts. **Medium** content/integration; extend compiler only where actual selected groups cannot be expressed. | Chapter2 artifact contains its needed old/new rooms and no runtime reference to chapter1 artifact; imported stays does not become rescued in Ashmere greeting. Remove a selected group/import branch. No live dependency or shared whole save. |
| **CC-P01** P | Q4/Q5 paid chapter2/3 availability, acquisition/entitlement, installs, support/recovery and account completion sync. [Product ladder](archive/spec/14-implementation-plan.md) R12/R12A/R13/R16; [account progress](archive/spec/23-accounts-progress-admission.md). | Existing product track, certified artifacts and account APIs. **Large**, own product queue. | Restored purchase enables eligible install; account outage does not block installed play; repeat completion upload creates one accepted occurrence. Commerce/human/store evidence required at release, not an engine-mechanics slice. No paid tooling authorization implied. |

## Selected future policies and remaining OPEN work

Five conflicts now have [PM-selected future policies](decisions/pm-decision-later-story-reconciliation-2026-10-04.md),
with implementation and independent docs review pending. Candidate IDs remain provisional.

| Seam | Status / canonical policy |
|---|---|
| Q4 King/crown/vault | Selected future; [chamber fight, post-defeat vault and reachable loot-key proof](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#1-king-in-the-chamber-vault-after-defeat). |
| S8/S28 ring chain | Selected future; [first ring, honest vault memory/lead and actual carried subset](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#2-first-ring-from-s8-matching-ring-in-chapter-three). |
| S25 teacher geography | Selected future; [one chapter-local Maren and ward/light lesson](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#3-one-local-maren-and-lesson-per-artifact). |
| S19 jail | Selected future; [physical one-body custody, sentence, escape and recovery](decisions/pm-decision-later-story-reconciliation-2026-10-04.md#4-physical-jail-one-body-and-real-routes). |
| Q5 ending table | Selected future; [exact base/legal/faction selectors and import/default guards](LATER-ENDINGS.md). |
| S21/S15 protection | OPEN: protected identities, availability/missed-event alternatives, repeat/reward and dig-work semantics. Living defenders and gate aftermath fact remain separate. |
| Safety and other tuning | OPEN at each consumer: prove gear-free corpse routes, selected NPC service failure/replacement and safe/interruptible reading; freeze rates/costs/effects only in the actual brief. |

Guild affiliation in S7/S17/S26 is story state; these consumers do not require a class
framework. S12/S20 training and S25 words need selected acquisition/outcome rules;
universal learn-by-use/decay and unverified numerical formulas are not adopted.
[PR #136](https://github.com/lorecrafting/lokacore/pull/136) is merged. Its
[PM reconciliation](decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md)
governs current planning; the original research/formula alternatives remain historical.
This queue imports no equations or XP/attribute purchase. Candidates use one shared difficulty;
no ironman or separate penalty branch is introduced.
S4 ward knowledge remains a topic/fact, not an already-learned spell. Keep actual item
mechanics independent of identification, and learned knowledge distinct from present
qualification. Follow the existing clock policy; no player Wait or skip is introduced.

S7 needs custody/faction choice, not barter; S13's NPC mystery needs no player ghost-walk.
Use M13/M20 for riddles, sequence puzzles and quota credit, ordinary event composition
for Wight Night, and the listed services/custody for economy. Stances, dual wield,
ranged attacks, collections, hunt/drives/funerals/ecology, bank/debt, mail/boards,
weather/seasons, broad crafting quality/salvage and disguise/recognition remain catalog
options needing their own selected first consumer. No blanket catalog or framework
implementation follows from this map.

## Continuity boundaries

CC candidates admit only declared versioned fields. Validate campaign, exact allowed
source release/schema/lineage, unknown fields, item definitions and complete destination
defaults before save creation; apply export/import effects once across retry/reopen.
Character fields are opt-in, without implicit gold, possessions, NPC health, active quests
or scheduled jobs. Earlier saves stay separately pinned and intact; destination chapter
compiles its whole accumulated map, without cross-cartridge runtime or shared World save.

The [canonical ending/default table](LATER-ENDINGS.md#defaults-and-import-mapping) and
[selected item policy](decisions/pm-decision-later-story-reconciliation-2026-10-04.md)
own exact future defaults and ports. Valid imports take precedence; starting fiction
never certifies earlier completion. Account progress acceptance remains separate from
local continuity, with no account call in portable rules or offline-to-Realm power import.

## Route to playable results

Continue M1–M23 and chapter-one content/proof first. Suggested future checkpoints are
standalone/imported chapter-two arrival plus a safe dungeon route; King encounter,
return and acknowledged high-pass ending; companion or Wight Night loop; chapter-three
ore→forge; stealth→arrest→trial→release; foot/horse race; Lantern Night with selected
import/default/jail outcomes. These are preview batches, not promised PRs.

After shared contracts freeze, S7 choice, S13 mystery, spell lesson, companions and
Wight Night can form separate content branches; chapter-three ore/fishing, theft/law,
race, house and song similarly follow their specific dependencies. Movement,
combat/status, custody/payment, scenes, protocol/compiler/generated outputs and
GameView remain shared integration surfaces. Enumerate actual disjoint file sets
before concurrent implementation; merge shared contracts first. Each implementation
lands a real consumer and focused automated proof under the canonical validation
policy linked by [owner rules](system/owner-rules.md#process), with playable previews
batched at these checkpoints.
