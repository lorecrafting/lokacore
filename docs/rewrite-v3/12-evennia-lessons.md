# 11 — Evennia Design Review: What Loka v3 Should Learn

**Review baseline:** current Evennia documentation and main-branch architecture reviewed 2026-09-17.

Evennia is a mature Python/Twisted MUD/MU* framework. Loka v3 should not clone it, but its long operational history makes it valuable evidence about which abstractions survive years of text-world development.

## 1. Summary

### Adopt strongly

- Session → Account → Character separation.
- Command/action sets that compose with union/intersection/replacement.
- Fail-closed lock/access semantics.
- Indexed tags/aliases separate from arbitrary state.
- Explicit persistent vs non-persistent state.
- On-demand temporal computation instead of universal ticking.
- Persistent task/ticker concepts for work that really needs scheduling.
- Builder-safe controlled functions rather than arbitrary code.
- Prototype validation and builder-friendly templates.
- Search/disambiguation/aliases as first-class MUD UX.
- Generated help from command/capability definitions.
- Offline/batch building workflows.
- Transport/game-logic separation.

### Adapt to Elixir/BEAM

- Typeclasses → typed components/capabilities, not inheritance-heavy runtime classes.
- Portal/Server → gateway/runtime architectural boundary; only split OS processes if needed.
- Idmapper cache → one OTP world/shard owner plus explicit persistence, not model-instance magic.
- Scripts/TickerHandlers → world schedulers + derived time + durable jobs.
- Prototypes → compile-time templates/mixins flattened into cartridge definitions.
- REST object editing → canonical Builder API with workspace/revision boundaries.

### Do not copy

- arbitrary pickled/persistent attribute values;
- global dbrefs as content identity;
- deep runtime typeclass/prototype inheritance;
- executable batch code as normal content tooling;
- implicit database writes hidden behind object attribute assignment;
- one general event/ticker mechanism for every temporal need.

## 2. Portal/Server separation

Evennia splits network-facing Portal and game Server into separate Twisted processes. The Portal handles telnet/websocket/SSH and can remain connected while the game server reloads.

### Lesson

Transport must not know game internals, and game logic must not care how the player connected.

### Loka adaptation

Keep `loka_web` and `loka_runtime` as separate OTP/application boundaries.

Do **not** immediately duplicate Evennia's two-OS-process topology. OTP supervision and modern rolling deploys solve different problems; adding another network hop solely for reload continuity is premature.

Later, gateway/runtime can be deployed separately if uptime or protocol aggregation warrants it.

## 3. Typeclasses, Attributes, and Components

Evennia's central abstraction is a database model wrapped by a Python typeclass. Arbitrary persistent Attributes and non-persistent NAttributes attach state to objects. Evennia also has a Components contrib to move reusable functionality away from deep inheritance.

### What this validates

MUD entities need:

- extensible state;
- reusable behavior;
- persistent and ephemeral values;
- searchable labels.

### Loka adaptation

Prefer:

```text
Definition
  components: typed declarative capability data

Runtime Entity
  state: typed component state
  tags: indexed labels
  ephemeral: owner-process memory
```

Do not recreate arbitrary “anything goes” persistent Attributes. They are flexible but weaken validation, code generation, migration, and AI authoring.

## 4. CmdSets are highly relevant to touch-first Loka

Evennia CmdSets can merge through set operations such as Union, Intersect, and Replace. They allow available commands to change with game state without nesting endless conditionals.

Lokacore independently evolved something similar in its Action Resolver.

### Loka adaptation: ActionSet algebra

Formalize it.

An entity/context produces candidate actions from:

1. base definition;
2. equipment;
3. statuses;
4. quest/relationship grants;
5. scripts/capabilities;
6. room/zone restrictions;
7. account/character permissions.

Merge operations:

- **union** — add actions;
- **subtract** — remove actions;
- **intersect** — whitelist;
- **replace** — transformation/modal state;
- **override** — same action key with higher-priority implementation.

Then evaluate typed conditions and return a server-resolved `ActionSet`.

This serves both:

- text commands;
- mobile contextual buttons.

The ActionSet should also be introspectable by the builder and test lab.

## 5. Locks and fail-closed policy

Evennia attaches lock strings to objects/commands and evaluates named lock functions. Missing access is denied by default.

### Loka adaptation

Use a typed Policy AST rather than free-form executable lock strings:

```yaml
policy:
  all:
    - permission: builder
    - any:
        - has_item: shrine_key
        - quest_state:
            quest: temple_intro
            state: completed
```

Required operators may include:

- all / any / not;
- permission/role;
- self/owner;
- tag;
- attribute/stat comparison;
- inventory ownership;
- quest state;
- faction/reputation;
- world scope;
- time/window.

Unknown policy operators MUST fail closed.

Policies should protect exits/actions/content publication/builder tools as appropriate.

## 6. Sessions, Accounts, and puppeting

Evennia distinguishes physical connection Session, durable Account, and in-world Object/Character. It supports multiple sessions and different multi-puppeting modes.

### Loka adaptation

Keep Session, Account, Character separate from v3 day one.

Benefits:

- reconnect without corrupting character state;
- future multi-device support;
- guest/account upgrade;
- one account owning multiple characters;
- admin/session messaging;
- account-level entitlements and permissions;
- cartridge-local world state remains separate from connection lifecycle.

## 7. Tags and aliases

Evennia Tags are indexed markers shared across objects; aliases/permissions reuse similar infrastructure.

### Loka adaptation

Use indexed tags for:

- biome;
- faction membership labels;
- content queries;
- capability discovery;
- zone/category lookup;
- builder search.

Keep typed state in components, not tags.

Aliases/keywords are a separate searchable field used by the MUD command parser and accessibility tooling.

## 8. Search is a feature, not a utility afterthought

Traditional text interfaces need robust target resolution:

- local location + inventory scope by default;
- aliases/keywords;
- disambiguation among multiple matches;
- stable IDs for tools;
- optional global/admin search.

The touch client can bypass textual ambiguity by sending IDs, but the terminal, bots, and builders still benefit from a canonical Search service.

Loka v3 SHOULD have one target-resolution contract rather than ad-hoc “find by keyword” helpers in transport modules.

## 9. Prototypes and OLC

Evennia prototypes provide per-instance customization without requiring a class for every variation. They support inheritance, validation, permissions, controlled prototype functions, and OLC.

### Loka adaptation

The useful idea is **authoring-time reuse**, not runtime inheritance.

Support source-level templates/mixins such as:

```yaml
use:
  - npc.humanoid
  - behavior.shopkeeper
  - schedule.day_worker
```

The compiler:

1. resolves them;
2. applies deterministic merge rules;
3. detects cycles;
4. validates capability compatibility;
5. records provenance;
6. emits a fully flattened definition.

Runtime never needs to resolve an inheritance chain.

Avoid open-ended multiple inheritance semantics unless evidence shows it is necessary.

## 10. Protfuncs: controlled power for builders

Evennia deliberately does not let in-game prototype data contain arbitrary Python. Instead, trusted functions can be exposed through named prototype functions.

This is directly relevant to AI authoring.

### Loka adaptation

Cartridge source may call registered **compiler functions/capabilities** with typed schemas, for example:

```yaml
description:
  template: weathered_object
  args:
    material: bronze
```

The function registry is engine-owned and testable.

Do not let arbitrary compilation-time Elixir escape into the filesystem/network.

## 11. Scripts, tickers, tasks, and OnDemandHandler

Evennia has several temporal tools rather than forcing one model:

- persistent/non-persistent Scripts;
- subscription TickerHandler;
- persistent TaskHandler;
- OnDemandHandler for state derived only when observed.

The OnDemand idea is especially important.

### Loka adaptation

Classify time-driven behavior:

**Derived time**  
No job at all. Store baseline + timestamp and compute now.

**Durable job**  
Persisted, idempotent scheduled effect.

**Ephemeral cadence**  
In-memory timer recreated on restart.

**World simulation step**  
Processed by the authoritative world/shard scheduler.

Do not tick every NPC/plant/shop each second.

## 12. Commands and automatic help

Evennia command definitions carry aliases, access locks, parsing expectations, and help text; the help system can automatically derive command help.

### Loka adaptation

Every player action and Builder API operation SHOULD expose metadata:

- key;
- aliases;
- argument/input schema;
- policy;
- description;
- examples;
- result/error schema.

Generate:

- terminal help;
- AI capability descriptions;
- docs;
- possibly mobile accessibility labels

from the same metadata.

## 13. Batch processors

Evennia supports offline batch commands and also powerful batch Python execution, the latter explicitly considered a security risk.

### Loka adaptation

Our cartridge compiler and Builder API supersede raw batch command files.

We should support:

- batch operation plans;
- dry-run;
- transaction/workspace preview;
- machine-readable per-operation results;
- rollback before publication.

Normal authoring SHOULD NOT run arbitrary Elixir files as batch content.

## 14. Contrib ecosystem

Evennia keeps many optional mechanics as isolated contrib packages rather than bloating core.

### Loka adaptation

Long term, define **capability packs**:

- combat pack;
- crafting pack;
- social pack;
- survival pack.

But packs must:

- declare dependencies;
- register typed capabilities;
- include tests;
- participate in compatibility/versioning;
- be compiled into a known engine release.

Do not start v3 with a dynamic plugin marketplace.

## 15. Evennia ideas useful later

Potentially valuable but not foundation blockers:

- channels/comms;
- roleplaying recognition/sdesc systems;
- object poses/emotes;
- safe barter/trade contracts;
- achievements;
- builder OLC ideas;
- web admin patterns;
- full multi-session puppeting.

These belong in later capability packs unless needed by the first cartridge.

## 16. Core contrast: Evennia object-centric vs Loka instance-centric

Evennia's long-lived design centers powerful persistent objects.

Loka v3 should center the **world instance/shard authority** because:

- cartridges are bounded worlds;
- deterministic simulation is a primary feature;
- atomic multi-entity commands matter;
- BEAM actors are natural ownership boundaries;
- the mobile client needs coherent snapshots;
- certification needs repeatable state.

Entities remain important data, but the world owner coordinates them.

That is the major architectural divergence.
