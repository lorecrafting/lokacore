# R&D adoption map for the prologue (2026-11-04)

Read-only study. Sources (short names): **K** = koster-design-lessons-2026-10-15; **M** = elder-scrolls-morrowind-skills-2026-10-23; **A** = design-audit-abilities-authoring-2026-10-23; **W** = wow-and-classic-forever-design-lessons-2026-11-03; **R** = rpg-and-mud-design-breakthroughs-2026-11-03. Heading evidence is from `docs/system/mechanics.md` unless a file is named. I did not read the koster-research-notes files (no lesson needed them).

Scales:
- **Status.** Built = engine capability exists (heading cited). Partly = engine exists but no prologue content, no sampler proof, or one piece missing. Not built = nothing found.
- **Cost.** S = content only or a setting. M = one mechanic slice. L = new subsystem or save/contract change.
- **Writing load.** What the owner must write (every player-facing word is hers). Structure-only work is "none".
- **Prologue.** The prologue is free, 3-5 hours, no economy, no coin, no houses or guilds, basics taught through gifts and labour, ends on the landing.

Cautions (mine, unsure): W and R were written by a Gemini agent in the Pi harness. They name fields (`notices`, `journal`, `GameView.conditions`, "calorie burn") and prose lines that I did not verify against the repo. Treat their example sentences as reference only (owner rule: agent prose is placeholder). I judged status from mechanics.md headings, not by running anything.

## 1. Adoption map

### A. Skills, growth, character (K, M, A)

| # | Lesson | Source | Loka system | Status (evidence) | Cost | Writing | Prologue |
|---|---|---|---|---|---|---|---|
| 1 | Everyone can try every basic; the free novice box is taught to all | M, A | Skill trees (hs-11); Skill ranks | Built (`## Skill trees`, `## Skill ranks`; owner rule on prologue basics) | S | med | yes: already the owner's rule |
| 2 | Specialists are better, not exclusive (novice passes only easy checks) | M | Skill growth and opposed checks (rows 5, G5); Dialogue skill checks | Built (`## Skill growth and opposed checks`) | S | low | yes: set ratings so first-hour checks pass |
| 3 | First-hour basic must succeed; no "swing and miss" at the start | M | Same plus numbers tools (`play/numbers.ts`) | Partly: rules exist, prologue ratings unset | S | none | yes: a tuning pass, not code |
| 4 | Growth by use, gated by difficulty; failure costs something (no "bottom-feeding" trivial actions) | K, M | Skill growth (use counts saturate at last `growth` entry) | Built (`## Skill growth...`; A finding 3 says use counts already saturate) | S | none | yes: nothing to add |
| 5 | Typed XP: every activity advances something | K | Experience and levelling (row 4): kills, `experience.grant` | Partly (`## Experience and levelling`; grants by kill and reaction only) | S | none | later: prologue needs few levels (unsure) |
| 6 | Do not tie global level to skill raises; no attribute multiplier planning | M | Levelling is class-free and from deeds | Built (`## Experience and levelling`; owner decision 2026-10-08) | S | none | yes: keep as is |
| 7 | Gold must not buy skill points; a fee only unlocks a box | M, K | Skill trees (box fee) | Built (`## Skill trees`; owner rule on trainer coin fee) | S | none | yes: prologue has no coin anyway |
| 8 | Choose the "class" after trying basics (Skyrim lesson) | M | D11 ancestry is immutable and picked before play; skills are open | Partly (`## D11 character choice`) | S | low | later: ancestry is not a class, but check the prologue does not force an early choice (unsure) |
| 9 | The quest is the box: a quest objective is `skill_compare` on the box; the lesson takes a gift | A (approach A, findings 6, 7) | Quest@1 (`current_state` objective), `skill_compare` leaf (`## Passive skill voices`), dialogue `hand_over` | Partly (A calls it "not run"; needs one sampler) | S | med | yes: the prologue's four basics are this |
| 10 | Spell `learned` may name a box fact | A | Spell cast admission (29a) | Partly (A: verified by reading, not run) | S | none | yes: needed for the light word |
| 11 | Capacity budget (3 masters and a dabble) and surrender | K, M, A | Skill trees; save recovery | Not built | L | low | later: A parks it to the landing; touches save |
| 12 | Growth window / anti-grind cap | A | Skill growth | Not built | M | none | later: build only if a playtest shows grinding |
| 13 | Six-starter roster (66-84 boxes) | A | Skill trees content | Not built (content) | S | high | later: build the 20 prologue boxes first |
| 14 | Hidden elite requirements should be discoverable in play, not secret | K | Hidden elite professions | Conflicts with owner rule (see section 4) | S | med | no |
| 15 | Never require mastering disliked professions to unlock an elite | K | Skill trees | Not built (design rule) | S | none | later |
| 16 | Do not maximize both rarity and power for an elite | K | Elite professions | Not built | S | none | later |
| 17 | Every profession rests on systemic demand, none on authored content | K | Decay (row 41), Durability and repair (row 21), Cooking, Craft | Partly (`## Decay`, `## Durability, crafting quality and repair`) | S | none | later: no economy in prologue |
| 18 | Paper-prototype combat; cap buff stacking | K, M | Status modifiers (row 2c); `play/fight.ts`, `play/power.ts` | Partly (`## Status modifiers`; fight/power tools exist; no stacking cap found, unsure) | S | none | later: prologue has light combat |
| 19 | Rank gives places and people (trainer, hall, title), not bigger numbers | M | Recognition and earned titles (W15, FD9); Standing (rows 15, G11) | Built (`## Recognition and earned titles`) | S | high | later: houses and guilds open at the landing |
| 20 | Guilds stack; one exclusive house; ranks need skills plus deeds | M | Standing and disposition; `skill_compare`; Access locks (G7) | Built (A: "no engine change") | S | high | later: landing |
| 21 | Once-a-day "power" that never fails and costs nothing | M | Scripted action `cooldown`; Delayed reactions (FD1) | Partly (`## scripted_action@1` cooldown; never used as a power) | S | low | yes: fits Thera's resonance, but never gate required content on it (rule: no idle waits) |
| 22 | Anyone casts; skill sets the fizzle odds | M | Spell cast admission (29a), Spell effects (29b) | Partly: admission by learned/pools, no fixed-rating fizzle (A phase 6b) | M | low | later: only if a prologue word needs a fizzle |
| 23 | Spell reagents consumed | M, A | Spell cast admission (reagents are pools until `loka-kgd.83`) | Partly | M | none | later: prologue has no reagents |
| 24 | Enchanting; spellmaking by guild members | M | None found | Not built | L | med | later |
| 25 | One shared weariness pool that many actions read | M | `mv` pool (resource@1) | Built (`## resource@1`) | S | none | yes |
| 26 | LegendMUD: each place's beliefs are literally true; skills gated by origin | K | D11 ancestries with acquired skill | Partly (`## D11 character choice`) | S | high | later: one origin in the prologue |

### B. Economy, crafting, towns, Realm (K)

| # | Lesson | Source | Loka system | Status (evidence) | Cost | Writing | Prologue |
|---|---|---|---|---|---|---|---|
| 27 | Faucet and sink ledger from day one | K | `play/ledger.ts` (cartridge.md "Economy and ecology ledger") | Built (tool exists) | S | none | no: prologue has no economy to measure |
| 28 | All prices and rewards in cartridges, none hardcoded | K | World parameters rule | Built (owner rule: engine owns mechanics, cartridges own numbers) | S | none | yes: already law |
| 29 | Guarantee newcomers starter goods | K | Gifts, Give pairs, Replenish | Built (`## Give pairs`, `## Replenish`) | S | med | yes: matches "gifts, no coin" |
| 30 | Crafting skill-up never a guaranteed money loser; cap NPC buyback | K | Barter (kgd.70), Stock-sensitive prices (W11), Craft | Built (`## Barter`, `## Stock-sensitive prices`) | S | none | no: no coin |
| 31 | No global perfect-information market early | K | None (Realm) | Not built | L | none | no: offline |
| 32 | Resource attributes feed recipe stats; experimentation risk/reward | K | Durability, crafting quality and repair (row 21) | Partly (quality exists; no experimentation) | M | low | later |
| 33 | Resource half-life / rotation | K | Replenish (19b), Decay | Partly (`## Replenish`, `## Decay`) | S | none | later |
| 34 | Housing upkeep, decay, civic roles | K | Property and bank (24, 25); Built rooms S2-S6; Furnishing | Built (`## Property and bank`, `## Built rooms...`) | S | med | later: houses open at the landing |
| 35 | Overhead and collapse risk grow with town size | K | None (Realm) | Not built | L | none | no |
| 36 | Decide land supply and placement rules before the Realm | K | Built rooms | Not built (decision) | S | none | no |
| 37 | Offline import policy (items, coin, skills) before the Realm | K | Realm seams rule; save.md | Not built (decision) | L | none | later |
| 38 | Decide PvP consent up front | K | None | Not built (decision) | S | none | no |
| 39 | Review every Realm feature as a weapon; adversarial testing | K | Process | Not built | S | none | later |
| 40 | Code of conduct, sanction ladder, persistent identity, rolling interaction log | K | None | Not built | L | low | no |
| 41 | Save-data integrity and an export path | K | save.md (one save per story) | Partly (integrity exists; export not found, unsure) | M | none | later |
| 42 | Stage social play along a trust ladder | K | None (Realm) | Not built | L | none | no |
| 43 | Avoid power-law ladders; no announcement spam at scale | K | None | Not built (design rule) | S | none | no |
| 44 | Permanent live team, train a successor | K | Process | Not built | S | none | no |
| 45 | Authoring tools for one audience, easy to use | K, A | Source shortcuts (extends, bundles, zones); AI builder (phase 8) | Partly (`BUILDERS-GUIDE` rows 107-111: extends, bundles, zones built; builder app not) | L | none | later |
| 46 | Authored text is a consumable; let systems carry replay | K | Narration variety and visit tiers (W7); Description variants | Built (`## Narration variety and visit tiers`) | S | high | yes: a budget rule for the owner |

### C. Authoring tools and sugar (A)

| # | Lesson | Source | Loka system | Status (evidence) | Cost | Writing | Prologue |
|---|---|---|---|---|---|---|---|
| 47 | Lower sugar in the compiler, no new grammar | A | cartridge.md "Source shortcuts" | Built (`BUILDERS-GUIDE.md:107-111`) | S | none | yes |
| 48 | `signal` as a counter fact; zone rule per tagged room | A | `fact_changed`; zones | Partly (zones built; `signal` not found in BUILDERS-GUIDE, unsure) | S | none | yes if wanted: sugar only |
| 49 | Why-didn't-this-rule-fire replay; dead rules by transcript coverage | A | `play/why.ts`, `play/coverage.ts` | Built (files exist) | S | none | yes: use them for acceptance |
| 50 | A `wait` cannot end in a move or a door (delayed-rule subject, `loka-v86w`) | A | Delayed reactions (FD1) "Event-bound steps refused" | Not built | M | none | later: fund only if the prologue needs "guards arrive a minute later" |
| 51 | Byte-identical lowering as the sugar gate | A | Content hash, known answers | Built (process) | S | none | yes |

### D. Quest, level and world design (W, R)

| # | Lesson | Source | Loka system | Status (evidence) | Cost | Writing | Prologue |
|---|---|---|---|---|---|---|---|
| 52 | Hub-and-spoke: 2-3 overlapping quests per hub, one breadcrumb out | W | Quest@1, Quest stage hints (W23), Chronicle (FD6) | Built engine (`## quest@1`, `## Quest stage hints`); no hub rule | S | med | yes: the Grove and Heartwood are hubs |
| 53 | Horizontal progression: toolkit verbs (rope, lantern, waterskin) unlock room verbs | W | Held tools, Use X on Y (G4), Tool-gated harvest (19), Rope and climb (30) | Built (`## Use X on Y`, `## Tool-gated harvest`) | S | med | yes: wood and stone tools only |
| 54 | Small permanent level cap and small numbers | W | `world.levelling.thresholds`; world-parameters | Built (`## Experience and levelling`) | S | none | yes |
| 55 | Knowledge unlocks dialogue (deductions, topics) | W | Lore codex and deduction (46); Ask about a topic (FD7) | Built (`## Lore codex and deduction`, `## Ask about a topic`) | S | high | yes: Seren and Maren talks |
| 56 | Standing opens doors | W | Standing and disposition (15, G11); Access locks (G7) | Built | S | med | yes in small form: Thera's trust; guilds later |
| 57 | Danger gradients: safe road vs perilous off-path, shown by cues | W | Sense cues: sound, smell, heat (G6); Random encounters (9) | Built (`## Sense cues`) | S | med | yes: Edge and Thinning rooms |
| 58 | Positive framing of rest ("Rested" bonus, warm hearth) | W | Position@1 rest regen; Status effects over time; `rested` event | Partly (`## position@1`, `## Sleep`: `rested` reaction can apply a status; no authored bonus) | S | low | yes: a hearth status, no code |
| 59 | World-anchored crafting at an anvil, rack or kettle | W | Craft (hs-10) "station recipes"; Furnishing | Built (`## Craft`; A cites "craft recipes are station recipes") | S | low | yes: Kira's hearth |
| 60 | Macro-landmark visible across a district's descriptions | W | Room descriptions; Description variants (W6) | Built (content only) | S | med | yes |
| 61 | Afflictions with teeth: a sprain slows movement, smoke blocks words, a head wound hides cues | R | Movement on a status (SR7), Command blocks (SR4), Perception on a status (SR6) | Built engine (`## Movement on a status`, `## Command blocks and resistances on a status`, `## Perception and concealment on a status`); no prologue content | S | low | yes: Edge sickness and the thirst/cold beats |
| 62 | Triage choices between competing remedies | R | Bleeding and bandage (C5), Potions and songs (18, 42), status readers | Partly (`## C5 hound bleeding and bandage`) | M | low | later: prologue combat is light |
| 63 | Quests award permanent world verbs (shortcut, recipe, new address) | R | `quest_resolved` reaction + `barrier.set`, `recipe` grant | Built engine (`## reaction@1`, `## Pick and force a barrier`); content pattern only | S | low | yes |
| 64 | Few, handcrafted, high-impact quests | R | Quest@1 | Built (design rule) | S | high | yes: matches 48 beats |
| 65 | Internal voices: high skill adds nuance to room narration | R | Passive skill voices (FD2); Entity description variants (W6) | Built (`## Passive skill voices`) | S | high | yes: but fits only once skills are visible on the Contents page |
| 66 | Failing forward: a failed check opens a complication, never a dead end | R | Dialogue `then_failed`; scripted action `failure` outcome; `check_failed` trigger | Partly (`## dialogue@1` Branching dialogue "check... then_failed"; failure commits costs and time) | S | med | yes |
| 67 | Looping geography: open a shortcut back to the safe hub | R | Barriers, Hidden passages (11), Rope and climb | Built engine (`## barrier@1`, `## Hidden passages and search`); a map-design rule | S | med | yes |
| 68 | Tangible lore in the mundane: 1-2 line inspect fragments per entity | R | `inspectable_detail@1` | Built (`## description_variant@1 and inspectable_detail@1`) | S | high | yes: a writing budget item |
| 69 | Adversarial mentor: NPCs challenge the player's worldview | R | Branching dialogue; Dialogue skill checks | Built engine (`#### Branching dialogue`) | S | high | yes: Seren and Maren, already in the outline |
| 70 | Judge morals by quiet, unprompted choices; never show a karma slider | R | `fact@1` facts; quest outcomes | Built (`## target_resolution@1, policy@1, fact@1`) | S | med | yes: outline beats 15, 24, 42, 43 |
| 71 | Physical simulation depth (fire, exposure, weather) | R | Fire (W22), Exposure (W25), Derived sky (31) | Built (`## Fire`, `## Exposure...`, `## Derived sky`) | S | low | yes in small form |

## 2. Merged duplicates

- Rest framing (W) and Morrowind's shared pool (M) both map to position/rest: rows 25 and 58.
- Koster's "players decode formulas" (K), Morrowind's levelling break (M) and the audit's growth-window deferral (A) are one lesson: rows 4, 6, 12.
- Hidden elites (K), "secret" owner rule and SWG trees (M, A) are one item: row 14.
- Hub clusters (W) and "few handcrafted quests" (R) are rows 52 and 64, kept apart because one is layout and one is count.
- Tangible lore (R) and macro-landmarks (W) both lean on room/detail text but ask different things: rows 60, 68.

## 3. Top 10: not-yet-built adoptions for the prologue, by value per cost

All are S unless noted. "Not yet built" means status Partly or content-only, since each needs prologue content or one proof, not new engine. Ranked highest value per cost first.

| Rank | Adoption (row) | Why it ranks here | Cost / writing |
|---|---|---|---|
| 1 | The quest is the box (9, 10) | Teaches all four basics with installed mechanics; story clock equals the quest log. Needs one sampler to prove `skill_compare` objectives plus `hand_over` plus `skill.acquire`. | S / med |
| 2 | Failing forward on checks (66) | One `then_failed` branch per check turns dead ends into scenes. Cheap, high feel. | S / med |
| 3 | Permanent world verbs as quest rewards (63) | `quest_resolved` plus `barrier.set` or a recipe. Makes rewards felt with no coin. | S / low |
| 4 | Rested and warm hearth status (58) | Positive framing of rest; the `rested` event already applies a status. Natural fit for beat 12 (first fire). | S / low |
| 5 | Looping geography back to the hub (67) | A map and barrier choice; no code. Gives the Grove a mental map. | S / med |
| 6 | Hub clusters with one breadcrumb out (52) | Pacing for 48 beats in five parts; stage hints exist. | S / med |
| 7 | Afflictions with consequences (61) | Edge sickness, cold, thirst can slow movement or hush perception via statuses already built. | S / low |
| 8 | Danger gradients by sense cues (57) | Edge, Thinning and Understory rooms warn before the player steps in. | S / med |
| 9 | Quiet leaning choices as facts, no display (70) | Outline already lists four such choices; only fact wiring and a no-UI check. | S / med |
| 10 | Once-a-day power for Thera's resonance (21) | `cooldown` exists; gives one signature verb. Never gate required beats on it. | S / low |

Near misses: macro-landmark text (60), world-anchored crafting at Kira's hearth (59), knowledge-unlocked topics (55). They are as cheap but mostly writing load, which is the owner's bottleneck; the ranking is by value per engine cost, so they sit just below. The one engine item worth watching is row 50 (delayed move, M); fund it only if a beat needs it.

## 4. Lessons that conflict with owner rules or direction

| Lesson | Source | Conflicts with | Note |
|---|---|---|---|
| Treat hidden elite requirements as public; give each a discoverable path | K | Owner rule: hidden elite professions are secret, a hidden skill shows nothing until the player qualifies | Real conflict. Koster's point (cartridge data on the phone is readable) is a security fact; the owner chose secrecy. Elites are post-landing. |
| Trainers sell points; fee-based guild hall first; Morrowind trainer pipeline | M, A | Owner rule: prologue boxes are gifts or labour, no coin, no houses or guilds until the landing | Already resolved by A finding 1. Do not build the fee hall in the prologue. |
| Economy ledger, buyback caps, global market, faucets and sinks | K | Prologue outline: "no economy"; no coin | Tools exist but have nothing to measure in the prologue. |
| Authored text is expensive, so lean on systems and community content | K | Owner rules: the owner writes every player-facing word; agents add structure only | Fine as a budget rule. Reject any "fill gaps with generated text" reading; runtime LLM text needs a new owner decision. |
| Agent-written sample lines (Gemini notes) as content | W, R | Same prose rule | Reference only. Names like Seren, Maren, Dov match the outline, but the prose does not ship. |
| "Rested" or once-a-day mechanics that make players wait | W, M | Owner rules: no required idle waits in the opening; fixed time with no time skips | Allowed only as optional bonuses. Never as a gate. |
| Interrogation by the night watch after forcing a chest | R | Prologue has no law, theft or town guard (Theft/Arrest rows exist but the outline has no watch) | Use a prologue-native complication instead. |
| Class chosen after trying basics | M | D11 ancestry is chosen once, immutable, before play | Not a true conflict (ancestry is not a class); check the prologue does not add an early class pick (unsure). |
| Capacity budget and surrender, six-starter roster | K, M, A | Parked to the landing by the audit | Not a conflict, but building early would contradict the owner's ordering. |
| Realm items: PvP consent, code of conduct, trust ladder, live team | K | Product scope: offline first release; Realm seams rule says do not add single-player assumptions, not build Realm | Not for the prologue. Keep as notes. |
| Fatigue loops tied to session length | K | Rule: backgrounding does not pause the world | Consistent: avoid session-length mechanics. No change needed. |
