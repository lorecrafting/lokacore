# 02 — BEAM Runtime Architecture

## 1. Proposed repository shape

Use a Mix umbrella to make dependency direction mechanically obvious.

```text
loka/
├── apps/
│   ├── loka_core/       # pure domain types/rules/capability contracts
│   ├── loka_content/    # cartridge parsing/compiler/definition registry
│   ├── loka_store/      # Ecto/PostgreSQL persistence adapters
│   ├── loka_platform/   # accounts, catalog, entitlements, purchase/restore services
│   ├── loka_runtime/    # OTP world/session/scheduling authority
│   ├── loka_builder/    # workspaces, Builder API, lab, certification
│   └── loka_web/        # Phoenix HTTP/channels/admin/MCP adapter
├── kernel/              # portable deterministic rules kernel (Rust; spike-gated)
├── mobile/              # React Native / Expo + local authority/persistence
├── protocol/            # external machine-readable schemas/codegen
├── cartridges/          # first-party source cartridges in development
└── docs/
```

This exact split MAY be adjusted after a compile-dependency spike, but the dependency direction is normative:

```text
core        content
 ↑            ↑
 |            |
 store      platform
  ↑  \       /  ↑
  |   runtime   |
  |      ↑      |
  +---- builder-+
          ↑
         web
```

`loka_core` MUST NOT depend on Phoenix, Ecto, filesystem, network, or runtime processes. Portable rule semantics that must execute offline SHOULD live in or call the shared kernel behind a narrow adapter.

`loka_store` may depend on core/domain data contracts but MUST NOT contain game rules.

`loka_platform` owns online account/catalog/entitlement/purchase-restore application rules. It MUST NOT own world simulation or cartridge mechanics.

`loka_web` is an adapter layer and MUST NOT become a source of game or commerce truth.

Boundary enforcement SHOULD use separate umbrella apps plus compile-time boundary checks/tests.

## 2. Supervision topology

Draft topology:

```text
Loka.Runtime.Supervisor
├── SessionRegistry
├── SessionSupervisor
│   └── SessionProcess[player/session]
├── InstanceRegistry
├── InstanceSupervisor
│   └── WorldInstance[instance_id]
├── RealmSupervisor               # dormant/limited before shared-world phase
│   └── RealmCoordinator
│       └── ZoneShard[zone_id]
├── SchedulerSupervisor
│   ├── DurableJobScheduler
│   └── EphemeralTimerScheduler
└── EffectSupervisor
    └── EffectDispatcher workers
```

All dynamic processes MUST be addressable by stable IDs through Registries rather than hidden process dictionary conventions.

## 3. Offline versus online authority

The BEAM runtime described in this document is the **online authority host**. Offline private cartridges use a local authority shell and the same portable kernel, as specified in [07 — Offline Storypacks and the Path to the MMORPG](07-offline-storypacks-to-mmo.md).

Do not attempt to embed a BEAM node in the mobile app merely to preserve architectural symmetry.

## 4. Session, account, character, instance

Keep these concepts separate.

```text
Client connection
      |
   Session
      |
   Account
      |
  Character
      |
 World Instance / Realm
```

### Session

Connection-local and ephemeral:

- socket/session ID;
- device/client metadata;
- last acknowledged protocol sequence;
- UI-specific ephemeral state where appropriate;
- currently controlled character;
- reconnect bookkeeping.

Session state MUST NOT contain irreplaceable quest/inventory/world state.

An account MAY have multiple sessions later.

### Account

Durable identity:

- authentication;
- entitlements;
- account settings;
- account-level moderation/permissions.

### Character

Durable game identity:

- stats/progression intended to survive cartridges where product rules allow;
- cosmetics/profile;
- world membership;
- cartridge-local character snapshot refs.

### World instance

Authority for one private or party play space:

- cartridge release ref;
- logical clock;
- explicit RNG state/seed;
- runtime entities;
- scoped world variables;
- scheduled game jobs;
- instance revision.

## 5. Online private/party world owner

For online private/party cartridges, one `WorldInstance` GenServer SHOULD own the mutable in-memory state of the instance.

Why:

- player commands become naturally serialized;
- multi-entity operations inside an instance are easier to make atomic;
- deterministic simulation is straightforward;
- snapshot/replay has one coordination boundary;
- NPC schedules can be managed collectively;
- a crashed instance can reload from durable state.

The instance process MUST call the shared portable deterministic kernel through the `loka_core` host adapter for portable rules. Server-only orchestration MAY use pure Elixir domain functions when the behavior is explicitly not part of offline cartridge semantics.

It SHOULD NOT block on slow external I/O while holding command serialization. Persistence commits should be bounded and synchronous where correctness requires; non-authoritative notifications are effects.

### Command lifecycle

```text
1 client command arrives
2 gateway authenticates + validates protocol
3 command routed to owning WorldInstance
4 instance checks command id / expected revision
5 portable kernel / host decision layer evaluates state
6 store transaction commits affected durable records + command receipt + effect outbox
7 in-memory state advances to committed revision
8 response/notifications are emitted
9 durable outbox effects are dispatched/retried
```

The exact transaction strategy may batch entity changes, but step 6 must prevent a crash from producing half a logical action.

## 6. Why not one GenServer per entity by default

Lokacore's entity-process approach provides useful isolation but makes operations like “move item from room to inventory and advance quest” cross multiple authorities.

A v3 item usually does not need independent concurrency.

Use a process per entity only when an entity truly owns concurrent autonomous work that cannot cleanly belong to its world shard. Such exceptions MUST be justified.

NPC autonomous behavior SHOULD usually be scheduled as commands/events to the world owner, not a permanently ticking process per NPC.

## 7. Shared MUD evolution

Do not distribute the private-instance architecture prematurely.

When a persistent realm needs more concurrency, partition by **ownership domain**, likely zone/area.

```text
RealmCoordinator
  ├── ZoneShard(town)
  ├── ZoneShard(forest)
  ├── ZoneShard(dungeon-1)
  └── SharedServices(economy/guilds/etc)
```

An entity belongs to one shard at a time.

Cross-shard movement MUST use an explicit handoff protocol:

1. source validates move;
2. durable transfer intent is recorded;
3. destination accepts/imports entity state;
4. ownership pointer commits;
5. source removes local authority;
6. recovery reconciles incomplete transfers.

Do not rely on “send two PubSub messages and hope.”

## 8. BEAM distribution

Initial production SHOULD run on one BEAM node plus PostgreSQL unless measured scale requires clustering.

The architecture MUST avoid assumptions that prevent later clustering:

- IDs are global UUIDs;
- Registries have an adapter boundary;
- world owners are addressed by logical IDs;
- persistent state is not stored only in local ETS;
- effects and jobs are durable when required.

Do not add Horde/Swarm/distributed Registry solely because BEAM clustering is possible.

## 9. Gateway/runtime separation

Borrow the **principle**, not the literal implementation, of a network-facing portal separate from game logic.

`loka_web` owns:

- HTTP;
- WebSocket/Phoenix channels;
- authentication;
- protocol validation;
- rate limiting;
- transport serialization.

`loka_runtime` owns:

- sessions as game-facing abstractions;
- world authority;
- commands;
- scheduling;
- durable gameplay coordination.

A production deploy MAY later split gateway and runtime into different releases/nodes, but the first implementation SHOULD keep them in one deployment unless operational evidence justifies separation.

## 10. Restart behavior

WorldInstance restart:

1. supervisor restarts process;
2. process loads last committed state/snapshot and pending durable jobs;
3. it verifies command/effect receipts;
4. it reconstructs explicit RNG/logical-clock state;
5. it resumes.

A client may receive a transient retry/resync response. It MUST NOT observe duplicated durable rewards.

## 11. Schedulers: use three temporal strategies

Do not use one timer mechanism for every feature.

### A. Derived/on-demand temporal state

For states whose intermediate stages have no side effects:

- plant growth;
- cooldown remaining;
- decay stage;
- shop “currently open?” if no transition action is needed.

Store `state_at_t0` + logical timestamp and derive current state when queried.

This avoids unnecessary ticks.

### B. Durable scheduled jobs

For events that MUST happen even across restart:

- quest deadline consequence;
- auction/market settlement;
- paid construction completion;
- scheduled world event with side effects.

Persist job identity, due logical/wall time, payload, status, idempotency key.

### C. Ephemeral timers

For disposable local behavior:

- short combat timeout;
- animation/UI pacing;
- ambient emote cadence.

These may be recreated after restart rather than persisted.

## 12. Backpressure and overload

Every externally reachable command path SHOULD have bounded queues/rate limits.

World owners SHOULD expose telemetry for:

- mailbox length;
- command latency;
- commit latency;
- commands/sec;
- effect backlog;
- scheduled-job backlog.

If an instance is overloaded, the gateway should reject/throttle new non-critical commands rather than allowing unbounded mailbox growth.

## 13. BEAM-specific review questions

Every proposed process must answer:

- What state does it exclusively own?
- Why does this state require independent concurrency?
- What supervisor restarts it?
- How is state recovered?
- What messages can it receive?
- What is its mailbox/backpressure policy?
- What happens if it crashes between decision and effect?
- Can this be a pure module instead?

If the last answer is yes, prefer the pure module.
