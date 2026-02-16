# Loka MUD Engine - Comprehensive System Study Guide

> **A Complete Technical Reference for Understanding the Loka Game Engine**
>
> *Version 5.0 | February 2026 — V2 Unified Entity System*

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
│ GAME CONTENT - priv/world/ (286 YAML files)                │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK - lib/loka/framework/ (~52 modules)         │
├─────────────────────────────────────────────────────────────┤
│ CONTENT MODULES - lib/loka/content/ (12 modules)           │
├─────────────────────────────────────────────────────────────┤
│ COMPONENTS - lib/loka/components/ (24 accessor modules)    │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE - lib/loka/engine/ (24 modules)                │
├─────────────────────────────────────────────────────────────┤
│ SESSION LAYER - lib/loka/session/ (client messaging)       │
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
| **Component Accessors** | 24 typed accessor modules for entity components |
| **Event Bus (PubSub)** | Decoupled entity communication via Phoenix.PubSub |
| **Hooks** | 22 lifecycle extension points |
| **Locks** | String-based access control (Evennia-inspired) |

### Key Numbers

| Metric | Count |
|--------|-------|
| Elixir modules | ~141 |
| YAML content files | ~286 |
| Test files | ~146 (~2,319 tests) |
| Test suite time | ~33s |
| Supervised children | ~50 (order matters) |
| Framework subsystems | ~15 subdirectories |
| Component accessors | 24 |
| Behavior modules | 11 |
| Content modules | 12 |
| Event hook types | 22 |
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

3. **Components hold all data.** `entity.components` is a JSON map containing all game data. No separate `data`, `attributes`, or `contents` fields.

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
| 250+ framework modules | ~141 modules total | Scriptable framework |
| Bardo death realm | UO-style ghost system | Simpler, more MUD-traditional |
| Resource YAML files (focus, insight, ki) | Removed | Simplified resource model |

### What Still Exists from V1

- **TypedObject.Loader** — Still loads YAML at boot, but primarily for EntitySeeder to consume
- **Player.GameState** — Being phased out in favor of player entity components
- **Hooks system** — Unchanged, still 22 hook types
- **Locks system** — Unchanged, string-based access control
- **Event/EventBus** — Unchanged, Phoenix.PubSub routing

---

## 3. Application Bootstrap

**Key File:** `lib/loka/application.ex`

The OTP application supervisor orchestrates startup of ~50 children in critical order.

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
│   ├── Loka.Session.PlayerRegistry
│   ├── Loka.Session.Registry
│   └── Loka.Session.Supervisor
│
├── Game Configuration
│   └── Loka.Config.Balance (YAML formulas)
│
├── Engine Core (order critical!)
│   ├── Hooks.TaskSupervisor
│   ├── Loka.Engine.Hooks
│   ├── Loka.Engine.TypedObject.Loader  (loads YAML for EntitySeeder)
│   ├── Loka.Engine.EntitySeeder        (seeds YAML → SQLite)
│   ├── Loka.Engine.EntityRegistry      (on-demand process management)
│   ├── Loka.Engine.CommandRegistry
│   ├── Loka.Engine.EntitySupervisor    (DynamicSupervisor for EntityServers)
│   └── Loka.Engine.Cooldowns           (ETS-backed cooldowns)
│
├── Framework Layer
│   ├── Combat, Quest, Dialogue, Skills, etc.
│   └── ... 20+ GenServers
│
├── Zone System
│   ├── Loka.Engine.ZoneLoader
│   ├── Loka.Engine.ZoneRegistry
│   └── Loka.Engine.ZoneReset
│
├── Content Validation
│   └── Loka.Engine.ContentValidator
│
└── Web Server
    └── LokaWeb.Endpoint
```

### Initialization Phases

1. **Infrastructure** — Telemetry, Database, PubSub
2. **Game Config** — Balance formulas from YAML
3. **Engine Core** — Hooks, YAML Loading, EntitySeeder, Entity Registry/Supervisor
4. **Framework** — Social, Quest, Combat, Crafting
5. **Zones** — Zone loading and reset scheduling
6. **Validation** — Content validators
7. **Web Server** — Phoenix endpoint ready

### Environment Configuration

| Env | Database | Pool | Port | Features |
|-----|----------|------|------|----------|
| **Dev** | loka_dev.db | 5 | 4000 | Code reload, debug |
| **Test** | loka_test.db | 1 | 4002 | Sandbox, no server |
| **Prod** | $DATABASE_PATH | 10 | 8080 | HSTS, metrics auth |

---

## 4. Engine Core Layer

**Location:** `lib/loka/engine/` — 24 modules

The Engine Core provides foundational primitives that all other layers build upon.

### Core Modules

| Module | Purpose |
|--------|---------|
| **Entity** | Core data structure for all game objects |
| **Entities** | Unified persistence API (DB CRUD) |
| **EntityServer** | GenServer per active entity (60s auto-save) |
| **EntitySeeder** | Boot-time YAML → DB seeder |
| **EntityRegistry** | On-demand process management |
| **EntitySupervisor** | DynamicSupervisor for entity processes |
| **EntityBehavior** | Behavior callback interface |
| **Spawner** | Create entities from prototype templates |
| **StateMachine** | Shared state machine engine |
| **Event** | Immutable event data structure |
| **EventBus** | PubSub routing to subscribers |
| **Hooks** | Lifecycle callback system |
| **Locks** | Access control expressions |
| **Cooldowns** | ETS-backed cooldown manager |
| **Scripts** | DB context for sandboxed scripts |
| **WorldGraph** | Room connectivity / pathfinding |
| **Directions** | Direction parsing/normalization |
| **Social** / **SocialSubstitution** | Social commands and template substitution |
| **Zone** / **ZoneReset** | Zone management and respawning |
| **ContentValidator** | Content validation framework |

### Module Interaction Diagram

```
YAML Content ──→ TypedObject.Loader ──→ EntitySeeder ──→ SQLite DB
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
  id: String.t(),              # UUID — unique instance ID
  type: entity_type(),         # :character | :room | :item | :npc | :exit
  key: String.t(),             # Prototype key (shared across instances)

  # LegendMUD-style descriptions
  short_desc: String.t(),      # Action/speech identifier (~40 chars)
  long_desc: String.t(),       # Room display sentence (<=79 chars)
  extra_desc: String.t(),      # Detailed examine text (<=10,000 chars)

  keywords: [String.t()],      # Targetable words
  primary_keyword: String.t(), # Single UI keyword
  mood: String.t(),            # Current mood

  location_id: String.t(),     # Parent entity ID (containment)

  # V2 Core Fields
  components: map(),           # ALL game data: %{"combatant" => %{...}, "data" => %{...}}
  traits: [module() | map()],  # Behavior modules or script maps
  tags: [String.t()],          # Categorical markers
  scripts: map(),              # Elixir scripts by hook
  locks: map(),                # Access control
  metadata: map()              # created_at, updated_at, draft flag, etc.
}
```

### Entity Types

| Type | Purpose | Examples |
|------|---------|---------|
| `:room` | Locations/areas | monastery_gate, meditation_garden |
| `:character` | Player characters | Created on first join |
| `:npc` | Non-player characters | village_elder, temple_guard |
| `:item` | Inventory items | wisdom_blade, health_potion |
| `:exit` | Directional connections | Stored in `components["exit"]` |

Content entities (quests, skills, etc.) are also stored as entities with their data in `components["data"]`.

### Entities API (Unified Persistence)

```elixir
# Create
entity = Entity.new(type: :npc, key: "goblin", components: %{...})
{:ok, saved} = Entities.save_entity(entity)

# Read
entity = Entities.get_entity(uuid)
entity = Entities.find_one(key: "goblin", type: :npc)
entities = Entities.find_all(type: :room, location_id: zone_id)
entities = Entities.list_by_type(:npc)

# Update
{:ok, updated} = Entities.save_entity(%{entity | short_desc: "changed"})

# Delete
{:ok, _} = Entities.delete_entity(uuid)
```

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
   └─ handle_info(:tick) → dispatch on_tick to all traits

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

**Location:** `lib/loka/components/` — 24 modules

Component accessors provide typed, safe access to entity `components["key"]` data. They prevent typos and provide domain-specific convenience methods.

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
  def attack(entity), do: get_in(entity.components, [@component_key, "attack"]) || 0
  def defense(entity), do: get_in(entity.components, [@component_key, "defense"]) || 0

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

### Component Modules

**Character/Progression:**
| Module | Component Key | Purpose |
|--------|--------------|---------|
| `Player` | `"player"` | Player account linkage |
| `Stats` | `"stats"` | Core stats (str, dex, int, etc.) |
| `Skills` | `"skills"` | Skill levels and XP |
| `Resources` | `"resources"` | Health, mana, stamina pools |
| `Combatant` | `"combatant"` | Combat stats with StateMachine |
| `Equipment` | `"equipment"` | Equipped items |
| `QuestProgress` | `"quest_progress"` | Quest state tracking |

**World Objects:**
| Module | Component Key | Purpose |
|--------|--------------|---------|
| `Room` | `"room"` | Room metadata |
| `Exit` | `"exit"` | Direction, destination_id, destination_key |
| `Coordinates` | `"coordinates"` | X/Y/Z position |
| `Physical` | `"physical"` | Weight, size, stackable |
| `Container` | `"container"` | Capacity, contents |
| `Spawnable` | `"spawnable"` | Spawn rules |

**Items:**
| Module | Component Key | Purpose |
|--------|--------------|---------|
| `Weapon` | `"weapon"` | Damage, damage_type, speed |
| `Armor` | `"armor"` | Armor rating |

**Content Definitions:**
| Module | Component Key | Purpose |
|--------|--------------|---------|
| `QuestDef` | `"data"` | Quest definition data |
| `SkillDef` | `"data"` | Skill definition data |
| `RecipeDef` | `"data"` | Recipe definition data |
| `DialogueTree` | `"dialogue_tree"` | Dialogue tree data |
| `ZoneConfig` | `"data"` | Zone configuration |

**Misc:**
| Module | Component Key | Purpose |
|--------|--------------|---------|
| `Emotes` | `"ambient_actions"` | Ambient emote schedules |
| `Tick` | `"tick"` | Tick interval configuration |
| `Service` | `"service"` | Service entity config (shops, trainers) |
| `Locks` | `"locks"` | Lock definitions |

### Usage

```elixir
# Read
health = Components.Combatant.health(entity)
has_weapon = Components.Weapon.has?(entity)

# Write
entity = Components.Combatant.set_health(entity, 50)
entity = Components.Weapon.put(entity, %{"damage" => 10, "damage_type" => "slashing"})

# Check
if Components.Combatant.alive?(entity) do
  # ...
end
```

---

## 7. Trait & Behavior System

**Location:** `lib/loka/behaviors/` — 11 modules

### Terminology

- **Trait** = entry in `entity.traits` list (module atom or script map)
- **EntityBehavior** = the callback interface that trait modules implement
- **Behavior module** = compiled Elixir module implementing `EntityBehavior`
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

### Built-in Behavior Modules (11)

**NPC AI:**
| Module | Trigger | Action |
|--------|---------|--------|
| `Wander` | Timer tick | Random movement to allowed rooms |
| `Patrol` | Timer tick | Walk predefined room sequence |
| `Guard` | Threat enters | Protect area, attack threats |
| `Aggressive` | Player enters | Attack on sight |
| `Janitor` | Item dropped | Pick up and dispose items |
| `Scavenger` | Specific item | Collect specific item types |
| `Runner` | Shared utilities | Behavior config helper |

**World Systems:**
| Module | Trigger | Action |
|--------|---------|--------|
| `Weather` | Timer tick | Weather state transitions |
| `DayNight` | Timer tick | Day/night cycle management |
| `NpcAmbient` | Timer tick | NPC ambient emotes/actions |
| `RoomAmbient` | Timer tick | Room atmospheric messages |

### Trait Configuration in YAML

```yaml
key: temple_guard
type: npc
parent: base_npc

# V2: traits (renamed from behaviors)
traits:
  - Loka.Behaviors.Guard       # Compiled module
  - Loka.Behaviors.Aggressive  # Compiled module
  - script: wander             # Script trait (from priv/world/scripts/traits/)
    config:
      interval: 600
      zone: monastery

components:
  behavior_config:
    guard:
      protected_room: "temple_inner"
      attack_on_intrusion: true
    aggressive:
      aggro_range: 1
      attack_delay_ms: 2000
```

### Script Traits (12 YAML files in `priv/world/scripts/traits/`)

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
| **Quest** | available → accepted → in_progress → completed/failed | `Components.QuestDef` |
| **Dialogue** | closed → active → waiting_choice → closed | `Framework.Dialogue` |
| **NPC AI** | idle → patrolling → alert → pursuing → attacking → returning | `EntityBehavior` |
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

**Key Files:**
- `lib/loka/engine/entity_seeder.ex` — Seeds YAML content into SQLite
- `lib/loka/engine/typed_object/loader.ex` — Loads YAML with inheritance

### Boot Flow

```
1. TypedObject.Loader starts, loads all YAML files from priv/world/
2. Resolves prototype inheritance (parent → child merging)
3. EntitySeeder.seed() runs, creates entities in SQLite from loaded YAML
4. YAML attributes: → components["attributes"]
5. YAML content data → components["data"]
6. Runtime: All queries go through Entities API → SQLite
```

### Directory Structure

```
priv/world/
├── prototypes/
│   ├── _base/           # Parent templates (6 files)
│   ├── npcs/            # NPC definitions (39 files)
│   ├── items/           # Item definitions (65+ files)
│   │   ├── containers/  # Herb patches (9)
│   │   ├── food/        # Consumables (1)
│   │   ├── herbs/       # TCM herbs (12)
│   │   └── teas/        # Tea items (3)
│   └── rooms/           # Room definitions (36 files)
├── quests/              # Quest definitions (16 + 3 templates)
├── cutscenes/           # Cutscene sequences (15)
├── scripts/             # Event scripts (10)
│   └── traits/          # Trait scripts (12)
├── skills/              # Skill definitions (25)
├── recipes/             # Crafting recipes (7)
├── statuses/            # Status effects (13)
├── zones/               # Zone definitions (2)
├── storylines/          # Storyline definitions (1)
├── nodes/               # Gathering nodes
│   ├── foraging/        # Wild plants (4)
│   └── herbalism/       # Herb patches (8)
├── resources/           # Resource definitions (2: mana, mv)
├── config/              # System config (5 files)
├── combat/              # Damage types (1)
├── drafts/              # Builder workspace (empty)
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

**Location:** `lib/loka/content/` — 12 modules

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
| `Content.Cutscene` | cutscene | Cutscene sequences |
| `Content.Resource` | resource | Resource pool definitions |
| `Content.StatusEffect` | status | Status effect definitions |
| `Content.GatheringNode` | gathering_node | Gathering node definitions |
| `Content.Storyline` | storyline | Storyline definitions |
| `Content.Validator` | — | Content validation |

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
| `Engine.ZoneLoader` | Load zones from YAML |
| `Engine.ZoneRegistry` | Track all zones |
| `Engine.ZoneReset` | Periodic respawning |

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

### Atmosphere Systems

| System | Purpose |
|--------|---------|
| `Behaviors.DayNight` | Time-of-day cycle (8 phases) |
| `Behaviors.Weather` | Dynamic weather per zone |
| `Behaviors.RoomAmbient` | Room atmospheric messages |
| `Behaviors.NpcAmbient` | NPC idle actions/emotes |

**Day/Night Phases:** dawn, morning, noon, afternoon, dusk, evening, night, midnight

**Weather Types:** clear, cloudy, rain, storm, fog, snow

### WorldGraph

```elixir
# Room connectivity analysis
exits = WorldGraph.get_exits("monastery_courtyard")
{:ok, path} = WorldGraph.find_path("monastery_gate", "meditation_garden")
WorldGraph.reachable?("monastery_gate", "secret_cave")
```

---

## 15. Framework Subsystems

**Location:** `lib/loka/framework/` — ~52 modules across ~15 subdirectories

### Subsystem Directory

| Directory | Modules | Purpose |
|-----------|---------|---------|
| `quest/` | 13+ | Quest progression, objectives, rewards, listeners |
| `social/` | 6 | Chat channels, parties, message routing |
| `inventory/` | 5 | Items, containers, equipment, stacking |
| `combat/` | 4 | Combat mechanics, server, respawn |
| `world/` | 4 | Atmosphere, calendar, room mechanics |
| `content_validator/` | 3 | Dialogue, quest, world validation plugins |
| `skills/` | 2 | Skill progression, binary skills |
| `resources/` | 2 | Resource pools, formula evaluation |
| `conditions/` | 1 | Condition evaluation (quest requirements) |
| `dialogue/` | 1 | Dialogue tree traversal |
| `broadcast/` | 1 | Global announcements |
| `status/` | 1 | Status effect management |
| `player/` | 1 | GameState (V1 remnant, being phased out) |
| `actions/` | 2 | Action definitions, resolution |

### Quest System

The quest system is the largest subsystem with 13+ modules:

```
quest/
├── progress.ex           # Quest progression logic
├── journal.ex            # Quest journal management
├── admin.ex              # Quest admin tools
├── listeners.ex          # Event-driven quest tracking (hooks)
├── metrics.ex            # Quest analytics
├── objective_handler.ex  # Objective type dispatch
├── objective_registry.ex # Objective type registry
├── quest_item_spawner.ex # Quest item spawning
├── state_helper.ex       # Quest state machine helpers
├── timer_manager.ex      # Quest timers
├── validator.ex          # Quest validation
├── handlers/             # Per-objective-type handlers
│   ├── craft_handler.ex
│   ├── get_item_handler.ex
│   ├── go_to_handler.ex
│   ├── kill_handler.ex
│   └── talk_handler.ex
└── progress/
    ├── rewards.ex        # Reward distribution
    └── tracking.ex       # Progress tracking
```

**Objective Types:** `go_to`, `talk`, `kill`, `get_item`, `craft`

### Combat System

- Turn-based PvE/PvP with auto-combat
- StateMachine for state transitions (idle → engaged → dead → respawning)
- Death: UO-style ghost system (die at location, walk to shrine to resurrect)
- `Actions.Death` handles ghost_enter/ghost_exit events
- Ghost state enforced in `Game.Actions` (only allow navigate/chat/resurrect)

### Inventory System

- Container operations (open, take_from, put_in)
- Equipment with slot/bonus system
- Item stacking with max_stack limits
- Physical properties (weight, stackable)

### Deleted V1 Subsystems

Magic, Farming, Housing, Companion, Mail, Barter, Clothing, Elements, WeaponArmorTypes, CombatRound, Relationships, MVSystem, Quest.Status, Quest.ObjectiveTypes, Abilities — all removed in Feb 2026 cleanup.

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
| `scripts` | Elixir scripts (DB context) | integer |
| `timers` | Persistent timers | UUID |
| `spark_states` | Companion AI state | integer |
| `spark_events` | Companion world events | integer |

**Note:** V1's `player_game_states` and `entity_attributes` tables are being phased out/dropped.

### Entity Schema

```elixir
schema "entities" do
  field :type, Ecto.Enum, values: [:room, :character, :npc, :item, :exit]
  field :key, :string
  field :short_desc, :string
  field :long_desc, :string
  field :extra_desc, :string
  field :keywords, {:array, :string}
  field :primary_keyword, :string
  field :mood, :string
  field :location_id, :binary_id

  # Complex data as JSON
  field :components, Loka.Ecto.Json    # ALL game data
  field :traits, Loka.Ecto.Json        # Behavior modules/scripts (renamed from behaviors)
  field :tags, {:array, :string}
  field :locks, Loka.Ecto.Json
  field :scripts, Loka.Ecto.Json
  field :metadata, Loka.Ecto.Json
end
```

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

### Test Distribution (146 files, ~2,319 tests)

| Area | Files | Key Tests |
|------|-------|-----------|
| Engine | 25 | Entities, EntityServer, Seeder, StateMachine, Scripts |
| Mechanics | 32 | Combat, Quest, Dialogue, Inventory |
| Components | 24 | All 24 component accessor modules |
| Behaviors | 11 | All 11 behavior modules |
| Web/Channel | 20 | GameChannel, CommandParser, Builder |
| World Builder | 9 | Script templates, YAML builder |
| Integration | 1 | Full storyline playthrough via ChannelBot |

### ChannelBot Testing

```elixir
# Bot plays through real GameChannel code path
player = create_test_player()
{:ok, bot} = ChannelBot.start(player, strategy: StorylineRunner,
  strategy_opts: [storyline_id: "monastery_arc"])

# 95% parity with real client gameplay
# Validates quest completability, dialogue trees, combat
```

### Content Validators (13)

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
- **Draft YAML cleanup** — Tests creating YAML in `priv/world/drafts/` MUST clean up

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
- Game events logged to ETS (auto-prune after 24h)

### Cooldowns

```elixir
Cooldowns.set(entity_id, :skill_meditate, 30_000)
Cooldowns.ready?(entity_id, :skill_meditate)
Cooldowns.remaining(entity_id, :skill_meditate)
Cooldowns.clear(entity_id)
```

ETS-backed, supervised, auto-sweep every 60s.

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
| `lib/loka/engine/` | Core engine (24 modules) |
| `lib/loka/components/` | Component accessors (24 modules) |
| `lib/loka/behaviors/` | Behavior modules (11 modules) |
| `lib/loka/content/` | Content modules (12 modules) |
| `lib/loka/framework/` | Game subsystems (~52 modules) |
| `lib/loka/game/` | Actions coordinator (11 modules) |
| `lib/loka/session/` | Client communication (3 modules) |
| `lib/loka_web/channels/` | Phoenix channels + builder |
| `priv/world/` | YAML game content (286 files) |
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

### Engine Core (24 modules)
- `Entity`, `Entities`, `EntityServer`, `EntitySeeder`, `EntityRegistry`, `EntitySupervisor`
- `EntityBehavior`, `Behavior`, `Spawner`
- `StateMachine`, `Cooldowns`
- `Event`, `EventBus`
- `Hooks`, `Locks`, `Scripts`
- `Zone`, `ZoneReset`, `WorldGraph`, `Directions`
- `Social`, `SocialSubstitution`
- `ContentValidator`, `SystemSupervisor`

### Components (24 modules)
- Player, Stats, Skills, Resources, Combatant, Equipment, QuestProgress
- Room, Exit, Coordinates, Physical, Container, Spawnable
- Weapon, Armor
- QuestDef, SkillDef, RecipeDef, DialogueTree, ZoneConfig
- Emotes, Tick, Service, Locks

### Behaviors (11 modules)
- Wander, Patrol, Guard, Aggressive, Janitor, Scavenger, Runner
- Weather, DayNight, NpcAmbient, RoomAmbient

### Content (12 modules)
- Quest, Dialogue, Script, Zone, Skill, Recipe, Cutscene
- Resource, StatusEffect, GatheringNode, Storyline, Validator

### Framework (~52 modules across ~15 subdirectories)
- Quest (13+), Social (6), Inventory (5), Combat (4), World (4)
- ContentValidator (3), Skills (2), Resources (2)
- Conditions, Dialogue, Broadcast, Status, Player, Actions (2)

### Game (11 modules)
- Actions, Context, Result
- Combat, Death, Dialogue, Shop, Container, Gathering, Social, Spark

### Session (3 modules)
- Server, Registry, Supervisor

### Channel (2 modules)
- Events, Validator

---

*This guide reflects the V2 Unified Entity System architecture as of February 2026.*
*Previous version (V1/4.0) is available in git history.*
