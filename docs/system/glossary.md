# Glossary

These names describe the current system. Contract identifiers and JSON field names keep
their existing spelling; the [cartridge format](cartridge.md) defines those interfaces. The
[current chapter identity](cartridge.md#current-bundled-chapter) owns the bundled release
and allocation answers.

| Term | Meaning |
|---|---|
| **Capability** | A versioned engine mechanic, such as containment or dialogue. It supplies behavior and validation; see the [feature map](../features.gen.md). |
| **Cartridge** | An immutable, versioned package of compiled world content: blueprints, rooms, quests, text, settings and its capability lock. It is the package, not an individual creature or item. |
| **Blueprint** | An authored, reusable NPC or item definition in a cartridge. It describes what an instance starts as; it is not that instance's changing HP, location or custody. `DefinitionRef` is the contract name for its reference. Other authored definitions, such as quests and policies, retain their own names. |
| **Instance** | A particular entity in a world, with its own ID and mutable state. Fresh creation instantiates ordinary placed blueprints; templates are instantiated by the installed [population plans](mechanics.md#c3-bounded-living-hounds-selected-contract) or death mechanics. Multiple instances can share a blueprint and retain separate HP and custody. |
| **Spawn** | Create an instance from a blueprint at a destination under an owner. Fresh creation, bounded population replacement and dynamic corpses are installed. The [population contract](mechanics.md#c3-bounded-living-hounds-selected-contract) governs admitted births; arbitrary live builder spawning remains [future work](future.md#authoring-and-certification). |

Blueprint is builder-facing vocabulary. It does not rename `DefinitionRef`, the compiled
artifact, save pins or protocol fields.
