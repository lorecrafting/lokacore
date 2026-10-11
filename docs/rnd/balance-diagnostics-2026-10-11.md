# Balancing and diagnostic tools for Loka: broad study

Read-only study, branch main @ c2b089dc, 2026-10-11. Facts cite file:line or doc section; proposals are marked. Builds on Beads epic loka-kgd.107 (.1 static ledger, .2 measured coin flows, .3 balance gates, .4 district dials), row 19b replenish and row 41 decay, which are not re-proposed.

## 0. What exists today (facts)

Reusable inputs and tools, with where they live. Everything below the table in this document is proposal unless marked otherwise.

| Asset | What it gives a balancing tool | Where |
|---|---|---|
| Compiled artifact | Every definition as canonical JSON keyed `<id>@<ver>:<kind>/<key>`: rooms, exits, barriers, items (slot, affects, tags, prices), NPCs (hp, attack profiles, resistances, loot roles, schedules), quests, dialogues, choices, facts, reactions, populations, statuses, spells | cartridge.md "Artifact and loader" (`content/cartridge.ts:110`); `mix loka.compile` |
| Numeric content tables | `world.derived` (hit_chance, damage, carry_grams, hp_max as `{terms:[{attribute, per_point, pivot}], divisor}`); `world.levelling` (thresholds, points_per_level, kills [{npc, experience}]); `ItemDefinition.affects` 1-16 `{attribute, modifier}`; attack `damage_min..max`, `crit {chance, multiplier}`, `kind`, NPC `resistances` -100..100; authored shop prices and discounts | cartridge.md "Derived stat declarations", "Item affect declarations", "B3 shop" (`:685`), "D12" (`:1400`); mechanics.md "Experience and levelling", "Damage kinds" (G2) |
| Combat rule | uniform(100) strict `roll < chance`; damage roll in inclusive interval; crit from the hit draw; order rolled, crit, resistance, sleep multiplier, HP cap; eight-raw-draw round budget | mechanics.md combat@1 (`:753`), G2 "Order" |
| Deterministic simulator | seed -> cartridge, world, 1-64 commands mostly from the GameView, invariants per step, shrinking, sequence digest; `--cartridge <artifact>`; worker batches; real-proposal sampler | `kernel/ts/test/sim.ts:1-12`, `sim_batch.ts`, `sim_sample.ts`; 10,000 fresh sequences in CI (`sim.test.ts:30`) |
| Scripted scenario recorder | fixed programs over the chapter with disposition rows and controlled refusals | `kernel/ts/test/e1_cases.ts`, `e1_dispositions.json`, `e1_refusals.ts`; e1-certification.md `:63` |
| Showcase pins | per-district scripted walks as tests | `kernel/ts/test/showcase_*.test.ts`; SHOWCASE.md matrix |
| Replayable transcripts | `loka play --replay` JSONL per cartridge, replayed in CI | BUILDERS-GUIDE.md; `kernel/ts/test/transcripts.test.ts` |
| Receipts and trace | every committed Command and DecisionResult; trace per command (outcome, delta digest, RNG, events), cap 5000; observations `evaluation.budget_exceeded`, `kernel.decision_latency`, cap 1000 | save.md "Receipts" (`store.ts:36`), "The game trace" |
| Observation format | `loka-obs-v1`, names `trace.run`, `trace.command`, `content.diagnostic`, `simulation.invariant_failed`, `target.unresolved`, `evaluation.budget_exceeded`, `kernel.decision_latency`, `agent.work`; player words redacted | `protocol/event_registry.json`; `kernel/ts/play/obs.ts:1-2`; architecture.md "Observability" |
| Budgets | eleven `LIMITS`, one aggregate counter; `query_steps` 32768 | protocol.md "Budgets" |
| Static reachability | compiler reach-from-entry for details and barrier keys (`UNREACHABLE_DETAIL`, `BARRIER_UNREACHABLE_KEY`), "authoring potential, not proof"; `TOUCH_LINK_MISSING` warnings | cartridge.md "Compiler" |
| Generated graphs and pages | `docs/system-graph.gen.json` {capabilities, edges, files, layers, nodes, saveTables}; `docs/toolbox.gen.json` rows; `docs/features.gen.md`; `docs/state-sections.gen.json` (a kernel test writes it); PR comment graph diff; Storybook System pages | `bin/system_graph.exs:1-10`, `bin/graph_diff.py:1-4`, `bin/features.exs`; docs/design/system-dashboard/spec.md |
| World numbers inventory | every hard-coded, default and content number, tagged HC/DEF/CT | docs/world-parameters.md |
| Browser walkthrough | scripted Book walks with a contact sheet of screenshots; e2e tests with a faked clock | `mobile/app/walkthrough/*.walk.ts`, `.walkthrough/contact-sheet.html`; `mobile/app/tests/*.e2e.ts` |
| Polish panel | `.polish/status.jsonl` shown in the preview; picks become Beads issues | `bin/polish_status.sh`; web-preview.md "Polish queue" |
| Playtest protocol | blind play script per district ending on "did I find out what I did, or was I told? which line told you; where did you first notice" | docs/showcase/cause-and-effect.md `:172` |
| Mutant sweeps | planted-mutant test sweeps with a results table | `bin/mutate.sh` |
| Knowledge rows | codex entries, discovered places, visited counts, rumour facts as saved state | mechanics.md D10, W7, W3 |

Tool-table columns below: **Measures | Input | Output | Reuses | New hook | Size | Value**. Input codes: **S** static over the compiled artifact, **Sim** simulator, **R** saves/receipts/trace, **T** playtest telemetry.

## 1. Items and gear

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| I1 | Item stat sheet | per item: slot, affects, derived-stat delta via `world.derived` terms, tags, mass, price, where found (placement, loot role, shop, quest reward) | S | report table per cartridge and district | affects and derived declarations; artifact maps | none | S | high |
| I2 | Slot and level budget | sum of affect points per slot and per intended level versus a declared budget; flags over-budget items | S | report + CI warning | I1 | **a stat-budget schema**: `world.gear_budget {per_slot, per_level}` and an `intended_level` tag on items (L5, L8) | S | high |
| I3 | Dominance check | an item strictly better on every affect at the same or lower price, mass and skill requirement, same slot | S | report; CI gate optional | I1 | none | S | med |
| I4 | Orphan and unused items | items never placed, never in a loot table, never sold, never a quest reward or recipe input; items placed but never reachable (uses 6.1) | S | report; `content.diagnostic` warning | compiler reference resolution, loot and placement maps | content graph export (L1) | S | high |
| I5 | Best-in-slot per level | for each slot and level, the obtainable items ranked by derived-stat delta; shows gaps (no upgrade between levels 3 and 6) | S + Sim (obtainability from 3.3) | chart per slot | I1, I2 | L1, L8 | M | med |
| I6 | Affix totals and stacking | total modifier a character can wear at once (two fingers), saturation at row-2 caps, status modifier stacking (2c) and permanent statuses (W8) | S | report | attributes@1 saturation, status modifiers | none | S | med |
| I7 | Durability and repair curve (when row 21 lands) | wear per use versus repair fee per level | S | chart | row 21 declarations | none until row 21 | S | low |

## 2. Character power

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| C1 | Power curve by level | for each level: attribute total (start + points_per_level x (level-1) + best gear), derived hit, damage, hp_max, carry via the `world.derived` tables | S | chart (level on x; one line per derived stat) | derived and levelling declarations | none | S | high |
| C2 | Allocation sweep | derived stats for every way to spend points (STR-heavy, CON-heavy, even); shows dominated allocations | S | table | C1 | none | S | med |
| C3 | Skill growth curve | skill rating after n uses, time to the next opposed-check tier | S + Sim | chart | row 5 growth tables, G5 checks | none | S | med |
| C4 | Build diversity | over purposeful sim runs: distribution of allocations and worn sets at each level; a single dominant build is a flag | Sim | histogram | levelling rows, sim | purposeful policies (L3) | M | med |
| C5 | Ancestry and starting choice balance | D11 ancestry modifiers against C1: no ancestry strictly ahead at every level | S | table | D11 declarations | none | S | med |

## 3. Progression

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| P1 | XP supply versus curve | total XP available (sum of `kills` x population caps and replenish, plus every `experience.grant` reaction) per district against `thresholds`; max reachable level; repeatable versus once | S | report + chart | levelling, population plans, reactions | L1 | S | high |
| P2 | Time-to-level | game hours and commands to reach each level under a fighter policy, by seed | Sim | chart with spread | sim, elapsed commands | L3 | M | high |
| P3 | Level versus zone difficulty | each room's encounter rating (4.2) against the level a player typically has on arrival (P2, visit order) | S + Sim | heat map by room | 4.2, P2, D10 visits | difficulty rating (L5), district tag (L8) | M | high |
| P4 | Gating and dead ends | quest and barrier gates whose unlock condition can become unsatisfiable (key consumed, NPC dead, deadline passed, fact assigned once); soft dead ends (reachable but no progress) | S + Sim | report; CI gate | compiler reach, quest lifecycle, deadlines (W23) | L1 | M | high |
| P5 | Pacing per district | commands, game hours, narration lines, fights and purchases per district under purposeful play; dead stretches without a new fact, item or room | Sim + T | table + timeline | sim, trace | L3, L8 | M | high |
| P6 | Critical path length | shortest command sequence to each chapter story point and to each quest outcome | S + Sim | number per goal + path | chapters, story points | L1; a goal-directed search policy (L3) | M | med |

## 4. Combat

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| F1 | Monte Carlo fight sim | time-to-kill, time-to-die, win rate and HP left for player at level L with gear G versus NPC N (and packs, 6b allies), over many seeds; exact to the kernel because it uses the real round code and RNG | Sim (fixture, no cartridge walk) | matrix: level x NPC | `combat_fixture.ts`, `c4_pack_fixture.ts`, round code | none | M | high |
| F2 | Encounter difficulty rating | a closed-form rating from F1 (expected rounds, death chance) stored per NPC and per population plan | S + F1 | field in a generated report; the compiler could later accept an authored `rating` to compare | F1 | optional `rating` field (L5) | S | high |
| F3 | Status-effect power | per status: total damage or heal over its life, modifier size x duration, cure cost; compared against a weapon hit of the same level | S | table | G3, 2c, W8, row 1 declarations | none | S | med |
| F4 | Spell cost and benefit | mana and reagent cost versus F1 effect of each spell; learnability gates (29a/b) | S + F1 | table | spell declarations | none | S | med |
| F5 | Resistance coverage | which damage kinds and materials the player can access per district against each NPC's resistances; an NPC nobody can hurt before level L | S | matrix | G2 resistances, G1 tags, I1 | L1 | S | med |
| F6 | Draw budget audit | rounds that approach the eight-raw-draw budget or `query_steps` | Sim | report | budgets, `evaluation.budget_exceeded` | none | S | low |

## 5. Economy beyond the ledger

(.1-.4 cover faucets, sinks, flows, gates and dials; these add the player-facing shape.)

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| E1 | Price ladder | all buy and sell prices sorted, per district, against the coin per hour band from .3; items priced above anything earnable before level L | S | chart | .1 ledger, shop declarations | none | S | high |
| E2 | Value versus power | item price against its derived-stat delta (I1); flags cheap-strong and dear-weak | S | scatter | I1, E1 | none | S | med |
| E3 | Sink pressure by level | mandatory spend (fares, fees, services, repairs, decay replacement) per level against income at that level | S + Sim | chart | .1, .2, P2 | L3 | S | med |
| E4 | Wealth curve | coin and inventory value over game time per policy and seed; spread between policies | Sim | chart | .2 flows | L3 | S | high |
| E5 | Service and training uptake | which paid services are never used in purposeful play | Sim | table | .2 | L3 | S | low |

## 6. Content coverage and reachability

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| R1 | Content graph export | one JSON graph: rooms-exits-barriers-keys, quests-dialogues-choices-facts-story points, items-placements-loot-shops, NPCs-schedules-populations, reactions-triggers-targets | S | `docs/content-graph.gen.json` per cartridge | compiler reference resolution (`cartridge_refs.ts`), `system_graph.exs` shape | this is L1 itself | M | high |
| R2 | Static reachability report | rooms, items, NPCs, details, quests and dialogue choices unreachable from the entry under any policy; soft-reachable (needs a check or key) | S | report; CI gate for hard-unreachable | compiler reach, R1 | L1 | S | high |
| R3 | Dynamic coverage | which rooms, choices, reactions, recipes, loot entries, statuses and events fired at least once across all seeds; the never-fired list | Sim | coverage table (like code coverage) | sim, trace events | event and reaction attribution (L2) | M | high |
| R4 | Required-item chains | for each gate: the chain key -> container -> barrier -> room -> NPC; chain depth; single points of failure (one key, one NPC) | S | report + graph | R1, barrier reach rules | L1 | S | med |
| R5 | Softlock finder | sim runs that end with no progress-making action available and no fatal state; reports the shrunk sequence | Sim | report with repro (`loka play` playback) | sim shrinking, GameView action lists | L3 | M | high |
| R6 | Dialogue branch coverage | choices never offered, never chosen, never passable (check always fails at reachable level) | S + Sim | table | dialogue declarations, R3 | L1, L2 | S | med |

## 7. Player experience

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| X1 | Refusal and friction report | rejections per 100 commands by error code (`invalid_state`, `unsupported_capability`, `not_found`, `too_heavy`, `insufficient_resource`...), by room and by action; the GameView-offered actions that are refused (view/admission disagreement) | Sim + R + T | table + per-room heat map; CI gate on view/admission mismatches | DecisionResult `rejected.error.code`, `target.unresolved`, the view/admission conformance check (architecture.md "TypeScript kernel") | playtest log (L4) for humans; sim already has it | S | high |
| X2 | Confusion signals | repeated identical refused command, look/scan loops, rapid room ping-pong, long pause before a command (telemetry only), opening the Journal or map right after a refusal | T + R | per-session timeline, per-district rates | trace `trace.command`, Book page events | L4 | M | high |
| X3 | Idle and backtracking | revisits per room (W7 `visited_rooms.count` already stored), steps between new facts, share of moves that re-enter the previous room | Sim + R | table | visited counts, trace | L3 for sim | S | med |
| X4 | Information exposure | for each gate and quest objective: is every needed clue (text line, detail, rumour, codex entry) reachable before the gate, and did the run see it before passing it; "found before needed" ratio | S + Sim + T | matrix clue x gate; CI warning for a gate with no reachable clue | knowledge rows (D10, W3 rumour, codex), R1, R3 | a `clue_for` tag on text keys or details (L8) | M | high |
| X5 | Told versus found | the showcase playtest question made measurable: for each consequence, whether the run saw the cause's narration line (told) or inferred from state change (found); per-line "which line told you" | T (human and Fable playtests) + R | per-district verdict table matching docs/showcase scripts | playtest protocol (cause-and-effect.md `:172`), receipts' narration keys | L4 with a structured verdict record | M | high |
| X6 | Reading load per page | words, lines, links and actions per Book page and per room description; variants (W6/W7) counted; pages over a budget | S (text catalog) + T (pages shown) | table; CI warning over budget | `text.json`, Book model, walkthrough contact sheet | L4 for pages actually shown | S | med |
| X7 | Book UI metrics | taps per outcome, page turns per command, modal time, detail-page depth, action list length distribution | T | dashboard | GameView action lists, walkthrough | L4 | M | med |
| X8 | Fable playtest harness | blind AI playtest in the web Book producing the same L4 log plus a structured verdict (X5) and screenshots at phone width; re-run per district | T | report comparable with human sessions | the existing per-district AI playtest practice, walkthrough screenshots | L4 | M | high |

## 8. Narrative and world

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| N1 | NPC usage | per NPC: dialogues, choices, quests, shop, schedule rooms, reactions involving it; talk count in runs; NPCs with one line | S + Sim | table | R1, R3 | L1, L2 | S | med |
| N2 | Fact and flag usage | per fact: writers (recipes, reactions, choices), readers (policies, variants, gates); write-only or read-only (orphan) facts; facts that never change in any run | S + Sim | table; CI warning for orphan facts | compiler reference stage, R3 | L1, L2 | S | high |
| N3 | Dialogue coverage and depth | choices per dialogue, check-gated share, mean lines to a quest accept; unreachable branches (R6) | S | table | dialogue declarations | L1 | S | med |
| N4 | World-event cadence (37a/b when built) | events per game day by seed, overlap of phases, time between a trigger and its aftermath, raids a player at level L survives (F1) | Sim | timeline | schedules, reactions | L2 | S | med |
| N5 | Consequence reach | for each player choice: how many later lines, prices, dispositions and rumours change (trap 8 says consequences are lines, not gates); choices with zero reach | S + Sim | table | reactions, standing, rumour (W3), away recap | L1, L2 | M | med |
| N6 | Text catalog health | unused keys, keys with alternates never shown, missing touch links (`TOUCH_LINK_MISSING` already), band phrase coverage | S + Sim | report | compiler links check, W7 | L2 for shown keys | S | low |

## 9. Determinism and health

| Id | Tool | Measures | Input | Output | Reuses | New hook | Size | Value |
|---|---|---|---|---|---|---|---|---|
| H1 | Replay diff between versions | run the stored transcripts, showcase pins, E1 cases and a fixed seed corpus on kernel/content version A and B; diff outcomes, state hashes, HP, coin and XP per step; classify as intended tuning or regression | R + Sim | PR comment like the graph diff; CI gate on unclassified diffs | `transcripts.test.ts`, `e1_cases.ts`, sim sequence digest, `graph_diff.py` pattern | a baseline store of per-step metrics per version (L7) | M | high |
| H2 | Save compatibility probe | open a corpus of saves from release N on N+1: counts of `save_corrupt`, `pinned_release_missing`, recovery refusals per feature section | R | table per release pair | save.md refusal table, `saves.test.ts`, `recovery.test.ts` | a saved-game corpus kept per release (L7) | M | high at RC, low now (pre-production refuses by policy) |
| H3 | Decision cost profile | `kernel.decision_latency` and query steps per command type, room and policy; the costliest policies; budget headroom | Sim + R | table + histogram | `kernel.decision_latency`, `evaluation.budget_exceeded`, `LIMITS` | the step counter exposed to the sim (small kernel hook) | S | med |
| H4 | State size growth | rows per state section over game time (`docs/state-sections.gen.json` lists the sections); unbounded sections (visited counts, knowledge, trace) and their caps | Sim + R | chart | state sections, trace caps (5000/1000) | none | S | med |
| H5 | Invariant and fault census | `simulation.invariant_failed` and fault codes by seed, cartridge and command across the batch runs; flakiness over time | Sim | table | sim batch report, invariants registry | none | S | med |
| H6 | Numbers drift | diff of docs/world-parameters.md rows and every authored number between cartridge versions | S | table | world-parameters.md, artifact diff | none | S | low |

## 10. Telemetry design

Facts: the engine already records, per committed command, the command, the decision, the delta digest, the RNG and the events (`trace.command`), plus budget and latency observations, in the save's own tables with caps, redacting player words in `loka play` (save.md "The game trace"; `kernel/ts/play/obs.ts`). Observation is never authority: a write failure changes no decision (architecture.md "Observability"). The web preview and Book run the same local authority.

Proposal: one **playtest event log** (enabling layer L4), `loka-obs-v1` records so the existing registry, validators and redaction apply.

| Design point | Proposal |
|---|---|
| Events | `trace.command` as today (the authority already has it); add `view.shown` (page kind, room, action count, line count, variant keys), `view.tap` (which offered action or control; never free text), `view.idle` (bucketed pause before the next command), `playtest.verdict` (X5's structured answer: consequence id, told/found, line key, where noticed). Each a registered name in `protocol/event_registry.json` with a schema. |
| Identity | session id = the save's `run_id`; no account, device or name. Player words never recorded (as `obs.ts` does now); only text keys and ids. |
| Opt-in | a `?dev=1` panel toggle for the preview; a Book setting for players later; default off outside development. Local JSONL file in the served worktree (like `.polish/status.jsonl`), exported by hand. |
| Human and Fable | same log, same format; a Fable playtest adds `playtest.verdict` records and screenshots; a human session adds them through a short form in the dev panel at the end. Reports in §7 read both without knowing the source beyond a `source: human|ai|sim` field. |
| Sim parity | the simulator emits the same records (`obs.ts` already writes `trace.*`), so X1, X3 and P5 run on sim output before any human plays. |
| Storage limit | caps like the trace table; a session over the cap keeps its prefix. |

## 11. Visualization

Facts: `bin/system_graph.exs` renders `docs/system-graph.gen.json` for Storybook's System pages (docs/design/system-dashboard/spec.md §5 "Generation"); `bin/graph_diff.py` posts a node and edge diff as a PR comment; `docs/toolbox.gen.json` and `docs/features.gen.md` are generated rows checked by `--check`.

Proposal: every tool above writes one `docs/<tool>.gen.json` (facts, not prose) and the System pages gain a **Balance** tab that renders them, following the dashboard spec's visual language. Reuse by kind:

| Chart | Tools | Reuse |
|---|---|---|
| Node and edge graph | R1 content graph, R4 chains, N1, N2 | the System graph renderer and its diff comment |
| Line and band charts | C1 power curve, P1 XP, P2 time-to-level, E1 ladder, E4 wealth, H4 state size | one chart component (dataviz skill palette) |
| Matrices and heat maps | F1 fight matrix, P3 level x zone, X4 clue x gate, X1 refusals by room | one table component with colour scale |
| Coverage lists | R2, R3, R6, I4, N2 orphans | the features page's row style |
| PR comment diffs | H1 replay diff, H6 numbers drift, R3 coverage delta | `graph_diff.py` MARK/update pattern |

A per-district page (hub, body, world, social, combat...) that stacks P5 pacing, X1 refusals, F1 ratings and the .1 ledger is the single most useful view for the owner's playtests.

## 12. Enabling layers, ranked

Proposal. Ranked by how many tools each unlocks; "exists" notes the partial foundation.

| Rank | Layer | Unlocks | Exists today | Size |
|---|---|---|---|---|
| 1 | **L1 Content graph export**: one generated JSON of definitions and typed references from the compiled artifact | I4, I5, P1, P4, P6, R1-R6, N1-N3, N5, X4 (14) | compiler reference resolution (`cartridge_refs.ts`); `system_graph.exs` as the generator pattern | M |
| 2 | **L3 Purposeful player policies** in the simulator (fighter, trader, explorer, completionist, goal search), extending .2's policy | C4, P2, P3, P5, P6, E3-E5, R5, X3 (10) | sim command generator "mostly what the GameView offers"; .2 planned | M |
| 3 | **L4 Playtest event log** (§10) | X1 humans, X2, X5-X8, P5 human half (7) | trace tables, `obs.ts`, polish status file | M |
| 4 | **L2 Attribution on events and deltas** in sim and trace output: which recipe, reaction, job or rule produced each op and event (writer groups and root-caused `action_completed` exist inside composition; nothing exports them) | R3, R6, N1, N2, N4-N6, .2 flows by source (8) | writer groups in compose; `trace.command` events | S-M (export only; no rule change) |
| 5 | **L7 Baseline store and replay harness**: per-version per-step metrics for transcripts, pins and a seed corpus; a save corpus per release | H1, H2, H6, R3 deltas (4) | transcripts test, E1 cases, sim digest, graph diff comment | M |
| 6 | **L5 Stat budget and difficulty schema**: `world.gear_budget`, optional authored `rating` on NPCs and populations | I2, I5, F2, P3 (4) | derived and levelling tables | S (schema) |
| 7 | **L8 Content tags**: `district`, `intended_level`, `clue_for` on rooms, NPCs, items, text keys (compiler-checked references) | I2, I5, P3, P5, X4, per-district pages (6) | G1 `tags` vocabulary as the shape | S |
| 8 | **L6 Report framework**: one generator entry point writing `docs/*.gen.json`, `--check` freshness, Balance tab in System pages | all charts in §11 | `bin/features.exs`, `contracts.exs --check`, dashboard spec | M |
| 9 | Step counter and latency exposed to the sim | H3 | `kernel.decision_latency` in the authority only | S |

## 13. Recommended order and batch placement

Proposal. The five tools with the most value soonest, each needing at most one layer:

| Order | Tool | Why first | Layer | Batch |
|---|---|---|---|---|
| 1 | R1 + R2 content graph and static reachability report | no engine change; immediately finds unreachable or orphan content in the growing showcase; .1's ledger can read the same graph | L1 | M9 wave 3 (now) |
| 2 | C1 + I1 + I2 power curve and item sheet with slot budget | gear and levelling tables exist; M9b is the gear batch, so the budget schema lands with the content it governs | L5 (small) | M9b gear |
| 3 | F1 + F2 Monte Carlo fight matrix and encounter rating | reuses the combat fixtures; answers "can a level 2 beat the boar" exactly; feeds P3 | none | M10 world loop (beside .2/.3) |
| 4 | X1 refusal and friction report over sim output | DecisionResult codes exist; cheapest player-experience signal; catches view/admission drift | none for sim; L4 later for humans | M10 |
| 5 | H1 replay diff between versions | the showcase is the regression fixture; every tuning PR should show what changed per step | L7 | M11 property and trade (first tuning-heavy batch) |

Then by batch:

| Batch | Add | Reason |
|---|---|---|
| M9 wave 3 | R1, R2, I4, N2 orphans | static, no engine change |
| M9b gear | I1-I3, I6, C1, C2, C5, L5 schema | the gear batch defines the numbers these read |
| M10 world loop | F1-F3, X1, X3, P1, E1, L3 policies (with .2), L2 attribution export | .2 and .3 need policies and attribution anyway |
| M11 property and trade | H1 + L7, E2-E4, P2, C4, dial drift (H6) | tuning begins; the diff shows each dial's effect |
| M12 world events | N4 cadence, N5 reach, R3 dynamic coverage, R5 softlock | events multiply states; coverage and softlocks matter most here |
| M13 law and decay | E3 sink pressure, F3 statuses, H4 state growth | decay adds sinks and rows |
| M14 travel and trial | P3, P5, P6, X4, L8 tags, per-district pages (L6) | travel joins districts; pacing and level-versus-zone become real |
| M15 carry-over | L4 playtest log, X2, X5-X8, H2 save corpus, H3 | before owner playtests of the full world and the RC gate |

Not recommended now: X7 Book UI metrics and H2 save compatibility until the mobile pause ends and saves must survive a release; I7 until row 21 exists.
