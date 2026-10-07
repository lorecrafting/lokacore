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
| Blueprint | An NPC or item definition | Instantiates ordinary placements at world creation; population/death templates create their admitted instances with separate IDs and state |
| Room and detail | Places, exits and things to examine | Creates the map and resolves movement, visibility and targets |
| Fact and policy | Typed world values and conditions | Evaluates whether actions, dialogue and reactions apply |
| Recipe | A composed player action | Checks target and policy, then applies its registered consequences |
| Quest, dialogue, story point, scene | Story flow and presentation | Tracks objectives and choices, delivers outcomes and shows authored text |

The [glossary](system/glossary.md) distinguishes a blueprint from a live entity. A compiled
cartridge is an immutable release; changing source and recompiling creates a different content
hash. The [current bundled chapter](system/cartridge.md#current-bundled-chapter) owns its
release and oracle identity. Existing saves remain pinned to the release that created
them ([save model](system/save.md)).

## Make and try a cartridge

Start from a small development cartridge such as
[`ashmere_bell`](../cartridges/ashmere_bell/) for a composed action or
[`ashmere_missing_child`](../cartridges/ashmere_missing_child/) for a connected chapter. Copy its
source into a new cartridge directory before changing it, including its `cartridge.json`
manifest and `text.json` catalog. Give your new cartridge its own ID and version. Keep
references within that cartridge; the compiler resolves short keys by their expected kind.

From the repository root, with the pinned toolchain installed:

```sh
mise exec -- mix loka.compile cartridges/ashmere_bell /tmp/ashmere-bell.json
mise exec -- bin/loka play /tmp/ashmere-bell.json
```

The terminal player also accepts a script or a replay transcript:

```sh
mise exec -- bin/loka play /tmp/ashmere-bell.json --replay cartridges/ashmere_bell/transcripts/action_recipe.jsonl
```

Use the transcript for the cartridge you compiled; see its `transcripts/` directory. A
failed compile prints diagnostics instead of an artifact. Validation covers schema and
capability locks, references, placements and capacities, dialogue/quest links, text keys
and other content relationships ([compiler checks](system/cartridge.md#compiler)). A
compiled artifact is checked again when loaded ([loader](system/cartridge.md#artifact-and-loader)).

## Authoring paths and examples

| You want to make… | Source and working example | Engine behavior and limit |
|---|---|---|
| A place with exits or examinable details | `rooms/<key>.json`; [Bell cartridge rooms](../cartridges/ashmere_bell/rooms/) | [Movement and inspection](system/mechanics.md#movement1-kerneltssrcmechanicsmovementrulets); exits and targets must resolve. |
| An item, container, key or piece of equipment | `items/<key>.json`; [Missing Child items](../cartridges/ashmere_missing_child/items/) | [Containment](system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets), [barriers](system/mechanics.md#barrier1-kerneltssrcmechanicsbarrierrulets), [equipment](system/mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets) and carrying settings apply. |
| An NPC blueprint with HP | `npcs/<key>.json`; [one cellar rat](../cartridges/ashmere_missing_child/npcs/cellar_rat_1.json) | Its room and text are authored. HP is per entity; [resource rules](system/mechanics.md#resource1-kerneltssrcmechanicsresourcets) govern changes. A schedule is optional. An ordinary NPC definition creates one placement at fresh-world birth; a definition marked `spawn_template` supplies a population/death template and is not placed directly. |
| A fact or condition | `facts.json`, `policies/<key>.json`; [Missing Child facts](../cartridges/ashmere_missing_child/facts.json) | Typed facts and pure policies drive eligibility; see [policy and fact](system/mechanics.md#target_resolution1-policy1-fact1). |
| A player action | `recipes/<key>.json`; [ring the bell](../cartridges/ashmere_bell/recipes/ring_bell.json) | A target, policy and success/failure sequences compose registered outcomes; see [recipes](system/mechanics.md#action_recipe1-mechanicsaction_reciperulets49). No arbitrary script runs. |
| A quest and conversations | `quests/<key>.json`, `dialogues/<key>.json`; [first lead](../cartridges/ashmere_missing_child/quests/first_lead.json), [Elspeth's dialogue](../cartridges/ashmere_missing_child/dialogues/elspeth.json) | A choice can accept or resolve the quest; [quest](system/mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets) and [dialogue](system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts) document the supported objective and choice forms. |
| A consequence or story presentation | `reactions/<key>.json`, `story_points/<key>.json`, `scenes/<key>.json`; [bell scene](../cartridges/ashmere_scene/scenes/bell_rung.json) | [Reactions](system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [chapters](system/mechanics.md#chapters-kerneltssrcviewviewts) and [scenes](system/mechanics.md#scene1-mechanicsscenerulets) have bounded, typed triggers and steps. |

Put player-facing words in `text.json` and reference their keys from blueprints and story
definitions ([text rules](system/cartridge.md#text)). Put tunable costs, resource bounds and
other world numbers in cartridge data, not engine code ([world parameters](world-parameters.md)).

## What the current builder can express

The installed core covers deterministic IDs and decisions, typed commands/events and
deltas, admission, save receipts and replay. Its content mechanics include movement,
barriers, containment, carrying and equipment, position, inspection, facts and policies,
resources and attributes, checks and recipes, quests and dialogue, journal and chapters,
scenes, reactions, schedules, combat, death and same-body return, narration and the
shared GameView. Consult the
[capability map](features.gen.md) for the current installed list and
[mechanics](system/mechanics.md) for exact behavior.

The chapter already uses combat and same-body death/return; its remaining story and
mechanics work is tracked in the [completion plan](MISSING-CHILD-PLAN.md). Current
quests have one objective, evidenced by
a current-state policy or a post-activation item-acquired event. Dialogues have bounded
choices rather than an arbitrary dialogue graph, and scenes
support authored narration/acknowledgement steps. There is no general live blueprint
spawner or respawn system: the five cellar rats are five authored static NPC blueprints.
These limits matter when planning a new chapter or a Builder UI.

## Carry lessons into another story

Use the [active mechanics specification](system/mechanics.md) and [examples above](#authoring-paths-and-examples)
for current behavior. The [review index](reviews/README.md) retains each PR's findings
and fixes; the [mechanics](lessons/mechanics.md), [storage](lessons/storage.md) and
[contract](lessons/contracts.md) lessons explain failures that apply beyond one chapter.
Compiler and loader checks, contract fixtures and regression tests enforce reusable
rules. A review record preserves the investigation but is not an executable guard.
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
