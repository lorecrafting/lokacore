# R&D: depth, immersion and touch UX for Loka (2026-10-13)

Read-only study. Facts cite `file:line` on `lokacore` main or the `batch-m11` worktree (code through row 20b, `1bd6ed6`); proposals are marked. Toolbox row ids are from `docs/MECHANICS-TOOLBOX.md`.

## 1. Executive summary

1. The engine's vocabulary (tags, statuses on anything, reactions on every event, entity/pair facts, derived sky, variants, senses, locks) is now rich enough that most "depth" the state of the art shows is content plus one or two small leaves, not new families.
2. The largest single-player depth gap is **time-displaced consequence**: there is no delayed reaction (`after`) and no `time_since` leaf, so karma, grudges and history cannot "come back later" without a hand-built fuse status (Beads `loka-lvno` found the same).
3. The largest immersion gap is **the character's inner voice**: skills and attributes gate and roll but never *speak* (Disco Elysium's passive checks). One leaf (`skill_compare`, already on G1's candidate list) plus W6 variants gives it.
4. The second immersion gap is **opportunity**: everything is place-anchored; a quality-based storylet layer (Fallen London, 80 Days) drawn by hash would make the world offer things to the player.
5. NPC depth should stay event-driven (trap 2): NPC–NPC pair facts and relationship reactions give Wildermyth-style drift between NPCs with zero simulation.
6. The Book is blocked on **one component**: text/word input (`loka-kgd.72`, `.77`, `.82`); speech, use-on and spells are kernel-only. The mock's rejected "drawer and chips" now has three live consumers.
7. Touch play is below the state of the art in **word-tap** and **long-press verb** interaction; the inline touch-link decision already permits it.
8. Accessibility is strong on labels and contrast, absent on **dynamic type, live-region announcements and haptics** (no `fontScale`, no haptics dependency, `mobile/app/package.json`).
9. Multiplayer readiness: the kernel is single-character by type (`World.character`, `GameView.actor_id`), the clock is device-owned, speech is pre-moderated by design, and nothing is instanced. All are known and recoverable, but five concrete seams should be decided before M15.
10. Tooling: balance diagnostics are planned; **prose and story tooling** are not (no dialogue/scene DSL, no prose lint, no readable run export), and designer wording approval is a visible bottleneck.

## 2. What Loka already does well (evidence)

- Composition discipline: a mechanic reads shared facts and requests typed consequences; the fire sampler (W22) opened a door "nobody wrote a rule about" as pure content (`docs/system/mechanics.md` "Fire").
- Reactions on every registered event with FIFO delivery to quiescence under budgets (`kernel/ts/src/mechanics/reaction.ts:2-3`, `:105`); traps list keeps it bounded (`MECHANICS-TOOLBOX.md` "Traps").
- Deterministic variety without RNG spend: W7 alternates by `(command id, key)` hash; row 31 derived weather; W6 entity variants.
- Memory that is bounded by declaration: W2 entity/pair facts, W3 rumour by co-presence, D10 discovered places with `last seen`, codex and deduction (row 46), away recap (W27).
- Honest time: fixed-rate elapsed authority, due work before input, catch-up receipts (`mechanics.md:212`; owner fixed-time and background-time decisions).
- Book: label-in-name WCAG 2.5.3 rule (`docs/system/book-ui.md:174`), 4.5:1 text roles in all four palettes, reduced-motion fallback, keyboard movement, 44 px `Tap` bleed, every string in `LABEL` or the cartridge.
- Playtest culture: blind AI playtest per district (`loka-y6yg.7`), "told vs found" protocol (`docs/showcase/cause-and-effect.md:142`).

## 3. Mechanics gaps (ranked)

Size S < 1 day, M a few days, L a week. SP = single player; R = Realm.

| # | Gap | Why it matters | Compose from | Size | SP/R | Placement |
|---|---|---|---|---|---|---|
| 1 | **Delayed reaction** `after {real minutes}` on a reaction step, and a `time_since {fact, at_least}` policy leaf | Consequences that arrive later are what make a world feel like it remembers (King of Dragon Pass, Kenshi). Today a "fuse" needs a bespoke status; `loka-lvno` names both gaps | reaction@1 + engine job (`mechanics/bleed/job.ts` shape); fact rows already carry logical time for W23 `started_at` | S | SP+R | New row in M12 (world events), before 37a |
| 2 | **Passive skill voices**: `skill_compare {skill, at_least}` leaf (G1 candidate, unbuilt) read by W6/W7 variants and a room/detail `asides [{when, text}]` list | The character's mind narrating is the single most-praised immersion device in modern RPG text ([Disco Elysium: passive checks, voices scale with skill](https://www.thefandomentals.com/disco-elysium-redefines-stories-rpgs/)). Everything else exists; no roll, no state | G1 leaf set; `description_variant/rule.ts`; skills@1 use counts | S-M | SP+R | M13 first row (cheap atmosphere before law) |
| 3 | **Storylet deck**: cartridge `storylets [{when, weight, scene or dialogue}]`; on `entity_entered_room` or `clock_hour` the engine picks by hash (W7 pattern) one holding storylet, offered as an Action card ("A stranger beckons…") | Quality-based narrative ([Short: prerequisites, results, opportunity deck](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/)) is how 80 Days and Fallen London feel inexhaustible; Loka's scenes are place-anchored | scene@1 presentation-only, dialogue@1, W1 triggers, W7 hash, policy leaves | M | SP+R (per-player draw) | M12 after 37b; the showcase social district as sampler |
| 4 | **NPC–NPC pair facts** (W2 `pair` currently NPC×character only) plus reactions keyed on both | Rivalries, debts and romances among NPCs without simulation (Wildermyth: "characters impact the world, visibly"); W10 cases and W6 variants render them | `mechanics/fact.ts` pair scope; W3 co-presence | S | SP+R | M12 beside W12 |
| 5 | **Witness ledger**: `attack_result`, `item_acquired`, `spoken` reactions that write pair facts on co-present NPCs (G6 senses as range) | Row 33 "witnessed offense" is law-only; gratitude and grudge are the same primitive and feed trap-8 consequences (lines, prices, dispositions) | W1, W2, G6, G11 | S (content + one `witness` trigger filter) | SP+R | M13 with row 33 |
| 6 | **Chronicle**: a Journal "Chronicle" projection built from receipts' narration keys and `story_point_reached`, grouped by game day | Dwarf Fortress legends / [Caves of Qud history](https://gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves) show that recounting a run is itself play; nothing stored, W27 already groups receipts | `view/`, W27 recap, codex 46 | M (view) | SP; Realm "legends" later | M15 with 48a export |
| 7 | **Ask about topic** verb: `ask {npc, topic}` resolved by topics@1 facts, falling to an authored "knows nothing" line | Knowledge play (Roadwarden): the player carries questions between NPCs; today only authored dialogue choices or a `say` keyword | dialogue@1 `keyword`, topics@1, G4's generic-verb shape | M | SP+R | M13 after W15 recognition |
| 8 | **Ambient sensory lines by sky × hour** as content on W7 alternates + `sky` and `time_window` leaves | Sunless Sea and 80 Days make weather felt in prose; rows exist, no sampler composes them | content only | S | SP+R | Content row in M12 showcase |
| 9 | **Earned titles / epithets**: codex badge → displayed-name variant | Player expression without free text (trap 9); Achaea titles | row 46 badges, W15 displayed identity | S | SP+R | M13 with W15 |
| 10 | **Ghost-walk death** (`loka-kgd.69`) and **barter** (`loka-kgd.70`) | Already requested; barter is the natural Homestead gifting dual | death@1 relocation; commerce exchange | M each | SP+R | kgd.69 M15 beside 47; kgd.70 Homestead |
| 11 | **Companion remarks**: a G8 member's `asides` (gap 2's list) read on room entry | Companion banter is the cheapest emotional hook (Wildermyth, Baldur's Gate) | G8, G6 cue reader, W6 | S | SP+R | Homestead or M14 with 45 |
| 12 | **Instancing** (spec 21 §19 InstancePlan) | Realm requirement: per-party quest spaces; SP gains nothing | archived contract | L | R only | Batch Realm, decision record first |

Not proposed, by owner rule: any wait or sleep that skips time (fixed time); selectable difficulty or "story mode"; NPC needs/utility AI (trap 2: all of the above are event-driven); procedural prose (trap 4: every line above is authored; LLM uses stay presentation-only per `docs/rnd/ai-world-shaping-2026-10-11.md` ring 2).

## 4. Narrative and content tooling gaps

1. **Dialogue/scene DSL** (proposal): an Ink-like text front-end compiled to the existing JSON by `mix loka.compile`; YAML is already allowed later (owner R4). Dialogue graphs in JSON are the slowest authoring path and the hardest to review in a PR diff. Size M; no engine change.
2. **Prose lint** over `text.json`: repeated openers, sentence-length spread, alternate coverage per key (W7 keys with one alternate), band-phrase coverage, reading level. Builds on balance N6; S.
3. **Readable run export**: `loka play --replay` to a Markdown story (room, lines, choices) so a reviewer reads a sim run as a novella and judges variety. S; reuses transcripts.
4. **Designer wording queue**: at least `loka-x6t.14`, `loka-kgd.30`, `loka-kgd.112` wait on wording; a batched "wording PR per batch" step in the toolbox process would close them in one designer run.
5. **Generation with safeguards**: adopt the first three experiments of `docs/rnd/ai-world-shaping-2026-10-11.md` A5 (hand-authored "boss opens area", dial probes, offline AI district with compile-repair loop) as a tooling row; nothing runs inside the kernel.
6. **Sim reach**: `loka-lmvc` (aim attacks, answer choices, elapsed steps) gates every dynamic-coverage tool in the balance study; it should precede them.
7. **Content graph + reachability** (balance R1/R2) is the enabling layer for the rest; still unscheduled in Beads beyond `loka-kgd.107`.

## 5. Multiplayer-readiness risks in current designs

| Risk | Where | Why it hurts the Realm | Cheap mitigation now |
|---|---|---|---|
| One character per world: `World.character: CharacterId` and `actor === world.character ? world.body` | `kernel/ts/src/runtime/decision.ts:126`, `:184` | Every rule that reaches the body through this helper is single-player; `GameView.actor_id` is one actor (`contracts.gen.ts:128`) and the Book draws "no fabricated player rows" (`book-ui.md` "Future boundaries") | Owner puppeting rule already says "read the actor from the command"; add a lint that forbids new `world.character` reads outside view/authority |
| Party credit hard-codes "the player's body or a listed ally" | `kernel/ts/src/mechanics/combat/credit.ts:122` | Contested kills between two players need a declared contract (owner Story/Realm decision names "party credit" explicitly) | Write the credit contract as data on G8 groups before 45/S4 |
| Legacy reaction triggers keep the root actor | `kernel/ts/src/mechanics/reaction.ts:282` | A reaction fired by player B's event attributed to player A's command | W1's "declared subject per event" rule should be made total before 37a |
| Clock is device-owned: `AppState` pauses pulses (`mobile/app/App.tsx:161-176`), web tab occlusion stopped time (`loka-x6t.28`); `stepElapsed` trusts the authority's `from/until` | `kernel/ts/src/runtime/world.ts:162-175` | A Realm must own `elapsed`; clients that compute catch-up locally will diverge | Keep `elapsed` authority-only (already); document that the Realm authority issues it and the client never does |
| Speech is one 32-letter ASCII word that never reaches narration | `mechanics.md` "Social verbs" | Right for trap 9 in SP; the Realm needs sentences plus a moderation seam; emotes deferred | Decide now that Realm speech is a distinct capability key (`speech@2`), per the shared-mechanics decision |
| No instancing; populations and quests are per world, quest scope `instance` vs `player` | `mechanics/population/`, `mechanics/fact.ts:24` | Two players kill the same unique boss; row 37a spawns once per cycle per world | AudiencePolicy already has `party` and `instance` kinds (`contracts.gen.ts:306`): a GameView audience filter is a view change, instancing is the L item (gap 12) |
| Receipts lack `result_digest` | `docs/system/DIFFERENCES.md` row 1 | A server cannot verify a client's claimed replay | Scheduled for R12; pull forward before any AI or Realm input is trusted |
| Ownership rows are pair facts (G7, M11) | row G7 text | Fine for SP; the Realm needs transfer, inheritance on account loss and griefing rules (stolen provenance exists) | G7's "wanted player's property stays theirs" is the right seed; record transfer semantics in the G7 mechanics section |

## 6. Touch/mobile UI/UX innovations (ranked)

Native items (haptics, notifications, Live Activities, dictation) respect the mobile pause: design and token them now, ship web fallbacks, build native when the owner resumes.

| # | Innovation | Extends / new | Effort | Accessibility |
|---|---|---|---|---|
| 1 | **Word input**: a bottom "Say" bar with recent-word chips, reusing the Riddle letter bank for keyboards-off play; same bar serves `use X on Y` (target chips) and `cast` | New row "Word bar" (the mock's drawer with live consumers: `loka-kgd.72/.77/.82`) | M | Needs `TextInput` labels; chips are buttons; good |
| 2 | **Long-press verb sheet**: long-press an Entity line, Fixture link or item to open its offered actions as a bottom sheet (ActionSet, same freshness token); tap still opens the detail | New "Verb sheet"; Entity line, Fixture link | M | Must stay a shortcut: detail pages remain the accessible path; sheet gets a dismiss Control |
| 3 | **Word-tap in log lines**: narration participants are bound at commit (`NarrationRecord`), so names in log lines can be links like room fixtures (inline markup already allowed) | Log line, Fixture link | S-M | Links need role and ", open" names |
| 4 | **Dynamic type**: scale `type` by `PixelRatio.getFontScale()` with a cap, plus a Reading size setting beside Sound; status line already needs a wrap plan (`loka-kgd.7`, `loka-15g`) | tokens.ts `type`, Status line, Settings | S-M | High: fixed 17 px today (`tokens.ts:84`) |
| 5 | **Live-region announcements**: new World log lines, combat rounds and refused lines announced; condition changes on the status line | Log line, Status line, Combat page | S | High (screen readers hear nothing new today) |
| 6 | **Haptics as tokens**: page turn tick, refusal buzz, danger on hp band drop, bleed tick, deadline minute | tokens.ts `haptic` (beside `sound`), Settings toggle | S (web: Vibration API; native later) | Multimodal per Apple HIG |
| 7 | **Honest background notices**: a local notification when a W24 deadline or 20b job completes while backgrounded; iOS Live Activity for the countdown | New App-level driver next to `useElapsed`; no new Book component | M (native, local only, free) | Respects "backgrounding does not pause"; opt-in setting |
| 8 | **Reopen card**: on return, the away recap block (W27) plus "You were: <room>, <quest stage>" from the Journal | Away recap | S | Good |
| 9 | **Progressive scene reveal**: a scene's lines appear one tap at a time with the Continue button; protects reading speed where the owner wants intentional timing | ScenePage, Continue button | S | Reduced-motion safe (no animation) |
| 10 | **Swipe-to-move on the prose body** as a second gesture to the joystick (edge swipes = compass) with the same captured exits | Room page, joystick | S | Keyboard path exists; announce destination |
| 11 | **Map pins and notes** (G10) with pinch zoom | DiscoveredMap | M | Pins need names |
| 12 | **Dictation into the Word bar** via the platform keyboard; no custom model | Word bar | S | Alternative input |
| 13 | **Contextual first-time tips** from W23's `tip` field (engine-side exists) | Tip | S | Good |
| 14 | **High-contrast ink toggle** independent of the in-game palette | tokens, Settings | S | High, but see conflict note below |

## 7. Recommended next ten additions, in order

1. **Delayed reactions + `time_since` leaf** (gap 1): one small engine row that turns every existing consequence into a possible later one.
2. **Word bar in the Book** (UX 1): unblocks three finished kernel mechanics and all social play.
3. **Passive skill voices** (gap 2): the cheapest large immersion step; one leaf, content otherwise.
4. **Long-press verb sheet + word-tap log lines** (UX 2, 3): the touch idiom MUD text deserves; reuses freshness and labels.
5. **Dynamic type, live regions, haptic tokens** (UX 4-6): the accessibility trio, each a day.
6. **NPC–NPC pair facts + witness ledger** (gaps 4, 5): relationships and grudges without simulation.
7. **Storylet deck** (gap 3): opportunity layer on scenes and dialogue.
8. **Content graph, reachability, prose lint, readable run export** (tooling 2, 3, 7): the authoring loop for a bigger world.
9. **Chronicle view + reopen card** (gap 6, UX 8): the player's own history as a page.
10. **Multiplayer seams record**: one decision record covering actor attribution, credit contract, Realm-owned elapsed, `speech@2`, audience filtering and `result_digest` (section 5), so M12-M15 rows stop adding single-player assumptions.

### Owner-decision conflicts to surface (not proposed silently)

- UX 14 (contrast toggle) and UX 4 (reading size) touch the "no Settings override for the palette" ruling; reading size is not a palette override, contrast arguably is. Owner call.
- Native UX items (6, 7, 12) are planned under the mobile pause; web fallbacks only until the owner resumes native work.
- Any LLM narration or companion (`loka-u5vi`, `loka-e97d`) conflicts with trap 4 unless presentation-only and uncached in state; this document assumes that line holds.
- Gap 7 (ask about topic) and UX 1 stay one-word input in SP (trap 9); sentences are a Realm capability.

Sources: [Emily Short, quality-based narrative](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/); [Short, high-agency systems](https://emshort.blog/2017/05/25/mailbag-high-agency-narrative-systems/); [Grinblat, Procedurally Generating History in Caves of Qud (GDC)](https://gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves); [Grinblat and Bucklew, mythic biographies (FDG 2017)](https://pcgworkshop.com/archive/grinblat2017subverting.pdf); [Disco Elysium skill voices and passive checks](https://www.thefandomentals.com/disco-elysium-redefines-stories-rpgs/); [Evennia lockstrings](https://www.evennia.com/docs/3.x/Components/Locks.html); [David Dunham interview, King of Dragon Pass](https://loading.journals.publicknowledgeproject.org/index.php/loading/article/view/166); [Wildermyth design critique](https://cannibalhalflinggaming.com/2022/01/12/a-glimpse-into-the-vault-wildermyth/); [Apple Core Haptics (WWDC19)](https://developer.apple.com/videos/play/wwdc2019/520).
