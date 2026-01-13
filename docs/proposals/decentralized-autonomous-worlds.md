# Decentralized Autonomous Worlds - Proposal

> **Status**: Research / Proposal (not yet implemented)
> **Issue**: TBD
> **Last Updated**: 2026-01-12
> **Related**: [Federated Planets Vision](federated-planets-vision.md), [Builder Content Layer](builder-content-layer.md)

## Executive Summary

This proposal explores transforming Loka from a traditional centralized MUD engine into a **decentralized autonomous world** that:
- Stores world state on IPFS with CRDT-based consistency
- Operates "always on" without single points of failure
- Allows upgrades without downtime via smart contract-inspired patterns
- Enables anyone to run a world node (federated or fully P2P)

**This is a research proposal.** It documents patterns from the crypto/blockchain gaming space and how they could apply to Loka.

---

## Problem Statement

### The Centralized World Problem

Current Loka architecture:

```
World State (SQLite) ←→ Server (ephemeral) ←→ Clients
       ↑
  Single point of failure
  Downtime for deploys
  Operator-controlled
  State lost if server dies
```

This creates several limitations:

| Issue | Impact |
|-------|--------|
| **Single operator** | Players trust one entity with their world |
| **Downtime deploys** | `fly deploy` disrupts active players |
| **No federation** | Can't connect multiple world instances |
| **State fragility** | Server crash can lose recent changes |
| **No auditability** | No proof of what happened when |

### The Vision: Always-On Autonomous Worlds

```
World State (immutable log on IPFS)
       ↑
  No single operator
  No downtime
  Anyone can run a node
  State persists even if everyone leaves
  Full event history auditable
```

### Why This Matters

1. **Persistence**: Worlds that outlive their creators
2. **Trust**: Verifiable game history, no hidden GM manipulation
3. **Extensibility**: Anyone can add systems to the world
4. **Resilience**: No single server to go down
5. **Federation**: Multiple worlds that can interoperate

---

## Prior Art: What the Crypto World Teaches Us

### MUD Framework (Lattice Labs)

[MUD](https://mud.dev/) is the most relevant prior art—literally named after Multi-User Dungeons and designed for "autonomous worlds" on Ethereum.

**Key patterns from MUD:**

1. **State/Logic Separation**: State in persistent "World" contract, logic in upgradeable "System" contracts
2. **Entity-Component-System (ECS)**: Entities are IDs, components are data tables, systems are logic
3. **Deterministic Indexing**: Client state derived from chain events, any client can reconstruct
4. **Infinite Extensibility**: Anyone can add new Systems (with governance)

**What MUD gets right:**
- State survives logic upgrades
- Fully auditable history
- Permissionless extension

**What MUD struggles with:**
- Latency (blockchain confirmation times: seconds to minutes)
- Cost (every action costs gas)
- Throughput (EVM limitations)

**Loka's opportunity**: Adopt MUD patterns without blockchain overhead using IPFS + CRDTs.

### Smart Contract Upgrade Patterns

From [OpenZeppelin](https://docs.openzeppelin.com/learn/upgrading-smart-contracts) and [Ethereum docs](https://ethereum.org/developers/docs/smart-contracts/upgrading/):

```
┌─────────────────────────────────────────────────────────┐
│ PROXY PATTERN                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐      ┌──────────────────┐                │
│  │ Proxy    │ ──▶  │ Implementation   │                │
│  │ (state)  │      │ v1 (logic)       │                │
│  └──────────┘      └──────────────────┘                │
│       │                                                 │
│       │ Upgrade (no state loss)                        │
│       ▼                                                 │
│  ┌──────────┐      ┌──────────────────┐                │
│  │ Proxy    │ ──▶  │ Implementation   │                │
│  │ (state   │      │ v2 (new logic)   │                │
│  │ PRESERVED)│     └──────────────────┘                │
│  └──────────┘                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key insight**: Separate state from logic. State is immutable, logic is upgradeable.

Loka already has this separation (Entity vs Behavior). The path is clearer than expected.

### OrbitDB: Mutable State on IPFS

[OrbitDB](https://orbitdb.org/) solves "IPFS is immutable but I need mutable state":

- **CRDT-based**: Conflict-free replicated data types for eventual consistency
- **Append-only log**: State derived from operation history
- **P2P sync**: Nodes sync via libp2p pubsub
- **Eventually consistent**: No coordination needed between peers

```
┌─────────────────────────────────────────────────────────┐
│ CRDT-BASED DISTRIBUTED STATE                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Peer A              Peer B              Peer C         │
│  ┌─────────┐        ┌─────────┐        ┌─────────┐     │
│  │ OrbitDB │ ◄────► │ OrbitDB │ ◄────► │ OrbitDB │     │
│  │ replica │        │ replica │        │ replica │     │
│  └────┬────┘        └────┬────┘        └────┬────┘     │
│       │                  │                  │           │
│       ▼                  ▼                  ▼           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ IPFS Log (append-only, content-addressed)        │   │
│  │ [op1] → [op2] → [op3] → [op4] → [op5]           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  CRDTs ensure eventual consistency without coordination │
└─────────────────────────────────────────────────────────┘
```

---

## Proposed Architecture

### Layer Model

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: IMMUTABLE CONTENT (IPFS)                       │
├─────────────────────────────────────────────────────────┤
│ Prototypes: Room/NPC/Item definitions (YAML → CID)      │
│ Scripts: Elixir behavior code (content-addressed)       │
│ Assets: Images, sounds, descriptions                    │
│                                                         │
│ Once published, never changes. New version = new CID.   │
└─────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: EVENT LOG (OrbitDB / IPFS)                     │
├─────────────────────────────────────────────────────────┤
│ Append-only log of all world events:                    │
│ [entity_created], [player_moved], [item_picked_up], ... │
│                                                         │
│ Any node can replay to derive current state.            │
│ CRDTs handle concurrent events from multiple nodes.     │
└─────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 3: SYSTEM REGISTRY (Governance-controlled)        │
├─────────────────────────────────────────────────────────┤
│ Active Systems: {combat_v2, quest_v1, movement_v3}      │
│ Each System is a CID pointing to Elixir code on IPFS    │
│ Governance decides which Systems are active             │
│                                                         │
│ Upgrade = publish new System CID, activate via governance│
└─────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 4: NODE NETWORK (Elixir/OTP)                      │
├─────────────────────────────────────────────────────────┤
│ Any node can join the network                           │
│ Fetches event log from IPFS/OrbitDB                     │
│ Replays events to build current state                   │
│ Loads active Systems from registry                      │
│ Serves clients, emits new events                        │
│                                                         │
│ Nodes use Erlang clustering for low-latency messaging   │
└─────────────────────────────────────────────────────────┘
```

### State Management: Event Sourcing

**Current (direct mutation):**
```elixir
Entity.update(entity, fn e -> %{e | location: new_room} end)
```

**Proposed (event sourcing):**
```elixir
# All state changes become events
EventLog.append(%Event{
  type: :entity_moved,
  entity_id: entity.id,
  data: %{from: old_room, to: new_room},
  timestamp: DateTime.utc_now(),
  caused_by: player_action_id
})

# State is derived by replaying events
def current_location(entity_id) do
  EventLog.events_for(entity_id)
  |> Enum.reduce(initial_state(), &apply_event/2)
  |> Map.get(:location)
end
```

### Content Addressing: Prototypes on IPFS

```elixir
# Prototype stored on IPFS
# CID: QmXyz...abc123
%{
  id: "elder_monk",
  type: :npc,
  name: "Elder Thane",
  components: %{
    stats: %{hp: 100, wisdom: 50},
    dialogue: %{ref: "Qm...dialogue-cid"}
  },
  behaviors: ["peaceful_npc", "quest_giver"]
}

# Load by CID (cached locally)
def load_prototype(cid) do
  {:ok, data} = IPFS.cat(cid)
  TypedObject.from_cbor(data)
end

# Prototype changes = new CID
# Old instances can still reference old CID
# New instances use new CID
```

### System Registry: Upgradeable Logic

```elixir
# System registered in governance-controlled registry
%System{
  name: "combat",
  version: "2.1.0",
  cid: "Qm...combat-v2.1.0",  # IPFS hash of Elixir module
  active: true,
  activated_by: "operator_did:key:z...",
  activated_at: ~U[2025-01-10 12:00:00Z],

  # Metadata for validation
  handles_events: [:attack, :defend, :flee],
  requires_components: [:stats, :equipment]
}

# Hot-load system from IPFS (sandboxed!)
def load_system(cid) do
  {:ok, code} = IPFS.cat(cid)

  # Validate and sandbox
  :ok = SystemValidator.validate(code)

  # Compile and register
  {:module, module} = Code.compile_string(code)
  BehaviorRegistry.register(module)
end
```

### Distributed Node Network

```elixir
# Node A joins network
defmodule Loka.Node do
  def start do
    # Connect to OrbitDB swarm
    {:ok, _} = OrbitDB.connect(:world_events)

    # Subscribe to new events
    OrbitDB.subscribe(:world_events, fn event ->
      EntityServer.apply_event(event)
    end)

    # Replay history to build current state
    OrbitDB.replay(:world_events, from: :genesis)
    |> Stream.each(&EntityServer.apply_event/1)
    |> Stream.run()

    # Ready to serve clients
    :ok
  end
end

# When node processes a player action
def handle_action(action) do
  # Validate action
  {:ok, events} = ActionResolver.resolve(action)

  # Append to OrbitDB (propagates to all nodes)
  Enum.each(events, &OrbitDB.append(:world_events, &1))

  # Local state updates automatically via subscription
end
```

---

## Development Paradigm Shift

### Without Idempotent Continuous Deployment

| Traditional | Decentralized World |
|-------------|---------------------|
| `fly deploy` | Publish new System to registry |
| Server restarts | Nodes download & verify new System |
| Migrations run | State unchanged, new logic applies |
| Downtime acceptable | Zero downtime mandatory |
| Rollback = redeploy | Rollback = deactivate System |
| You control all nodes | Anyone can run a node |

### The New Development Workflow

```bash
# 1. Write new System (behavior/logic)
vim lib/systems/combat_v3.ex

# 2. Test locally against world state snapshot
mix loka.test.system combat_v3 --snapshot latest

# 3. Publish System to IPFS
mix loka.system.publish combat_v3
# => Published: Qm...abc123

# 4. Propose activation (governance)
mix loka.governance.propose activate combat_v3 Qm...abc123
# => Proposal #42 created

# 5. Governance approves (voting, multisig, or instant if trusted)
# => System activated across all nodes

# 6. Old System still available for rollback
mix loka.governance.propose deactivate combat_v3
```

### Additive-Only Migrations

Smart contract thinking: you can't delete state, only add new state.

```elixir
# BAD: Breaks if entity lacks :mana field
def get_mana(entity), do: entity.mana

# GOOD: Handle missing fields gracefully
def get_mana(entity) do
  Map.get(entity.components, :mana, default_mana(entity))
end

# GOOD: Version-aware logic
def apply_damage(entity, damage) do
  case entity.schema_version do
    1 -> apply_damage_v1(entity, damage)
    2 -> apply_damage_v2(entity, damage)
    _ -> apply_damage_latest(entity, damage)
  end
end
```

---

## Federation Model

A stepping stone before full decentralization:

```
┌─────────────────────────────────────────────────────────┐
│ FEDERATED LOKA                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Planet: Monastery      Planet: Ocean       Planet: Sky │
│  ┌───────────────┐     ┌───────────────┐   ┌──────────┐│
│  │ Operator: You │     │ Operator: Bob │   │ Op: Alice││
│  │ Nodes: 3      │     │ Nodes: 2      │   │ Nodes: 1 ││
│  │ OrbitDB sync  │     │ OrbitDB sync  │   │ OrbitDB  ││
│  └───────┬───────┘     └───────┬───────┘   └────┬─────┘│
│          │                     │                 │      │
│          └─────────────────────┴─────────────────┘      │
│                         │                               │
│          ┌──────────────┴──────────────┐               │
│          │ Interplanetary Protocol     │               │
│          │ - Shared identity (DIDs)    │               │
│          │ - Asset transfer receipts   │               │
│          │ - Cross-world travel        │               │
│          └─────────────────────────────┘               │
│                                                         │
│  Each planet is autonomous but interoperable           │
│  Like Mastodon: multiple servers, shared protocol      │
└─────────────────────────────────────────────────────────┘
```

### Federation Benefits

- **Lower barrier**: Start with trusted operators, add more later
- **Gradual decentralization**: Move toward P2P over time
- **Governance simplicity**: Each planet has its own rules
- **Interoperability**: Defined protocol for cross-world interaction

---

## Loka Compatibility Assessment

### What Loka Already Has (Strengths)

| Feature | Why It Helps |
|---------|--------------|
| **ECS Architecture** | Matches MUD/blockchain game patterns exactly |
| **TypedObject/Prototypes** | Content-addressable definitions |
| **Event Bus** | Already emits events; just need persistence |
| **Behavior System** | Logic already separate from state |
| **GenServer per Entity** | Maps to per-entity state in OrbitDB |
| **Elixir/OTP** | Excellent for P2P networking |
| **Correlation IDs** | Events already track causation chains |

### What Would Need to Change

| Current | Needed |
|---------|--------|
| SQLite (single server) | OrbitDB/IPFS (replicated) |
| Ephemeral EventBus | Persistent event log |
| Direct state mutation | Event sourcing only |
| Single node Registry | Distributed hash table (DHT) |
| `fly deploy` | System registry + governance |
| You are the operator | Anyone can run a node |

### Key Code Changes

| Component | Current Location | Changes Needed |
|-----------|------------------|----------------|
| Event persistence | None | New `Loka.EventLog.IPFS` module |
| Prototype loading | `TypedObject.Loader` | Add IPFS backend |
| State derivation | Direct DB queries | Replay from event log |
| Process registry | `Registry` (local) | Use `pg` (distributed) |
| EventBus | `Phoenix.PubSub` (local) | Add OrbitDB sync |
| System loading | Compiled at deploy | Hot-load from IPFS CIDs |

---

## Implementation Plan

### Phase 1: Event Sourcing Foundation (4-6 weeks)

**Goal**: All state changes become replayable events.

1. Create `Loka.EventLog` abstraction
2. Wrap `Action` handlers to emit events
3. Implement event replay for entity reconstruction
4. Test crash recovery (kill node, verify state restores)

**Deliverables**:
- `lib/loka/event_sourcing/event_log.ex`
- `lib/loka/event_sourcing/replay.ex`
- Modified `Action` handlers
- Crash recovery test suite

### Phase 2: IPFS Content Backend (2-3 weeks)

**Goal**: Prototypes stored on IPFS.

1. Add IPFS client (ex_ipfs or direct HTTP)
2. Modify `TypedObject.Loader` to support CID-based loading
3. Create content publishing workflow
4. Implement local caching layer

**Deliverables**:
- `lib/loka/ipfs/client.ex`
- `lib/loka/ipfs/content_store.ex`
- `mix loka.content.publish` task

### Phase 3: OrbitDB Integration (4-6 weeks)

**Goal**: Event log on OrbitDB with multi-node sync.

1. Set up OrbitDB (JavaScript) as sidecar or port
2. Create Elixir-OrbitDB bridge
3. Replace local EventBus with OrbitDB-backed version
4. Test multi-node event propagation

**Deliverables**:
- OrbitDB sidecar configuration
- `lib/loka/event_sourcing/orbit_backend.ex`
- Multi-node test suite

### Phase 4: System Registry (3-4 weeks)

**Goal**: Hot-loadable, versioned behavior systems.

1. Define System schema and registry
2. Implement IPFS-based System loading
3. Create governance hooks (simple operator approval first)
4. Test System upgrades without state loss

**Deliverables**:
- `lib/loka/systems/registry.ex`
- `lib/loka/systems/loader.ex`
- `mix loka.system.publish` task

### Phase 5: Federation Protocol (6-8 weeks)

**Goal**: Multiple independent worlds that can interoperate.

1. Define interplanetary protocol (identity, asset transfer, travel)
2. Implement cross-world messaging
3. Create federation discovery mechanism
4. Test cross-world player travel

**Deliverables**:
- Protocol specification document
- `lib/loka/federation/protocol.ex`
- `lib/loka/federation/bridge.ex`

### Phase 6: Full Decentralization (8-12 weeks)

**Goal**: Anyone can run a node without permission.

1. Remove operator-only restrictions
2. Implement permissionless node joining
3. Add Sybil resistance (if needed)
4. Governance decentralization (token voting or similar)

**Deliverables**:
- Permissionless node setup guide
- Governance system implementation
- Security audit

---

## Alternatives Considered

### Alternative 1: Full Blockchain (Rejected)

**Approach**: Put everything on Ethereum/L2 like MUD does.

**Why rejected**:
- Latency too high for real-time gameplay
- Cost prohibitive (gas per action)
- Throughput insufficient
- UX terrible (wallet signatures everywhere)

**What we take**: Patterns only (ECS, proxy upgrades, event sourcing)

### Alternative 2: Traditional Clustering Only (Partial)

**Approach**: Just run multiple Erlang nodes with shared Postgres.

**Why partial**:
- Solves availability but not decentralization
- Still operator-controlled
- No auditability or permissionless extension
- Good stepping stone, but not the vision

**What we take**: Erlang clustering as the node coordination layer

### Alternative 3: Gun/Hypercore (Considered)

**Approach**: Use Gun or Hypercore instead of IPFS/OrbitDB.

**Pros**: Simpler API, built for real-time
**Cons**: Less mature ecosystem, fewer integrations, less content-addressing focus

**Decision**: Start with IPFS/OrbitDB (better ecosystem), evaluate Gun later

---

## Open Questions

### Technical

1. **Latency budget**: What's acceptable event propagation delay?
2. **Conflict resolution**: How to handle truly concurrent conflicting events?
3. **Garbage collection**: How to prune old events without losing auditability?
4. **Sandboxing**: How to safely hot-load untrusted System code?
5. **State snapshots**: How often to checkpoint for faster replay?

### Governance

1. **Who can publish Systems?**: Open (anyone), curated (approved list), or operator-only?
2. **Upgrade approval**: Instant, time-delayed, or vote-based?
3. **Emergency rollback**: Who can deactivate a broken System?
4. **Fork handling**: What if nodes disagree on active Systems?

### Economic

1. **Node incentives**: Why would someone run a node?
2. **Storage costs**: Who pays for IPFS pinning?
3. **Free riders**: How to handle nodes that consume but don't contribute?

### UX

1. **Player identity**: DIDs, traditional accounts, or both?
2. **Reconnection**: How to handle node-switching mid-session?
3. **Latency perception**: How to mask event propagation delays?

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OrbitDB immaturity | High | Medium | Start with simpler event log, migrate later |
| Performance degradation | High | Medium | Extensive benchmarking, caching layers |
| Security vulnerabilities | Critical | Low | Sandbox System code, audit before launch |
| Complexity explosion | High | High | Phased rollout, feature flags |
| Community adoption failure | Medium | Medium | Build compelling demo world first |

---

## Success Metrics

### Phase 1 (Event Sourcing)
- [ ] 100% of state changes captured as events
- [ ] Node restart recovers state from events in <30s
- [ ] No data loss in crash scenarios

### Phase 3 (OrbitDB)
- [ ] 2+ nodes stay synchronized within 500ms
- [ ] Event throughput >100 events/second
- [ ] Node can join and sync full history in <5 minutes

### Phase 5 (Federation)
- [ ] Player can travel between 2+ federated worlds
- [ ] Asset transfer works across world boundaries
- [ ] Independent operators running production worlds

### Phase 6 (Decentralization)
- [ ] Node can join without operator permission
- [ ] World continues operating if original operator leaves
- [ ] Community governance functional

---

## References

### Frameworks & Tools
- [MUD Framework](https://mud.dev/) - Autonomous worlds on Ethereum
- [OrbitDB](https://orbitdb.org/) - Peer-to-peer database on IPFS
- [IPFS](https://ipfs.tech/) - Content-addressed storage

### Patterns & Research
- [MUD: An Engine for Autonomous Worlds](https://lattice.xyz/blog/mud-an-engine-for-autonomous-worlds)
- [Upgradeable Smart Contracts](https://docs.openzeppelin.com/learn/upgrading-smart-contracts)
- [Ethereum Upgrade Patterns](https://ethereum.org/developers/docs/smart-contracts/upgrading/)
- [Smart Contract Proxy Patterns](https://www.cyfrin.io/blog/upgradeable-proxy-smart-contract-pattern)

### Game Architecture
- [Zero Downtime Releases](https://docs.unity.com/ugs/en-us/manual/game-server-hosting/manual/concepts/zero-downtime-releases)
- [MMO Architecture](https://prdeving.wordpress.com/2023/09/29/mmo-architecture-source-of-truth-dataflows-i-o-bottlenecks-and-how-to-solve-them/)
- [Amazon New World Architecture](https://aws.amazon.com/blogs/gametech/the-unique-architecture-behind-amazon-games-seamless-mmo-new-world/)

---

## Appendix A: Loka Current Architecture (Relevant to Decentralization)

### State Locations

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: In-Memory (Per-Process)                             │
│ - EntityServer: Per-entity GenServer                        │
│ - Session.Server: Per-player session                        │
│ - Combat.Server: Per-combat instance                        │
├─────────────────────────────────────────────────────────────┤
│ TIER 2: Process-Local ETS Tables                            │
│ - Entity registry (entity_id → PID)                         │
│ - Room-based entity indexes                                 │
├─────────────────────────────────────────────────────────────┤
│ TIER 3: SQLite Database                                     │
│ - Entities table                                            │
│ - Players, accounts, sessions                               │
│ - Quest progress, crafting timers                           │
└─────────────────────────────────────────────────────────────┘
```

### Event Structure (Already Has Correlation)

```elixir
%Event{
  id: "evt_123",
  type: :entity_moved,
  correlation_id: "session_abc",  # Groups related events
  caused_by: "evt_122",           # Causation chain
  source: "player_xyz",
  target: "room_456",
  data: %{from: "room_123", to: "room_456"},
  timestamp: ~U[2025-01-12 10:00:00Z]
}
```

### Key Files for Modification

| File | Purpose | Decentralization Changes |
|------|---------|--------------------------|
| `lib/loka/engine/entity_server.ex` | Per-entity GenServer | Load from event log |
| `lib/loka/engine/event_bus.ex` | Event routing | Add OrbitDB backend |
| `lib/loka/engine/entity_registry.ex` | Process lookup | Use distributed registry |
| `lib/loka/framework/actions/action.ex` | Action handling | Emit events to log |
| `lib/loka/engine/typed_object/loader.ex` | Prototype loading | Add IPFS backend |

---

## Appendix B: Comparison with MUD Framework

| Aspect | MUD (Blockchain) | Loka Proposed |
|--------|------------------|---------------|
| State storage | EVM storage | OrbitDB/IPFS |
| Event log | Ethereum events | OrbitDB append log |
| Confirmation time | 12s+ (L1) or 2s (L2) | <500ms (P2P) |
| Cost per action | Gas fees | Free (node operator pays) |
| Upgrade mechanism | Proxy pattern | System registry |
| Indexing | MUD indexer | OrbitDB built-in |
| Client sync | Event subscription | OrbitDB pubsub |
| Throughput | ~15 TPS (L1) | 100+ events/sec |
| Latency | Seconds | Milliseconds |

**Key insight**: Same patterns, different substrate. IPFS+OrbitDB gives us blockchain properties without blockchain limitations.
