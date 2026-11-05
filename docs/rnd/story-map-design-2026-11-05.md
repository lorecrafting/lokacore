# Story map: a generated narrative view of the cartridge (design, loka-wfrgk.18)

Design only. No code, no repo change beyond this file and its index line. Paths are repo-relative at
main `fcb78ae0c`. Owner ask (2026-11-04, paraphrased): a tool that tracks narrative arcs, quest
chains, dialogue and character development the way RPG studios do, with every detail figured out so
it helps make an immersive game. Accepted direction: borrow articy:draft's ideas, not the tool; the
map is **generated from the compiled artifact** so there is one source; read-only first; a view
beside the Map in the editor's three-column shell
([plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md)); build after E2 and E3.
Binding constraints: the owner writes every player-facing word
([prose ruling](../decisions/owner-decision-handwritten-prose-2026-10-31.md)); agents edit the same
source live; the compiler is the validator; this design reopens no editor ruling.

## 0. Decisions at a glance

| Question | Decision |
|---|---|
| Source of the graph | The compiled artifact, walked by the existing `contentGraph` and `reachReport` in `kernel/ts/play/reach.ts` (every DefinitionRef is an edge with its JSON path and `op`). The watcher computes it once per compile and serves `GET /story`, versioned by the artifact hash. No second parser. |
| Source of the beats | One author-side file at the cartridge root, `outline.json`: parts, beats, the nodes each beat binds (short refs), seeds and payoffs. Never in the artifact; the compiler ignores it as it ignores `checkpoints/`. A beat exists before its nodes do, which is what "missing" means. |
| Views | Four, not nine: **Flow** (a swimlane graph: columns are beats or derived layers, lanes are kinds), **List** (the same model as nested lists; also the screen-reader form and the first slice), **Character** (one page per NPC), **Trace** (one fact, quest or story point: set here, read there, never). Pacing and knowledge are panels inside List, not views. |
| What is a node | Quest, story point, chapter, scene, dialogue, reaction, scripted action, fact, topic, NPC. Rooms and items are **anchors** (drawn as tints and chips on a node), never nodes: the Map owns geography. Choices are rows inside their dialogue node, expanded on focus. |
| What cannot be derived | Anything a policy reads from the running world (time, sky, counts, pools, RNG checks, presence) is a **dashed** edge labelled "depends on", never resolved by the view. Unbound, unreached and unresolvable things are shown as such; nothing is guessed. |
| Where checks run | Refusals: the compiler (`mix loka.compile --json`, one source of diagnostics). Author-time definite findings: `mix loka.lint` (its baseline, its Compile card). Potential findings over the graph (reach, orphans, seeds, loops): `reach.ts` and `GET /story`, labelled "potential". The view adds no fourth checker. |
| Edit | Click a node selects `{file, kind, key}`, the inspector shows its card; double-click opens the prose (`.scene` text or the first `~`); Alt-click `POST /open`. The Story map writes nothing; the cards do. |
| Layout | Deterministic swimlane grid, about 150 lines, like the system dashboard's grid ([spec](../design/system-dashboard/spec.md#2-visual-language)). No graph library in v1; `@dagrejs/dagre` is the named fallback for unbound cartridges if the layered fallback reads badly. |
| First slice | `GET /story` plus the List view with beat status, seeds check and fact trace. Size S. Before the prologue is half written. |

## 1. What is there today (read-only findings)

- `kernel/ts/play/reach.ts` already builds the content graph the owner needs: `contentGraph(c)`
  returns `{nodes: [{ref, kind}], edges: [{from, to, path, op?}]}` for every definition and every
  `DefinitionRef` inside it; `reachReport(c)` returns `unreachable` (rooms, items, NPCs, dialogues,
  quests), `behind_lock` and `orphan_facts` (`unused`, `write_only`, `read_only`), with engine facts
  left out (`expectedFacts`, `engineWrittenRefs` in `kernel/ts/src/content/cartridge_position.ts`).
  Documented in [Content reports](../system/cartridge.md#content-reports). Measured on
  `toolbox_showcase` (64 rooms, 43 NPCs, 21 dialogues, 143 reactions, 84 facts): 688 nodes, 1580
  edges, 0.5 s wall for the whole CLI run including Node start and `loadCartridge`. Its header
  says "a report for authors, not a check: nothing reads its output". The Story map is that consumer.
- Story points are not files: the compiler derives `story_points` from each choice's
  `story_point: "<key>/<outcome>"` and each scene's `on_end`, so the compiled map points **from the
  point to its trigger** (`outcomes.<o>.dialogue` + `choice`, or `scene`). Chapters live in
  `cartridge.json` `chapters[]` (`name`, `story_point`, `outcome`). Scenes start on `on.story_point`,
  `on.quest` + `outcome`, or `on.action` + `room` + `detail` (modal), or `on.rest` (presentation
  only). Verified on the compiled `scene_sampler`.
- A choice's `then` is a `Key` (the dialogue key or `end`), not a DefinitionRef, so `contentGraph`
  does not see dialogue chains today (its ponytail note says so). The Story map's walker adds that
  one edge kind (section 4).
- `mix loka.compile --json <file>` writes `[{severity, code, path, rel, line, words}]`
  (`lib/mix/tasks/loka.compile.ex`), and the watcher pushes it as `diagnostics` on the SSE message
  (`kernel/ts/play/live.ts` `Message`). `GET /todo` lists `~` placeholders per source file
  (`kernel/ts/play/todo.ts`). `GET /find?q=` maps a key to source `file:line` and to the definitions
  that name it (`find.ts`). The watcher already loads the artifact in-process for `POST /why`.
- An unknown root file is refused: `entry/3` in `lib/loka/content/source.ex` answers
  `UNKNOWN_FIELD` for `:unknown`, and `classify/1` knows six root files and 21 directories. Only
  `checkpoints/` is skipped, by the watcher and the compiler. `outline.json` therefore needs one
  allowance in `classify/1` (section 5c).
- The author panel is Vite + React 19, shadcn on Radix, Tailwind 4, lucide
  (`tools/author-panel/package.json`); no graph or layout dependency. The Map (E3a, loka-vduxr.52)
  is ruled "plain SVG on Book tokens". The chrome ruling (loka-wfrgk.15) sets the dense scale,
  mono for keys, OS dark mode for chrome, feed and refusal colours, and a categorical area hull
  palette.
- The Book end of the panel (`mobile/app/author/panel.tsx`) accepts `hello advance jump drop trace
  go_to_room set_fact`; `jump` replays a checkpoint's steps; `coverage.ts` can mark which reactions,
  choices, actions and quests a recorded path exercises. Those three are the whole "play from a
  node" story (section 7).
- The prologue outline (`docs/worldbuilding/notes/prologue-outline-2026-10-30.md`) has 48 beats
  in five parts with minutes, a seeds-and-payoffs table of 20 rows, three capacities mapped to
  beats, eight named NPCs and 18 rooms. It is the test case for every view below; no prologue
  cartridge exists yet.

## 2. What the industry does, and what fits a solo author on a MUD-like engine

| Tool | Gets right | Gets wrong for us |
|---|---|---|
| articy:draft | The flow view (nested fragments, pins, jumps), typed entities with templates, global variables with a conditions/instructions syntax, and simulation mode that walks the flow with variable state. Everything references everything; a variable's "where used" is one click. | It is the source: the flow is authored in the tool and exported, so there are two truths and a converter. Its templates become a second schema. Overkill for one author; the licence and the Unity-centric export are beside the point here. We borrow: flow, entities, variables with where-set/where-read, and a simulation that reads real state (our Book is that). |
| Arcweave | Boards as a whiteboard of elements and connections; components (characters, items) attached to elements; global variables and conditions; a play mode. Pleasant to sketch in. | Same two-truths problem; free-form placement means the author does layout by hand, which rots. We generate layout. |
| Twine | Passages and links drawn as a graph that is the story; instant. | Only passage-to-passage links; no world state in the graph, no entities. Our graph must carry facts, quests and reactions, which Twine's never has. |
| Ink, Yarn Spinner | Text-first scripts (our `.scene` is this family); Inky's live player; Yarn's graph view of nodes and jumps. | Their graph views show jumps only and are read-only pictures of the text. Fine as far as it goes; we go further by including what the text sets and reads. |
| Inform 7's Index | Generated, never authored: the Scenes index (begins when, ends when), the Rules index, the World index. Every entry links to the source line. | HTML tables only; no graph. The principle (generated from the compiled program, every row a link to source) is exactly ours. The Index proves a generated view beats an authored one for a solo author. |
| Creation Kit (Bethesda) | Quest stages with scripted fragments, aliases that bind actors and items at runtime, a dialogue view per quest, conditions on everything. Scale-tested. | A form-heavy editor with no overview; writers keep the arc in a spreadsheet. Its "conditions on everything" is our Policy block, already ruled. |
| BioWare (Aurora, Mass Effect) and Obsidian conversation editors | A tree of nodes with conditions and scripts per node; the conversation is the unit; a "preview branch" plays one path. | Per-conversation only; the cross-conversation state lives in scripts the editor cannot see. Our dialogue card (E6d) covers the tree; the Story map covers what their tools miss, the state between conversations. |
| Witcher 3 quest graphs (REDkit) | Quest phases as graph blocks with conditions, facts (`FactsDB`) read and written by name, and a timeline of community spawns per phase. Facts as the universal glue is close to our facts. | Needs a team to read; blocks hide scripts. We keep facts as first-class nodes with set/read edges rather than hidden inside blocks. |
| Disco Elysium's articy use | Showed articy scaling to a million words: dialogue is the game, variables everywhere, the "orb" view of a conversation hub. | They had a team and heavy custom tooling around it. The lesson that survives: hub-and-return conversations plus facts is enough structure for a dense, literate game. |
| Plottr, Aeon Timeline, Scrivener | Beats on a timeline, by plotline and character; scenes tagged with POV and location; corkboard of index cards; word counts per part. Writers think in beats and arcs, not in files. | None knows what the game does with a beat. Our beats overlay (5c) is Plottr's timeline bound to real nodes; words-per-part comes from `todo.ts` for free. |

What a solo author on a MUD-like engine needs that none of them gives whole: one generated picture
of **beats, state and places together**, where every node is also the thing in the Book and the
card in the inspector, and the "simulation" is the real game with checkpoints.

## 3. Purpose: the questions, and which view answers each

| The owner asks | View | How it is answered |
|---|---|---|
| What leads here? | Flow (focus on a node), Trace | The node's inbound edges: `starts`, `leads-to`, `unlocks` and the facts its policy reads, each with its source node; one hop by default, "expand" for the second. |
| Can this quest ever finish? | Trace on the quest; List's lints | Resolvers (a dialogue with `quest`, a reaction `quest.resolve`, a patrol or expedition objective, a deadline) listed; none is a lint finding. The objective's leaves are checked against the reach report: an `has_item` of an unreachable item or a `fact_compare` of a `read_only` fact marks "cannot complete (potential)". |
| Where does Thera change? | Character page | Every policy on her definition and her dialogues (`disposition`, `description_variants[].when`, `schedule_cases`, dialogue `policy`), grouped by the fact they read, placed on her beat timeline. |
| Which seeds have no payoff? | List (beats panel) | `outline.json` seeds and payoffs by name; a seed with no later payoff, a payoff with no earlier seed, and the span between them. |
| What does the player know by beat 20? | List (knowledge panel) | Facts and topics set true by nodes bound to beats 1 to 20, split into **knows** (set by a scene's `on_end`, a reaction on a story point, or every choice of a set) and **may know** (set by one choice among several). |
| Which lines are still `~`? | List, Flow badges | `GET /todo` per file mapped to nodes; a beat is `~` while any of its nodes is. |
| What fires when this fact flips? | Trace | Reactions `on.fact_changed` of it, scenes guarded by it, variants that switch, dialogues that open or close. |
| Why is this beat empty in play? | Flow (focus), play from here | The beat's nodes and their unreached or refused status; one click plays the nearest checkpoint. |

## 4. The data model, derived from the artifact

### 4.1 Nodes

| Kind | Artifact | Label | Anchors shown on the node |
|---|---|---|---|
| quest | `quests/<k>` | `name` text (the journal title) | offer target room or NPC |
| story point | `story_points/<k>` | key, outcome keys | none |
| chapter | `cartridge.chapters[i]` | `name` text | the story point it opens on |
| scene | `scenes/<k>` | key; `treatment` badge | `on.room` for an action start |
| dialogue | `dialogues/<k>` | `prompt` text's first line; `keyword`, `entry`, `quest`, `riddle` badges | speaker NPC and the NPC's start room |
| choice (row inside a dialogue) | `choices/<c>` | `label` text | `then`, `check`, `accept`, `hand_over`, `receive`, `payment`, `sitting`, `once` as badges |
| reaction | `reactions/<k>` | `on.event` and its filters | `on.room`, `on.npc` |
| scripted action | `scripted_actions/<k>` | label text | target room or detail |
| fact | `facts/<k>` | key, type, default, scope | none |
| topic | `topics/<k>` | `name` text | its fact |
| NPC | `npcs/<k>` | name text | start room, area |

Engine facts are folded into their owner: `scene_<k>` into the scene, `story_point_<k>` into the
point, `<d>_<c>_done` (`once`) and `<d>_<c>_asked` into the choice, `seen_tip_<k>` into the action,
`skill_<k>` and `uses_<k>` hidden. The list comes from `expectedFacts` and `engineWrittenRefs`, so
the view never keeps its own.

### 4.2 Edges

Each row names the exact artifact field that produces it. "Ref" means a DefinitionRef object that
`contentGraph` already emits with its `path` and `op`; the view classifies by path and op. Two rows
(marked new) are not refs and need the walker to read a `Key`.

| Edge | From → to | Produced by |
|---|---|---|
| starts | dialogue choice → quest | `choices.<c>.accept` |
| starts | quest offer → quest | `quests.<q>.offer` present (the quest's own node; the target is an anchor) |
| starts | reaction → quest | `steps[i].op = quest.activate` |
| resolves, fails | dialogue → quest | `dialogues.<d>.quest`; `steps[i].op = quest.resolve \| quest.fail` on a reaction; `deadline.outcome` as a fail edge |
| reaches | choice or scene → story point outcome | `story_points.<p>.outcomes.<o>.{dialogue, choice}` or `.scene`, read **backwards** from the compiled map |
| opens | story point outcome → chapter | `cartridge.chapters[i].story_point` + `outcome` (no outcome: every outcome) |
| triggers | story point, quest outcome, scripted action → scene | `scenes.<s>.on.{story_point, quest, action}` + `outcome` |
| triggers | event source → reaction | `reactions.<r>.on`: `fact_changed.fact` (fact → reaction), `quest_resolved.quest`, `story_point_reached.story_point`, `scene_ended.scene`, `choice_resolved.choice` (new: a Key), `action_completed.action`, `entity_entered_room.room` (room anchor), the rest as a labelled source chip |
| leads-to (then) | choice → dialogue | `choices.<c>.then`, `then_failed` (new: a `Key`; `end` draws a terminal) |
| sets | node → fact | any `steps[i]` with `op` `fact.assign`, `fact.adjust`, `fact.stamp`; `scenes.<s>.on_end.assign[i].fact`; `topics.<t>.fact` (a `topic.grant` step sets it); the engine write sites `reach.ts` `SITES` lists |
| reads (requires) | fact → node | every Policy leaf `fact_compare`, `fact_at_least` at `policy`, `when`, `offer.policy`, `objective.policy`, `choices.<c>.policy`, `disposition.*`, `*_variants[].when`, `schedule_cases[].when`, `locks.*`, `opens_when`; `quest_state` reads a quest; `has_item` reads an item anchor |
| grants | choice, scripted action → topic, skill, item | `steps[i].op = topic.grant \| skill.acquire`; `receive.item`; `hand_over.item` (reverse) |
| appears | NPC → dialogue, reaction, scene | `dialogues.<d>.npc`, `roles.*.npc`, `reactions.<r>.on.npc`, `steps[i].npc`, `emote.npc` |
| bound to | beat → node | `outline.json` (section 5c), never the artifact |

Direction follows cause: the thing that happens first is on the left. A `fact` sits between its
writers and its readers, so "what leads here" on a dialogue is its policy's facts and, one hop
further, who sets them.

### 4.3 What cannot be derived statically, and how it shows

| Leaf or field | Why static analysis cannot settle it | Shown as |
|---|---|---|
| `check` on a choice or action | the RNG and the actor's skill decide | a dashed fork from the node: `then` and `then_failed`, or `success` and `failure`, labelled "check" |
| `time_window`, `sky`, `time_since` | the clock and the derived sky | dashed edge from a clock chip, "depends on time" |
| `visited_count`, `population_count`, `resource_compare`, `stat_compare`, `level_compare`, `skill_compare` | counts and pools the player's path produces | dashed edge from a world chip, "depends on play" |
| `npc_present`, `item_present`, `target_present`, `status_active`, `cue_perceived`, `has_item`, `has_tag`, `wearing`, `barrier_state`, `light_off`, `escort_state` | presence and state at the moment of play | dashed edge to the anchor (room, item, NPC, status) when one is named, else a world chip |
| `entity_entered_room`, `rested`, `clock_hour`, `attack_result`, `entity_died` and the other W1 triggers | the player's movement and fights | the reaction keeps its trigger chip; no inbound story edge is drawn |
| `population.spawn`, `npc.move`, `replenish.run` | world ecology | outbound chip, not an edge |
| `expedition`, `patrol` objectives | a route walked in play | the quest shows "route" with its rooms as anchors |

The rule: a solid edge is one the compiler could refuse; a dashed one is a hint. The view never
evaluates a policy. "Test now" against the running world is `POST /why`'s job and stays in the
Why panel (E2 moves it to the console).

### 4.4 Worked spine from the prologue outline

Likely definitions for seven beats, to show what the graph holds. Keys are illustrative; the
owner names them.

| Beat | Nodes | Edges the map draws |
|---|---|---|
| 2 The dream | modal scene `opening_dream` (`treatment: reverie`, words in `scenes/opening_dream.cut`) | **No start trigger exists for a scene at game start** (a scene starts on a story point, a quest outcome or an action's success): the beat shows "missing: nothing starts this scene" until the content brief chooses a trigger. The map catches it before anyone writes a line. |
| 11 First night's dream | presentation-only scene `cradles_dream` (`on.rest` in the hut) | dashed "depends on play" from the rest; `on.rest.credit` sets `dreamt_cradles`; seed `dream` |
| 17 First Cloth | Kira choice `take_coat` reaches `first_cloth/done`; Thera dialogue `thera_walk_back` with `policy: fact_compare first_cloth_done`; Maren dialogue `maren_dreams` reads `dreamt_sphere` | choice → story point → (reaction `cloth_rite` sets `first_cloth_done`) → Thera's dialogue; the dream scene's credit → Maren's dialogue |
| 23 The Three Roots stone | scripted action `read_stone` at the Deep threshold's detail; success `topic.grant three_roots`, `fact.assign thera_yearning_named`; Thera dialogue `thera_stone` reads the topic's fact | action → topic → dialogue; the fact `thera_yearning_named` fans out to beats 28, 37 and 44 |
| 30 The membrane | scripted action `touch_seam` at the Edge; modal scene `membrane_crack` on its success; `on_end` assigns `saw_sphere`, reaches `sky_is_skin/seen` | action → scene → story point; `saw_sphere` pays seed `dream` (beat 2) and `no_stars` (10): the seeds panel shows both spans |
| 35 The records | readable item `your_file` with `topic: witness_class`; Tomas dialogue `tomas_lucid` reads it, reaches `liras_promise/named` | item anchor → topic → dialogue → story point; chapter "Descent" opens on `liras_promise` |
| 37 The Small Grove again | dialogue `thera_small_grove_2` with `policy: quest_state find_thera resolved`, `receive pressed_flower`, sets `wants_to_stay_said`; room `small_grove` `variants[].when` reads `saw_sphere` ("you can no longer hear the Pulse") | quest → dialogue; dialogue grants item; item read by beat 47's policy (`has_item pressed_flower`, dashed); the room variant appears on Thera's page as a change in her place, and in Trace for `saw_sphere` |

## 5. Views

Four views share one model (`GET /story`, section 9) and one selection. Each is a left-column
view in the Map slot (the plan lets the map grow to fill the column), chosen by a segmented
control **Map | Story**, with Story's own sub-tabs List, Flow, Characters. Trace is a panel that
any view opens on a fact, quest or story point. Nothing of this enters the Book strip.

### 5a. Flow: the story graph

- **Layout.** A swimlane grid. Columns: the beats of `outline.json` in order, grouped under parts
  (part headers carry the outline minutes). Without an outline, or for unbound nodes, columns are
  layers from a longest-path layering over the solid edges, seeded at the entry room's NPCs'
  entry dialogues and quests with an offer; unbound nodes get a trailing "unplaced" column so
  nothing is hidden. Lanes (rows): chapter and story point; quest; dialogue and scene; reaction and
  scripted action; fact and topic. Inside a cell, nodes stack in topological order over `then` and
  `leads-to`, then by key, so the order is stable between compiles. Edges are SVG cubic paths
  between cell slots, drawn left to right; an edge that goes right to left is a **loop** and is
  drawn as a back arc above the lanes, which is the loop lint made visible. This is the dashboard
  spec's reasoning: the data has a natural grid (time by kind), so the cells are placed
  deterministically and no general layout engine is needed.
- **Clustering and collapse.** A part collapses to one column showing counts per lane and the
  edges that cross its border; a chapter boundary is a vertical rule with the chapter title. A
  dialogue node collapses its choices; focus expands them in place. An NPC's dialogues can be
  grouped by speaker ("by character") as an alternative lane split.
- **Focus and context.** Click a node: its 1-hop neighbourhood is inked, the rest dimmed to the
  chrome's muted token; a second click on "expand" adds the next hop; Esc restores. Follow a fact:
  pick a fact and every node that sets or reads it stays inked across the whole graph with the
  set edges solid and read edges dashed, until unfollowed.
- **Search and filters.** The search field matches keys, text, event names and fact names;
  matches are inked. Kind filters are toggles per lane. A "needs words" filter keeps only nodes
  with `~` (the hierarchy has the same filter, same name). A "potential problems" filter keeps the
  lint hits of section 6.
- **Badges on a node.** Refusal (red, the count of diagnostics whose `rel` is the node's file);
  `~` (amber, the count from `/todo`); unreached (hollow outline, from `reachReport`); changed in
  the last burst (the feed colour of `by: editor` or `outside`, fading after the next compile).

### 5b. Character pages

One page per NPC (and one for the player as "you", listing player-scope facts set by choices the
outline marks as leanings). Sections, each a list of nodes that selects on click:

1. **Appearances by beat**: the dialogues, scenes (as a role or speaker), reactions filtered on
   this NPC and schedule rooms, placed on the beat timeline; unbound ones in "unplaced".
2. **What changes them**: every policy on the definition and its dialogues, grouped by the fact it
   reads: `disposition.hostile`/`friendly`, `description_variants[].when` (the Book's mood line),
   `name_variants`, `schedule_cases[].when`, `room_line` variants, each dialogue's `policy`. Each
   group shows the fact's setters, so "where does Thera change" is read top to bottom: beat 17
   `first_cloth_done` opens `thera_walk_back`; beat 23 `thera_yearning_named` switches her variant.
3. **What they give and take**: `receive`, `hand_over`, `shop`, `services`, `drops`.
4. **Arc timeline**: one row per beat with a dot per appearance and a mark where a variant or
   disposition switches, so a flat stretch (no change for ten beats) is visible. For Thera the
   outline predicts marks at 17, 23, 26, 31, 37, 44 and 46; a built cartridge whose timeline lacks
   them is the honest signal that the arc is not yet in the rules.

Nothing here is prose. A tone or mood word per beat would have to be written by the owner (section 8).

### 5c. Beats overlay and `outline.json`

**The one source for beats is a small author-side file**, not tags on definitions and not the
markdown outline:

```json
{
  "parts": [
    {"title": "The Radiant Grove", "minutes": 45, "beats": [
      {"n": 2, "title": "The dream", "nodes": ["scenes/opening_dream"], "seeds": ["dream"]},
      {"n": 6, "title": "The Pulse", "nodes": ["dialogues/thera_spring"], "pays": ["dream"], "seeds": ["waiting_for_you", "pulse_strong"]}
    ]}
  ]
}
```

- `nodes` are short refs `<dir>/<key>` (the same spelling the hierarchy and `find.ts` use); a
  choice is `dialogues/<d>/<c>`. `seeds` and `pays` are the owner's names from the outline's table.
  `title` is an author note, never shown to a player, so it is not player prose; the owner still
  owns the words (question 2).
- Why a file and not tags: a beat exists before any node does (that is the "missing" state), a
  node can serve two beats, seeds and payoffs are beat-level, and the outline stays one place the
  owner reorders. Tags would spread 48 beats over 48 files and need a source-schema field per kind.
- Why not the artifact: author notes are not game content and would change the hash on every
  renumbering. The compiler gets one allowance: `classify("outline.json")` answers an ignored kind,
  like `checkpoints/`; `schemas/source/outline.schema.json` describes it for the generic card and the
  editor's registry (it is a declaration path, so E4a's gate lists it as `engine-only: author notes`).
- **Status per beat**, computed by the watcher: **missing** (no `nodes`, or a ref that is not in
  the artifact; the latter is also a refusal shown at the beat with "fix: pick a node"); **`~`**
  (some bound node's file has placeholders in `/todo`); **built** (every node compiles and has no
  `~`). A fourth mark, **unreached**, when every bound node is in `reachReport.unreachable`.
- **Seeds and payoffs check**: each `seeds` name must appear in a later beat's `pays` (else "seed
  without payoff"), each `pays` in an earlier beat's `seeds` (else "payoff without seed"); the
  panel lists each seed with its planted beats, paid beats and span (beats, and minutes summed from
  the parts between). The outline's 20 rows are the test data.
- The beats panel in List shows parts and beats with status chips and counts; in Flow the beats are
  the columns. A beat row's "bind" button opens a Picker over story nodes and writes `outline.json`
  through `POST /change` with `was`, the one write the Story map's own panel makes (it is an author
  file, like a checkpoint; it never touches cartridge content).

### 5d. Fact and condition tracing

Trace opens on a fact, a quest or a story point as a panel below the view:

- **Fact**: declaration (type, default, scope, meaning); **set at** (every `sets` edge with its node,
  the value or amount, and the beat); **read at** (every `reads` edge with the leaf, the compared
  value, and whether the read is solid or dashed); **never set** (`read_only` from `orphan_facts`),
  **never read** (`write_only`), **unused**; **unreachable writers**: setters whose node is in
  `unreachable`, so the fact can only ever be its default (potential). A value timeline: for an
  enum or bool, which beats leave it which value along the bound order, with "may" for choice-set
  values.
- **Quest**: starters, resolvers, failers, the objective's leaves with their reach status, the
  journal's five texts with `~` marks, deadline, hints; "cannot complete (potential)" when no
  resolver exists or the objective reads an unreachable item or a never-set fact.
- **Story point**: its outcomes and their triggers, the chapters, scenes and reactions that consume
  each outcome; an outcome nothing consumes is "dangling (nothing happens)".

### 5e. Player knowledge at a beat

Pick a beat in List: the knowledge panel lists facts and topics that are true after it, derived
from the `sets` edges of nodes bound to beats up to and including it. **Knows**: set by a scene
`on_end`, a reaction on a story point or scene end, a `receive`/`accept` the beat's only dialogue
forces, or every choice of a set; **may know**: set by one choice among several, or behind a
dashed read. Facts never set by then are "not yet". Topics come from `topic.grant` and readable
items' `topic`. This is derivable because it reads only solid `sets` edges and the bound order; the
honest limit is stated on the panel: "assumes the player took the beats in outline order".

## 6. Reachability and lint

| Finding | Where it runs | Why there |
|---|---|---|
| Unresolved refs, duplicate story point claims, `then` on a point-reaching choice, chapters without points, entry markers | compiler (exists) | definite; already `Diagnostic` with `path` |
| `LOOP_SPEAKER`, `ENTRY_GUESSED`, `SPEAKER_ELSEWHERE`, `SITTING_SPENT` | compiler warnings (exist) | definite, structural |
| Quest with no resolver; story point outcome nothing consumes; a scene no trigger site can reach (its `on.story_point` outcome has no trigger); a reaction cycle through `fact_changed` with no `when` that breaks it | `mix loka.lint` (new rows, Elixir, baseline) | definite from the source alone; the Compile card already lists lint lines |
| Unreachable rooms, NPCs, dialogues, quests; `behind_lock`; `orphan_facts`; unreachable fact writers; "cannot complete (potential)" | `reach.ts` (exists) via `GET /story` | potential checks over initial state; labelled so |
| Seeds without payoff, payoffs without seed, missing or dangling beats, `~` per beat | watcher, `GET /story` | author notes, not content; never a compile failure |

How a refusal shows at the node with the fix one click away (promise 3): each diagnostic has
`rel` and `path`; the node whose source file is `rel` carries the red badge with the count; its
hover lists the `words` lines; clicking one selects the node's card and the card places the
diagnostic at its field by `path` (E4a's placement, [GUI design 5.5](gui-editor-design-2026-11-04.md#55-refusals-shown-in-place)).
Lint lines map by their `rel` the same way. Potential findings carry a "potential" chip and link to
the Trace panel that explains them; they never use the refusal colour.

## 7. Interaction with the rest of the editor

- **Selection.** One selection `{file, kind, key}` (E2). A node click sets it; the hierarchy,
  Map and inspector follow; selecting in any of them inks the node in Story if it has one. A room
  selected on the Map inks the Story nodes anchored there. A Book click (which plays and selects)
  inks the dialogue or action it touched.
- **Edit where it shows.** Click: the card. Double-click: the prose, through the card's Scene text
  or Prose block at the first `~` of that node, else its prompt (E5's `/edit` route); the Story map
  never shows a text field. Alt-click: `POST /open`. The one write the Story panel owns is
  `outline.json` (5c).
- **Play from a node.** Two offers on a node's hover card: **play to here**, the checkpoint whose
  recorded path exercises the node (run `coverage.ts`'s marking over each checkpoint on the
  current artifact hash once per compile, in the `limited` child like Numbers; a node with no
  covering checkpoint says "no checkpoint reaches this yet; save one from Play"); and **jump
  here**, a synthesized path: `dev_go_to_room` to the node's anchor room, then `dev_set_fact` for
  each `fact_compare`/`fact_at_least` leaf in its policy. Each refusal the cheats return is shown
  in the plain sentence the panel already uses; a `quest_state` leaf cannot be set by a cheat, so
  the hover says "needs quest X active: play to here from checkpoint Y or accept it at Z" with Z
  the starter node. Both go through the Book's `jump` and the normal replay, so a reload replays them.
- **Live updates.** The SSE message gains nothing new for the graph: the view refetches
  `GET /story` when `diagnostics` or `changed` arrive and the artifact hash the Book posts
  differs; `changed[].file` maps to nodes and paints the feed colour for one compile. Hold keeps the
  last model; the badge counts waiting changes as elsewhere.
- **Cmd-K.** Story entries beside keys and commands: `beat 23`, `story: thera_stone`, `follow
  fact saw_sphere`, `trace quest find_thera`, `character thera`, `story: needs words`. The palette
  reads the same `/story` model, so a new node is findable as soon as it compiles.
- **Checkpoints as story states.** A checkpoint's covered nodes (above) are shown as a chip on
  each node ("in: start, after_rite"), so the owner sees which saved places reach which beats.

## 8. Immersion aids that a writer actually uses

Kept only what is derivable or one cheap owner word. Anything that needs an agent to read or write
prose is out (the prose ruling); such items are flagged.

| Aid | Derivable? | Shown |
|---|---|---|
| Pacing | yes | Per part: outline minutes (owner's), beats, nodes, words written (`/todo` word counts summed over bound files), and words per outline minute against the median part; a part far below the median is marked "thin", far above "dense". Not a judgment of quality, only of mass. |
| Foreshadowing distance | yes | Seeds panel: span in beats and minutes; a seed paid within two beats is marked "close", one paid five parts later "long"; both are information, not findings. |
| Rooms and senses that recur | yes | Per room (Map-anchored): the beats whose nodes anchor there; a room in no beat ("never visited by the story") and a room in ten ("the hearth") both read at a glance. Per room the `cues` (sense_cue) by sense, so a story with no smell for three parts is visible. |
| Idle stretches | partly | A beat whose nodes offer the player nothing to do: no dialogue the player can open, no scripted action, no detail with a page in its anchor rooms, no reaction on the player's own acts. Derivable from anchors and edges; "partly" because availability depends on policies the view does not evaluate. Labelled potential. |
| Tone or mood per scene | **no** | Would need a reader of the prose. Option: one owner word per beat in `outline.json` (`tone`), shown as a chip and a strip across the timeline. Recommend skipping until the owner asks (question 6). |
| Leaning choices | yes | The outline's four leaning choices (15, 24, 42, 43) are facts; the player page lists their setters and the paid books' readers (none yet), so "nothing is scored or shown" is checkable: a reader inside the free story would be a finding. |

## 9. Scale and speed

- **Sizes.** Prologue estimate from the outline: 18 rooms, 8 NPCs, about 40 dialogues, 15 scenes,
  60 reactions, 60 facts, 10 quests, 12 topics, 15 story points, 5 chapters: about 250 story nodes
  and 600 solid edges. A full game of five books: about five times that, 1200 nodes and 3000
  edges, still a fifth of the measured showcase per view because parts collapse. The showcase
  itself (688 nodes, 1580 edges) is the stress case and compiles the graph in well under the 0.5 s
  the whole CLI run takes.
- **Where the work runs.** The watcher computes the model in-process after each successful
  compile, from the artifact it already loads for `/why`: `contentGraph`, `reachReport`, the
  `then` and `choice_resolved` edges, `/todo` by node, diagnostics by node, `outline.json`
  status. Linear in the artifact. It is served by `GET /story` with the artifact hash as the ETag
  and cached until the next compile; the SSE message does not carry it (a 1580-edge model is
  about 300 KB, too heavy per push).
- **Layout cost.** Swimlane placement is one pass over nodes and one over edges; the longest-path
  layering for unbound nodes is a topological sort, linear. Rendering: nodes as absolutely
  positioned HTML chips (real buttons) over one SVG layer of paths; React keys by ref so a recompile
  rerenders only changed nodes; collapsed parts render one chip each.
- **Budgets.** Open under 300 ms: fetch (cached, gzipped, about 60 KB for the prologue) plus
  layout (about 5 ms at 250 nodes) plus first paint. Update under 100 ms: the model diff by ref,
  layout again, keyed render. Measured in the slice with `performance.mark` around fetch, layout
  and commit, shown in the panel's timings beside E2's compile and publish numbers; a budget miss
  is a visible number, not a guess.
- **Library.** None in v1 (`tools/author-panel/package.json` has none and the Map is plain SVG).
  The named fallback for an unbound cartridge whose layered columns read badly is
  `@dagrejs/dagre` (maintained fork, about 60 KB, no transitive dependencies), used for layout
  coordinates only and still drawn as our SVG; `elkjs` (over 1 MB) and React Flow (owns the
  canvas) are excluded. The dependency lives in the panel, which never enters the app's bundle.

## 10. Style and accessibility

- **Chrome.** Follows loka-wfrgk.15: dense scale (text-sm, 28 px chips), mono for keys and refs,
  OS light or dark for the chrome, decoupled from the strip's solar palette; the feed colours for
  `editor`/`outside` changes; the refusal colour only for compiler errors. Node **kind is shape
  and icon** (lucide: a flag for story points, a scroll for quests, a speech bubble for dialogues,
  a film strip for scenes, a bolt for reactions, a hand for actions, a tag for facts, a book for
  topics, a person for NPCs), never colour alone; the area hull palette tints a node's anchor
  chip so Map and Story agree on what an area looks like. Dashed strokes for "depends on", hollow
  chips for unreached, a hatched chip for a missing beat. The designer rules the final set in the
  slice's pass.
- **Keyboard.** The graph is a list of focusable chips in reading order (part, lane, cell): Tab
  moves between parts, arrows move within a part (left and right across beats, up and down across
  lanes), Enter selects (the card opens), Shift+Enter follows the first outbound edge, Backspace the
  first inbound, `f` follows the focused fact, `/` searches, Esc clears focus and context. Every
  shortcut is also a button.
- **Screen reader.** List is the equivalent form of Flow, not a fallback: the same model as
  nested lists (part, beat, node, then "leads to", "sets", "reads" sub-lists), with status in text.
  Edges in Flow are `aria-hidden` SVG; the information is in List and on the node's hover card
  (a popover with the same lists). Live region announces the beat count that changed after a
  compile. Axe at error level passes under the panel's smoke run when one exists; until then the
  owner walk includes one keyboard-only pass.

## 11. Slice plan

Each slice is one PR, each test names the break it catches. "Reviewer" per the lean default: only
shared Elixir tooling gets one. v1 is S1 to S3, before the prologue is half written.

| # | Slice | Size | Depends on | Tests | Reviewer or designer |
|---|---|---|---|---|---|
| S1 | **Story model.** `GET /story` in `live.ts`: `contentGraph` + `reachReport` + `then`/`choice_resolved` edges + `/todo` by node + diagnostics by node + `outline.json` beats with status and seeds check, computed once per compile, ETag by hash. `classify("outline.json")` ignored by the compiler; `schemas/source/outline.schema.json`. `bin/loka story <cartridge>` prints the model (the CLI form, like `reach.ts`). | S | E1 (merged) | `node:test` on a planted source tree: a seed without payoff and a payoff without seed are listed; a beat binding a ref not in the artifact is `missing` with that ref; a beat whose node has `~` is `~`, the same node with words is `built`; a `then: end` draws no edge and `then: hub` draws one; the model's hash equals the artifact's. Elixir: a cartridge with `outline.json` compiles byte-identical to one without (the ignore rule); a planted `outline.json` with bad JSON is a watcher refusal, not a compile error. Red control: break the seeds check and watch the first test fail. | none (one-line compiler allowance, lean); PM may ask a reviewer if `classify` grows |
| S2 | **List view + Trace.** The Story segment in the Map slot: parts and beats with status chips, node rows with badges, selection sync, "bind" through `POST /change` on `outline.json`, the Trace panel for facts, quests and story points, the knowledge and pacing panels, keyboard order, Cmd-K entries. | S | S1, E2 | Pure functions with `node:test`: knowledge at beat N splits knows/may-know on a planted model (two-choice set vs `on_end`); pacing marks the thin part on planted word counts; Trace lists a `read_only` fact as never set. Owner walk on the showcase and on a stub prologue skeleton. | designer pass (density, chips) |
| S3 | **Flow graph.** Swimlane layout, edges, collapse per part, focus and context, follow a fact, filters, badges, hover card with play offers (stub), double-click and Alt-click. | M | S2, E3a (shared pan and zoom) | `node:test` on the layout function: a right-to-left edge is classed a loop; nodes in one cell keep topological then key order under a permuted input; unbound nodes land in the trailing column; a collapsed part reports the edges that cross it. Timing marks printed in the panel; the owner walk reads them against the budgets. | designer pass (shapes, dashes, dark) |
| S4 | **Character pages.** Appearances, what changes them, gives and takes, arc timeline. | S | S2 | `node:test`: a variant `when` on a fact places a mark at the beat whose node sets it; an NPC with no appearances renders an empty timeline (no invented rows). | none |
| S5 | **Play from a node.** Coverage of checkpoints per node (child process, cached per hash); jump here by `go_to_room` + `set_fact` with refusals shown; checkpoint chips on nodes. | S | S2, E2 (Play in the console) | `node:test`: a planted trace marks the choice it took and not its sibling; a policy with `quest_state` yields the "needs quest" sentence naming the starter node, never a cheat step. | none |
| S6 | **Story lints** in `mix loka.lint`: quest with no resolver, story point outcome nothing consumes, unreachable scene trigger, reaction fact cycle without a breaking `when`. Baseline rows for the showcase if any. | S | none (parallel) | ExUnit on planted cartridges: each finding appears; the sampler corpus stays at its baseline; red control by removing a resolver. | reviewer (shared Elixir tooling) |
| S7 | **Idle stretches, rooms and senses recurrence**, tone word if ruled in. | S | S3 | `node:test`: a beat anchored in a room with no action, dialogue or detail page is marked idle; a room with cues of one sense only is listed under the missing senses. | none |

What ships before the prologue is half written: S1 to S3 (the owner's "which seeds have no
payoff", "which lines are still `~`", "what leads here" and refusals on nodes). S4 to S7 follow in
lean slots. No slice changes a protocol file, the kernel or the Book.

## 12. Open questions for the owner, with recommendations

1. **Beats in `outline.json` at the cartridge root, ignored by the compiler** (vs tags on
   definitions, vs keeping the markdown outline). Recommend the file: beats exist before nodes,
   seeds are beat-level, one place to reorder.
2. **Who writes the beat titles and seed names.** They are author notes, never shown to a player.
   Recommend: an agent may seed the file from the owner's 2026-10-30 outline table and beat
   purposes verbatim; the owner edits freely; no player-facing word is involved.
3. **Where Story lives.** Recommend the left column's Map slot behind a Map | Story segment,
   growing to the column, with Cmd-\ collapsing the inspector for a wide graph; never in the Book
   strip and never a fourth column (the plan's three columns stand).
4. **Definite story findings into `mix loka.lint`** (shared baseline, reviewer) vs view-only.
   Recommend lint for the four definite ones in S6; everything potential stays in the view.
5. **Knowledge panel semantics.** Show "may know" (choice-set facts) beside "knows", or only
   forced knowledge? Recommend both, labelled; a writer plans around what the player might know.
6. **A tone word per beat** in `outline.json`. Recommend not now; add when the owner asks for it
   while writing Part 2.
7. **No layout library in v1**, `@dagrejs/dagre` as the fallback. Recommend yes; the beats give
   the x axis for free, and an articy-style free canvas would make the map a second source.
8. **Order.** S1 can run before E2 in any lean slot (it is a route and a CLI); S2 and S3 wait for
   E2 and E3a as ruled. Recommend S1 right after E2 starts, so the shell lands with data to show.

## 13. Not checked, and risks

- I ran two compiles (`scene_sampler`, `toolbox_showcase`) and one `reach.ts` run; every other
  `file:line` and shape is a reading. The `then` edge shape (a `Key`) is from
  `protocol/dialogue.schema.json`; no cartridge in the repo uses `then` or `once` yet, so S1's
  planted tree is the first exercise of that edge.
- The prologue has no cartridge. Beat 2's "no start trigger for an opening scene" is a real gap in
  scene@1 (starts are story point, quest outcome, action success or rest), surfaced here as a
  finding the beats overlay would show; it belongs in the prologue content brief, not this design.
- The "cannot complete (potential)" join (quest objective leaves against the reach report) is only
  as good as `reachReport`, which is static initial state: rooms reached by transport or scripted
  action show unreachable. The chip says "potential" for that reason.
- `outline.json` as an ignored root file makes the compiler's `UNKNOWN_FIELD` guard one entry
  looser. The S1 Elixir test pins that the artifact bytes do not change, and the schema makes the
  file a gated declaration path.
- Coverage of checkpoints (S5) replays every checkpoint per compile in a child; on a long path
  that is seconds, so it is cached by hash and runs after the model, never before the view shows.
- Layout quality for an unbound cartridge (the showcase) is unproven; the fallback is named and
  costs one dependency in the panel only.
- Token cost: S1 to S3 at S, S, M is about a week of lean slots beside the E6 inspectors; S4 to S7
  can wait until the owner is writing Part 2 and asks a question the List view cannot answer.
