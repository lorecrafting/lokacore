# 05 — Cartridges, Content, and Capabilities

## 1. Cartridge definition

A cartridge is an immutable, versioned, compiled bundle of game definitions and assets that Loka can instantiate.

A cartridge is not:

- a separate executable app;
- arbitrary mobile code;
- a second server engine;
- a mutable live directory.

## 2. Source layout

Recommended source form:

```text
cartridges/
└── fox_spirit_of_yunmeng/
    ├── cartridge.yaml
    ├── rooms/
    ├── npcs/
    ├── items/
    ├── quests/
    ├── dialogues/
    ├── scripts/
    ├── systems/
    ├── localization/
    │   ├── en/
    │   └── zh/
    ├── assets/
    └── tests/
```

Source YAML is human/LLM friendly. The compiler normalizes it into typed definitions.

## 3. Manifest

Example:

```yaml
api_version: loka/v3
id: fox_spirit_of_yunmeng
version: 1.2.0
title: The Fox Spirit of Yunmeng

requires:
  kernel_api: ">=1.3 <2.0"
  rule_ir: 1
  content_schema: 1
  capabilities:
    - movement@1
    - dialogue@2
    - quest@3
    - schedule@1
    - weather@1
  client_features:
    - contextual_actions_v1
    - dialogue_choices_v1

execution_profiles:
  - offline_private
  - online_private

instance_modes:
  - private

entry:
  room: rooms/ferry_dock

locales:
  default: en
  available: [en, zh]
```

### Compatibility versions

`kernel_api` describes portable semantic capabilities implemented by the installed kernel. `rule_ir` versions the normalized LokaScript/rule representation. `content_schema` versions compiled definition structure.

Published cartridges pin all three. Compatibility and migrations MUST be explicit; host/app upgrades may not reinterpret old rule IR implicitly.

## 4. Local keys and qualified identity

Within a cartridge:

```text
rooms/ferry_dock
npcs/old_ferryman
quests/missing_child
```

Compiler resolves to:

```text
fox_spirit_of_yunmeng@1.2.0:room/ferry_dock
```

No global content-key namespace.

## 5. Content envelope

Every definition uses a standard envelope:

```yaml
api_version: loka/v3
kind: npc
key: old_ferryman
tags: [human, ferryman]

components:
  description:
    short: Old Ferryman
    long: ...
  schedule:
    ...
  dialogue:
    ref: dialogues/ferryman
```

Fields outside registered schemas are errors unless explicitly allowed under extension metadata.

## 6. Capability registry

A capability is an engine-supported reusable semantic feature.

### Canonical capability vocabulary

Use these terms consistently in v3:

| Term | Meaning |
|---|---|
| **Capability** | Versioned feature contract registered by the engine. Owns schemas and the commands/events/effects/policies/rules it introduces. |
| **Component** | Typed definition/runtime data attached to an entity or scoped state. A component is data/state, not an independent authority. |
| **Behavior** | Declarative autonomous/reactive rule configuration supplied by a capability, such as patrol or schedule. |
| **Action** | Player/agent affordance resolved into a typed Command. |
| **Policy / condition** | Pure predicate tree deciding whether an action/content path is allowed/visible. |
| **Command** | Request to authoritative game semantics. |
| **DomainEvent** | Immutable fact produced during a decision. |
| **StateDelta** | Proposed authoritative state change accumulated before commit. |
| **Effect** | Typed post-decision instruction whose durability/retry semantics are explicit; not a hidden DB mutation path. |
| **GameView** | Host-neutral semantic projection consumed by mobile rendering. |

`trait` is historical Lokacore terminology and SHOULD NOT be a separate v3 schema concept. Old trait ideas become Behaviors/capabilities.

Likewise, a generic runtime `signal` is not a fifth event system. Cartridge-local notifications compile to registered/namespaced DomainEvents.

Examples:

```text
movement
container
equipment
combatant
merchant
schedule
patrol
wander
ambient
weather_reaction
dialogue
quest_giver
faction_member
reputation
status_effect
crafting_station
```

Capability metadata includes portability classification:

```elixir
%CapabilitySpec{
  key: "schedule",
  version: 1,
  portability: :portable,
  applies_to: [:npc, :system],
  definition_schema: ...,
  runtime_components: [...],
  commands: [...],
  events: [...],
  effects: [...],
  policies: [...],
  dependencies: [...],
  docs: ...,
  examples: [...]
}
```

The registry is engine-owned and enumerable.

Portability is one of `:portable`, `:server_only`, or `:client_presentation_only`. An `offline_private` cartridge cannot compile if a gameplay dependency is server-only.

Server-only does **not** mean side-effectful arbitrary Elixir. Server-only gameplay capabilities MUST participate in the same command/event/delta/effect decision contract as portable capabilities. They return proposed state deltas/events/effects to the online decision coordinator and MUST NOT write Repo/PubSub/external services directly from rule evaluation.

## 7. Capability discovery API

Builder tools support:

```text
capabilities.search(query)
capabilities.get(key, version)
capabilities.examples(key)
capabilities.compatible_with(kind)
capabilities.dependencies(key)
```

This replaces giant LLM manuals.

## 8. Compile stages

```text
source load
  ↓
syntax/schema parse
  ↓
template/mixin expansion
  ↓
local ref resolution
  ↓
capability validation
  ↓
policy/action/script validation
  ↓
graph validation
  ↓
localization/assets validation
  ↓
normalization
  ↓
canonical serialization
  ↓
content hash
  ↓
compiled cartridge artifact
```

Every stage emits structured diagnostics.

## 9. Authoring-time templates/mixins

Reuse is useful, but runtime inheritance is not required.

Example:

```yaml
use:
  - template: templates/humanoid_npc
  - mixin: mixins/day_worker

components:
  description:
    short: Old Ferryman
```

Merge rules MUST be deterministic per field/capability.

Recommended defaults:

- scalar: child replaces;
- map: schema-directed deep merge;
- keyed collections: merge by declared key;
- ordinary list: replace unless schema says append;
- tags: union;
- policies/actions: merge by stable key according to defined algebra.

Compiler records provenance for debugging.

Cycles are compile errors.

Compiled definition is flat.

## 10. Controlled compiler functions

Some dynamic authoring conveniences may use registered compiler functions similar to safe macro/prototype functions.

Example:

```yaml
components:
  loot:
    table:
      generate:
        function: weighted_loot
        args:
          tier: village
```

Compiler functions:

- are engine-registered;
- have typed inputs/outputs;
- have no arbitrary filesystem/network access;
- are deterministic unless explicitly seeded;
- are testable;
- run before hash generation.

## 11. Assets

Compiled artifact includes manifest of asset hashes, sizes, media type, locale/variant.

Large binary assets SHOULD live in object storage/CDN referenced by hash.

A cartridge content hash covers:

- normalized definitions;
- script sources/byte representation;
- asset manifest;
- localization manifest;
- compatibility requirements.

## 12. Immutability

Published cartridge release cannot be edited in place.

Fixes create a new release/hash even if semver patch only.

Catalog may point new purchases/instances to latest compatible release while old active saves remain pinned.

## 13. Dependencies between cartridges

Avoid cross-cartridge dependencies in the first release.

Later, if needed, dependencies must be explicit:

```yaml
dependencies:
  - cartridge: loka_core_folklore
    version: "^1.0"
```

Compiler resolves exact versions into release lock data.

Do not allow “whatever latest happens to be installed.”

## 14. Capability packs

Engine features may be grouped into versioned capability packs, but capabilities remain individually introspectable.

Examples:

- core-world;
- combat;
- crafting;
- social;
- economy.

A cartridge declares what it uses.

This helps certification choose relevant test suites.

## 15. Definition versus state

Definitions describe initial/default behavior.

Runtime state belongs to world/quest/entity state.

Bad:

```yaml
npc:
  current_hp: 17
```

as mutable published content.

Good:

```yaml
components:
  combatant:
    max_hp: 50
```

Runtime entity state stores current HP.

## 16. Spawn model

Spawn operations reference definitions and create runtime entities under an instance owner.

Spawn must declare:

- definition ref;
- destination/container;
- scope/instance;
- optional allowed overrides;
- deterministic spawn identity policy if needed.

Overrides are validated against capability schemas.

## 17. World topology

Rooms and exits are definitions; runtime exits may carry mutable state such as lock/open status.

Compiler validates:

- target exists;
- direction semantics;
- intended reciprocal links;
- reachability rules;
- orphan regions;
- inaccessible required quest targets.

Custom named connections MAY exist; mobile UI renders action labels instead of assuming cardinal directions only.

## 18. Localization

Content strings SHOULD use stable string IDs for production-ready cartridges, even if authoring allows inline defaults.

Compiler can extract inline prose into locale catalogs later, but the format should anticipate:

```text
title_key
description_key
action_label_key
dialogue_text_key
```

Certification checks missing locale entries.

## 19. Content migrations

A new content release may include explicit migration declarations.

Migrations MUST be deterministic and testable against snapshots.

No runtime content loader should infer renamed keys from similarity.

## 20. Cartridge artifact

Potential logical artifact:

```text
manifest.json
definitions.bin/json
scripts.bin
localization/
asset-manifest.json
schema-lock.json
certificate-ref.json (after certification)
```

Packaging format is implementation detail; canonical hash must be reproducible from normalized inputs.

## 21. Promotion states

```text
draft workspace
  ↓
compiled candidate
  ↓
certification candidate
  ↓
certified hash
  ↓
staging
  ↓
published catalog release
  ↓
deprecated/withdrawn (still available to pinned saves as policy allows)
```

Authors cannot skip from draft directly to production.


## 22. Cartridge/deployment split

The cartridge defines reusable story/world semantics. A deployment defines how that exact cartridge is hosted: offline private, online private, party, embedded instance, or shared realm area.

Deployment overlays may change hosting policy—such as realm mount point, NPC respawn policy, or economy integration—but any semantic override is separately hashed and certified. This is the mechanism for reusing a storypack inside the later MMORPG without pretending every private-world assumption is globally shareable.


## 23. Cartridge ports and extension points

Cartridges that may participate in campaigns or the later MMORPG SHOULD expose explicit composition ports rather than encourage arbitrary cross-cartridge references.

Examples:

```yaml
ports:
  entries:
    ferry_road:
      room: rooms/ferry_dock
  exits:
    northern_road:
      room: rooms/north_gate
  continuity:
    exports:
      - memory.saved_ferryman
  extension_points:
    village_notice_board:
      accepts: [quest_hook, rumor_source]
```

A campaign/deployment may bind ports:

```yaml
mounts:
  - from: chapter_1:exits/northern_road
    to: chapter_2:entries/southern_road
```

Rules:

- ports are versioned cartridge API;
- internal definition keys remain private unless exported;
- extension points declare accepted contribution kinds/schemas;
- binding validation happens at campaign/deployment compile time;
- published cartridge artifacts remain immutable;
- adding an expansion changes the composite campaign/deployment manifest, not the old artifact.

This creates a stable module boundary for chapters, side adventures, and MMO region mounting.
