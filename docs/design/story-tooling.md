# Story tooling for a reactive story: design (loka-wfrgk.113)

The owner is the only author and is building a branching, reactive story: choices land as facts, and many
small things read them. This doc assesses ten tool candidates and three mechanic gaps against what the repo
already has, and gives a build order. Doc only; the owner picks, and each pick becomes a normal slice.

- The editor's shape, write path and cards: [GUI editor design](../rnd/gui-editor-design-2026-11-04.md).
  The story map, its model and its lints: [story map design](../rnd/story-map-design-2026-11-05.md) and the
  [map and story rulings](editor-map-and-story-rulings.md). Scene text: [scene structure rulings](scene-structure-rulings.md).
  Content reports, the author preview and checkpoints: [cartridge.md](../system/cartridge.md#content-reports),
  [author preview](../system/cartridge.md#author-preview). None of that is restated here.
- Reference points, mapped once: Larian's Osiris is a fact store plus event rules with a story debugger; Loka's
  facts, reactions (`on` + `when` + `steps`) and `POST /why` are the same three parts. BioWare's plot database is
  the facts table with its readers and writers; Bethesda's quest stages and conditions are quest states plus the
  26 policy leaves; articy:draft's flow is the shipped Story map; Valve's response rules are condition-chosen
  line pools, which ambient sets already are (section 3, candidate 10).
- No player-facing words are written here; an example line is `~`.

## 0. Decisions at a glance

| # | Candidate | Verdict | In one line |
|---|---|---|---|
| 1 | Fact usage view | **Merge** into the Trace as a Facts table | Per-fact Trace and `orphan_facts` exist; what is missing is the all-facts list sorted by trouble |
| 2 | Story map | **Done** | S1 to S3 shipped (#646, #657, #679); open items are Beads nits under loka-wfrgk.18 |
| 3 | Consequence preview of a choice | **Keep**, slice C1 | A forward walk over the story model's edges; nothing exists yet |
| 4 | In-play state debugger | **Keep**, slice D1 | Live facts and `POST /why` exist; the gap is a per-step panel that asks without being asked |
| 5 | One-click test saves | **Done** | Checkpoints: Save in the Play tab, jump replays, `bin/loka check` |
| 6 | Recorded playthroughs replayed after each edit | **Keep**, slice R1 | `bin/loka check` is headless and in CI; the watcher does not run it after each compile |
| 7 | Coverage of lines, choices, reactions | **Merge** with 6, slice R2 | `coverage.ts` exists over transcripts; the prologue has checkpoints, not transcripts |
| 8 | Story-logic lints | **Keep**, slice L1 | The story map's S6 rows were designed and not built; two rows added here |
| 9 | `~` writing tracker | **Done** | `/todo`, the palette's `~` filter, placeholders per story node; one Beads fix (loka-vduxr.69) |
| 10 | Barks | **Drop** as a mechanic; one lint row in L1 | Ambient sets are state-chosen line pools already; event-driven lines are reactions |

Recommended order: R1, D1, C1, L1, F1, R2 (section 5); decided by the owner 2026-11-07 (section 6). The
[studio tooling survey](../rnd/studio-tooling-survey-2026-11-07.md) (loka-wfrgk.114) widened the scope to
engine, protocol and compiler changes; its slices are ruled in section 2b and placed in section 5b. **Owner 2026-11-07
(paraphrased): yes to each survey recommendation**, so the build order is R1, W1, D1, K2, C1, L1 + L2, W2, F1 + W4, R2, K1, then W3 and E1 before v1.

## 1. What the compile already gives

Every tool below reads these; none adds a parser or a second source.

| Primitive | Where | What tooling reads |
|---|---|---|
| **Facts** | `facts.json` per `schemas/source/facts.schema.json`; a fact is bool, enum or bounded int with a default (`protocol/fact.schema.json:6-70`) | Written by `fact.assign`, `fact.adjust`, `fact.stamp` (`protocol/step.schema.json`, three of 35 ops) and by the field sites `reach.ts:19-31` lists (a scene's `on_end.assign`, a quest's deadline fact, a topic's fact, a service's account); read by `fact_compare` (`protocol/policy.schema.json:136`), `fact_at_least` (`:563`), `time_since` (`:578`). A value of the wrong type is a compile refusal, `FACT_TYPE_MISMATCH` (`lib/loka/content/refs.ex:41`, `:68`) |
| **Reactions** | `reactions/<k>.json` (`protocol/reaction.schema.json`: `on`, `when`, `after`, `silent`, `steps`); `triggered()` picks the rules an event matches (`kernel/ts/src/mechanics/reaction.ts:103`); a failed `when` returns `undefined` and leaves no trace (`reaction.ts:154`) | **No committed event names its reaction** (`kernel/ts/play/coverage.ts:20-24`). Every "did it fire" answer is a replay of a marked copy of the cartridge whose rules each end in a probe `narrate` (`coverage.ts:25-36`; `why.ts:44-70` probes one `when` leaf at a time) |
| **Conditions** | 26 policy leaves (`protocol/policy.schema.json`); the story map's §4.3 splits the ones the compiler can settle from the ones only play can | A static view draws a solid edge for the first kind and a dashed "depends on" edge for the second; it never evaluates a policy |
| **Scenes** | Triggers `start`, `story_point`, `quest`, `action` (`kernel/ts/play/scene_trigger.ts:9`; `lib/loka/content/scenes.ex:140-147`); a modal scene is narrate pages, `await_ack`, `end` (`protocol/scene.schema.json:67-69`); `on_end` sets up to three facts and reaches a story point (`:45-48`) | The two-option `choice` step belongs to the **dream** scene only (`scene.schema.json:128`, `:306-307`); see section 4 |
| **Story model** | `contentGraph` and `reachReport` with `orphan_facts` `{unused, write_only, read_only}` (`kernel/ts/play/reach.ts:39`, `:77`, `:117-126`); `story.ts` adds `then`/`then_failed` and `choice_resolved` edges (`:56-76`), `~` placeholders and diagnostics per node (`:112`, `:147`); served as `GET /story` (`kernel/ts/play/live.ts:276`) | The Trace rows `set at`, `read at`, `never set` (`tools/author-panel/src/storylist.ts:229-257`); the Flow graph (S3) |
| **System graph** | `docs/system-graph.gen.json` (280 nodes, 1288 edges: capabilities, files, layers, save tables; `bin/contracts.exs:266`) | The engine's own map, not story content. No story tool reads it |
| **Dev commands** | `dev_go_to_room`, `dev_set_fact`, `dev_set_level` (`kernel/ts/src/mechanics/dev/rule.ts:112-137`); the panel's Cheats forms send them (`tools/author-panel/src/cheats.tsx:15`, `:48`, `:74`) over the Book protocol `hello`, `advance`, `jump`, `trace` (`mobile/app/author/panel.tsx:187-196`) | A recorded cheat replays in a checkpoint ([guide](../guides/writing-the-game.md#jump-to-a-beat)) |
| **Checkpoints** | `GET|PUT /checkpoints/<name>` writes `{steps}` under `checkpoints/` (`kernel/ts/play/live.ts:83-112`); jump replays one; `bin/loka check` replays all headless (`kernel/ts/play/check.ts:30-45`, `:47-72`); CI runs it for every cartridge with the directory ([cartridge.md](../system/cartridge.md#author-preview)) | Candidates 5 and 6 |
| **Why** | `POST /why` replays the run to the last step and answers, per rule, its trigger match, whether it fired and each `when` leaf's `held` count (`why.ts:44-70`); the panel asks it for one action or dialogue of the room (`tools/author-panel/src/reading.tsx:90-102`). The panel also shows every declared fact at its current value ([author panel bullet](../system/cartridge.md#author-preview)) | Candidate 4 |
| **Coverage** | `coverage.ts` replays `cartridges/<c>/transcripts/*.jsonl` and lists the reactions, scripted actions, choices and quests none exercises (`coverage.ts:1-5`); `kernel/ts/test/transcripts.test.ts:1-7` replays them in CI | Candidate 7 |
| **Lint** | `mix loka.lint` runs after each good compile and the panel folds its lines (`kernel/ts/play/live.ts:60-66`); baseline `test/loka/lint_baseline.txt` (197 lines); the shadowed-variant rule `lib/loka/content/lint.ex:76`, `:119-133` | Candidate 8 |
| **Still to write** | `GET /todo` (`kernel/ts/play/todo.ts:79`), the palette's `~` filter (`tools/author-panel/src/shell.ts:194`), placeholders per node in `GET /story`, the Pacing panel's word counts | Candidate 9 |
| **State-chosen lines** | Ambient sets `{lines | emotes, every, chance?, when?}` on rooms, items and NPCs; the first set whose `when` holds is the active one (`protocol/entity.schema.json:1619-1660`, `:1647`; `protocol/room.schema.json:498`); a choice's `narration_variants` (`protocol/dialogue.schema.json:377`); a room's or detail's `DescriptionVariant` (`protocol/room.schema.json:630-645`) | Candidate 10 and the room-text gap |

## 2. Rulings for the kept tools

Each tool is read-only over the model or the running game; the cards keep every write.

### C1: Consequence preview of a choice

For the owner: before writing a choice's words, see what picking it does, two hops out, and what it never
touches. articy shows the next node; BioWare's plot editor shows the flag's readers. This shows both.

| Ruling | Why | Test |
|---|---|---|
| **A pure walk, `consequences(model, ref)` in `kernel/ts/play/`.** From a choice (or a scene's `on_end`, a reaction, a story point outcome): hop 1 is its own `steps` (facts set with the value, quests started or resolved, story point and outcome, `then`); hop 2 is every node whose trigger or `when` reads what hop 1 wrote (`fact_changed` on the fact, `choice_resolved` on the key, `quest_resolved`, `story_point_reached`, and the `fact_compare` readers, scenes with a matching `on`). Two hops, then "and N more" | The story model already holds every edge; two hops answer "what happens" without drawing the whole graph again | A planted choice that sets `f` and resolves `q`: hop 1 lists both; hop 2 lists the reaction on `fact_changed f`, the variant reading `f` and the scene on `q`'s outcome, each once |
| **Gates stay visible.** A hop-2 node with a `when` shows its leaves; a solid leaf the walk can settle (`fact_compare` on a fact hop 1 set) is marked holds or fails; any other leaf is dashed "depends on play" | The §4.3 rule: solid is what the compiler could refuse, dashed is a hint; the view never evaluates a policy on a live world | A reaction gated on `f == true` after a choice that sets `f = false` shows `fails`; one gated on `npc_present` shows dashed |
| **"Never read."** A fact hop 1 writes that no edge reads is one row, `write_only`, from `reachReport` | The cheapest catch of a dead consequence | A planted write-only fact shows the row; adding a reader removes it |
| **Where.** The Story slot's lower section, like Trace (`Consequences <key>`, `×`); `c` on a focused choice or node row; Cmd-K `consequences <key>`; a row click selects that node | One lower-section idiom; following is reading, as S2 ruled for Trace | Keyboard only: focus a choice row, `c`, arrow to a hop-2 row, Enter selects it |

Built 2026-11-13 (`kernel/ts/play/consequences.ts`, `tools/author-panel/src/storyconseq.ts` and the panel
wiring; tests in `kernel/ts/test/consequences.test.ts` and `test/author_story.test.ts`). Eight facts the build
settled:

- **The model needed three more fields, not a second walk.** `reach.ts`'s edges now carry `value` (what a
  `fact.assign` writes), `leaf` (any policy leaf's own object, with `neg` when a `not` wraps it), and `story.ts`'s
  `links` exports the `choice` a `choice_resolved` named. Without them a gate could not be settled from the model
  alone; `value` rides only the writes, so no read edge grew.
- **A gate settles only on the fact hop 1 wrote.** Any other leaf is `depends` (dashed), including a gate on a
  fact hop 1 never touched, so the walk never guesses from a world it cannot see. A `fact.adjust` or `fact.stamp`
  writes a value only play computes, so its readers stay `depends` too — only `fact.assign` carries a `value`.
- **Every policy leaf keeps its row.** `npc_present`, `fact_at_least`, `has_item` and the rest say `depends on
  play` rather than vanishing: the review's first pass kept only `fact_compare`, which silently dropped gates.
- **A story point is a write only where it is reached** (a scene's `on_end`, a choice's own `story_point`), and
  hop 2 then asks who listens for it; a scene's `on.story_point` is a trigger and writes nothing.
- **A reader is one row per node**, naming every write it reads (`both via a, b`), so two effects do not list the
  same scene twice with the same gates.
- **The Story list has no choice rows.** Its rows are parts, beats, nodes and seeds, so `c` opens on a node; a
  dialogue's panel lists its choices, each a walk of its own (`<node>#<choice>`), and a choice row's click
  walks it.
- **Scenes and story points walk their own steps** as the bare node (a scene's `on_end`, a story point's
  outcome); `CONSEQUENCES` is what the list offers `c` and the palette on.
- **`and N more` caps at 20 readers**, the same list the panel shows; no reading of a live world anywhere in
  the walk.

Written 2026-11-13 06:25 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017

### D1: In-play step panel (the debugger)

For the owner: after each step in the Book, see what changed and which rules looked at it: Osiris's story
debugger without the second application.

| Ruling | Why | Test |
|---|---|---|
| **Asked on every step, not on request.** After each accepted step the panel asks `POST /why` for the run (the `trace` op already returns the rows) and shows: facts whose value changed (from the two views, no engine work), quests started or resolved, then every reaction whose trigger matched (`causes` non-empty) with `fired` and, when it did not fire, the first `when` leaf whose `held` is 0, in the explainer's sentence form (`why_words.ts`) | The answer exists (`why.ts:44-70`); today the owner must guess which action to ask about | Take a step that sets a fact a gated reaction reads but whose other leaf fails: the panel shows the fact's change and that rule with the failing leaf named |
| **Nothing new in the kernel.** The panel reads the explainer's report; a reaction that matched no trigger is not listed | No committed event names its reaction (`coverage.ts:20-24`); the marker replay is the only honest source without an engine change | The report for a step with no matching rule lists no reactions |
| **Cost shown, not hidden.** The replay re-runs the whole run per step; the panel prints its time and stops asking past a budget (an owner-visible "Why is off past N steps; jump to a checkpoint") | Replay cost grows with path length; a silent slowdown is worse than a stated limit | A run of 400 steps shows the notice; a jump to a checkpoint resets it |
| **Where.** A `Step` tab beside Why in the reading tabs; rows are node rows (click selects the rule's card) | The reading tabs already hold Why and the state; one more tab, same idiom | Select a listed rule: the inspector shows its card |

Built 2026-11-12 (`tools/author-panel/src/steptab.tsx`, `step.ts`, `steprows.tsx`; tests in
`test/step.test.ts`). Two notes the build settled:

- **The two views cost no message.** The panel already receives the Book's whole `state` on every update
  (`mobile/app/author/panel.tsx:205-214`), so the facts changed are its own last two snapshots, and the Book
  needed no change at all. A second `state` at the same step is a redraw, not another step (`useViews` keys the
  pair by `hash:steps.length`, so a redraw reuses its pair instead of pairing a view with itself).
- **"Asked on every step" is an effect, not a button.** The report is asked as the step arrives; a step past the
  budget, and a report slower than 2 s, are both shown rather than hidden. The failing leaf is worded by
  `why_words.ts`, so a new policy leaf cannot gain a sentence here that the explainer lacks.
- **No panel E2E.** `test/harness.ts` deliberately serves no Book, so an E2E of this tab could only assert its
  own text; the pure halves (`changedFacts`, `changedQuests`, `looked`, `lookedLine`) are unit-tested and the tab
  is a thin render over them.

### R1: Checkpoints replayed after each compile

For the owner: every edit re-tests every path the owner recorded, in the editor, with the failing step named.

| Ruling | Why | Test |
|---|---|---|
| **The watcher runs `check` after each good compile**, in a child process, cached by artifact hash, after the story model is served, never before the page updates. The result rides the SSE `Message` as `checkpoints: [{name, ok} | {name, step, why}]` (`kernel/ts/play/live.ts:37-42` holds `diagnostics` and `lint` the same way) | `bin/loka check` is one function over the compiled dir (`check.ts:47-72`); the panel already lists the names | Break a step of a saved checkpoint by renaming its room: the next compile pushes that checkpoint as failed with the step's words; fix it and it is `ok` |
| **Shown twice.** The Play tab's checkpoint list gets a status word per name (`ok`, `step 4 refused`), and the Compile card counts failed checkpoints beside lint, in the refusal colour | A broken path is as loud as a broken file | A failed checkpoint shows in both places and both clear on the fix |
| **Jump offers the drop.** Jumping to a failed checkpoint keeps today's "drop this step and continue" | Exists ([guide](../guides/writing-the-game.md#test-your-checkpoints)) | unchanged |

### R2: Coverage from checkpoints

For the owner: which reactions, choices and quests none of the owner's recorded paths reaches, as chips on
story nodes (the story map's planned S5).

| Ruling | Why | Test |
|---|---|---|
| **Replay the checkpoints through a marked artifact** (`coverage.ts` `marked()`), in the R1 child, and record per checkpoint the rules whose probe line appeared, the choices resolved, the quests started | `coverage.ts` reports over `game_trace` transcripts; the prologue has checkpoints (command steps), so the check's replay is the path. One marker trick, two inputs | A planted path that takes choice `a`: `a` is covered, its sibling `b` is not, the reaction on `choice_resolved a` is covered |
| **Chips, not a report.** Each story node row gets a `covered`/`uncovered` chip with the checkpoint names in its title; a filter `uncovered` in the Story list | The owner reads the list, not JSON | Filter `uncovered` shows only nodes no checkpoint reaches |
| **Lines wait.** Line coverage (which text keys the player read) is a later row: `~` already says what is unwritten, and a line's reach follows its node's | The owner's question is "does anything reach this", answered per node | none |

### L1: Story-logic lints

For the owner: definite findings, in the Compile card's lint lines, at author time.

| Row | Finding | Why | Test |
|---|---|---|---|
| story map S6 | quest with no resolver; story point outcome nothing consumes; a scene whose `on` no trigger site can reach; a `fact_changed` reaction cycle with no `when` that breaks it | Designed ([§6](../rnd/story-map-design-2026-11-05.md#6-reachability-and-lint)), owner-accepted, not built | ExUnit on planted cartridges, one per row; the sampler corpus stays at its baseline |
| new | **A compare value never written.** A `fact_compare` on an enum or bool fact whose `equals` is neither the default nor any value a `fact.assign` or site writes anywhere in the cartridge | The condition can never hold; the compiler checks only the type (`refs.ex:41`) | A fact with values `[a, b, c]`, default `a`, assigned `b` once: a `when` on `c` is a finding; on `b` it is not |
| new | **A shadowed ambient set.** An ambient set after one with no `when`, or with a `when` whose terms are a subset of its own, on the same room, item or NPC | The first set whose `when` holds is active (`entity.schema.json:1647`); `lint.ex:119-133` already does this for variants | Two sets, the first unconditioned: the second is a finding |

Elixir, in `mix loka.lint`, with the baseline; an engine-adjacent shared tool, so one reviewer per the lean
default. Potential findings (`unreachable`, `orphan_facts`) stay in the view, labelled potential.

### F1: Facts table

For the owner: the plot database page. One table of every declared fact: type, default, scope, meaning,
set count, read count, status (`unused`, `write_only`, `read_only`), sorted by trouble first; click opens its
Trace. In the Story slot's lower section (`Facts`), Cmd-K `facts`. All of it is in `GET /story` and
`reachReport` today; the slice is the table and the sort. Test: a planted cartridge with one fact of each
status lists them in the order `read_only`, `write_only`, `unused`, then the rest by key.

## 2b. Rulings for the survey's slices (loka-wfrgk.114)

From the [studio tooling survey](../rnd/studio-tooling-survey-2026-11-07.md); the lesson and its sources are in
its section 3 by row number. Tools slices need no reviewer; the compiler slices change source schemas only and
leave the artifact as it is; L2 joins L1's Elixir slice; E1 is an engine change.

### W1: Roam, a random player over the real authority (survey row 9)

For the owner: what no path reaches, found by a bot that plays at random, at speed, many times, and keeps every
crash as a checkpoint. Larian's World Tester, Owlcat's bots, ChoiceScript's Randomtest, Ink-Tester.

| Ruling | Why | Test |
|---|---|---|
| **`bin/loka roam <cartridge> [--runs N] [--steps M] [--seed S]`** in `kernel/ts/play/roam.ts`: compiles to a temp dir like `sim.ts`, marks the artifact (`coverage.ts` `marked()`), opens the headless game as `check.ts` does, and drives it with `flows.ts`'s worker (`kernel/ts/play/flows.ts:39`) for M steps per seeded run; a choice step is added to the worker if it lacks one | The three parts exist and are already reused across `play/`; the marker is the only honest "did it fire" without a kernel change | A planted reaction only a rare choice reaches: zero-hit at 20 runs, hit at 500, same seed base |
| **Report**: zero-hit reactions, choices, quests, scenes and story points first, then hit counts per node, as one canonical JSON document (`coverage.ts`'s form) and as lines; the panel may show the counts as a chip later (R2's slot) | A report for authors, not a check, like coverage and flows | The showcase's report lists each kind once and sorts zero-hit first |
| **A fault or invariant failure writes `checkpoints/roam-<seed>.json`** holding the run's steps up to the failure, shrunk by greedy step deletion as `sim.ts` does (`kernel/ts/test/sim.ts:169`) | A found bug becomes a path R1 guards after every compile | A planted invariant break at step 40 writes the file; `bin/loka check` fails it at the same step; the shrunk path is shorter than 40 |
| **Budget shown**: prints its run time; the acceptance keeps the showcase at 50 × 300 under two minutes on the M1, else the number is recorded | A slow tool is run once; a fast one every day | measured in the slice |

Measured 2026-11-12 on the M1: **50 × 300 took 273 s** (compile 2 s, then 271 s of play), so the budget does not
hold. `view()` alone is 3564 ms of a 300-step run against 649 ms of presses and 29 ms of choosing, so the number is
the Book's snapshot build, not the sampler; the default is `10 × 150` (about 40 s) and `--runs`/`--steps` raise it.
The reaches the spec asks for were met: the gated-choice case reports the ref under `never.choices`, and planted
kernels cannot be written because the compiler rejects every malformed rule statically, so the break path is
pinned by `writeBreaks` tests instead of an end-to-end planted fault.

### K2: `once` and `cooldown` on a reaction (survey row 3)

For the owner: a rule that fires once, or rests, without writing the fact, the `not`, the assign and `silent`.

| Ruling | Why | Test |
|---|---|---|
| **Source only.** `once: true` on a reaction lowers to the engine bool fact `<rule>_done` (default false), `not fact_compare` under `all` beside the authored `when`, and a trailing `fact.assign … true`; `cooldown: N` (logical seconds, ≥ 1) lowers to the engine int fact `<rule>_at`, `time_since {at_least: N}` and a trailing `fact.stamp`. An authored fact of either name, or a write to it, is `RESERVED_FACT` (as tips, `docs/system/cartridge.md:1370`) | The same lowering the compiler does for a choice's `once` (`cartridge.md:1018`); the artifact is unchanged, so no protocol, kernel or reviewer | A rule with `once` fires on the first matching event and not the second in a checkpoint; with `cooldown: 60` it fires, stays silent at +30 s and fires at +61 s |
| **Lint sees the lowered write as deliberate**: the added assign or stamp does not trigger the narrate-or-silent rule | The write is bookkeeping, not a consequence | A `once` rule with a `narrate` step lints clean; one with no step but the lowered assign lints as today's silent rule does. Holds by construction, not by a test: `lib/loka/content/lint.ex` reads the source file before any lowering, so it never sees the added steps. A test would only pass because of that ordering, which is a change detector |
| **Both on `after` rules**: the `once` guard is checked at delivery and again when the job runs (the rule's `when` is, `protocol/reaction.schema.json:529`) | No special case | A delayed `once` rule delivered twice before its job runs fires once |

Built (`test/loka/content_reaction_once_test.exs`, `lib/loka/content/reaction_once.ex`). Two shape
facts the compiler settled that this table assumed:
- **The stamp fact takes no `maximum`.** `protocol/step.schema.json`'s `fact.stamp` accepts an int
  fact with "no maximum, minimum absent or at most 0", so a bounded spec made every stamp step
  invalid; the reserved `_at` fact has `minimum: 0` and no maximum.
- **The `once`/`cooldown` refusals are `RESERVED_FACT`**, not a new code, which is what the survey
  row and the tips precedent name.
- **`once` and `cooldown` need the `policy` capability.** The guard sits in the rule's `when`, and
  `kernel/ts/play/allowed.ts:51` already maps `reactions.when` to `policy`; a cartridge that writes
  `once` without locking `policy` is refused `UNDECLARED_CAPABILITY` at the rule. This is the same
  capability an authored `when` already needs, not a new one, but a writer who only ever wrote
  `on`/`steps` will meet it for the first time here.

A lowered `once` step goes after the rule's own steps and a `cooldown` stamp before `once`'s assign,
so a delayed rule records the time it fired rather than the time it was queued.

Where the firing row is pinned: this repo has no Elixir play harness (no test drives a world), so the
rows are split across layers rather than claimed end to end in one file. The lowering — guard beside
the authored `when`, leaf shape, step order, both refusals — is `content_reaction_once_test.exs`. The
guards' own truth at a clock are the kernel's, hand-computed: `kernel/ts/test/raid.test.ts:482`
fixes `time_since ... at_least: 600` against a stamp at 1000 as false at 1599 and true at 1600, and
`kernel/ts/test/reactions.test.ts` fixes `fact_compare`. So "fires once, rests for its seconds" is
those two facts composed, not a separate test of the composition.

### W2: a rename rewrites the checkpoints (survey row 12)

For the owner: renaming a room, NPC or dialogue does not rot the recorded paths. Ink's order-based paths and
CDPR's deletion markers are the two sides of the lesson.

| Ruling | Why | Test |
|---|---|---|
| **In the `/restructure` route** (in flight, another session): when a key is renamed, every `checkpoints/*.json` step whose intent names the old key (a room, NPC, item, dialogue, choice or fact ref) is rewritten in the same write; the response adds `checkpoints: n` | The editor knows the rename; the checkpoint is `{steps: [{intent} | {advance}]}` (`mobile/app/author/place.ts:7`) and names keys | Rename a room a checkpoint walks into: the file changes, `bin/loka check` stays `ok`; a checkpoint that never names it is byte-identical |
| **Undo covers it**: the route's undo restores the checkpoint bytes with the source | One undo, one write | Undo after the rename restores both |

### L2: three lint rows (survey rows 6, 8, 7)

| Row | Finding | Why | Test |
|---|---|---|---|
| L2a | **Threshold never reachable.** A bounded int fact compared (`fact_compare`, `fact_at_least`) against a value the default plus the sum of every positive `fact.adjust` amount in the cartridge cannot reach, unless a repeatable writer (a repeatable quest's exchange or a reaction on a repeating event) adjusts it | Failbetter's parsimony; a gate that never opens is definite from the source | A fact default 0 adjusted +1, +2 and compared `at_least 5` is a finding; `at_least 3` is not; with a repeatable exchange writer, neither is |
| L2b | **No fallback choice** (warning). A dialogue whose every choice carries a `policy` or `availability` | BioWare's unconditioned last line; Yarn skips the group; a talk that opens with nothing to pick | Two gated choices: a finding; add one ungated `then: end`: none |
| L2c | **A fact without `meaning`** (nit; baseline absorbs today's) | One quality, one meaning; F1's table shows it | planted fact without the field |

### K1: named conditions (survey row 2)

For the owner: write `~trusts you` once and read it at twenty gates. BioWare's defined flags, Osiris's QRY,
Yarn's smart variables.

| Ruling | Why | Test |
|---|---|---|
| **`conditions/<key>.json` holds one Policy; `{"op": "named", "key": "<k>"}` is accepted wherever a Policy is written in source and replaced by that Policy at compile** (`Loka.Content.Resolve`'s stage, before type checks); a cycle is `CONDITION_CYCLE` at the file; an unknown key `UNRESOLVED_REFERENCE` | The artifact never carries the leaf: no protocol, kernel or reviewer; the owner rule allows compile-time shortcuts (`docs/system/owner-rules.md:117`) | Two sites name it: the artifact is byte-identical to the hand-inlined cartridge; a cycle is refused |
| **The Story map shows a condition as a node with its readers; the Trace answers "where is `~k` read"** | The point of a name is to find it | `GET /story` lists the node with two reader edges |
| **The card**: the Policy block's leaf picker offers `named` with the keys | One more leaf in the picker | the picker lists it |

### W3: a lines sheet (survey row 14)

`bin/loka lines <cartridge> [--speaker <key>]`: one row per text key: key, words, speaker or owning node, source
`file:line`, the gate in the explainer's sentence form (`why_words.ts`), a `~` flag, byte length; CSV and JSON. First
for proofreading an area in order; later the on-ramp for voice and localisation, where Yarn's `lock` hash becomes a
column. Test: a planted cartridge with a gated and an ungated line lists both with the gate words on the first.

### E1: a conditional page in a modal scene (survey row 15, engine)

Rulings, contract and parity impact: [survey section 5](../rnd/studio-tooling-survey-2026-11-07.md#5-engine-proposals-contract-parity-reviewer).
Owner question 2 there; not scheduled until answered.

## 3. Candidates dropped or done, with reasons

- **2, story map.** Built. Remaining: the nits in loka-wfrgk.18.8 and .18.10, and S4 (character pages) and S7
  (idle stretches), which wait for an owner question the list cannot answer.
- **5, one-click test saves.** Built: Save under a name in the Play tab, jump replays, a refused step offers
  the drop ([guide](../guides/writing-the-game.md#jump-to-a-beat)). "Save a checkpoint from a story node" adds
  nothing the Play tab lacks.
- **9, `~` tracker.** Built: `/todo`, the palette's `~` filter, placeholders per node, Pacing. One fix stands:
  loka-vduxr.69 (`~words` counts as unwritten).
- **10, barks.** Ambient `when` already covers the state-chosen line pool: the first holding set is active,
  with `every` and `chance` (`entity.schema.json:1619-1660`). An event-driven line is a reaction with a `when`
  and a `narrate` or `emote` step. What Valve's system adds and Loka lacks: a most-specific-rule-wins score
  (the owner orders the sets instead, which is fine for one author), a per-line once or cooldown (`sitting`
  exists only on dialogue choices, `dialogue.schema.json:368`), and a pool shared across speakers. None is
  worth a mechanic before Part 1 shows the need; the one tooling gain is the shadowed-set lint in L1.

## 4. Mechanic gaps found 2026-11-07

| Gap | What the code says | Options | Recommendation |
|---|---|---|---|
| **No step changes weather** | A day's weather is a hash of the world id and the day over the calendar's weighted table (`kernel/ts/src/mechanics/calendar.ts:57-63`; `protocol/cartridge.schema.json:757`); the view says it is derived on read, never stored (`protocol/gameview.schema.json:1200`); only `sky` reads it (`protocol/policy.schema.json:361`) and only `wet` has a mechanical effect (flames) | (a) a `weather.set` step with a duration: a stored override, so a spec amendment, kernel change, reviewer; (b) story weather as an enum fact the scene or reaction sets, read by variants, ambient sets and reactions through `fact_compare`: no engine change, but `sky` and `wet` do not follow it | (b) now for Part 1; (a) when a beat needs a flame that will not light. Owner question 1 |
| **A cutscene choice is two options** | A modal scene has no choice at all: its steps are narrate pages, `await_ack`, `end` (`scene.schema.json:67-69`), and `.cut` has no choice grammar (`lib/loka/content/cut_files.ex:1-6`). The two-option `choice` step is the dream's (`scene.schema.json:128`, `:306-307`) | (a) branch with a `.scene` dialogue after the cut (today's path); (b) a `choice` step in modal scenes with two to four options: protocol, `kernel/ts/src/mechanics/scene/sequence.ts`, the cut grammar, the Scene card, a reviewer | (a) for Part 1; (b) only if the owner wants a choice inside a cutscene's pages. Owner question 2 |
| **Room text by a fact** | Yes: a room's or detail's `variants` are `{when, description}`, tried in order, first holding one shown (`protocol/room.schema.json:630-645`), and `fact_compare` is a `when`; lint refuses an unconditioned or shadowed variant (`lint.ex:76`, `:119-133`) | nothing to build | Checked, no gap |

## 5. Build order

Each slice is one PR under the lean default; sizes are S unless said. No slice changes a protocol file, the
kernel or the Book, except where a row says so.

| Order | Slice | Why here | Acceptance |
|---|---|---|---|
| 1 | **R1** checkpoints re-run after each compile | Cheapest and the biggest safety while Part 1 is being built; D1 and R2 reuse its child process | The R1 tests; a compile with no `checkpoints/` dir pushes none; the panel shows the status word and the Compile card's count |
| 2 | **D1** step panel | The owner is playing Part 1 in the editor now; the answer exists in `why.ts` | The D1 tests; the budget notice; `node:test` on the panel's row builder from a planted report: the first failing leaf is named, a fired rule has none |
| 3 | **C1** consequence preview | Needed before the branching beats of Part 1 are written | The C1 tests; `node:test` on `consequences()` over a planted model; the showcase answers under 50 ms per node |
| 4 | **L1** story lints (Elixir, reviewer) | Definite findings belong in the shared lint; independent of 1 to 3, so it can run in parallel when a slot allows | One ExUnit test per row with a red control; the sampler baseline grows by its listed rows only or stays |
| 5 | **F1** facts table (XS) | Reads what S2 already has | The F1 test; Cmd-K `facts` opens it |
| 6 | **R2** coverage chips | Needs R1's child and more than one checkpoint to be useful | The R2 tests; the chip's title lists the checkpoint names |

### 5b. The survey's slices

Owner 2026-11-07 (paraphrased): the survey's order, R1, W1, D1, K2, C1, L1 + L2, W2, F1 + W4, R2, K1
([survey question 1](../rnd/studio-tooling-survey-2026-11-07.md#7-owner-questions)); the numbers below are the
survey's rows, not the build order. No protocol or kernel change except E1.

| Order | Slice | Size | Why here | Acceptance |
|---|---|---|---|---|
| 7 | **W1** roam | M | The one QA tool every shipping studio built; reuses `flows.ts`, `coverage.ts`, `sim.ts`; a found fault becomes a checkpoint R1 guards | The W1 tests; the showcase timing recorded |
| 8 | **K2** `once` and `cooldown` on reactions | S | The first reactive lines are one-shot rules; same lowering as a choice's `once` | The K2 tests; the compiled artifact of a cartridge without the fields is byte-identical |
| 9 | **L2** rows a, b, c | S | Joins L1's Elixir slice when it runs, else its own, one reviewer | One ExUnit test per row with a red control; the baseline grows by listed rows only |
| 10 | **W2** rename rewrites checkpoints | S | With or after the `/restructure` route | The W2 tests |
| 11 | **W4** F1 columns `meaning`, reachable range | XS | Reads what L2a computes | The F1 test lists the range |
| 12 | **K1** named conditions | S | Before v1; now if Part 1's second area repeats a gate | The K1 tests |
| 13 | **W3** lines sheet | S | Before v1; proofreading first | The W3 test |
| — | **E1** conditional scene page | M, reviewer | Owner question; before v1 | The E1 tests in the survey |

## 6. Owner questions

**Owner 2026-11-07 (paraphrased): yes to each recommendation below.** Decided: weather is a story fact for Part 1
(no `weather.set` step); modal scenes stay choice-free and branch through `.scene` dialogues; D1 accepts the
per-step replay within a stated budget before any kernel firing record; the two new L1 rows are lints with a
baseline; the order is R1, D1, C1, L1, F1, R2. The questions stay below as the record. A reopen of the order (W1
and K2 inserted) is [survey question 1](../rnd/studio-tooling-survey-2026-11-07.md#7-owner-questions).

1. **Weather.** Story weather as a fact the story sets (no engine change; `sky` and `wet` do not follow it), or
   a `weather.set` step (spec amendment, kernel, reviewer)? Recommend the fact for Part 1.
2. **Choices in a cutscene.** Keep modal scenes choice-free and branch through a `.scene` dialogue, or open a
   two-to-four-option `choice` step in modal scenes (protocol and kernel)? Recommend keep, until a beat needs it.
3. **Debugger cost.** D1 replays the run per step. Accept the stated budget and the "jump to a checkpoint"
   notice, or ask for a kernel record of reaction firings (an engine change with a reviewer) so a live answer
   costs nothing? Recommend the budget first.
4. **Lint or view.** The two new L1 rows (compare value never written, shadowed ambient set) as lint with the
   baseline, or as potential findings in the view? Recommend lint: both are definite from the source.
5. **Order.** R1, D1, C1, L1, F1, R2 as above, or C1 first because the branching beats come next?

## Known limits

- A static preview cannot settle a leaf that reads the running world; it says so with a dashed edge and
  never guesses (story map §4.3).
- The kernel records no reaction firing; every live or coverage answer replays a marked cartridge
  (`coverage.ts:20-24`). D1's cost therefore grows with the run; R2's with the number and length of checkpoints.
- A checkpoint proves one path on one seed ([guide](../guides/writing-the-game.md#test-your-checkpoints)); a
  chance roll that flips with a changed number can fail a path that is otherwise fine.
- Not checked in this session: whether the Room card already offers `variants` as a field (the mechanic exists;
  the card is loka-wfrgk.94's area); the World card's referrers-per-fact from `find.ts` (GUI design §4.5); any
  timing beyond the story map's measured 0.5 s run of `reach.ts` on the showcase.
