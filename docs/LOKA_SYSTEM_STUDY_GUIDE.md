# Loka MUD Engine - Comprehensive System Study Guide

> **A Complete Technical Reference for Understanding the Loka Game Engine**
>
> *Version 6.0 | February 2026 — V2 Unified Entity System*

---

## Table of Contents

**Part I: Core Architecture**
1. [Architecture Overview](#1-architecture-overview)
2. [V2 Design Philosophy](#2-v2-design-philosophy)
3. [Application Bootstrap](#3-application-bootstrap)
4. [Engine Core Layer](#4-engine-core-layer)
5. [Entity System](#5-entity-system)
6. [Component Accessors](#6-component-accessors)
7. [Trait & Behavior System](#7-trait--behavior-system)
8. [StateMachine Engine](#8-statemachine-engine)
9. [Event & PubSub System](#9-event--pubsub-system)
10. [Hook System](#10-hook-system)

**Part II: Content & Data**
11. [YAML Prototypes & EntitySeeder](#11-yaml-prototypes--entityseeder)
12. [Content Modules](#12-content-modules)
13. [Elixir Scripting](#13-elixir-scripting)
14. [Zone & World Systems](#14-zone--world-systems)
15. [Framework Subsystems](#15-framework-subsystems)
16. [Game Actions Coordinator](#16-game-actions-coordinator)

**Part III: Client & Transport**
17. [Session & Transport Layer](#17-session--transport-layer)
18. [Channel Protocol](#18-channel-protocol)
19. [Game Client Architecture (Godot)](#19-game-client-architecture-godot)

**Part IV: Infrastructure**
20. [Database & Persistence](#20-database--persistence)
21. [Authentication System](#21-authentication-system)
22. [Admin Dashboard & World Builder](#22-admin-dashboard--world-builder)
23. [Testing Framework](#23-testing-framework)
24. [Observability & Operations](#24-observability--operations)
25. [Deployment](#25-deployment)

**Part V: Reference**
26. [Quick Reference](#26-quick-reference)
27. [Entity Type Reference](#27-entity-type-reference)
28. [Complete Module List](#28-complete-module-list)

---

## 1. Architecture Overview

Loka is an Elixir-based MUD (Multi-User Dungeon) engine framework for building text-based RPGs. It leverages Elixir's OTP for concurrency, fault tolerance, and real-time features.

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Elixir/Phoenix | 1.19.4 / 1.8.3 |
| Runtime | Erlang/OTP | 28.3 |
| Real-time | Phoenix LiveView | 1.1.19 |
| Database | SQLite (via Ecto) | ecto_sqlite3 |
| Auth | phx.gen.auth + Guardian JWT | 2.4.0 |
| Scripting | Elixir (sandboxed) | Native |
| Mobile Client | Godot | 4.6 |
| Deployment | Fly.io | ~$5/month |

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTS - Mobile (Godot 4.6) + Web (LiveView)              │
├─────────────────────────────────────────────────────────────┤
│ WORLD BUILDER - Terminal at /admin/builder (AI-assisted)    │
├─────────────────────────────────────────────────────────────┤
│ GAME CONTENT - priv/world/ (~295 YAML files)               │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK - lib/loka/framework/ (39 modules, 12 dirs) │
├─────────────────────────────────────────────────────────────┤
│ CONTENT MODULES - lib/loka/content/ (10 modules)           │
├─────────────────────────────────────────────────────────────┤
│ COMPONENTS - lib/loka/components/ (5 accessor modules)     │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE - lib/loka/engine/ (~33 modules)               │
├─────────────────────────────────────────────────────────────┤
│ SUPPORT LAYERS - mechanics, primitives, admin, session      │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM - Phoenix 1.8, LiveView, Ecto + SQLite            │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

| Pattern | Purpose |
|---------|---------|
| **Unified Entity System** | Everything is an entity — rooms, NPCs, items, quests, skills |
| **Single DB Truth** | SQLite is the source of truth; no ETS registries for content |
| **Components** | All game data in `entity.components` (JSON map) |
| **Traits** | `entity.traits` — behavior modules or script maps |
| **StateMachine** | Shared state machine engine for quests, combat, dialogue, NPC AI |
| **GenServer per Entity** | In-memory state with 60s auto-save, hibernation, idle shutdown |
| **Prototype Inheritance** | YAML templates with parent/child merging |
| **Content Modules** | Type-safe domain APIs (Quest, Dialogue, Script, Zone, etc.) |
| **Component Accessors** | Typed accessor modules for entity components |
| **Event Bus (PubSub)** | Decoupled entity communication via Phoenix.PubSub |
| **Hooks** | 22 lifecycle extension points |
| **Locks** | String-based access control (Evennia-inspired) |

### Key Numbers

| Metric | Count |
|--------|-------|
| Elixir .ex files (lib/) | ~270 |
| YAML content files | ~295 |
| Test files | ~112 |
| Test suite time | ~33s |
| Supervised children | ~26 (order matters) |
| Framework subdirectories | 12 |
| Component accessors | 5 |
| Content modules | 10 |
| Script trait YAML files | 12 |
| Event hook types | 22 |
| Entity types | 18 |
| Godot GDScript files | 19 (~7,100 LOC) |

---

## 2. V2 Design Philosophy

### Why V2?

V1 had a **three-store problem**: content lived in YAML files, ETS TypedObject Registry, AND SQLite entities table. This caused:
- Dual-store sync bugs (5+ found during builder testing)
- Complex code paths that had to check multiple sources
- Data loss in entity save/load cycles (attributes excluded from round-trip)
- Confusion about which store was authoritative

### V2 Core Principles

1. **Everything is an entity.** Rooms, NPCs, items, quests, skills, recipes, dialogues, scripts, zones — all stored as entities in SQLite.

2. **Single DB truth.** SQLite is the only runtime data store. No ETS registries for content. YAML files are templates, seeded into DB at boot by `EntitySeeder`.

3. **Components hold all data.** `entity.components` is a JSON map containing all game data. No separate `data`, `attributes`, or `contents` fields on the Entity struct.

4. **Traits replace behaviors.** `entity.traits` is a list of behavior module atoms or script maps. The field was renamed from `behaviors` in Feb 2026.

5. **Scriptable framework.** Complex game logic moves from compiled Elixir modules to sandboxed Elixir scripts in YAML, making content extensible by designers.

### V2 vs V1 Changes

| V1 | V2 | Rationale |
|----|----|-----------|
| TypedObject.Loader (ETS) | EntitySeeder (SQLite) | Single source of truth |
| `data`, `attributes` fields | `components` map | Unified storage |
| `behaviors` field | `traits` field | Clearer naming |
| ETS TypedObject Registry | Direct DB queries via Entities | No dual-store sync issues |
| GameState (player state) | Player entity with components | Unified entity system |
| `locks` field on Entity | `components["locks"]` | Everything in components |
| Separate Cooldowns GenServer (ETS) | `components["cooldowns"]` | Component-based, no ETS |
| Separate DayNight/Weather GenServers | `Atmosphere` reads system entity | Stateless module |
| CombatServer/Registry GenServers | Deleted (dead code) | Unused |
| 250+ framework modules | ~270 .ex files total | Scriptable framework |
| Bardo death realm | UO-style ghost system | Simpler, more MUD-traditional |

### What's Been Fully Deleted from V1

- **TypedObject.Loader** — Deleted. EntitySeeder loads YAML directly.
- **Player.GameState** — Deleted. All callers migrated to character entity components. `player_game_states` table dropped.
- **Engine.Cooldowns** (ETS GenServer) — Deleted. Replaced by `Components.Cooldowns` (pure component accessor).
- **CombatServer/CombatSupervisor/CombatRegistry** — Deleted (dead code, zero callers).
- **DayNight/Weather GenServers** — Deleted. Replaced by `Atmosphere` module reading system entity.
- **RespawnManager GenServer** — Converted to plain module, stores data in entity components.
- **Behaviors directory** (`lib/loka/behaviors/`) — Does not exist. All behavior logic is in script traits (12 YAML files in `priv/world/scripts/traits/`).

---

## 3. Application Bootstrap

**Key File:** `lib/loka/application.ex`

The OTP application supervisor orchestrates startup of ~26 children in critical order.

### Supervision Tree

```
Loka.Supervisor (strategy: :one_for_one)
├── Telemetry Layer
│   ├── LokaWeb.Telemetry
│   └── Loka.PromEx (Prometheus metrics)
│
├── Persistence Layer
│   ├── Loka.Repo (Ecto + SQLite)
│   └── Ecto.Migrator (auto-migration)
│
├── Network Layer
│   ├── DNSCluster (optional distributed)
│   └── Phoenix.PubSub
│
├── Session System
│   ├── Loka.Session.PlayerRegistry (Elixir Registry)
│   ├── Loka.Session.Registry
│   └── Loka.Session.Supervisor
│
├── Game Configuration
│   └── Loka.Config.Balance (YAML formulas)
│
├── Engine Core (order critical!)
│   ├── Hooks.TaskSupervisor
│   ├── Loka.Engine.Hooks
│   ├── Loka.Engine.EntitySeeder        (seeds YAML → SQLite)
│   ├── Loka.Engine.EntityRegistry      (process registry — Elixir Registry)
│   ├── Loka.Engine.EntitySupervisor    (DynamicSupervisor for EntityServers)
│   ├── Loka.Engine.EntityRegistry      (on-demand process management)
│   ├── Loka.Engine.SystemSupervisor    (system entity bootstrap)
│   └── Loka.Engine.WorldGraph.LayoutManager
│
├── Admin & Logging
│   ├── Loka.Admin.GameLog
│   └── Loka.Admin.Audit.TaskSupervisor
│
├── Timers
│   └── Loka.Timers.Server
│
├── Framework Layer
│   ├── Loka.Framework.World.NpcAmbient.Scheduler
│   └── Loka.Framework.World.ZoneReset
│
├── Content Validation
│   └── Loka.Engine.ContentValidator
│
├── World Builder
│   └── Loka.WorldBuilder.LLM.ObservabilityLogger
│
└── Web Server
    └── LokaWeb.Endpoint
```

### Post-Boot Initialization (after children start)

```elixir
Loka.Engine.Locks.init_cache()
LokaWeb.Channels.RoomHelpers.init_minimap_cache()
LokaWeb.Plugs.RateLimiter.init_table()
Loka.Framework.Quest.Listeners.register_all()
Loka.Framework.World.RoomEvents.register_hooks()
Loka.Framework.Inventory.Container.register_hooks()
Loka.Engine.SystemSupervisor.boot_system_entities()
```

### Initialization Phases

1. **Infrastructure** — Telemetry, Database, PubSub
2. **Session** — Player registry, session management
3. **Game Config** — Balance formulas from YAML
4. **Engine Core** — Hooks, EntitySeeder, Entity Registry/Supervisor, SystemSupervisor
5. **Admin** — Game logging, audit
6. **Timers** — Persistent timer server
7. **Framework** — NPC ambient scheduler, zone resets
8. **Validation** — Content validators
9. **Web Server** — Phoenix endpoint ready

### Environment Configuration

| Env | Database | Pool | Port | Features |
|-----|----------|------|------|----------|
| **Dev** | loka_dev.db | 5 | 4000 | Code reload, debug |
| **Test** | loka_test.db | 1 | 4002 | Sandbox, no server |
| **Prod** | $DATABASE_PATH | 10 | 8080 | HSTS, metrics auth |

---

## 4. Engine Core Layer

**Location:** `lib/loka/engine/` — ~33 modules (including submodules)

The Engine Core provides foundational primitives that all other layers build upon.

### Core Modules

| Module | Purpose |
|--------|---------|
| **Entity** | Core data structure for all game objects |
| **Entities** | Unified persistence API (DB CRUD) |
| **EntityServer** | GenServer per active entity (60s auto-save) |
| **EntityServer.Volatile** | Volatile (non-persisted) entity state |
| **EntitySeeder** | Boot-time YAML → DB seeder |
| **EntityRegistry** | On-demand process management |
| **EntitySupervisor** | DynamicSupervisor for entity processes |
| **EntityBehavior** | Behavior callback interface |
| **Behavior** | Behavior dispatch utilities |
| **Spawner** | Create entities from prototype templates |
| **Spawner.Editor** | Entity editing for spawned entities |
| **Spawner.Templates** | Spawn template helpers |
| **StateMachine** | Shared state machine engine |
| **FormulaEvaluator** | Formula parsing/evaluation |
| **Event** | Immutable event data structure |
| **EventBus** | PubSub routing to subscribers |
| **Hooks** | Lifecycle callback system |
| **Locks** | Access control expressions |
| **WorldGraph** | Room connectivity / pathfinding |
| **WorldGraph.LayoutManager** | Map layout computation |
| **Directions** | Direction parsing/normalization |
| **Social** / **SocialSubstitution** | Social commands and template substitution |
| **Zone** | Zone data structure |
| **ContentValidator** | Content validation framework |
| **ContentValidator.Plugin** | Validator plugin behaviour |
| **ContentValidator.PrototypePlugin** | Prototype validation |
| **SystemSupervisor** | System entity boot/management |
| **Constants.EntityTypes** | Entity type enum (18 types) |
| **Constants.EquipmentSlots** | Equipment slot definitions |
| **Constants.WorldPaths** | Centralized `priv/world/` path constants |
| **Schema.EntitySchema** | Ecto schema for entities table |
| **Schema.EntityTagSchema** | Ecto schema for entity tags |

### Script Subsystem (in `engine/script/`)

| Module | Purpose |
|--------|---------|
| **Script.Sandbox** | Sandboxed code execution |
| **Script.Bindings** | API bindings for scripts |
| **Script.ActionQueue** | Queued action processing |
| **Script.Executor** | Script execution orchestration |
| **Script.Validator** | Script source validation |

### Module Interaction Diagram

```
YAML Content ──→ EntitySeeder ──→ SQLite DB
                                       │
                                       ↓
                       EntityRegistry.get_or_start(id)
                                       │
                                       ↓
                                 EntityServer
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 ↓                     ↓                     ↓
           Trait Dispatch          EventBus              Hooks
           (on_tick, etc.)     (broadcasts)         (callbacks)
                 ↓                     ↓
           StateMachine          Subscribers
```

---

## 5. Entity System

**Key Files:**
- `lib/loka/engine/entity.ex` — Entity struct
- `lib/loka/engine/entities.ex` — Unified persistence API
- `lib/loka/engine/entity_server.ex` — GenServer implementation
- `lib/loka/engine/entity_registry.ex` — Process registry

### Entity Data Structure

```elixir
%Entity{
  # Identity
  id: String.t(),              # UUID — unique instance ID
  type: entity_type(),         # 18 types (see Entity Types below)
  key: String.t(),             # Prototype key (shared across instances)
  prototype_key: String.t(),   # Parent prototype key (for inheritance)
  is_prototype: boolean(),     # true for prototype definitions
  version: integer(),          # Schema version (default 1)

  # LegendMUD-style descriptions
  short_desc: String.t(),      # Action/speech identifier (~40 chars)
  long_desc: String.t(),       # Room display sentence (<=79 chars)
  extra_desc: String.t(),      # Detailed examine text (<=10,000 chars)

  keywords: [String.t()],      # Targetable words
  primary_keyword: String.t(), # Single UI keyword
  mood: String.t(),            # Current mood

  # Relationships
  location_id: String.t(),     # Parent entity ID (containment)
  account_id: String.t(),      # Player account linkage (characters only)

  # V2 Core Fields
  components: map(),           # ALL game data: %{"combatant" => %{...}, "data" => %{...}}
  traits: [module() | map()],  # Behavior modules or script maps
  tags: [String.t()],          # Categorical markers
  scripts: map(),              # Elixir scripts by hook
  metadata: map()              # created_at, updated_at, draft flag, etc.
}
```

**Note:** The `locks` field was removed from the Entity struct. Lock data is now stored in `components["locks"]`.

### Entity Types (18)

**World entities** (have location, exist in-game):

| Type | Purpose | Examples |
|------|---------|---------|
| `:room` | Locations/areas | monastery_gate, meditation_garden |
| `:character` | Player characters | Created on first join |
| `:npc` | Non-player characters | village_elder, temple_guard |
| `:item` | Inventory items | wisdom_blade, health_potion |
| `:exit` | Directional connections | Stored in `components["exit"]` |

**Content entities** (prototypes/definitions, no location):

| Type | Purpose |
|------|---------|
| `:quest` | Quest definitions |
| `:dialogue` | Dialogue trees |
| `:zone` | Zone definitions |
| `:storyline` | Storyline containers |
| `:cutscene` | Cutscene definitions |
| `:skill` | Skill definitions |
| `:recipe` | Crafting recipes |
| `:resource` | Gatherable resource definitions |
| `:status` | Status effect definitions |
| `:script` | Reusable script definitions |
| `:gathering_node` | Gathering node definitions |
| `:social` | Social command definitions |

**System entities** (no location, background processes):

| Type | Purpose |
|------|---------|
| `:system` | System-level entities (weather, day/night, economy config) |

### Entities API (Unified Persistence)

The `Entities` module provides two API levels:

**High-level API** (returns `%Entity{}` structs):
```elixir
# Find
entity = Entities.find_one(key: "goblin", type: :npc)
entity = Entities.find_one(uuid)  # by ID
entities = Entities.find_all(type: :room, location_id: zone_id)
entities = Entities.find(opts)  # alias for find_one (id) or find_all (opts)
entities = Entities.find_many(ids)
entities = Entities.find_many(keys, :npc)

# Save (create or update)
{:ok, saved} = Entities.save(entity)
{:ok, saved} = Entities.save_batch(entities)

# Delete
{:ok, _} = Entities.delete(uuid)
{:ok, _} = Entities.delete(entity)

# Update
{:ok, updated} = Entities.update(uuid, %{short_desc: "changed"})

# Tags
Entities.add_tag(entity_id, "hostile")
Entities.remove_tag(entity_id, "hostile")
Entities.get_tags(entity_id)

# List
entities = Entities.list_entities(type: :npc)
entities = Entities.list_by_type(:npc)

# Convert schema to struct
entity = Entities.to_entity(schema)
```

**Low-level Schema API** (returns `%EntitySchema{}`, for Ecto operations):
```elixir
schema = Entities.get_entity(uuid)
schema = Entities.get_entity_by_key(key)
{:ok, schema} = Entities.create_entity(attrs)
{:ok, schema} = Entities.update_entity(schema, attrs)
{:ok, schema} = Entities.delete_entity(schema)
```

**Also:** `Entities.save_entity/1` accepts an `%Entity{}` struct and handles both create and update.

### EntityServer Lifecycle

```
1. EntityRegistry.get_or_start(entity_id)
   └─ Starts EntityServer if not running

2. EntityServer.init/1
   ├─ Load entity from database
   ├─ Subscribe to topics: entity:{id}, location:{id}
   ├─ Initialize traits (on_init callbacks)
   ├─ Schedule auto-save timer (60s)
   └─ Schedule tick timer (if components["tick"] exists)

3. EntityServer processes events
   ├─ handle_call(:get_entity) → return entity
   ├─ handle_call({:update, fun}) → apply function, mark dirty
   ├─ handle_cast({:event, event}) → dispatch through traits
   ├─ handle_info(:tick) → dispatch on_tick to all traits
   └─ handle_info(:respawn) → respawn after death (RespawnManager)

4. Auto-save (every 60s if dirty)
   └─ Save to database, clear dirty flag

5. Idle management
   ├─ Hibernate after 30s inactivity
   └─ Stop after 2min inactivity (non-room entities)

6. Terminate
   └─ Final save, unregister from registry
```

### Key EntityServer Functions

```elixir
# Get or start entity process
{:ok, pid} = EntityRegistry.get_or_start(entity_id)

# Update entity atomically
EntityServer.update(pid, fn entity -> updated_entity end)

# Get entity data
entity = EntityServer.get_entity(pid)

# Broadcast to room occupants
EntityRegistry.broadcast_to_room(room_id, event)

# Room occupancy
occupants = EntityRegistry.get_room_occupants(room_id)
```

---

## 6. Component Accessors

**Location:** `lib/loka/components/` — 5 modules

Component accessors provide typed, safe access to entity `components["key"]` data. They prevent typos and provide domain-specific convenience methods.

**Note:** Many component keys (like `"weapon"`, `"room"`, `"exit"`, `"stats"`, etc.) are accessed directly via `get_in(entity.components, ["key", "field"])` throughout the codebase. Only the most complex/frequently-used components have dedicated accessor modules.

### Existing Component Modules

| Module | Component Key | Purpose |
|--------|--------------|---------|
| `Combatant` | `"combatant"` | Combat stats, health, StateMachine integration |
| `Cooldowns` | `"cooldowns"` | Cooldown timestamps (pure component, no ETS/GenServer) |
| `QuestProgress` | `"quest_progress"` | Quest state tracking |
| `ResourcePools` | `"resource_pools"` | Health, mana, stamina resource pools |
| `Wallet` | `"wallet"` | Currency balances (used by Economy system) |

### Pattern

```elixir
defmodule Loka.Components.Combatant do
  @component_key "combatant"

  # Base accessors (all component modules have these)
  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)
  def put(entity, data), do: %{entity | components: Map.put(entity.components, @component_key, data)}
  def component_key, do: @component_key

  # Domain-specific accessors
  def health(entity), do: get_in(entity.components, [@component_key, "health"]) || 0
  def max_health(entity), do: get_in(entity.components, [@component_key, "max_health"]) || 0

  # Mutations
  def set_health(entity, val) do
    comp = get(entity) || %{}
    put(entity, Map.put(comp, "health", val))
  end

  # StateMachine integration
  @machine StateMachine.new(%{
    initial: "idle",
    transitions: %{
      "idle" => ["engaged"],
      "engaged" => ["defending", "fleeing", "dead", "idle"],
      ...
    }
  })
  def machine, do: @machine
end
```

### Common Component Keys (accessed directly, no accessor module)

| Component Key | Purpose | Used By |
|--------------|---------|---------|
| `"data"` | Content entity data (quest, dialogue, skill, etc.) | Content modules |
| `"attributes"` | YAML attributes (coordinates, respawn_time, etc.) | EntitySeeder |
| `"exit"` | Exit direction/destination | Rooms, WorldGraph |
| `"room"` | Room metadata | Room operations |
| `"weapon"` | Weapon stats (damage, type) | Combat |
| `"armor"` | Armor rating | Combat |
| `"equipment"` | Equipped items | Equipment module |
| `"stats"` | Core stats (str, dex, int) | Combat, skills |
| `"skills"` | Skill levels/XP | Skill system |
| `"player"` | Player account linkage | Auth, session |
| `"container"` | Container capacity/contents | Inventory |
| `"physical"` | Weight, size, stackable | Inventory |
| `"spawnable"` | Spawn rules | Zone resets |
| `"ambient_actions"` | Ambient emote config | NpcAmbient |
| `"tick"` | Tick interval config | EntityServer |
| `"behavior_config"` | Trait-specific config | Behaviors |
| `"locks"` | Access control (was a top-level field in V1) | Locks system |
| `"dialogue_tree"` | Dialogue tree data | Dialogue system |
| `"despawned"` | Despawn state for respawn | RespawnManager |
| `"respawn_data"` | Respawn timer data | RespawnManager |
| `"valuable"` | Base price for economy | Economy/shops |

### Usage

```elixir
# Via accessor module
health = Components.Combatant.health(entity)
balance = Components.Wallet.balance(entity)

# Direct component access (more common)
weapon_damage = get_in(entity.components, ["weapon", "damage"])
room_data = entity.components["room"]
quest_data = entity.components["data"]

# Via accessor write
entity = Components.Combatant.set_health(entity, 50)
entity = Components.Wallet.credit(entity, 100, "gold")
```

---

## 7. Trait & Behavior System

**Important:** There is no `lib/loka/behaviors/` directory. All behavior logic is implemented as script traits (YAML files in `priv/world/scripts/traits/`) or via the `EntityBehavior` callback interface in `lib/loka/engine/entity_behavior.ex`.

### Terminology

- **Trait** = entry in `entity.traits` list (module atom or script map)
- **EntityBehavior** = the callback interface that trait modules implement (`lib/loka/engine/entity_behavior.ex`)
- **Script trait** = YAML script referenced by `%{"script" => key, "config" => %{...}}`

### EntityBehavior Callbacks

```elixir
@behaviour Loka.Engine.EntityBehavior

# Called when EntityServer starts
@callback on_init(entity) :: {:ok, entity}

# Called periodically (interval from components["tick"])
@callback on_tick(entity) :: {:ok, entity}

# Called for each dispatched event
@callback on_event(entity, event_type, payload) ::
  {:ok, entity} | {:ok, entity, payload} | {:halt, entity}

# Called when EntityServer stops
@callback on_terminate(entity, reason) :: :ok
```

All callbacks are optional. Return `{:halt, entity}` to stop the behavior chain.

### Script Traits (12 YAML files in `priv/world/scripts/traits/`)

All behavior logic is implemented as script traits:

| Script | Purpose |
|--------|---------|
| `aggressive` | Attack hostiles on sight |
| `ambient_emitter` | Emit ambient messages |
| `day_night_schedule` | Wake/sleep schedules |
| `day_night_staggered_emote` | Phase-aware emotes |
| `guard` | Guard territory |
| `janitor` | Clean up items |
| `nocturnal` | Night-active behavior |
| `patrol` | Patrol route |
| `scavenger` | Collect items |
| `shopkeeper_hours` | Shop open/close |
| `spawn_condition_time` | Time-based spawn rules |
| `wander` | Random wandering |

### Trait Configuration in YAML

```yaml
key: temple_guard
type: npc
parent: base_npc

# V2: traits (renamed from behaviors)
traits:
  - script: guard
    config:
      protected_room: "temple_inner"
      attack_on_intrusion: true
  - script: aggressive
    config:
      aggro_range: 1
      attack_delay_ms: 2000
  - script: wander
    config:
      interval: 600
      zone: monastery
```

### Script Trait Dispatch

EntityServer dispatches script traits via `dispatch_script_traits_tick/1`:

```elixir
# For each script trait in entity.traits:
# 1. Load script source from Content.Script
# 2. Execute in sandbox with bindings
# 3. Bindings include: get_trait_state/set_trait_state, continue/handled
# 4. Script returns continue.() or handled.() to control chain
```

**Important:** Script sandbox requires dot-call syntax for variable-bound functions:
```elixir
# CORRECT (sandbox)
message.("Hello!")
set_trait_state.("patrol_index", 3)
continue.()

# WRONG (will fail at runtime)
message("Hello!")
set_trait_state("patrol_index", 3)
continue()
```

---

## 8. StateMachine Engine

**Key File:** `lib/loka/engine/state_machine.ex`

A shared, reusable state machine engine used across multiple game systems. Eliminates ad-hoc boolean flags and implicit state.

### API

```elixir
# Define a state machine
machine = StateMachine.new(%{
  initial: "idle",
  transitions: %{
    "idle" => ["engaged"],
    "engaged" => ["defending", "fleeing", "dead", "idle"],
    "defending" => ["engaged", "fleeing", "dead", "idle"],
    "fleeing" => ["idle", "dead"],
    "dead" => ["respawning"],
    "respawning" => ["idle"]
  }
})

# Check if transition is valid
StateMachine.can_transition?(machine, "idle", "engaged")  # => true
StateMachine.can_transition?(machine, "idle", "dead")     # => false

# Perform transition
{:ok, "engaged"} = StateMachine.transition(machine, "idle", "engaged")
{:error, :invalid_transition} = StateMachine.transition(machine, "idle", "dead")

# Get valid next states
StateMachine.valid_transitions(machine, "engaged")
# => ["defending", "fleeing", "dead", "idle"]
```

### Usage Across Systems

| System | States | Module |
|--------|--------|--------|
| **Combat** | idle → engaged → defending/fleeing/dead → respawning | `Components.Combatant` |
| **Quest** | available → accepted → in_progress → completed/failed | Content.Quest |
| **Dialogue** | closed → active → waiting_choice → closed | `Framework.Dialogue` |
| **NPC AI** | idle → patrolling → alert → pursuing → attacking → returning | Script traits |
| **Session** | connecting → authenticated → in_game → ghost → disconnected | `Session.Server` |

### Why StateMachine?

- **Prevents invalid states:** Can't go from "idle" directly to "dead"
- **Self-documenting:** State graph is explicit, not hidden in conditionals
- **Shared across systems:** Same engine, same patterns everywhere
- **Testable:** Pure functions, easy to verify transitions

---

## 9. Event & PubSub System

**Key Files:**
- `lib/loka/engine/event.ex` — Event struct and types
- `lib/loka/engine/event_bus.ex` — PubSub routing

### Event Structure

```elixir
%Event{
  id: String.t(),              # UUID
  type: event_type(),          # :attack, :say, :move, etc.
  source: String.t() | nil,    # Entity that caused it
  target: String.t() | nil,    # Entity it affects
  location: String.t() | nil,  # Room where it occurred
  payload: map(),              # Event-specific data
  timestamp: DateTime.t(),
  cancellable?: boolean(),     # Can hooks cancel it?
  cancelled?: boolean(),       # Is it cancelled?
  correlation_id: String.t(),  # Groups related events
  caused_by: String.t() | nil  # Parent event ID
}
```

### Event Types

| Category | Types |
|----------|-------|
| **Movement** | `:move`, `:enter_room`, `:leave_room` |
| **Communication** | `:say`, `:tell`, `:whisper`, `:shout`, `:emote` |
| **Combat** | `:attack`, `:defend`, `:damage`, `:heal`, `:death` |
| **Items** | `:get`, `:drop`, `:give`, `:equip`, `:unequip`, `:use` |
| **World** | `:tick`, `:weather_change`, `:time_change` |
| **System** | `:connect`, `:disconnect`, `:save`, `:load` |
| **Display** | `:display`, `:message`, `:notify_room` |
| **Quest** | `:quest_started`, `:quest_completed`, `:quest_failed`, `:objective_progress` |
| **Economy** | `:currency_changed`, `:item_purchased`, `:item_sold` |

### PubSub Topic Routing

When `EventBus.emit(event)` is called, it broadcasts to:

| Topic Pattern | When Used |
|---------------|-----------|
| `events:global` | Always (all events) |
| `events:{type}` | Always (e.g., `events:attack`) |
| `location:{id}` | If `event.location` set |
| `entity:{id}` | If `event.target` set |

### Event Chaining

```elixir
# Create chain of related events
attack = Event.new(:attack, source: player_id, target: enemy_id)
damage = Event.caused_by(attack, :damage, payload: %{amount: 50})
death = Event.caused_by(damage, :death)
# All three share the same correlation_id
```

---

## 10. Hook System

**Key File:** `lib/loka/engine/hooks.ex`

Hooks are synchronous/asynchronous callbacks for 22 lifecycle events.

### Hook Types (22)

| Category | Hooks |
|----------|-------|
| **Entity Lifecycle** | `:at_entity_creation`, `:at_entity_delete`, `:at_pre_save`, `:at_post_load` |
| **Movement** | `:at_before_move`, `:at_after_move`, `:at_enter_room`, `:at_leave_room` |
| **Perception** | `:at_before_look`, `:at_after_look`, `:at_object_receive`, `:at_object_leave` |
| **Communication** | `:at_before_say`, `:at_after_say` |
| **Commands** | `:at_pre_command`, `:at_post_command`, `:at_command_fail` |
| **Combat** | `:at_before_attack`, `:at_after_attack`, `:at_damage`, `:at_death` |
| **Scripts** | `:at_script_execute`, `:at_script_error` |

### Hook Execution Modes

```elixir
# Synchronous, all hooks run
Hooks.run(:at_entity_creation, [entity, context])

# Asynchronous, fire-and-forget
Hooks.run_async(:at_after_move, [entity, old_room, new_room])

# Validation: stops on first {:halt, reason}
case Hooks.run_until_halt(:at_before_move, [entity, destination]) do
  :ok -> proceed_with_move()
  {:halt, reason} -> block_move(reason)
end
```

### Events vs Hooks

| Use Events When... | Use Hooks When... |
|--------------------|-------------------|
| Broadcasting to multiple subscribers | Intercepting/modifying single actions |
| Logging/auditing game actions | Blocking/cancelling actions |
| Notifying clients | Adding side effects to existing code |
| Decoupled, fire-and-forget | Synchronous validation needed |

---

## 11. YAML Prototypes & EntitySeeder

**Key File:** `lib/loka/engine/entity_seeder.ex` — Seeds YAML content into SQLite

### Boot Flow

```
1. EntitySeeder.seed() runs at application startup
2. Reads all YAML files from priv/world/
3. Resolves prototype inheritance (parent → child merging)
4. Creates entities in SQLite from loaded YAML
5. YAML attributes: → components["attributes"]
6. YAML content data → components["data"]
7. Runtime: All queries go through Entities API → SQLite
```

### Directory Structure

```
priv/world/
├── prototypes/
│   ├── _base/           # Parent templates (6 files)
│   ├── npcs/            # NPC definitions (39 files)
│   ├── items/           # Item definitions (65+ files)
│   │   ├── containers/  # Containers (8)
│   │   ├── food/        # Consumables (1)
│   │   ├── herbs/       # TCM herbs (12)
│   │   └── teas/        # Tea items (3)
│   └── rooms/           # Room definitions (36 files)
├── quests/              # Quest definitions (16 + 3 templates)
├── cutscenes/           # Cutscene sequences (15)
├── dialogues/           # Dialogue trees (directory exists, empty)
├── scripts/             # Event scripts (10)
│   └── traits/          # Trait scripts (12)
├── skills/              # Skill definitions (25)
├── recipes/             # Crafting recipes (7)
├── statuses/            # Status effects (13)
├── zones/               # Zone definitions (2)
├── storylines/          # Storyline definitions (1)
├── nodes/               # Gathering nodes (12 total)
│   ├── foraging/        # Wild plants (4)
│   └── herbalism/       # Herb patches (8)
├── resources/           # Resource definitions (2: mana, mv)
├── config/              # System config (5 files)
├── combat/              # Damage types (1)
├── systems/             # System entity definitions
├── drafts/              # Builder workspace (mirrored dirs)
└── socials.yml          # Social commands
```

### Prototype YAML Format

```yaml
key: "temple_guard"
type: npc
parent: "base_npc"

short_desc: "Temple Guard"
long_desc: "A stern-faced guard watches the temple entrance."
extra_desc: |
  The guard wears ceremonial armor and carries a polished spear.
keywords: [guard, temple, soldier]
primary_keyword: "guard"
mood: "alert"

traits:
  - script: guard
    config:
      protected_room: "temple_inner"
  - script: aggressive

components:
  combatant:
    health:
      current: 80
      max: 80
    stats:
      str: 14
      dex: 12
      sta: 13
    level: 3
  ambient_actions:
    messages:
      - "The guard shifts his weight, scanning the area."
      - "The guard's eyes narrow as he watches a shadow move."
    interval_min: 45
    interval_max: 90

tags: [npc, hostile, monastery]

attributes:
  respawn_time: 300
```

### Inheritance Rules

- Child values override parent values
- Maps are deep-merged
- Lists are concatenated (child + parent, deduplicated)

### EntitySeeder Details

- `EntitySeeder.seed()` is expensive (~650ms) — never put in global test setup
- `build_components/1` maps YAML `attributes:` → `components["attributes"]`
- Content entities get their data in `components["data"]`
- Only seed in specific test `describe` blocks that actually need DB prototypes

---

## 12. Content Modules

**Location:** `lib/loka/content/` — 10 modules

Content modules provide domain-specific APIs for content entities. They resolve via `Entities.find_one()` against the SQLite database.

### Available Modules

| Module | Entity Type | Purpose |
|--------|------------|---------|
| `Content.Quest` | quest | Quest definitions with objectives |
| `Content.Dialogue` | dialogue | NPC dialogue trees |
| `Content.Script` | script | Elixir scripts for hooks/traits |
| `Content.Zone` | zone | Zone definitions with resets |
| `Content.Skill` | skill | Skill definitions |
| `Content.Recipe` | recipe | Crafting recipes |
| `Content.Resource` | resource | Resource pool definitions |
| `Content.StatusEffect` | status | Status effect definitions |
| `Content.Storyline` | storyline | Storyline definitions |
| `Content.Validator` | — | Content validation |

**Note:** `Content.Cutscene` and `Content.GatheringNode` do not exist as separate modules. Cutscene and gathering node entities are accessed directly via `Entities.find_one()`.

### Usage Pattern

```elixir
# Get content by key
{:ok, quest} = Content.Quest.get("intro_welcome")

# Convenience methods
objectives = Content.Quest.objectives(quest)
rewards = Content.Quest.rewards(quest)

# Raw data access (components["data"] convention)
quest_data = quest.components["data"]

# List all of a type
all_quests = Content.Quest.all()

# Direct entity lookup (alternative)
entity = Entities.find_one(key: "intro_welcome", type: :quest)
```

### The `components["data"]` Convention

Content entities (quest, dialogue, script, zone, skill, recipe, etc.) store their domain-specific data in `components["data"]`. This is the established V2 pattern used in 40+ places across all Content modules. EntitySeeder maps YAML content fields into `components["data"]`.

---

## 13. Elixir Scripting

**Key Files:**
- `lib/loka/engine/script/sandbox.ex` — Sandboxed execution
- `lib/loka/engine/script/bindings.ex` — API bindings
- `lib/loka/engine/script/action_queue.ex` — Action processing
- `lib/loka/engine/script/executor.ex` — Script execution orchestration
- `lib/loka/engine/script/validator.ex` — Script source validation

### Sandbox Security

**Blocked Patterns:** `System.`, `File.`, `IO.`, `Process.`, `Node.`, `Code.`, `Application.`, `Port.`, `Module.`, `:erlang.`, pipe operator (`|>`)

**Runtime Protections:**
- Configurable timeout (default 100ms, max 5s)
- 10KB result size limit, 50KB script size limit
- Pattern validation before execution
- Restricted to safe Kernel and Enum functions

### Available Bindings

```elixir
# Context (read-only)
entity           # Current entity map
player           # Player entity map
context          # Execution context

# Query Functions (dot-call syntax required!)
quest_active?.("quest_id")
quest_completed?.("quest_id")
has_item?.("item_key")
has_flag?.("flag_name")
get_stat.("stat_name")
on_cooldown?.("cooldown_key")

# Action Functions (queued, not immediate)
say.("Hello!")                    # Entity speaks
message.("Private message")       # Send to player
set_flag.("flag_name", true)      # Set player flag
give_item.("item_key")            # Give item to player
spawn_npc.("prototype_key")       # Spawn NPC
damage.(entity_id, amount)        # Deal damage

# Trait-specific bindings
get_trait_state.("key")           # Get persistent trait state
set_trait_state.("key", value)    # Set persistent trait state
room_exits.()                     # Get exits from current room
entities_in_room.()               # Get entities in current room
continue.()                       # Continue trait chain
handled.()                        # Stop trait chain

# Cooldown bindings
set_cooldown.("key", duration_ms)
cooldown_remaining.("key")
```

### Script YAML Format

```yaml
key: elder_on_look
type: script
name: "Elder On Look"
data:
  hook: on_look
  entity_key: village_elder
  source: |
    if quest_active?.("find_artifact") do
      {:append, "The elder seems to know something..."}
    else
      :default
    end
```

### Adding New Script Bindings (4-file pattern)

1. **`event.ex`** — Add event type to `@event_types` + payload schema
2. **`bindings.ex`** — Add binding function in `action_bindings` + private helper
3. **`action_queue.ex`** — Add to `@type action_type` + `@limits` + execute handler
4. **`entity_server.ex`** — (optional) Handle incoming events

---

## 14. Zone & World Systems

### Zone System

| Module | Purpose |
|--------|---------|
| `Engine.Zone` | Zone data structure |
| `Framework.World.ZoneReset` | Periodic respawning (supervised) |

**Zone YAML:**
```yaml
key: monastery
name: "Ancient Monastery"
rooms_with_tag: monastery
lifespan_minutes: 30
reset_mode: empty
resets:
  - type: mob
    prototype: young_monk
    room: monastery_courtyard
    max: 3
```

### Atmosphere System

| Module | Purpose |
|--------|---------|
| `Framework.World.Atmosphere` | Reads phase/weather from `world_system` entity |
| `Framework.World.NpcAmbient` + `Scheduler` | NPC ambient emotes/actions |
| `Framework.World.Room` | Room mechanics |

**Note:** `Atmosphere` is a stateless module — it reads day/night phase and weather from a `world_system` entity's components. Falls back to `:day`/`"clear"` when no system entity exists. The old `DayNight` and `Weather` GenServer modules have been deleted.

**Day/Night Phases:** dawn, morning, noon, afternoon, dusk, evening, night, midnight

**Weather Types:** clear, cloudy, rain, storm, fog, snow

### WorldGraph

```elixir
# Room connectivity analysis
exits = WorldGraph.get_exits("monastery_courtyard")
{:ok, path} = WorldGraph.find_path("monastery_gate", "meditation_garden")
WorldGraph.reachable?("monastery_gate", "secret_cave")
```

`WorldGraph.LayoutManager` computes map layouts for the builder minimap feature.

---

## 15. Framework Subsystems

**Location:** `lib/loka/framework/` — 39 modules across 12 subdirectories

### Subsystem Directory

| Directory | Modules | Purpose |
|-----------|---------|---------|
| `quest/` | 17 | Quest progression, objectives, rewards, listeners, handlers |
| `inventory/` | 5 | Items, containers, equipment, stacking, equipable |
| `world/` | 4 | Atmosphere, NPC ambient, room mechanics, zone reset |
| `content_validator/` | 3 | Dialogue, quest, world validation plugins |
| `economy/` | 2 | Central economy system, transaction logging |
| `combat/` | 2 | Combat mechanics, respawn manager |
| `actions/` | 2 | Action definitions, resolution |
| `skills/` | 1 | Skill progression |
| `conditions/` | 1 | Condition evaluation (quest requirements) |
| `dialogue/` | 1 | Dialogue tree traversal |
| `broadcast/` | 1 | Global announcements |

### Quest System

The quest system is the largest subsystem with 17 modules:

```
quest/
├── progress.ex           # Quest progression logic
├── journal.ex            # Quest journal management
├── admin.ex              # Quest admin tools
├── listeners.ex          # Event-driven quest tracking (hooks)
├── metrics.ex            # Quest analytics
├── objective_handler.ex  # Objective type dispatch
├── objective_registry.ex # Objective type registry
├── state_helper.ex       # Quest state machine helpers
├── timer_manager.ex      # Quest timers (stateless, data in components)
├── validator.ex          # Quest validation
├── handlers/             # Per-objective-type handlers
│   ├── craft_handler.ex
│   ├── get_item_handler.ex
│   ├── go_to_handler.ex
│   ├── kill_handler.ex
│   ├── talk_handler.ex
│   └── objective_helper.ex
└── progress/
    ├── rewards.ex        # Reward distribution
    └── tracking.ex       # Progress tracking
```

**Objective Types:** `go_to`, `talk`, `kill`, `get_item`, `craft`

**TimerManager** is a stateless module (no GenServer). Timer data (`expires_at`, `time_limit`, `warned`) is embedded in objective data within the `quest_progress` component.

### Economy System (NEW)

**Location:** `lib/loka/framework/economy/`

Central economy system where ALL currency changes must flow through:

```elixir
# Faucets (gold enters the world)
Economy.mint(entity, amount, "gold", reason: "quest_reward")

# Sinks (gold leaves the world)
Economy.burn(entity, amount, "gold", reason: "shop_purchase")

# Transfers (gold moves between entities)
Economy.transfer(from_entity, to_entity, amount, "gold")

# In-memory transforms (for action modules)
entity = Economy.credit(entity, amount, "gold")
entity = Economy.debit(entity, amount, "gold")
```

All transactions are logged via `EconomyLog` (append-only DB table). Config lives on a `economy_config` system entity for runtime tuning.

The `Components.Wallet` accessor stores currency balances in `entity.components["wallet"]`.

### Combat System

- Turn-based PvE/PvP with auto-combat
- StateMachine for state transitions (idle → engaged → dead → respawning)
- Death: UO-style ghost system (die at location, walk to shrine to resurrect)
- `Actions.Death` handles ghost_enter/ghost_exit events
- Ghost state enforced in `Game.Actions` (only allow navigate/chat/resurrect)
- `RespawnManager` is a plain module (no GenServer) — stores despawn data in entity `components["despawned"]` + `components["respawn_data"]`

### Inventory System

- Container operations (open, take_from, put_in)
- Equipment with slot/bonus system (see `Constants.EquipmentSlots`)
- Item stacking with max_stack limits
- Physical properties (weight, stackable)
- Equipable items with slot definitions

### Deleted V1 Subsystems

Magic, Farming, Housing, Companion, Mail, Barter, Clothing, Elements, WeaponArmorTypes, CombatRound, Relationships, MVSystem, Quest.Status, Quest.ObjectiveTypes, Abilities, GameState, CombatServer/Registry — all removed in Feb 2026 cleanup.

---

## 16. Game Actions Coordinator

**Location:** `lib/loka/game/` — 11 modules

### Why This Design?

The Game Actions layer is the **single entry point** for all game logic, regardless of transport. Whether a player connects via WebSocket, LiveView, REST API, or bot, all actions flow through the same code path.

### Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ GameChannel  │  │  LiveView   │  │  REST API   │  │  Bot/CLI    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       └────────────────┴────────────────┴────────────────┘
                                │
                                ↓
                    ┌───────────────────────┐
                    │   Game.Actions        │
                    │   (Single Entry Point)│
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ↓                 ↓                 ↓
       Action Handlers    Framework Layer    Events/Hooks
```

### Action Modules

| Module | Purpose |
|--------|---------|
| `Actions` | Main entry point, ghost state enforcement |
| `Actions.Context` | Execution context (player_id, character, room, combat, dialogue) |
| `Actions.Result` | Structured result with state changes + events |
| `Actions.Combat` | Attack, flee, combat_tick |
| `Actions.Death` | Ghost death system (UO-style) |
| `Actions.Dialogue` | Start conversation, select choice |
| `Actions.Shop` | Open/buy/sell/close |
| `Actions.Container` | Open/take/close |
| `Actions.Gathering` | Resource gathering |
| `Actions.Social` | Emotes, mood, pose |
| `Actions.Spark` | Spark companion system |

### Context & Result

```elixir
# Context — built by ActionBridge from socket
%Context{
  player_id: "uuid",
  player_name: "Tenzin",
  character: %Entity{...},
  room: %Entity{...},
  combat: nil | %{...},
  dialogue: nil | %{...},
  container: nil | %{...}
}

# Result — returned by action handlers
%Result{
  success: true,
  state_changes: [...],   # Character, room, combat, dialogue updates
  events: [...],           # Events to dispatch to clients
  data: %{...}             # Extra data for client
}
```

### Ghost State Enforcement

When a player dies, they enter ghost state. `Game.Actions` enforces that ghost players can only:
- Navigate (walk to shrine/healer)
- Chat
- Resurrect

All other actions return `{:error, "You are a ghost..."}`.

---

## 17. Session & Transport Layer

**Key Files:**
- `lib/loka/session/server.ex` — Per-player GenServer
- `lib/loka/session/registry.ex` — Session lookup
- `lib/loka/session/supervisor.ex` — DynamicSupervisor

### Session Architecture

```
┌─────────────────┐     ┌─────────────────┐
│ Browser Client   │     │ Godot Client    │
└────────┬────────┘     └────────┬────────┘
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  Phoenix.Channel      │
         │  (GameChannel)        │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │  Session.Server       │
         │  (per player)         │
         └───────────┬───────────┘
                     │
         ┌───────────┼───────────┐
         ↓           ↓           ↓
    PubSub       Timers      EntityRegistry
```

### Multi-Client Support

- Same player can connect from multiple devices (`:liveview`, `:mobile`)
- All clients receive same messages
- 30-second reconnection grace period on disconnect
- Session monitors client processes via refs

### Session Registry

- **Player registry:** `player_id → session_pid` (Elixir Registry, O(1))
- **Room index:** `room_id → [session_pids]` (ETS `:bag` table, O(1))
- Efficient room broadcasts without iterating all sessions

---

## 18. Channel Protocol

**Key Files:**
- `lib/loka/channel/events.ex` — Single source of truth for all events
- `lib/loka/channel/validator.ex` — Event payload validation
- `lib/loka_web/channels/game_channel.ex` — Main game channel
- `lib/loka_web/channels/game_channel/action_bridge.ex` — Transport adapter
- `lib/loka_web/channels/game_channel/serializers.ex` — Client serialization

### Client → Server Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `navigate` | `{direction}` | Movement |
| `click_entity` | `{id, type}` | Entity interaction |
| `action` | `{action, entity_id}` | Combat/actions |
| `inventory` | `{action, item_id}` | Inventory operations |
| `shop` | `{action, item_key}` | Shopping |
| `dialogue_select` | `{choice_index}` | Dialogue choice |
| `chat` | `{mode, message}` | Communication |
| `command` | `{input}` | Text commands |

### Server → Client Events

| Event | Purpose |
|-------|---------|
| `game_state` | Full state on join |
| `room_update` | Room changed |
| `inventory_update` | Inventory changed |
| `stats_update` | Stats changed |
| `equipment_update` | Equipment changed |
| `resources_update` | Resources changed |
| `combat_start/update/end` | Combat state |
| `dialogue_start/update/end` | Dialogue state |
| `shop_open/close` | Shop state |
| `container_open/update/close` | Container state |
| `quest_accepted/completed/progress` | Quest state |
| `ghost_enter/ghost_exit` | Death/resurrection |
| `atmosphere_updated` | Weather/time changes |
| `event` | Text messages |
| `entity_context` | Click response |

### ActionBridge Flow

```
Client event → GameChannel.handle_in → ActionBridge.execute
                                              │
                                              ↓
                                        Build Context from socket
                                              │
                                              ↓
                                        Game.Actions.execute(action, params, ctx)
                                              │
                                              ↓
                                        {:ok, Result} or {:error, reason}
                                              │
                                              ↓
                                        ActionBridge.apply_result
                                        ├── Update socket assigns
                                        ├── Push events to client
                                        └── Broadcast via PubSub
```

### Version Compatibility

```elixir
# On channel join, client version is checked
# Current API version: 1.0.0
# Major version mismatch = rejection
# Minor version = graceful degradation
# 14 core features negotiated
```

---

## 19. Game Client Architecture (Godot)

**Location:** `godot-client/` — 19 GDScript files (~7,100 LOC)

### Architecture

The Godot client is a 2D "magic book" interface targeting mobile (iOS/Android) and web.

```
┌─────────────────────────────────────────────────────────────┐
│ Godot Client (stateless visual layer)                       │
├─────────────────────────────────────────────────────────────┤
│ - 2D book with bone-based PageFlip animation                │
│ - BBCode text rendering for all page types                  │
│ - Navigation via compass directions                         │
│ - All game state comes from server                          │
└─────────────────────────────────────────────────────────────┘
                           │ WebSocket (Phoenix Channels)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Phoenix Server (source of truth)                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `phoenix_client.gd` | WebSocket client, Phoenix channel protocol, 30+ signal types |
| `game_state.gd` | Global state singleton, room state, navigation |
| `main_2d.gd` | Main scene controller, input routing, login flow |
| `loka_book.gd` | 2D book interface using PageFlip plugin |
| `page_content_renderer.gd` | BBCode generation for all page types |
| `menu_tab_renderer.gd` | Menu content (inventory, quests, map, etc.) |
| `dialogue_controller.gd` | Dialogue state management |
| `shop_container_handler.gd` | Commerce rendering |
| `effects_controller.gd` | Visual effects (burn, ice, glow, fade) |
| `mock_world.gd` | Test world data for offline development |

### Page Types

ROOM, MENU, ENTITY, DIALOGUE, SHOP, CONTAINER

### Development

```bash
cd godot-client
./dev.sh                      # Hot reload (~1s per change)
./check.sh                    # Validate scripts headlessly
./build_web.sh --fast         # Quick build (~30s)
./run_tests.sh                # Run 6 test suites
```

---

## 20. Database & Persistence

### Database Schema

| Table | Purpose | Primary Key |
|-------|---------|-------------|
| `players` | User accounts | integer |
| `players_tokens` | Session/email tokens | integer |
| `entities` | All game objects (V2 unified) | UUID |
| `entity_tags` | Entity tag associations | integer |
| `timers` | Persistent timers | UUID |
| `economy_logs` | Economy transaction audit trail | integer |
| `spark_states` | Companion AI state | integer |
| `spark_events` | Companion world events | integer |

**Dropped tables:** `player_game_states` (replaced by entity components), `entity_attributes` (replaced by entity components).

### Entity Schema

```elixir
schema "entities" do
  field :type, Ecto.Enum, values: EntityTypes.all()  # 18 types
  field :key, :string
  field :prototype_key, :string
  field :is_prototype, :boolean, default: false
  field :version, :integer, default: 1
  field :short_desc, :string
  field :long_desc, :string
  field :extra_desc, :string
  field :keywords, {:array, :string}
  field :primary_keyword, :string
  field :mood, :string
  field :location_id, :binary_id
  field :account_id, :binary_id

  # Complex data as JSON
  field :components, Loka.Ecto.Json    # ALL game data
  field :traits, Loka.Ecto.Json        # Behavior modules/scripts
  field :scripts, Loka.Ecto.Json
  field :metadata, Loka.Ecto.Json

  has_many :entity_tags, EntityTagSchema
end
```

**Note:** `tags` are stored via the `entity_tags` association table (not as a JSON array). `locks` is NOT a database field — lock data lives in `components["locks"]`.

### JSON Storage

- Complex game data stored as JSON text via `Loka.Ecto.Json` custom type
- Queryable in SQLite via JSON functions
- **Important:** Map keys become strings on load — always use `data["key"]` not `data[:key]`

### Timer System

Persistent timers that survive restarts and work offline:

```elixir
{:ok, timer} = Loka.Timers.schedule(player_id, :crafting, 30_000, %{recipe_key: "iron_sword"})
:ok = Loka.Timers.cancel(timer_id)
timers = Loka.Timers.get_active(player_id)
completed = Loka.Timers.get_completed_undelivered(player_id)
```

---

## 21. Authentication System

### Auth Methods

| Method | Use Case | Token Type |
|--------|----------|------------|
| **Magic Link** | Primary web auth | Session token (14 days) |
| **Email/Password** | Traditional auth | Session token |
| **JWT** | Mobile/API | Access (1hr) + Refresh (7d) |
| **Guest** | Anonymous play | JWT (device_id based) |

### JWT API

```
POST /api/v1/auth/register   # 3/hour rate limit
POST /api/v1/auth/login      # Returns JWT
POST /api/v1/auth/refresh    # Refresh token
GET  /api/v1/auth/me         # Current player
```

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Registration | 3/hour per IP |
| Login | 5/minute per IP |

---

## 22. Admin Dashboard & World Builder

### Admin Dashboard

**Location:** `lib/loka_web/live/admin_live/`

Access at `/admin` (requires admin role).

| Tab | Features |
|-----|----------|
| **Dashboard** | System stats, quick links |
| **Players** | List, admin toggle, kick |
| **Quests** | Debug player quest state |
| **Testing** | Content validation, combat/balance simulation |
| **Audit Log** | Compliance logging |

### World Builder Terminal

**Location:** `/admin/builder` — MUD-style terminal with AI assistance

The World Builder is a terminal-based content creation tool using Phoenix Channels + MudTerminal JS hook. It replaces the old LiveView GUI (archived on `archive/old-world-builder` branch).

**Implementation:** `lib/loka/world_builder/` (23 modules) — includes entity/room/quest/dialogue managers, tool executor (split into 7 domain modules), script templates, YAML builder, validation manager, audit logging, and LLM integration (AnthropicClient + MCP server).

**Commands:**
```
Navigation: goto <room>, rooms, where, find <search>
Inspect:    info <entity>, list npcs|items|quests
Content:    create zone|storyline|cutscene|script (via AI tools)
Publishing: publish <type> <key>, unpublish, list drafts, list published
Testing:    test quest <key>, test combat, validate
AI:         /ai <prompt>, /ai clear, /project
Map:        map (ASCII minimap)
```

**Draft/Publish Workflow:**
1. Content created via builder → `priv/world/drafts/`
2. Entities spawned from drafts get `metadata["draft"] = true`
3. `publish <type> <key> --force` moves to published directories
4. Room/NPC/item display shows `[DRAFT]` prefix for draft entities

---

## 23. Testing Framework

### Testing Layers

```
┌────────────────────────────────────────────┐
│ Balance Testing (Monte Carlo Simulations)  │
├────────────────────────────────────────────┤
│ Integration Testing (ChannelBot)           │
├────────────────────────────────────────────┤
│ Content Validation (YAML Integrity)        │
├────────────────────────────────────────────┤
│ Unit Testing (ExUnit)                      │
└────────────────────────────────────────────┘
```

### Test Distribution (~112 files)

| Area | Key Tests |
|------|-----------|
| Engine | Entities, EntityServer, Seeder, StateMachine, Scripts |
| Mechanics | Combat, Quest, Dialogue, Inventory |
| Components | Component accessor modules |
| Web/Channel | GameChannel, CommandParser, Builder |
| World Builder | Script templates, YAML builder, builder commands |
| Testing utilities | 23 support modules in `lib/loka/testing/` |
| Integration | Full storyline playthrough via ChannelBot |

### ChannelBot Testing

```elixir
# Bot plays through real GameChannel code path
player = create_test_player()
{:ok, bot} = ChannelBot.start(player, strategy: StorylineRunner,
  strategy_opts: [storyline_id: "monastery_arc"])

# 95% parity with real client gameplay
# Validates quest completability, dialogue trees, combat
```

### Content Validators

| Validator | Checks |
|-----------|--------|
| `PrototypeLinter` | YAML syntax, required fields, valid parents |
| `WorldValidator` | Room connectivity, no orphans, bidirectional exits |
| `QuestValidator` | Kill targets exist, NPCs have dialogue, rewards valid |
| `DialogueValidator` | All `next` references exist, actions valid |
| `ReachabilityAnalyzer` | All items/NPCs reachable from start |
| `CutsceneValidator` | Cutscene structure, references |
| `CraftingValidator` | Recipes valid, ingredients exist |
| `StorylineValidator` | Storyline quest order, dependencies |
| `WanderValidator` | NPC wander paths valid |
| `EntitySyncValidator` | Prototypes match database entities |
| `ChannelSchemaValidator` | WebSocket events match schema |

### Running Tests

```bash
mix test                           # Unit tests (~33s)
mix loka.test                      # All tests (unit + validate + balance)
mix loka.test --quick              # Skip slow balance simulations
mix loka.test.validate             # Content validation only
mix loka.test.validate --only quest  # Specific validator
mix loka.validate.yaml             # Quick YAML syntax check
mix test test/integration/storyline_channel_test.exs  # ChannelBot E2E
```

### Critical Test Patterns

- **EntitySeeder.seed() is expensive (~650ms)** — Only add to specific `describe` blocks that need DB prototypes
- **TypedObjectSandbox.checkout()** — Tests mutating registry state must use this (saves/restores ETS tables)
- **Test log level is `:warning`** — Use `Logger.warning` for debug output
- **Draft YAML cleanup** — Tests creating YAML in `priv/world/drafts/` MUST clean up (leftover files pollute global registry state)

---

## 24. Observability & Operations

### Prometheus Metrics (PromEx)

```
GET /metrics
Authorization: Bearer <METRICS_AUTH_TOKEN>
```

Game-specific + built-in Phoenix/Ecto/VM metrics. Protected by bearer token + IP allowlist.

### Logging

- Structured logging with metadata
- Log levels: debug (dev), warning (test), info (prod)
- Game events logged via `Admin.GameLog` (ETS-backed, auto-prune after 24h)
- Audit logging via `Admin.AuditLog` (async Task.Supervisor)

### Cooldowns (V2 — Component-Based)

Cooldowns are now stored in entity components, NOT in a separate ETS table:

```elixir
# Via Components.Cooldowns accessor
Components.Cooldowns.on_cooldown?(entity, "skill_meditate")
Components.Cooldowns.remaining(entity, "skill_meditate")

# Via script bindings
set_cooldown.("skill_meditate", 30_000)
on_cooldown?.("skill_meditate")
cooldown_remaining.("skill_meditate")
```

Cooldown timestamps are stored in `entity.components["cooldowns"]` as Unix timestamps. The `set_cooldown` action in ActionQueue updates the entity via EntityServer.

---

## 25. Deployment

### Fly.io Setup

- Single-server deployment (~$5/month)
- SQLite (single-writer) + Litestream backup
- Auto-migration on deploy

### CI/CD

- **GitHub Actions:** `test.yml` + `server-ci.yml`
- **Pre-commit hooks:** Elixir formatting, compile (warnings-as-errors), YAML validation, GDScript validation, secrets scan
- **Pre-push hooks:** Content validation (`mix loka.test.validate --quick`)

### Required Secrets

```bash
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
```

---

## 26. Quick Reference

### Common Commands

```bash
# Server Development
cd server
mix deps.get && mix ecto.setup    # Setup
mix phx.server                     # Start at localhost:4000
mix test                           # Run tests
mix credo                          # Code quality

# Content
mix loka.new quest|npc|room <name>
mix loka.test.validate             # Validate content
mix loka.validate.yaml             # Quick YAML check

# Godot Client
cd godot-client
./dev.sh                           # Hot reload
./check.sh                         # Validate scripts
./run_tests.sh                     # Run tests

# Deployment
fly deploy
```

### Key Directories

| Path | Purpose |
|------|---------|
| `lib/loka/engine/` | Core engine (~33 modules) |
| `lib/loka/components/` | Component accessors (5 modules) |
| `lib/loka/content/` | Content modules (10 modules) |
| `lib/loka/framework/` | Game subsystems (39 modules, 12 dirs) |
| `lib/loka/game/` | Actions coordinator (11 modules) |
| `lib/loka/session/` | Client communication (3 modules) |
| `lib/loka/mechanics/` | Core mechanics (4 modules: Check, CombatStats, Damage, Heal) |
| `lib/loka/primitives/` | Math primitives (2 modules: ResourcePool, Roll) |
| `lib/loka/world_builder/` | Builder system (23 modules) |
| `lib/loka/admin/` | Admin tools (5 modules) |
| `lib/loka/testing/` | Test support (23 modules) |
| `lib/loka/channel/` | Channel events/validation (2 modules) |
| `lib/loka/timers/` | Persistent timers (2 modules) |
| `lib/loka_web/` | Web layer (~64 modules) |
| `priv/world/` | YAML game content (~295 files) |
| `docs/` | Documentation |

### PubSub Topics

| Topic | Purpose |
|-------|---------|
| `events:global` | All events |
| `events:{type}` | Events by type |
| `location:{id}` | Room-scoped events |
| `entity:{id}` | Entity-scoped events |
| `player:{id}` | Player-scoped events |

### Routes

| Path | Auth | Description |
|------|------|-------------|
| `/` | No | Landing page |
| `/admin` | Admin | Admin dashboard |
| `/admin/builder` | Admin | MUD terminal builder |
| `/client/auth/login` | No | Magic link → JWT deep link |
| `/api/v1/auth/*` | Varies | REST API |
| `/socket` | JWT | WebSocket |

---

## 27. Entity Type Reference

### Room Entity

```yaml
type: room
key: monastery_courtyard
parent: base_room
short_desc: "Monastery Courtyard"
long_desc: "A peaceful courtyard with ancient stones."
extra_desc: |
  Detailed description...
keywords: [courtyard, monastery]
exits:
  north: temple_main_hall
  south: monastery_gate
spawns:
  - prototype: young_monk
components:
  ambient_actions:
    messages:
      - "Wind rustles the prayer flags."
    interval_min: 30
    interval_max: 60
tags: [outdoor, safe_zone, monastery]
attributes:
  x: 0
  y: 0
```

### NPC Entity

```yaml
type: npc
key: young_monk
parent: base_npc
short_desc: "Young Monk"
long_desc: "A teenage monk sweeps the stones."
keywords: [monk, novice, young]
primary_keyword: "monk"
mood: "distracted"

traits:
  - script: wander
    config:
      interval: 600
      zone: monastery

components:
  combatant:
    health:
      current: 35
      max: 35
    stats:
      str: 8
      dex: 9
      sta: 7
    level: 1
  dialogue_tree:
    start:
      text: "Greetings, traveler..."
      choices:
        - text: "Tell me more."
          next: "more"
  ambient_actions:
    messages:
      - "The monk pauses to wipe his brow."
    interval_min: 30
    interval_max: 60
tags: [npc, friendly, monastery]
```

### Item Entity

```yaml
type: item
key: wisdom_blade
parent: base_weapon
short_desc: "Wisdom Blade"
long_desc: "a singing blade that cuts through illusion"
keywords: [wisdom, blade, sword]
primary_keyword: "blade"
components:
  weapon:
    damage: 10
    damage_type: slashing
  equipable:
    slot: "hand"
  valuable:
    base_price: 200
tags: [weapon, quest_reward]
```

### Quest Definition

```yaml
id: main_sleeping_master
name: "The Sleeping Master"
description: "Lama Tenzin has not moved in seven days..."
giver: abbot_jampa
type: main
act: 1
objectives:
  - id: talk_abbot
    type: talk
    target_id: abbot_jampa
    description: "Speak with Abbot Jampa"
  - id: visit_cell
    type: go_to
    target_id: tenzins_cell
    description: "Visit Lama Tenzin's cell"
rewards:
  xp: 100
  items: [cave_entrance_key]
  unlocks: [main_three_trials]
```

### Script (Trait)

```yaml
key: wander
type: script
name: "Wander Behavior"
data:
  hook: behavior
  config_schema:
    interval:
      type: integer
      default: 600
  source: |
    state = get_trait_state.("wander") || %{}
    exits = room_exits.()
    if length(exits) > 0 do
      exit = Enum.random(exits)
      teleport.(exit["destination_key"])
      set_trait_state.("wander", state)
    end
    continue.()
```

---

## 28. Complete Module List

### Engine Core (~33 modules in `lib/loka/engine/`)
- `Entity`, `Entities`, `EntityServer`, `EntityServer.Volatile`, `EntitySeeder`
- `EntityRegistry`, `EntitySupervisor`, `EntityBehavior`, `Behavior`, `Spawner`
- `Spawner.Editor`, `Spawner.Templates`
- `StateMachine`, `FormulaEvaluator`
- `Event`, `EventBus`
- `Hooks`, `Locks`
- `Zone`, `WorldGraph`, `WorldGraph.LayoutManager`, `Directions`
- `Social`, `SocialSubstitution`
- `ContentValidator`, `ContentValidator.Plugin`, `ContentValidator.PrototypePlugin`
- `SystemSupervisor`
- `Constants.EntityTypes`, `Constants.EquipmentSlots`, `Constants.WorldPaths`
- `Schema.EntitySchema`, `Schema.EntityTagSchema`
- Script: `Sandbox`, `Bindings`, `ActionQueue`, `Executor`, `Validator`

### Components (5 modules)
- `Combatant`, `Cooldowns`, `QuestProgress`, `ResourcePools`, `Wallet`

### Content (10 modules)
- `Quest`, `Dialogue`, `Script`, `Zone`, `Skill`, `Recipe`
- `Resource`, `StatusEffect`, `Storyline`, `Validator`

### Framework (39 modules across 12 subdirectories)
- Quest (17): Progress, Journal, Admin, Listeners, Metrics, ObjectiveHandler, ObjectiveRegistry, StateHelper, TimerManager, Validator, 5 Handlers + ObjectiveHelper, Rewards, Tracking
- Inventory (5): Inventory, Container, Equipment, Equipable, Stacking
- World (4): Atmosphere, NpcAmbient (+Scheduler), Room, ZoneReset
- ContentValidator (3): DialoguePlugin, QuestPlugin, WorldPlugin
- Economy (2): Economy, EconomyLog
- Combat (2): Combat, RespawnManager
- Actions (2): Action, Resolver
- Skills (1): SkillManager
- Conditions (1): Evaluator
- Dialogue (1): Dialogue
- Broadcast (1): Broadcast

### Game (11 modules)
- Actions, Context, Result
- Combat, Death, Dialogue, Shop, Container, Gathering, Social, Spark

### Session (3 modules)
- Server, Registry, Supervisor

### Channel (2 modules)
- Events, Validator

### Mechanics (4 modules)
- Check, CombatStats, Damage, Heal

### Primitives (2 modules)
- ResourcePool, Roll

### World Builder (23 modules)
- EntityManager, RoomManager, QuestManager, DialogueManager
- ToolExecutor + 7 domain modules (Analysis, Dialogues, Entities, Quests, Rooms, Scripts, Zones)
- ScriptTemplates, YamlBuilder, ValidationManager, Respawner
- AuditLog, AuditLogEntry
- AnthropicClient, LLM.ObservabilityLogger
- MCP: Router, Server, Tools

### Admin (5 modules)
- AuditLog, Audit, GameLog, GameLog.Event, GameLog.Quest

### Other
- Accounts (3), Auth (1), AI (1), Config (1), Ecto (1), Timers (2), Utils (2)
- Testing support (23 modules in `lib/loka/testing/`)
- Web layer (~64 modules in `lib/loka_web/`)

---

*This guide reflects the V2 Unified Entity System architecture as of February 2026.*
*Previous version (V5.0) is available in git history.*
