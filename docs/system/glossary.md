# Glossary

These names describe the current system. Contract identifiers and JSON field names keep
their existing spelling; the [cartridge format](cartridge.md) defines those interfaces. The
[current chapter identity](cartridge.md#current-bundled-chapter) owns the bundled release
and allocation answers.

| Term | Meaning |
|---|---|
| **Capability** | A versioned engine mechanic, such as containment or dialogue. It supplies behavior and validation; see the [feature map](../features.gen.md). |
| **Cartridge** | An immutable, versioned package of compiled world content: NPC and item definitions, rooms, quests, text, settings and its capability lock. It is the package, not an individual creature or item. |
| **Check** | One roll or comparison an action or choice makes before its outcome: `luck`, `threshold`, `attribute_threshold` or `opposed` (`Check` in `protocol/step.schema.json`). A dialogue choice runs only `opposed` ([check@1](mechanics.md#check1-mechanicsscripted_actionrulets109), [steps and checks](cartridge.md#steps-and-checks)). |
| **Dialogue choice** | One answer a player picks in a conversation. Its terms (`accept`, `hand_over`, `payment`, `patrol`) are fields; its effects are its `steps` ([dialogue@1](mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts)). |
| **Instance** | A particular entity in a world, with its own ID and mutable state. Fresh creation instantiates ordinary placed NPC and item definitions; templates are instantiated by the installed [population plans](mechanics.md#c3-bounded-living-hounds-selected-contract) or death mechanics. Multiple instances can share a definition and retain separate HP and custody. |
| **Policy** | A condition tree of `all`, `any`, `not` and leaves ([policy@1](mechanics.md#target_resolution1-policy1-fact1)). A policy is optional; an absent gate always holds, an absent trigger (`disposition.hostile`, `friendly`) never fires. |
| **Reaction** | A rule that answers an event: a trigger, an optional policy and its `steps` ([reaction@1](mechanics.md#reaction1-kerneltssrcmechanicsreactionts)). |
| **Scripted action** | An authored verb on a detail (`scripted_actions` in a cartridge): costs, an optional check, and `success`/`failure` outcomes whose `steps` run in order ([scripted_action@1](mechanics.md#scripted_action1-mechanicsscripted_actionrulets49)). |
| **Service benefit** | What a paid NPC service gives: its `benefit`, exactly one Step whose `op` is a service op such as `meal`, `repair` or `build` ([steps and checks](cartridge.md#steps-and-checks)). |
| **Spawn** | Create an instance from an NPC or item definition at a destination under an owner. Fresh creation, bounded population replacement and dynamic corpses are installed. The [population contract](mechanics.md#c3-bounded-living-hounds-selected-contract) governs admitted births; arbitrary live builder spawning remains [future work](future.md#authoring-and-certification). |
| **Step** | One effect, named by its `op` (`Step` in `protocol/step.schema.json`). Reactions, scripted action outcomes and dialogue choices list Steps in `steps`; each context runs only its own ops ([steps and checks](cartridge.md#steps-and-checks)). |
| **Story point** | A named story beat with outcomes. A dialogue choice's `story_point: "<key>/<outcome>"` or a scene's `on_end` declares it; there is no story point file ([cartridge](cartridge.md#compiler)). |
| **Structure** | A definition of a room a player can build (`structures/<key>.json`, [construction](cartridge.md#structure-and-site-declarations)). |
