# Builder's guide: authoring Loka today

Loka currently has a file-based builder workflow. You write JSON source, compile it into a
versioned [cartridge](system/glossary.md), and play or replay the result. The compiler and
loader validate content before a world starts. A visual Builder app, live editing and arbitrary builder spawning are
[future work](system/future.md#authoring-and-certification). Authored bounded
[population plans](system/mechanics.md#c3-bounded-living-hounds-selected-contract) already
create and replace live NPC instances.

This is a route through the installed system, not a second specification. The
[cartridge source and validation rules](system/cartridge.md), [installed mechanics](system/mechanics.md),
[capability map](features.gen.md) and [protocol contracts](../protocol/README.md) govern details.

## The pieces

| Builder term | What you author | What the engine does |
|---|---|---|
| Cartridge | A manifest plus JSON files for a world or chapter | Compiles, hashes and pins the whole release and its capability lock |
| NPC and item definitions | `npcs/<key>.json`, `items/<key>.json` | Instantiates ordinary placements at world creation; population/death templates create their admitted instances with separate IDs and state |
| Room and detail | Places, exits and things to examine | Creates the map and resolves movement, visibility and targets |
| Fact and policy | Typed world values and conditions | Evaluates whether actions, dialogue and reactions apply |
| Action | A player action: a built-in command, or a scripted action with outcomes | Checks target and policy, then runs the command or its outcome's steps |
| Quest, dialogue, story point, scene | Story flow and presentation | Tracks objectives and choices, delivers outcomes and shows authored text |

These rules hold across every kind:

- A definition's displayed name is `name` (an item's, NPC's, room's, action's); an option the player
  picks (a dialogue or scene choice, a quest offer) has a `label`.
- A policy is its condition tree, and it is optional: an absent gate always holds, and an absent trigger (`disposition.hostile`, `friendly`) never fires.
- A story point is `story_point: "<key>/<outcome>"` on the dialogue choice that reaches it (a
  scene's `on_end` may also claim one); there is no story point file.
- One `steps` list serves reactions, scripted action outcomes and dialogue choices; a service's `benefit`
  is one Step, one of the service ops ([steps and checks](system/cartridge.md#steps-and-checks)).
- A dialogue choice's terms (`accept`, `hand_over`, `payment`, `patrol`) are fields; its effects are `steps`.
- One `Check` serves scripted actions and dialogue choices; a choice runs only `opposed`.
- Custom events are the one message between rules: an `event.emit` step in a reaction or scripted action emits a `custom_event`,
  and a reaction `on` `custom_event` with `custom: "<key>"` hears it.

The [glossary](system/glossary.md) distinguishes a definition from a live entity. A compiled
cartridge is an immutable release; changing source and recompiling creates a different content
hash. The [retired first chapter](https://github.com/lorecrafting/lokacore/blob/9b94cb5f094175727ff8cd7f7b26db44775c7a4d/docs/system/cartridge.md#retired-first-chapter-e1-candidate) owns its
release and oracle identity. Existing saves remain pinned to the release that created
them ([save model](system/save.md)).

## Make and try a cartridge

Start from a small development cartridge such as
[`recipe_sampler`](../cartridges/recipe_sampler/) for a composed action or
[`toolbox_showcase`](../cartridges/toolbox_showcase/) for a connected world. Copy its
source into a new cartridge directory before changing it, including its `cartridge.json`
manifest and `text.json` catalog. Give your new cartridge its own ID and version. Keep
references within that cartridge; the compiler resolves short keys by their expected kind.

From the repository root, with the pinned toolchain installed:

```sh
mise exec -- mix loka.compile cartridges/recipe_sampler /tmp/bell.json
mise exec -- bin/loka play /tmp/bell.json
```

The terminal player also accepts a script or a replay transcript:

```sh
mise exec -- bin/loka play /tmp/bell.json --replay cartridges/recipe_sampler/transcripts/scripted_action.jsonl
```

Use the transcript for the cartridge you compiled; see its `transcripts/` directory. A
failed compile prints diagnostics instead of an artifact. Validation covers schema and
capability locks, references, placements and capacities, dialogue/quest links, text keys
and other content relationships ([compiler checks](system/cartridge.md#compiler)). A
compiled artifact is checked again when loaded ([loader](system/cartridge.md#artifact-and-loader)).

## Validate while writing

`schemas/source/` has a JSON Schema for each source file kind ([source schema](system/cartridge.md#source-schema)),
so an editor flags a misspelled field or a malformed shortcut as you type. In VS Code, map them
in the workspace `settings.json`:

```json
"json.schemas": [
  { "fileMatch": ["cartridges/*/rooms/*.json"], "url": "./schemas/source/rooms.schema.json" },
  { "fileMatch": ["cartridges/*/text.json"], "url": "./schemas/source/text.schema.json" }
]
```

Add one entry per directory or root file you edit; the schema file is named after it. Do not put
`$schema` in a source file: the compiler refuses it as `UNKNOWN_FIELD`. The compiler is still
the judge; the schemas do not check references.

## Preview an edit

To see a cartridge in the Book on the web, compile it into the author preview, then, in a second
terminal, start the preview once (from `mobile/app`, `npm run author`; it serves
http://localhost:19006):

```sh
mise exec -- bin/loka dev cartridges/cellar_sampler --watch
```

Each save of a source file recompiles it; the page reloads with the edit in a few seconds.
Without `--watch` it compiles once. A failed compile prints its diagnostics and keeps the last
good cartridge. Each edited cartridge has its own save, so an edit starts a new game and the
normal preview's save is never touched. Add `?dev=1` to the URL for a control that advances game
time through the normal elapsed-time path; the world credits none before the ancestry choice.
Release, test and e2e builds always use the pinned chapter
([`metro.config.js`](../mobile/app/metro.config.js), [`bin/loka dev`](../kernel/ts/play/author.ts)).

The same compiled cartridge runs headless and in a scripted browser walk, so a sampler
([toolbox](MECHANICS-TOOLBOX.md)) is checked without a fixture of its own:

```sh
mise exec -- mix loka.compile cartridges/cellar_sampler /tmp/sampler.json
node kernel/ts/test/sim.ts --cartridge /tmp/sampler.json 1 2 3   # every seed on that cartridge
cd mobile/app && LOKA_WALK=build_sampler mise exec -- npm run walkthrough   # after bin/loka dev cartridges/build_sampler
```

The walk plays `mobile/app/walkthrough/<id>.walk.ts` on the author preview's artifact and writes
the contact sheet to `mobile/app/.walkthrough/contact-sheet.html`; without `LOKA_WALK` it plays
the toolbox showcase.

## Authoring paths and examples

| You want to make… | Source and working example | Engine behavior and limit |
|---|---|---|
| A place with exits or examinable details | `rooms/<key>.json`; [Bell cartridge rooms](../cartridges/recipe_sampler/rooms/) | [Movement and inspection](system/mechanics.md#movement1-kerneltssrcmechanicsmovementrulets); exits and targets must resolve. |
| An item, container, key or piece of equipment | `items/<key>.json`; [showcase items](../cartridges/toolbox_showcase/items/) | [Containment](system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets), [barriers](system/mechanics.md#barrier1-kerneltssrcmechanicsbarrierrulets), [equipment](system/mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets) and carrying settings apply. |
| An NPC definition with HP | `npcs/<key>.json`; [one cellar rat](../cartridges/cellar_sampler/npcs/cellar_rat_1.json) | Its room and text are authored. HP is per entity; [resource rules](system/mechanics.md#resource1-kerneltssrcmechanicsresourcets) govern changes. A schedule is optional. An ordinary NPC definition creates one placement at fresh-world birth; a definition marked `spawn_template` supplies a population/death template and is not placed directly. |
| A fact or condition | `facts.json`, with each policy inline where it is read; [showcase facts](../cartridges/toolbox_showcase/facts.json) | Typed facts and pure policies drive eligibility; see [policy and fact](system/mechanics.md#target_resolution1-policy1-fact1). |
| A player action | `actions/<key>.json`; [ring the bell](../cartridges/recipe_sampler/actions/ring_bell.json) | With `command`, the action names a built-in command; without it, a target, policy, optional check and `success`/`failure` outcomes whose `steps` use registered ops; see [scripted actions](system/mechanics.md#scripted_action1-mechanicsscripted_actionrulets49). No arbitrary script runs. |
| A quest and conversations | `quests/<key>.json`, `dialogues/<key>.json`; [the wizard's errand](../cartridges/toolbox_showcase/quests/errand.json), [its offer](../cartridges/toolbox_showcase/dialogues/wizard_errand.json) | A choice can accept or resolve the quest; [quest](system/mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets) and [dialogue](system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts) document the supported objective and choice forms. |
| Definitions that share most fields | `"extends": "<key>"` and `"abstract": true` in any definition file; [shoo's deer and crow](../cartridges/shoo_sampler/npcs/) | The compiler merges the parent in before anything else reads the source ([Source shortcuts](system/cartridge.md#source-shortcuts)): objects merge, everything else replaces, and the artifact is unchanged. |
| A family of definitions that differ in a few values | `"params"` on the abstract parent with `{"param": "<name>"}` markers, `"with"` on each child; [the showcase wheel](../cartridges/toolbox_showcase/reactions/wheel_shows.json) and [one child](../cartridges/toolbox_showcase/reactions/wheel_1_x_shows_0.json) | Each marker is replaced whole by the child's value, then the child merges over the parent ([Source shortcuts](system/cartridge.md#source-shortcuts)). |
| The same reactions on many NPCs or items | `behaviours/<name>.json` and `"behaviours": ["<name>"]` on each holder; [the fishing spoils](../cartridges/fishing_sampler/behaviours/spoils.json) on [a trout](../cartridges/fishing_sampler/items/trout_02.json) | The compiler copies the reactions per holder, with `holder` bound to it ([Source shortcuts](system/cartridge.md#source-shortcuts)). |
| An area in one file | `areas/<name>.json`, `{"<dir>": {"<key>": definition}}`; [the speech village](../cartridges/speech_sampler/areas/village.json) | The compiler opens the bundle into ordinary definitions before anything else reads the source ([Source shortcuts](system/cartridge.md#source-shortcuts)); diagnostics name the bundle path, and the artifact is unchanged. |
| One rule for many rooms | `"zones"` on rooms and `"zone"` on a reaction; [codex wanderer](../cartridges/codex_sampler/reactions/wanderer.json) | The compiler copies a zone rule per member room ([zones](system/cartridge.md#source-shortcuts)). |
| A consequence or story presentation | `reactions/<key>.json`, a dialogue choice's `story_point`, `scenes/<key>.json`; [bell scene](../cartridges/scene_sampler/scenes/bell_rung.json) | [Reactions](system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [chapters](system/mechanics.md#chapters-kerneltssrcviewviewts) and [scenes](system/mechanics.md#scene1-mechanicsscenerulets) have bounded, typed triggers and steps. |

Put player-facing words in `text.json` and reference their keys from NPC, item and story
definitions ([text rules](system/cartridge.md#text)), or write them in place as
`{"prose": "<words>"}`; the compiler lowers each to a generated key
([inline prose](system/cartridge.md#source-shortcuts)). Put tunable costs, resource bounds and
other world numbers in cartridge data, not engine code ([world parameters](world-parameters.md)).

To check content, replay its transcripts: `node kernel/ts/play/coverage.ts <artifact> [<transcript.jsonl> ...]`
lists the definitions that no transcript exercises
([transcript coverage](system/cartridge.md#transcript-coverage-loka-kgd1942)), and
`node kernel/ts/play/why.ts <artifact> <transcript.jsonl> <ordinal> [--action <key> | --dialogue <key>]`
says why a rule did or did not run at that step ([rule explainer](system/cartridge.md#rule-explainer-loka-kgd1943)).

## What the current builder can express

The installed core covers deterministic IDs and decisions, typed commands/events and
deltas, admission, save receipts and replay. Its content mechanics include movement,
barriers, containment, carrying and equipment, position, inspection, facts and policies,
resources and attributes, checks and scripted actions, quests and dialogue, journal and chapters,
scenes, reactions, schedules, combat, death and same-body return, narration and the
shared GameView. Consult the
[capability map](features.gen.md) for the current installed list and
[mechanics](system/mechanics.md) for exact behavior.

The chapter already uses combat and same-body death/return; its remaining story and
mechanics work is tracked in the [completion plan](archive/MISSING-CHILD-PLAN.md). Current
quests have one objective, evidenced by
a current-state policy or a post-activation item-acquired event. Dialogues have bounded
choices rather than an arbitrary dialogue graph, and scenes
support authored narration/acknowledgement steps. There is no general live
spawner or respawn system: the five cellar rats are five authored static NPC definitions.
These limits matter when planning a new chapter or a Builder UI.

## Carry lessons into another story

Use the [active mechanics specification](system/mechanics.md) and [examples above](#authoring-paths-and-examples)
for current behavior. The [review records](reviews/README.md) retain each PR's findings
and fixes; the [mechanics](lessons/mechanics.md), [storage](lessons/storage.md) and
[contract](lessons/contracts.md) lessons explain failures that apply beyond one chapter.
Compiler and loader checks, contract fixtures and regression tests enforce reusable
rules. A review record preserves the investigation but is not an executable guard.
Before a district or area plan, read the [area authoring checklist](guides/area-authoring.md).
When another story needs a missing mechanic, add it for that real consumer, amend
the active specification and test the failure before updating this guide.

## Builder app direction

The first useful visual builder could edit the same source files, show compiler diagnostics,
and launch a preview using the existing terminal or local Story authority. The current
`Loka.Builder` module is a boundary placeholder, so workspace storage, editing APIs,
live preview controls, certification and publishing still require implementation
([planned authoring work](system/future.md#authoring-and-certification)). Live spawning
would additionally need persisted entity identity, one-to-many NPC lookup and the normal
transactional decision path; the [glossary](system/glossary.md) marks it as planned.
