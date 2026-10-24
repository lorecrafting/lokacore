# Design audit: abilities, authoring language, prototype inheritance (2026-10-23)

One-pass independent audit of the day's design work. No code, no Beads, no PRs. Judged:
[abilities design](../game-design/abilities-design-2026-10-23.md),
[abilities lore](../worldbuilding/notes/abilities-lore-2026-10-23.md),
[Morrowind note](elder-scrolls-morrowind-skills-2026-10-23.md), and two chat-only proposals
(an area authoring language; compile-time `extends`). Decided today and not reopened: SWG trees;
prologue teaches basics to all; houses and guilds wait for the landing; prologue boxes are earned
by gifts and labour under the quest system, no coin before descent stage 4.

## 1. Verdict

The abilities design is sound and mostly built on installed mechanics; its build order is aimed at
the wrong place (a fee-based guild hall) when the owner aimed at the prologue. Three of its
"verify" items resolve now (two yes, one no). The authoring-language proposal names real pain but
the cure should be sugar on today's source, lowered by the one compiler, not a new grammar. Prototype
inheritance fits in one place and needs no loader twin. The plan below is content and compile-time
first; the only engine rows wait for a measured failure.

## 2. Findings, ranked by impact

Each finding: what, evidence, what to do.

1. **Slice 0 builds the wrong thing first (contradiction with today's decision).** Design §8 slice
   0 is a "guild hall" with fees, a master title and a hidden elite. The owner aimed the design at
   the prologue (§11): free basics, no coins, no houses or guilds. Fix: slice 0 is one prologue
   basic (Tending) built as quests; the guild hall waits for the landing.
2. **Error: item reagents cannot reuse `craft.consume` on a spell.** §3.4 says "if the loader
   allows". It does not: a craft block on a spell or storylet target is refused
   (`kernel/ts/src/content/cartridge_replenish.ts:33-34`, "craft recipes are station recipes").
   Reagents stay pools (29a ruling) until the consumed-holder change (`loka-kgd.83`). Fix the text.
3. **Over-built: the growth window is first in the engine order with no evidence of need.** Use
   counts already saturate: `uses_<key>` has maximum the last `growth` entry
   ([skill growth](../system/mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5)),
   so a rating-1 chest cannot grind forever; it can only reach the box's top level. The prologue
   first-hour rule (§11) wants every rating passable anyway. Defer the window to a playtest that
   shows the grind; gate higher boxes on prerequisites and deeds (content).
4. **Over-built for now: capacity and surrender (§1.5).** Surrender touches save recovery
   (`skills-save.ts`, §9 table). The prologue has 20 free boxes and no cap. Design it (done), build
   it at the landing.
5. **Verified yes: a spell's `learned` may name a box fact.** The compiler merges the engine's
   `skill_<key>` facts into the definitions before the spell check runs
   (`lib/loka/content/compiler.ex:222-231`, `:109`), and the check wants a bool player fact
   (`lib/loka/content/spells.ex:51-67`), which `skill_<key>` is. Not run; prove with the sampler.
6. **Verified yes: a lesson can take a gift.** A gift to the teacher is `hand_over` (the player
   gives, [mechanics](../system/mechanics.md)); `receive` is the reverse: Aldous gives the player a
   training sword with `skill.acquire` in one choice
   (`cartridges/toolbox_showcase/dialogues/aldous_lesson.json`). A choice without
   `lesson_payment` may grant one skill and take no payment (`lib/loka/content/skills.ex:313-316`);
   the dialogue `check` and `accept` refusals (`lib/loka/content/dialogues.ex:301-307`) do not
   apply; still a sampler case. A reaction has no `skill.acquire` step
   (`protocol/reaction.schema.json` ReactionRule.apply: 16 ops), so §11 option B is engine, as said.
7. **Missing: the quest can be the box.** A quest objective is any `current_state` policy
   (`protocol/quest.schema.json`), so "learn Tending" can be an objective (`skill_compare`), its
   journal stage hints tell the player what to practise, and `quest_resolved` reactions set the
   descent stage facts. This makes the story clock equal the quest log with zero engine. §11 has the
   pieces but routes them the other way (quest first, then the lesson). Either order works; this one
   needs fewer facts.
8. **Risk: two rosters.** §1.1 proposes six starters (66 to 84 boxes at §1.2's shape); §11 proposes
   20 prologue boxes. Per box today: a skill file (about 25 lines, `skills/carving.json`), a dialogue
   choice, three to five text entries, an aside. Mark the six-starter roster as landing-stage so no
   one builds 80 boxes before the first 20 are played.
9. **Ritual (§3.6 A) is consistent with FD1.** The fired rule re-reads `when` for the stored actor
   and an untargeted status lands on that actor's body
   ([FD1](../system/mechanics.md#delayed-reactions-toolbox-row-fd1), Known limits), so a
   `status_active {subject: self}` guard works. Sampler, not engine.
10. **Lore and research notes: no errors found.** The lore note keeps proposals marked as such and
    separates coin fees (landing) from gifts (ark). The Morrowind note tags each source; UESP
    numbers came through a summarizing fetch and are flagged as such. Keep both as drafts until the
    owner accepts names.

### Authoring language (chat proposal)

11. **The six ACTS parity scenarios are already expressible in today's JSON, save one step.**
    Password doorman: `spoken {npc, word}` trigger plus `barrier.set`. Alarm guards: `witness`
    filter plus `npc.move`
    ([FD5](../system/mechanics.md#witness-ledger-and-reaction-moves-toolbox-row-fd5-loka-kgd22):
    "brings the crow down from the roost"). Tile-order trap: the showcase wheel rules
    (`action_completed` plus `fact_compare` chains, `reactions/wheel_2_x_shows_7.json`). Moon ritual:
    `sky` and `time_window` leaves plus FD1 `after`. Barrage ruining rooms: room description
    `variants`, a status on a room, `barrier.set`. Cross-area fetch with a multi-day craft: a quest
    plus escrow `ready_after`. So the pack measures authoring weight, not capability.
12. **One real engine gap the pack will hit: a `wait` cannot end in a move or a door.** A rule with
    `after` may not carry `barrier.set`, `item.move`, `npc.move`, `quest.*`
    ([FD1](../system/mechanics.md#delayed-reactions-toolbox-row-fd1), "Event-bound steps refused";
    the job stores no subject, `loka-v86w`). "Guards arrive a minute later" and "the door shuts after
    the password" need that row. Fund it only when the pack shows it.
13. **Inter-rule messaging exists; a `signal` step is sugar.** Reactions cannot emit a
    `custom_event` (no `event.emit` in ReactionRule.apply; only a recipe step emits one,
    `protocol/action.schema.json` RecipeStep), but a reaction's `fact.assign` or `fact.adjust`
    emits `fact_changed` and "the resulting events trigger further rules, FIFO, to quiescence"
    ([reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts)). Lower `signal
    x` to `fact.adjust` on a compiler-made bounded int `signal_x` and `on signal x` to
    `fact_changed signal_x`. Zero engine. Limit: the int's maximum; the compiler picks a large one.
14. **Zones: rooms carry `tags` and policies read them; triggers do not.** `protocol/room.schema.json:495`;
    `has_tag` leaf (`protocol/policy.schema.json`); the `entity_entered_room` trigger filters one
    `room` only. Lower a zone rule to one rule per tagged room at compile time (63 rooms in the
    showcase). An engine filter waits for a measured budget problem.
15. **A new grammar fights two standing facts.** The owner already chose "YAML source after JSON"
    ([future](../system/future.md#authoring-and-certification)), and LLM drafting already has its
    JSON plus compile-and-repair loop ([AI world shaping](ai-world-shaping-2026-10-11.md) §1). A
    parser, its error mapping, docs and a second syntax for every agent is L for a gain the sugar in
    finding 17 gives at S-M. Keep the runtime declarative (right call; archived spec 08 "closed
    semantics, open composition"; the pure-kernel lint).
16. **Several proposed tools exist already.** Live reload: `bin/loka dev --watch` reloads the web
    Book in seconds ([builders guide](../BUILDERS-GUIDE.md#preview-an-edit)). Walkthrough
    transcripts: `cartridges/*/transcripts/*.jsonl` replay byte for byte
    (`kernel/ts/test/transcripts.test.ts`), plus browser walks. Facts read but never written and
    unreachable quests: `reach.ts` reports `orphan_facts` (`unused`, `write_only`, `read_only`) and
    `unreachable` ([content reports](../system/cartridge.md#content-reports)). Author lints:
    `mix loka.lint` (`lib/loka/content/lint.ex`). New and worth building: dead rules by evidence
    (finding 23) and the rule explainer (finding 22).
17. **The real authoring weight is sprawl and two-place text, not JSON.** The showcase is 594
    files: 140 reactions (12 to 54 lines, median 20, one if-then each), 139 items, 63 rooms, 42
    NPCs, 22 dialogues, 11 skills, 7 transcripts; `text.json` holds 1632 entries, so every line of
    prose lives in two places. Fix at compile time, in the existing format: a bundle file per area
    (several kinds in one file), inline prose lowered to generated keys, `extends`, `signal`, `zone`.

### Prototype inheritance (chat proposal)

18. **Resolved: there is no shared source-reading entry point, and that is good.** The Elixir
    compiler reads the directory (`Loka.Content.Source.load/1`, `lib/loka/content/source.ex:52`);
    the TypeScript loader reads only artifact bytes (`loadCartridge`,
    `kernel/ts/src/content/cartridge.ts:60`); the author preview shells to `mix loka.compile`
    (`kernel/ts/play/author.ts:55`). A flattening pass sits once, under `Source.load`, so `mix
    loka.lint` and the compiler see the same flattened view and the artifact never carries
    `extends`. No loader twin, no protocol, save or GameView change. Consequence: no on-device
    authoring, which is already a known gap (AI world shaping §1).
19. **The NPC gain is modest; the reaction and box gain is larger.** `den_goblin.json` is not a pure
    copy: 12 of 26 lines differ (room, text keys, one variant). Inheritance saves about ten lines
    per such NPC. The 140 one-rule reaction files and the near-identical box files
    (`skills/carving.json` differs from its siblings in three values) gain more from parameterized
    bundles (finding 20).
20. **Behaviours change rule order; name the keys.** Reactions run in rule-key order
    ([reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts)), so generated
    keys decide semantics. Fix the scheme (`<instance>__<behaviour>__<rule>`) and document that a
    behaviour's rules sort together under the instance. Each instance also needs its own text keys
    for lines that name the NPC, so a behaviour's parameters include text.
21. **Over-built: two merge grammars.** "Scalars and lists replace, explicit `+list` append" is two
    rules. Ponytail: objects merge key by key, everything else replaces; a child that needs one more
    list item restates the list. Add append when a real case asks. Keep `abstract`, cycle and
    missing-parent refusal, and provenance: the diagnostic `path` grammar is file-relative
    (`protocol/cartridge.schema.json` Diagnostic), so a flattened field carries its parent file in
    `data.from`.

### Tools worth adding

22. **"Why didn't this rule fire" needs a replay, not a receipt.** A receipt stores the Command and
    DecisionResult ([receipts](../system/save.md#receipts)), not rule evaluations. The kernel is
    pure and replay is deterministic, so a play tool in the `friction.ts` pattern can replay a
    transcript to a step and report, per rule: trigger matched or not (which filter failed), and
    each `when` leaf's value. No contract change.
23. **Dead rules by evidence.** Static dead-rule analysis over policies is hard; coverage over the
    area's transcripts is cheap: which reactions, recipes, choices and quests no transcript ever
    exercised. The area checklist already says a rule a script can decide belongs in a check
    ([area authoring](../guides/area-authoring.md)).

## 3. Novel approaches (grounded, at most six)

| # | Approach | Grounded in | Buys | Cost |
|---|---|---|---|---|
| A | **The quest is the box.** Each prologue box is a quest whose objective is `skill_compare` on the box; journal stage hints say what to practise; the teacher's choice takes the gift (`hand_over`) and grants (`skill.acquire`); `quest_resolved` reactions set descent-stage facts that room `variants` and `sky` read | quests, hs-11, FD2, W6 variants, row 31 sky; `aldous_lesson.json` | stability (installed mechanics only), the story clock equals the quest log | S content |
| B | **Signals as counters, zones as expansions.** `signal` lowers to a synthesized bounded int plus `fact.adjust`; `on signal` to `fact_changed`; a zone rule expands to one rule per tagged room | reaction@1 cascade to quiescence, room tags | extensibility, morphability (retag a room, the zone follows) | S compile-time |
| C | **Area bundles with inline prose and `extends`.** One file per area; prose inline, keys generated deterministically from the path; boxes and spell tiers from templates; merge rule: objects merge, else replace | `Source.load`, the text catalog, the artifact hash as proof of equivalence | buildability (one place per line of prose), morphability (retune a tier once) | M compile-time |
| D | **Byte-identical lowering as the gate.** Re-express an existing sampler in sugar; its artifact must hash the same as the JSON original | content hash, known-answer fixtures | stability: the sugar provably changes nothing | folded into C |
| E | **Rule explainer by replay.** `why.ts <artifact> <transcript> <step>`: replays, then lists each rule with its trigger match and `when` leaf values at that step | pure kernel, deterministic replay, `friction.ts` | buildability, stability | M TS tool |
| F | **Transcript coverage as the area's acceptance.** `coverage.ts`: definitions no transcript of the cartridge exercises; an area ships green only with every quest resolved and every reaction fired at least once in its transcripts | `transcripts.test.ts`, walks | stability; dead rules by evidence | S-M TS tool |

Not proposed: a runtime interpreter (rejected, right), a new grammar (finding 15), an engine
`signal` step or zone filter before B is measured.

## 4. Plan

Serves: S stability, B buildability, E extensibility, M morphability. Contract columns name
protocol, save and kernel_api; "none" is explicit.

| Phase | Deliverables | Size | Contract | Depends on | Gate | Serves |
|---|---|---|---|---|---|---|
| 0. Correct the drafts | Fix §3.4 reagents (finding 2); re-aim slice 0 at the prologue (1); park the six-starter roster, capacity, surrender and the growth window to the landing with their reasons (3, 4, 8); two decision records: prologue gifts not fees, Skills on Character collapse | S docs | none | owner answers below | docs merged; every "verify" in the design has a cited answer or a sampler case | S |
| 1. Prologue sampler, Tending | `cartridges/prologue_sampler`: Tending novice plus two branches of two (5 boxes) as quests (A); gifts by `hand_over`; one labour box (a deed counter from `action_completed`); `lux` with `learned` = a box fact; the descent-stage facts driving one room variant and the sky; one ritual (§3.6 A); a transcript and a phone-width walk | M content | none | 0 | transcript replays byte for byte; every box learned and every quest resolved in it; `reach.ts` shows no `write_only` fact; `mix loka.lint` clean; record lines and files per box as the baseline | S, B |
| 2. ACTS parity pack | `cartridges/acts_sampler`: the six scenarios in today's JSON, one transcript each; a table of lines and files per scenario; the alarm scenario's delayed move recorded as refused | S-M content | none | none (parallel with 1) | five of six replay; the sixth names the FD1 refusal and `loka-v86w` | E |
| 3. Source sugar in the compiler | Under `Source.load`: bundle files, inline prose, `extends` (objects merge, else replace; `abstract`; cycle and missing-parent refusal; `data.from` provenance), `signal`, `zone`; docs in cartridge.md Compiler; lint reads the flattened view | M Elixir | none (artifact unchanged) | 1, 2 as baselines | phases 1 and 2 rewritten in sugar hash byte-identical to their JSON originals (D); at least 40 percent fewer lines and 70 percent fewer files against the phase 1 baseline | B, M |
| 4. Tools | `why.ts` (E) and `coverage.ts` (F) as play tools; `coverage.ts` on the showcase listed in content reports | M TS | none | none (existing samplers and the showcase's transcripts) | `why.ts` explains one deliberately broken guard edited in-test into an existing sampler; `coverage.ts` names the showcase's never-fired reactions | S, B |
| 5. Prologue roster | The other three basics (Making, Guarding, Words) in sugar: 15 more boxes, ark teachers, the companion sparring, the light word the night the light dies | M content | none | 3 | one blind playtest at phone width before the owner plays; every box reached in its transcript; refusal report `per_100` not above the showcase's | S, B, M |
| 6. Engine rows, each on evidence | a. Delayed-rule subject (`loka-v86w`) lifting the FD1 refusals, when phase 2's sixth scenario is wanted; b. spell fixed `rating` check, when a prologue word needs a fizzle; c. aimed skills on the aimed-spells field after 1.119 merges | S-M each | a: save (job row gains a subject), kernel_api; b: action schema, kernel_api; c: action, command, GameView, kernel_api | 2, 5 | each row's sampler plus the parity scenario it unblocks replaying | E |
| 7. Landing | Capacity, surrender, growth window if a playtest shows grinding, six starters, houses and guilds as rank facts, coin fees | L | per §9 of the design | 5, owner's landing lore | deferred | E, M |
| 8. AI-assisted builder (owner 2026-10-23, [record](../decisions/owner-decision-authoring-builder-2026-10-23.md)) | Web app in `Loka.Builder`/`LokaWeb`: a read-only room map and rule list per room and NPC first; an AI pane that turns prose into a source diff, checked by the compiler, `reach.ts`, transcript replay and `why.ts`, previewed in the web Book; visual editing of rooms, things and behaviours after | L | none (edits source; compiles to today's cartridge) | 3, 4 | an area drafted from prose in the builder compiles clean, its transcript replays, and coverage shows every new rule fired | B, M |

Owner order (2026-10-23, paraphrased): 0, then 4 (tools), then 3 (source shortcuts) are the
foundation, built now; phase 1 and later wait for prologue lore. Phase 3's byte-identical gate
then uses existing samplers instead of phases 1 and 2. Phase 2 (the parity pack) has no slot yet:
it is a measurement, built when the shortcuts need a second baseline. Beads `loka-kgd.194`.

Audit's original order of value: 0 and 1 first (a week of content proves the whole shape); 2 and 4 in parallel;
3 only after both baselines exist, so its gate is real.

## 5. Open questions for the owner

Each is answerable in one line; the default applies if unanswered.

1. Re-aim slice 0 at the prologue's Tending basic instead of the guild hall? Default: yes.
2. Prologue boxes as quests whose objective is the skill learned (approach A)? Default: yes.
3. Park the six-starter roster, capacity, surrender and the growth window to the landing? Default: yes.
4. Authoring sugar lowered by the compiler in the existing JSON (YAML later, as decided), no new grammar? Default: yes.
5. Inheritance merge rule: objects merge, everything else replaces, no append operator? Default: yes.
6. Spell reagents stay pools until `loka-kgd.83`? Default: yes.
7. Fund the delayed-rule subject (`loka-v86w`) only if the parity pack's alarm scenario is wanted in the prologue? Default: yes.
8. The parity pack is one sampler cartridge with six transcripts? Default: yes.
9. The phase 3 gate is byte-identical artifacts for existing samplers re-expressed in sugar (owner order: phases 1 and 2 come later)? Default: yes.
10. Skills on Character: collapse each profession to a title line now, split a page at the landing? Default: yes.

Skipped: no compile or test run (the design worktree has no built dependencies and the machine was
at the load gate); every "verified" claim above is a reading of the cited lines. Not checked: the
TypeScript loader's acceptance of `learned` naming `skill_<key>` beyond its facts map carrying the
synthesized spec. Risk: finding 7's quest-as-box needs one sampler before it is relied on.
