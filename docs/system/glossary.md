# Glossary

These names describe the current system. Contract identifiers and JSON field names keep
their existing spelling; the [cartridge format](cartridge.md) defines those interfaces. The
[current chapter identity](cartridge.md#current-bundled-chapter) owns the bundled release
and allocation answers.

| Term | Meaning |
|---|---|
| **Capability** | A versioned engine mechanic, such as containment or dialogue. It supplies behavior and validation; see the [feature map](../features.gen.md). |
| **Cartridge** | An immutable, versioned package of compiled world content: NPC and item definitions, rooms, quests, text, settings and its capability lock. It is the package, not an individual creature or item. |
| **Instance** | A particular entity in a world, with its own ID and mutable state. Fresh creation instantiates ordinary placed NPC and item definitions; templates are instantiated by the installed [population plans](mechanics.md#c3-bounded-living-hounds-selected-contract) or death mechanics. Multiple instances can share a definition and retain separate HP and custody. |
| **Spawn** | Create an instance from an NPC or item definition at a destination under an owner. Fresh creation, bounded population replacement and dynamic corpses are installed. The [population contract](mechanics.md#c3-bounded-living-hounds-selected-contract) governs admitted births; arbitrary live builder spawning remains [future work](future.md#authoring-and-certification). |
| **Policy** | A condition tree of `all`, `any`, `not` and leaves ([policy@1](mechanics.md#target_resolution1-policy1-fact1)). A policy is optional; an absent one always holds. |
| **Story point** | A named story beat with outcomes. A dialogue choice's `story_point: "<key>/<outcome>"` or a scene's `on_end` declares it; there is no story point file ([cartridge](cartridge.md#compiler)). |
| **Structure** | A definition of a room a player can build (`structures/<key>.json`, [construction](cartridge.md#structure-and-site-declarations)). |

