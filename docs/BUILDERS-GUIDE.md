# Builder's guide: authoring Loka today

Loka currently has a file-based builder workflow. You write JSON source, compile it into a
versioned [cartridge](system/glossary.md), and play or replay the result. The compiler and
loader validate content before a world starts. A visual Builder app, live editing and live
spawning are [future work](system/future.md#authoring-and-certification).

This is a route through the installed system, not a second specification. The
[cartridge source and validation rules](system/cartridge.md), [installed mechanics](system/mechanics.md),
[capability map](features.gen.md) and [protocol contracts](../protocol/README.md) govern details.

## The pieces

| Builder term | What you author | What the engine does |
|---|---|---|
| Cartridge | A manifest plus JSON files for a world or chapter | Compiles, hashes and pins the whole release and its capability lock |
| Blueprint | An NPC or item definition | Creates one entity from each blueprint when a new world starts; each entity has its own ID and mutable state |
| Room and detail | Places, exits and things to examine | Creates the map and resolves movement, visibility and targets |
| Fact and policy | Typed world values and conditions | Evaluates whether actions, dialogue and reactions apply |
| Recipe | A composed player action | Checks target and policy, then applies its registered consequences |
| Quest, dialogue, story point, scene | Story flow and presentation | Tracks objectives and choices, delivers outcomes and shows authored text |

The [glossary](system/glossary.md) distinguishes a blueprint from a live entity. A compiled
cartridge is an immutable release; changing source and recompiling creates a different content
hash. Existing saves remain pinned to the release that created them ([save model](system/save.md)).

## Make and try a cartridge

Start from a small development cartridge such as
[`ashmere_bell`](../cartridges/ashmere_bell/) for a composed action or
[`ashmere_sampler`](../cartridges/ashmere_sampler/) for a connected chapter sample. Copy its
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
| A place with exits or examinable details | `rooms/<key>.json`; [Bell cartridge rooms](../cartridges/ashmere_bell/rooms/) | [Movement and inspection](system/mechanics.md#movement1-kerneltsrcmechanicsmovementrulets); exits and targets must resolve. |
| An item, container, key or piece of equipment | `items/<key>.json`; [Sampler items](../cartridges/ashmere_sampler/items/) | [Containment](system/mechanics.md#containment1-kerneltsrcmechanicscontainmentrulets), [barriers](system/mechanics.md#barrier1-kerneltsrcmechanicsbarrierrulets), [equipment](system/mechanics.md#equipment1-kerneltsrcmechanicsequipmentrulets) and carrying settings apply. |
| An NPC blueprint with a schedule and HP | `npcs/<key>.json`; [one cellar rat](../cartridges/ashmere_sampler/npcs/cellar_rat_1.json) | Its room and text are authored. HP is per entity; [resource rules](system/mechanics.md#resource1-kerneltsrcmechanicsresourcets) govern changes. Schedule is optional. Each file creates one NPC at fresh-world birth. |
| A fact or condition | `facts.json`, `policies/<key>.json`; [Sampler facts](../cartridges/ashmere_sampler/facts.json) | Typed facts and pure policies drive eligibility; see [policy and fact](system/mechanics.md#target_resolution1-policy1-fact1). |
| A player action | `recipes/<key>.json`; [ring the bell](../cartridges/ashmere_bell/recipes/ring_bell.json) | A target, policy and success/failure sequences compose registered outcomes; see [recipes](system/mechanics.md#action_recipe1-mechanicsaction_reciperulets49). No arbitrary script runs. |
| A quest and conversations | `quests/<key>.json`, `dialogues/<key>.json`; [lantern quest](../cartridges/ashmere_sampler/quests/lantern.json), [Bram's offer](../cartridges/ashmere_sampler/dialogues/bram_offer.json), [return](../cartridges/ashmere_sampler/dialogues/bram.json) | A choice can accept or resolve the quest; [quest](system/mechanics.md#quest1-mechanicsquestrulets-kerneltsrcmechanicsquestlifecyclets) and [dialogue](system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltsrcmechanicsdialoguesharedts) document the supported objective and choice forms. |
| A consequence or story presentation | `reactions/<key>.json`, `story_points/<key>.json`, `scenes/<key>.json`; [bell scene](../cartridges/ashmere_scene/scenes/bell_rung.json) | [Reactions](system/mechanics.md#reaction1-kerneltsrcmechanicsreactionts), [chapters](system/mechanics.md#chapters-kerneltsrcviewviewts) and [scenes](system/mechanics.md#scene1-mechanicsscenerulets) have bounded, typed triggers and steps. |

Put player-facing words in `text.json` and reference their keys from blueprints and story
definitions ([text rules](system/cartridge.md#text)). Put tunable costs, resource bounds and
other world numbers in cartridge data, not engine code ([world parameters](world-parameters.md)).

## What the current builder can express

The installed core covers deterministic IDs and decisions, typed commands/events and
deltas, admission, save receipts and replay. Its content mechanics include movement,
barriers, containment, carrying and equipment, position, inspection, facts and policies,
resources and attributes, checks and recipes, quests and dialogue, journal and chapters,
scenes, reactions, schedules, narration and the shared GameView. Consult the
[capability map](features.gen.md) for the current installed list and
[mechanics](system/mechanics.md) for exact behavior.

The chapter still needs combat, death/return and later Missing Child story integration
([mechanics queue](NEXT-MECHANICS.md)). Current quests have one objective, evidenced by
a current-state policy or a post-activation item-acquired event. Dialogues have bounded
choices rather than an arbitrary dialogue graph, and scenes
support authored narration/acknowledgement steps. There is no general live blueprint
spawner or respawn system: the five cellar rats are five authored static NPC blueprints.
These limits matter when planning a new chapter or a Builder UI.

## Builder app direction

The first useful visual builder could edit the same source files, show compiler diagnostics,
and launch a preview using the existing terminal or local Story authority. The current
`Loka.Builder` module is a boundary placeholder, so workspace storage, editing APIs,
live preview controls, certification and publishing still require implementation
([planned authoring work](system/future.md#authoring-and-certification)). Live spawning
would additionally need persisted entity identity, one-to-many NPC lookup and the normal
transactional decision path; the [glossary](system/glossary.md) marks it as planned.
