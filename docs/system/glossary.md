# Glossary

These names describe the current system. Contract identifiers and JSON field names keep
their existing spelling; the [cartridge format](cartridge.md) defines those interfaces.

| Term | Meaning |
|---|---|
| **Capability** | A versioned engine mechanic, such as containment or dialogue. It supplies behavior and validation; see the [feature map](../features.gen.md). |
| **Cartridge** | An immutable, versioned package of compiled world content: blueprints, rooms, quests, text, settings and its capability lock. It is the package, not an individual creature or item. |
| **Blueprint** | An authored, reusable NPC or item definition in a cartridge. It describes what an instance starts as; it is not that instance's changing HP, location or custody. `DefinitionRef` is the contract name for its reference. Other authored definitions, such as quests and policies, retain their own names. |
| **Instance** | A particular entity in a world, with its own ID and mutable state. Today, a fresh world creates one NPC or item instance per authored definition; repeated live spawning is [planned](../NEXT-MECHANICS.md), not installed. With that feature, five rats could share a blueprint while each has separate HP. |
| **Spawn** | Create an instance from a blueprint at a destination under an owner. Fresh-world creation exists; a live spawner that creates and persists additional instances during play does not yet exist. |

Blueprint is builder-facing vocabulary. It does not rename `DefinitionRef`, the compiled
artifact, save pins or protocol fields.
