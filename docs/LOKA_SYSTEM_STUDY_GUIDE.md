# Loka MUD Engine - Comprehensive System Study Guide

> **A Complete Technical Reference for Understanding the Loka Game Engine**
>
> *Version 4.0 | January 2026*

---

## Table of Contents

**Part I: Core Architecture**
1. [Architecture Overview](#1-architecture-overview)
2. [Application Bootstrap](#2-application-bootstrap)
3. [Engine Core Layer](#3-engine-core-layer)
4. [Entity System](#4-entity-system)
5. [Event & PubSub System](#5-event--pubsub-system)
6. [Command System](#6-command-system)
7. [Hook System](#7-hook-system)
8. [Locks & Access Control](#8-locks--access-control)

**Part II: Content & Data**
9. [YAML Prototypes & Validation](#9-yaml-prototypes--validation)
10. [Session & Transport Layer](#10-session--transport-layer)
11. [Timer System](#11-timer-system)
12. [Framework Subsystems (27)](#12-framework-subsystems)
13. [Game Actions Coordinator](#13-game-actions-coordinator)
14. [Game Mechanics Layer](#14-game-mechanics-layer)
15. [NPC Behaviors System](#15-npc-behaviors-system)
16. [Zone & World Systems](#16-zone--world-systems)
17. [Elixir Scripting](#17-elixir-scripting)

**Part III: Infrastructure**
18. [Database & Persistence](#18-database--persistence)
19. [Authentication System](#19-authentication-system)
20. [Web Layer & Middleware](#20-web-layer--middleware)
21. [Channel Protocol & Validation](#21-channel-protocol--validation)
22. [Analytics & Observability](#22-analytics--observability)
23. [Admin Dashboard](#23-admin-dashboard)

**Part IV: Development**
24. [Testing Framework](#24-testing-framework)
25. [Mix Tasks & CLI](#25-mix-tasks--cli)
26. [Creating New Plugins](#26-creating-new-plugins)
27. [World Builder System](#27-world-builder-system)
28. [Spark Companion System](#28-spark-companion-system)
29. [Mobile App Architecture](#29-mobile-app-architecture)
30. [Quick Reference](#30-quick-reference)

---

## 1. Architecture Overview

Loka is an Elixir-based MUD (Multi-User Dungeon) engine framework. It leverages Elixir's OTP for concurrency, fault tolerance, and real-time features.

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Elixir/Phoenix | 1.19.4 / 1.8.3 |
| Runtime | Erlang/OTP | 28.3 |
| Real-time | Phoenix LiveView | 1.1.19 |
| Database | SQLite (via Ecto) | ecto_sqlite3 |
| Auth | phx.gen.auth + Guardian JWT | 2.4.0 |
| Scripting | Elixir (sandboxed) | Native |
| Deployment | Fly.io | ~$5/month |

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTS - Mobile (React Native) + Web (LiveView)           │
├─────────────────────────────────────────────────────────────┤
│ WORLD BUILDER - lib/loka/world_builder/ (content creation) │
├─────────────────────────────────────────────────────────────┤
│ GAME CONTENT - priv/world/prototypes/ (YAML)               │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK - lib/loka/framework/ (33 subsystems)       │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE - lib/loka/engine/ (entities, events, commands)│
├─────────────────────────────────────────────────────────────┤
│ SESSION LAYER - lib/loka/session/ (client messaging)       │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM - Phoenix 1.8, LiveView, Ecto + SQLite            │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

| Pattern | Purpose |
|---------|---------|
| Entity-Component-Behavior | Composition over inheritance |
| GenServer per Entity | In-memory state with auto-save |
| Prototype Inheritance | YAML templates with parent/child merging |
| **TypedObject System** | Unified foundation for all game content |
| Event Bus (PubSub) | Decoupled entity communication |
| Hooks | 22 lifecycle extension points |
| Locks | String-based access control (inspired by [Evennia](https://github.com/evennia/evennia)) |

### TypedObject Architecture

TypedObject provides a unified foundation for all game content types. Content modules wrap TypedObject with domain-specific APIs:

| Module | Type | Purpose |
|--------|------|---------|
| `Content.Quest` | `:quest` | Quest definitions with objectives |
| `Content.Dialogue` | `:dialogue` | NPC dialogue trees |
| `Content.Script` | `:script` | Elixir scripts for NPCs |
| `Content.Zone` | `:zone` | Zone definitions with resets |

**Resolution Order:** Framework systems check Content modules first, then fall back to legacy loaders.

**YAML Loading:** `TypedObject.Loader` loads from multiple directories:
- `priv/world/prototypes/` - Entity prototypes
- `priv/world/quests/` - Quest definitions
- `priv/world/zones/` - Zone definitions
- `priv/world/scripts/` - Elixir scripts

---

## 2. Application Bootstrap

**Key File:** `lib/loka/application.ex`

The OTP application supervisor orchestrates startup of all Loka systems in a critical order.

### Supervision Tree (30+ Children)

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
│   ├── Loka.Engine.PrototypeLoader
│   ├── Loka.Engine.SocialLoader
│   ├── Loka.Engine.EntityRegistry
│   ├── Loka.Engine.CommandRegistry
│   └── Loka.Engine.WorldGraph.LayoutManager
│
├── Plugin System
│   ├── Loka.Engine.PluginSupervisor
│   └── Loka.Engine.PluginLoader
│
├── Framework Layer (Social, Quest, Combat, etc.)
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

1. **Infrastructure** - Telemetry, Database, PubSub
2. **Game Config** - Balance formulas from YAML
3. **Engine Core** - Hooks, Prototypes, Entities, Commands
4. **Plugins** - Third-party extensions
5. **Framework** - Social, Quest, Combat, Crafting, Resources
6. **Zones** - Zone loading and reset scheduling
7. **Validation** - Content validators (can fail startup)
8. **ETS Caches** - Locks, Minimap, RateLimiter
9. **Hook Registration** - Quest, World, Inventory, Social hooks
10. **World Spawning** - Create room entities from YAML
11. **Web Server** - Phoenix endpoint ready

### Balance Configuration

**File:** `priv/config/balance.yml`

```elixir
# Access balance values
Balance.get(:combat, :damage, :base_damage)  # => 10
Balance.get(:progression, :xp_curve, :base)   # => 100

# Evaluate formulas with live data
Balance.eval_formula(:combat, :damage, :formula, %{
  base: 10, str: 15, weapon_damage: 5
})
```

**Categories:** Combat, Progression, Resources, Abilities, Economy, Gathering, Crafting

### Environment Configuration

| Env | Database | Pool | Port | Features |
|-----|----------|------|------|----------|
| **Dev** | loka_dev.db | 5 | 4000 | Code reload, debug |
| **Test** | loka_test.db | 1 | 4002 | Sandbox, no server |
| **Prod** | $DATABASE_PATH | 10 | 8080 | HSTS, metrics auth |

### Required Production Secrets

```bash
SECRET_KEY_BASE      # Cookie encryption
GUARDIAN_SECRET_KEY  # JWT signing
DATABASE_PATH        # SQLite location
PHX_HOST             # External hostname
```

---

## 3. Engine Core Layer

**Location:** `lib/loka/engine/`

The Engine Core provides foundational primitives that the Framework layer builds upon.

### Core Modules (36 total)

| Module | Purpose |
|--------|---------|
| **Entity** | Core data structure for all game objects |
| **EntityServer** | GenServer per active entity |
| **EntityRegistry** | Process registry & room occupancy |
| **EntitySupervisor** | Fault tolerance for entity processes |
| **Event** | Immutable event data structure |
| **EventBus** | PubSub routing to subscribers |
| **Command** | Command behavior protocol |
| **CommandRegistry** | Command dispatch & aliases |
| **Prototype** | YAML template structure |
| **PrototypeLoader** | Loads & resolves prototype inheritance |
| **Spawner** | Instantiates entities from prototypes |
| **Hooks** | Lifecycle callback system |
| **Locks** | Access control expressions |
| **Scripting** | Elixir sandbox execution |
| **Behavior** | Entity behavior protocol |

### Module Interaction Diagram

```
Prototype (YAML) ──→ PrototypeLoader ──→ Spawner ──→ Entity
                                              │
                                              ↓
                                        EntityServer
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ↓                     ↓                     ↓
                  EntityRegistry         EventBus              Hooks
                  (PID lookup)        (broadcasts)        (callbacks)
                        ↓                     ↓
                  Room Occupancy        Subscribers
```

---

## 4. Entity System

**Key Files:**
- `lib/loka/engine/entity.ex` - Entity struct
- `lib/loka/engine/entity_server.ex` - GenServer implementation
- `lib/loka/engine/entity_registry.ex` - Registry

### Entity Data Structure

```elixir
%Entity{
  id: String.t(),              # UUID - unique instance ID
  type: entity_type(),         # :character | :room | :item | :npc | :exit
  key: String.t(),             # Prototype key (shared across instances)

  # LegendMUD-style descriptions
  short_desc: String.t(),      # Action/speech identifier (~40 chars)
  long_desc: String.t(),       # Room display sentence (<=79 chars)
  extra_desc: String.t(),      # Detailed examine text (<=10,000 chars)

  keywords: [String.t()],      # Targetable words
  primary_keyword: String.t(), # Single UI keyword
  mood: String.t(),            # Current mood

  location_id: String.t(),     # Parent room ID
  contents: [String.t()],      # Child entity IDs

  # Extensibility
  components: map(),           # Flexible data: %{"combat" => {...}}
  behaviors: [module()],       # Event handlers
  attributes: map(),           # EAV pattern storage
  tags: [String.t()],          # Categorical markers
  scripts: map(),              # Elixir scripts by hook
  locks: map(),                # Access control
  metadata: map()              # created_at, updated_at, etc.
}
```

### Entity Types

| Type | Purpose |
|------|---------|
| `:room` | Locations/areas |
| `:character` | Player characters |
| `:npc` | Non-player characters |
| `:item` | Inventory items |
| `:exit` | Directional connections |

### EntityServer Lifecycle

```
1. EntityRegistry.get_or_start(entity_id)
   └─ Starts EntityServer if not running

2. EntityServer.init/1
   ├─ Load entity from database
   ├─ Subscribe to topics: entity:{id}, room:{id}
   ├─ Schedule auto-save timer (60s)
   └─ Schedule idle timer (2min)

3. EntityServer processes events
   ├─ handle_call(:get_entity) → return entity
   ├─ handle_call({:update, fun}) → apply function, mark dirty
   └─ handle_cast({:event, event}) → process through behaviors

4. Auto-save (every 60s)
   └─ Save to database if dirty=true

5. Idle management
   ├─ Hibernate after 30s inactivity
   └─ Stop after 2min inactivity

6. Terminate
   └─ Final save, unregister from room
```

### Key Functions

```elixir
# Get or start entity process
EntityRegistry.get_or_start(entity_id)

# Update entity
EntityServer.update(pid, fn entity -> updated_entity end)

# Get entity data
EntityServer.get_entity(pid)

# Broadcast to room
EntityRegistry.broadcast_to_room(room_id, event)

# Room occupancy
EntityRegistry.get_room_occupants(room_id)
```

---

## 5. Event & PubSub System

**Key Files:**
- `lib/loka/engine/event.ex` - Event struct
- `lib/loka/engine/event_bus.ex` - PubSub routing

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

### Event Types (28 total)

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

When `EventBus.emit(event)` is called, the event broadcasts to multiple topics:

| Topic Pattern | When Used |
|---------------|-----------|
| `events:global` | Always (all events) |
| `events:{type}` | Always (e.g., `events:attack`) |
| `room:{id}` | If `event.location` set |
| `entity:{id}` | If `event.target` set |

### Event Type Validation

**Compile-time validation:** Event types are validated at creation:

```elixir
# Valid - known event type
Event.new(:attack, source: player_id)  # ✓

# Invalid - raises ArgumentError
Event.new(:invalid_type, source: player_id)  # ✗ raises

# Check validity
Event.valid_type?(:attack)  # => true
Event.valid_type?(:foo)     # => false

# For testing with arbitrary types
Event.new_unchecked(:test_type, payload: %{})
```

### Payload Schemas

Each event type has required/optional payload fields:

```elixir
# Combat events
:attack   -> %{damage: required, hit: required, critical: optional}
:damage   -> %{amount: required, type: required, source_id: optional}
:heal     -> %{amount: required, source: optional}

# Movement events
:move     -> %{direction: required, from_room: required, to_room: required}

# Validate payloads
case Event.validate_payload(event) do
  :ok -> process(event)
  {:error, reason} -> log_invalid(reason)
end
```

### Event Creation & Chaining

```elixir
# Simple event
event = Event.new(:attack, source: player_id, target: enemy_id)

# Event with payload
event = Event.new(:damage, payload: %{amount: 50, type: :slashing})

# Event chains (correlation tracking)
attack = Event.new(:attack, source: player_id, target: enemy_id)
damage = Event.caused_by(attack, :damage, payload: %{amount: 50})
death = Event.caused_by(damage, :death)
# All three share the same correlation_id

# Trace event chains
related = Event.find_correlated(events, attack.correlation_id)
chain = Event.build_chain(events, attack.id)  # Returns tree structure
```

### Subscribing to Events

```elixir
# In EntityServer.init
EventBus.subscribe("entity:#{entity.id}")
EventBus.subscribe("room:#{entity.id}") # if room

# Receive events
def handle_info({:event, event}, state) do
  # Process through behaviors
  Behavior.process_event(state.entity, event, %{})
end
```

---

## 6. Command System

**Key Files:**
- `lib/loka/engine/command.ex` - Command behavior
- `lib/loka/engine/command_registry.ex` - Dispatch

### Command Behavior Callbacks

```elixir
@callback key() :: String.t()                    # "look", "get", etc.
@callback aliases() :: [String.t()]              # ["l"] for "look"
@callback help() :: String.t()                   # Help text
@callback locks() :: [atom()]                    # Permissions required
@callback required_context() :: [atom()]         # Keys needed in context
@callback parse(args :: String.t(), context :: map()) ::
  {:ok, map()} | {:error, String.t()}
@callback execute(parsed :: map(), context :: map()) ::
  {:ok, [Event.t()]} | {:error, String.t()}
```

### Command Context

```elixir
%{
  actor: map(),      # Entity executing command (player or game_state)
  location: map(),   # Current room
  session: pid()     # Session process for messaging
}
```

### Command Execution Pipeline

```
1. CommandRegistry.execute("say", "hello", context)
   │
   ↓
2. Lookup command module by key or alias
   │
   ↓
3. Check locks (permissions)
   │
   ↓
4. Validate required context keys
   │
   ↓
5. Command.parse("hello", context) → {:ok, %{message: "hello"}}
   │
   ↓
6. Command.execute(%{message: "hello"}, context) → {:ok, [events]}
   │
   ↓
7. Return events to caller
```

### Example Command Implementation

```elixir
defmodule Loka.Framework.Commands.SayCommand do
  use Loka.Engine.Command

  def key, do: "say"
  def aliases, do: ["'"]
  def help, do: "Say something to the room."

  def parse(args, _context) do
    {:ok, %{message: String.trim(args)}}
  end

  def execute(%{message: message}, context) do
    actor = Map.get(context, :actor)
    location = Map.get(context, :location)

    msg = ScopedMessage.new(:room, message, actor, location: location.id)
    MessageRouter.route(msg)

    {:ok, [%{type: :say, text: "You say, \"#{message}\""}]}
  end
end
```

---

## 7. Hook System

**Key File:** `lib/loka/engine/hooks.ex`

Hooks are synchronous/asynchronous callbacks for 22 lifecycle events.

### Hook Types (22 total)

| Category | Hooks |
|----------|-------|
| **Entity Lifecycle** | `:at_entity_creation`, `:at_entity_delete`, `:at_pre_save`, `:at_post_load` |
| **Movement** | `:at_before_move`, `:at_after_move`, `:at_enter_room`, `:at_leave_room` |
| **Perception** | `:at_before_look`, `:at_after_look`, `:at_object_receive`, `:at_object_leave` |
| **Communication** | `:at_before_say`, `:at_after_say` |
| **Commands** | `:at_pre_command`, `:at_post_command`, `:at_command_fail` |
| **Combat** | `:at_before_attack`, `:at_after_attack`, `:at_damage`, `:at_death` |
| **Scripts** | `:at_script_execute`, `:at_script_error` |

### Hook Registration

```elixir
# Register a hook handler
Hooks.register(:at_entity_creation, MyModule, :on_create, priority: 50)

# Priority: lower = executes first (default: 100)
```

### Callback Validation

Hooks are **validated at registration time** to catch errors early:

```elixir
# Valid registration
{:ok, _} = Hooks.register(:at_enter_room, MyModule, :on_enter, [])

# Invalid - module not loaded
{:error, {:module_not_loaded, UnknownModule}} =
  Hooks.register(:at_enter_room, UnknownModule, :on_enter, [])

# Invalid - function doesn't exist
{:error, {:function_not_found, MyModule, :nonexistent, 2}} =
  Hooks.register(:at_enter_room, MyModule, :nonexistent, [])

# For testing - skip validation
Hooks.register(:at_enter_room, TestModule, :test_fn, skip_validation: true)
```

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

### Hook Return Values

| Return | Effect |
|--------|--------|
| `:ok` | Continue to next hook |
| `{:ok, term()}` | Continue (data ignored) |
| `{:halt, reason}` | Stop chain (only for `run_until_halt`) |

### Real-World Example: Quest Progress

```elixir
# In Quest.Listeners - registered at app startup
def on_room_entry(player_context, room_info) do
  room_key = extract_room_key(room_info)
  game_state = get_game_state(player_context)

  # Auto-update quest progress for "go_to" objectives
  QuestProgress.update_progress(game_state, %{type: :go_to, target_id: room_key})
  :ok
end

# Triggered by NavigateCommand:
Hooks.run(:at_enter_room, [player_context, %{room_id: new_room.id}])
```

### Events vs Hooks: When to Use Which

| Use Events When... | Use Hooks When... |
|--------------------|-------------------|
| Broadcasting to multiple subscribers | Intercepting/modifying single actions |
| Logging/auditing game actions | Blocking/cancelling actions |
| Notifying clients | Adding side effects to existing code |
| Decoupled, fire-and-forget | Synchronous validation needed |

**Example Scenarios:**

```elixir
# EVENT: Player said something (notify room, log it)
EventBus.emit(Event.new(:say, source: player_id, payload: %{message: "Hello"}))

# HOOK: Check if player CAN say something (maybe muted?)
case Hooks.run_until_halt(:at_before_say, [player, message]) do
  :ok -> proceed_with_say()
  {:halt, :muted} -> deny_with_message("You are muted")
end

# HOOK: After movement, update quests
Hooks.run_async(:at_enter_room, [player, room])  # Quest progress updates
```

---

## 8. Locks & Access Control

**Key File:** `lib/loka/engine/locks.ex`

String-based access control system.

### Lock Syntax

```
lockfunc(args) [AND|OR|NOT] lockfunc2(args)
```

### Built-in Lock Functions (12)

| Function | Purpose | Example |
|----------|---------|---------|
| `all()` | Always allows | `"all()"` |
| `none()` | Always denies | `"none()"` |
| `perm(name)` | Check permission | `"perm(admin)"` |
| `attr(name, val)` | Exact attribute match | `"attr(level, 10)"` |
| `attr_gt(name, val)` | Attribute > value | `"attr_gt(strength, 50)"` |
| `attr_lt(name, val)` | Attribute < value | `"attr_lt(level, 5)"` |
| `id(entity_id)` | Match accessor ID | `"id(owner_123)"` |
| `tag(name)` | Entity has tag | `"tag(admin)"` |
| `has_item(key)` | Has item in inventory | `"has_item(gold_key)"` |
| `has_key(key)` | Alias for has_item | `"has_key(castle_key)"` |
| `is_type(type)` | Accessor is type | `"is_type(character)"` |
| `in_room(room_key)` | Accessor is in room | `"in_room(throne)"` |

### Lock Examples

```elixir
# Entity locks definition
entity = %Entity{
  locks: %{
    "get" => "all()",                           # Anyone can pick up
    "drop" => "all()",                          # Anyone can drop
    "use" => "perm(admin) OR attr_gt(level, 10)", # Admin or high level
    "edit" => "perm(builder)",                  # Only builders
    "delete" => "perm(admin)"                   # Only admins
  }
}

# Checking locks
case Locks.check(entity, accessor, "use") do
  :ok -> allow_use()
  {:denied, reason} -> deny_with_message(reason)
end
```

### Complex Lock Expressions

```
"(perm(admin) OR id(owner123)) AND NOT tag(banned)"
```

### Custom Lock Functions

```elixir
Locks.register_function("is_guild_member", fn _entity, accessor, [guild_id] ->
  accessor.components["guild"]["id"] == guild_id
end)

# Use: "is_guild_member(thieves_guild)"
```

---

## 9. YAML Prototypes & Validation

**Key Files:**
- `lib/loka/engine/prototype.ex` - Prototype struct
- `lib/loka/engine/prototype_loader.ex` - Loading & inheritance
- `lib/loka/testing/content/prototype_linter.ex` - Validation

### Directory Structure

```
priv/world/prototypes/
├── _base/                 # Parent prototypes
│   ├── base_npc.yml
│   ├── base_item.yml
│   ├── base_room.yml
│   └── base_weapon.yml
├── npcs/                  # NPC definitions
├── items/                 # Item definitions
│   ├── herbs/
│   ├── containers/
│   └── weapons/
├── rooms/                 # Room definitions
│   └── _templates/
└── exits/                 # Exit definitions
```

### Prototype YAML Structure

```yaml
# Required fields
key: "unique_prototype_key"
type: npc|item|room|exit

# Optional inheritance
parent: "base_npc"

# Description fields (LegendMUD style)
short_desc: "Young Monk"           # Action/speech name
long_desc: "A young monk sweeps."  # Room display sentence
extra_desc: |                      # Detailed examination
  The young monk wears simple robes...
keywords: [monk, novice, young]
primary_keyword: "monk"
mood: "anxious"

# Organization
is_template: false
tags: [friendly, monastery]

# Data
components:
  combatant:
    health: {current: 35, max: 35}
    stats: {str: 8, dex: 9, sta: 7}
behaviors: []
attributes: {}
scripts: {}
locks: {}
```

### Prototype Inheritance

```yaml
# Parent: base_weapon.yml
key: base_weapon
parent: base_item
type: item
components:
  weapon:
    damage: 5
    damage_type: "physical"

# Child: wisdom_blade.yml
key: wisdom_blade
parent: base_weapon
components:
  weapon:
    damage: 10               # Override
    damage_type: slashing    # Override
  valuable:                  # Add new component
    base_price: 200
```

**Merge Rules:**
- Child values override parent values
- Maps are deep-merged
- Lists are concatenated (child + parent, deduplicated)

### Room-Specific Fields

```yaml
key: monastery_courtyard
type: room
parent: base_room

exits:
  north: temple_main_hall
  south: monastery_gates

spawns:
  - prototype: young_monk
  - prototype: meditation_cushion

components:
  ambient_actions:
    messages:
      - "Monks move silently..."
    interval_min: 30
    interval_max: 60
```

### NPC Dialogue Trees

```yaml
key: young_monk
type: npc
parent: base_npc

components:
  dialogue_tree:
    start:
      text: "Greetings, traveler..."
      choices:
        - text: "Tell me about the monastery."
          next: "monastery"
        - text: "Goodbye."
          next: null    # End dialogue
    monastery:
      text: "The monastery has stood for centuries..."
```

### Validation

```bash
# Run all validators
mix loka.test.validate

# Run specific validator
mix loka.test.validate --only prototype,quest

# Validators: world, quest, yaml_quest, prototype, dialogue,
#            reachability, cutscene, crafting, storyline, ui,
#            wander, entity_sync, channel
```

---

## 10. Session & Transport Layer

**Key Files:**
- `lib/loka/session.ex` - Public API
- `lib/loka/session/server.ex` - Per-player GenServer
- `lib/loka_web/channels/game_channel.ex` - WebSocket transport

### Session Architecture

```
┌─────────────────┐     ┌─────────────────┐
│ Browser Client  │     │ Mobile Client   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ↓
         ┌───────────────────────┐
         │  Phoenix.Channel      │
         │  (GameChannel)        │
         └───────────┬───────────┘
                     │
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

### Session.Server State

```elixir
%{
  clients: %{monitor_ref => {type, pid, metadata}},
  current_room_id: "room_id",
  combat_state: nil | %{},
  dialogue_state: nil | %{}
}
```

### Multi-Client Support

- Same player can connect from multiple devices
- All clients receive same messages
- 30-second reconnection grace period on disconnect

### Session/EventBus Unification

Sessions subscribe to PubSub topics for automatic event delivery:

```elixir
# In Session.Server.init/1:
EventBus.subscribe("player:#{player_id}")

# Now events broadcast to player:{id} auto-deliver to clients
EventBus.emit(Event.new(:quest_completed, target: player_id, payload: %{...}))
# Client receives this automatically!

# Direct session messaging still works
Session.send_message(session_pid, %{type: :custom, data: data})
```

**When to use which:**
- `EventBus.emit/1` - Game events that should be logged, hooked, broadcast
- `Session.send_message/2` - Direct client messages (UI updates, errors)

### Key Client-to-Server Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `navigate` | `{direction: "north"}` | Movement |
| `click_entity` | `{id, type}` | Entity interaction |
| `action` | `{action: "attack", entity_id}` | Combat |
| `inventory` | `{action: "equip", item_id}` | Inventory |
| `shop` | `{action: "buy", item_key}` | Shopping |
| `dialogue_select` | `{choice_index}` | Dialogue |
| `chat` | `{mode: "say", message}` | Communication |
| `command` | `{input: "look"}` | Text commands |

### Key Server-to-Client Events

| Event | Purpose |
|-------|---------|
| `game_state` | Full state on join |
| `room_update` | Room changed |
| `inventory_update` | Inventory changed |
| `combat_start/update/end` | Combat state |
| `dialogue_start/update/end` | Dialogue state |
| `event` | Text message |
| `timer_completed` | Async timer done |

---

## 11. Timer System

**Key Files:**
- `lib/loka/timers.ex` - Public API
- `lib/loka/timers/server.ex` - GenServer
- `lib/loka/timers/timer.ex` - Ecto schema

### Timer Types

| Type | Purpose |
|------|---------|
| `:crafting` | Item crafting queue |
| `:gathering` | Offline resource gathering |
| `:quest` | Quest-related timers |
| `:cooldown` | Ability/action cooldowns |

### Timer Lifecycle

```
1. Schedule timer
   Loka.Timers.schedule(player_id, :crafting, 30_000, %{recipe: "sword"})
   │
   ↓
2. Store in database (completes_at calculated)
   │
   ↓
3. Process.send_after() scheduled
   │
   ↓
4. Timer fires
   ├─ Player online → deliver immediately
   └─ Player offline → store, deliver on reconnect
   │
   ↓
5. Mark delivered
```

### Timer API

```elixir
# Schedule a timer
{:ok, timer} = Loka.Timers.schedule(player_id, :crafting, 30_000, %{
  recipe_key: "iron_sword",
  outputs: [%{item: "iron_sword", quantity: 1}]
})

# Cancel a timer
:ok = Loka.Timers.cancel(timer_id)

# Get active timers
timers = Loka.Timers.get_active(player_id)

# Get offline completions (on reconnect)
completed = Loka.Timers.get_completed_undelivered(player_id)
```

### Offline Progression

Timers continue while players are offline:
1. Timer stored in database with `completes_at` timestamp
2. Server restarts: loads pending timers, recalculates remaining time
3. Player reconnects: receives all completed timers since last session

---

## 12. Framework Subsystems

**Location:** `lib/loka/framework/`

The Framework layer contains 33 reusable game subsystems built on Engine primitives.

### Subsystem Categories

#### Core Systems
| Subsystem | Purpose |
|-----------|---------|
| **Player** | GameState struct, character data |
| **Inventory** | Item management, equipment, containers |
| **Progression** | XP, leveling, skill points |
| **Combat** | Turn-based PvE/PvP with auto-combat |
| **Quest** | Quest/mission system with objectives |
| **Dialogue** | NPC conversation trees |

#### Character Systems
| Subsystem | Purpose |
|-----------|---------|
| **Abilities** | Special powers and actions |
| **Skills** | LegendMUD-style 100-point skills |
| **Status** | Buffs, debuffs, conditions |
| **Resources** | Health, mana, stamina pools |
| **Appearance** | Clothing and cosmetics |

#### World Systems
| Subsystem | Purpose |
|-----------|---------|
| **World** | Room loading, atmosphere |
| **Economy** | Gold, shops, trading |
| **Faction** | Reputation and allegiance |
| **Hometown** | Starting location |
| **Housing** | Player housing |

#### Crafting Systems
| Subsystem | Purpose |
|-----------|---------|
| **Crafting** | Recipe-based item creation |
| **Gathering** | Resource harvesting |
| **Farming** | Crop growth and harvesting |
| **Magic** | Spell system |

#### Social Systems
| Subsystem | Purpose |
|-----------|---------|
| **Social** | Channels, parties, relationships |
| **Companion** | Pet/follower system with loyalty, hunger, happiness |
| **Messaging** | In-game mail |
| **Broadcast** | Global announcements (system, event, emergency) |
| **Spark** | AI companion with bond progression and hints |

### Player.GameState

Central player data structure:

```elixir
%GameState{
  player_id: integer(),
  character_name: String.t(),
  gender: String.t(),           # "he/him", "she/her", "they/them"
  background: String.t(),       # "scholar", "pilgrim", "soldier", "acolyte"

  inventory: [item_id],         # Items carried
  equipment: %{slot => item},   # Equipped items
  quests: %{quest_id => progress},
  flags: %{flag => value},      # Boolean/value flags

  stats: %{                     # Character attributes
    str: 10, dex: 10, sta: 10,
    level: 1, xp: 0, skill_points: 0
  },

  resources: %{                 # Resource pools
    health: %{current: 100, max: 100},
    mana: %{current: 50, max: 100},
    mv: %{current: 120, max: 150}
  },

  skills: %{skill_name => level},
  settings: %{},
  current_room_id: String.t()
}
```

### Quest System

```yaml
# priv/world/quests/main_sleeping_master.yml
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

  - id: find_journal
    type: get_item
    target_id: meditation_journal
    description: "Find Tenzin's journal"

rewards:
  xp: 100
  items: [cave_entrance_key]
  unlocks: [main_three_trials]
```

**Objective Types:** `go_to`, `talk`, `kill`, `get_item`

### RegistryBase Pattern

Many subsystems use a shared GenServer pattern for YAML-backed registries:

```elixir
use Loka.Framework.RegistryBase,
  table: :skills,
  path: "priv/world/skills",
  item_module: Loka.Framework.Skills.Skill,
  item_name: "skill",
  state_key: :skills
```

---

## 13. Game Actions Coordinator

**Location:** `lib/loka/game/`

### Why This Design?

The Game Actions layer is the **single entry point** for all game logic, regardless of transport. Whether a player connects via WebSocket, LiveView, REST API, or admin CLI, all actions flow through the same code path.

**Design Rationale:**
- Transport-agnostic: Logic works the same for web, mobile, bots
- Testable: Actions can be tested without spinning up channels
- Consistent: Same validation, same events, same side effects
- Auditable: All actions go through one place for logging

### Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  GameChannel│  │  LiveView   │  │  REST API   │  │  Bot/CLI    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
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

### Core Components

| Module | Purpose |
|--------|---------|
| `Game.Actions` | Main entry point, routes to handlers |
| `Game.Actions.Context` | Execution context (player, room, permissions) |
| `Game.Actions.Result` | Structured result with state changes + events |
| `Game.CommandParser` | Parse text input into structured actions |

### Action Handlers

| Handler | Actions |
|---------|---------|
| `Actions.Combat` | `:attack`, `:defend`, `:flee`, `:use_ability` |
| `Actions.Dialogue` | `:start_dialogue`, `:select_choice`, `:end_dialogue` |
| `Actions.Shop` | `:buy`, `:sell`, `:browse` |
| `Actions.Container` | `:open`, `:close`, `:take_from`, `:put_in` |
| `Actions.Gathering` | `:gather`, `:harvest` |
| `Actions.Crafting` | `:craft`, `:queue_craft` |

### Using Game.Actions

```elixir
# Build context from any transport
context = Actions.Context.new(
  player: player_entity,
  game_state: game_state,
  room: current_room,
  session: session_pid  # optional
)

# Execute action
case Actions.execute(:attack, %{target_id: enemy_id}, context) do
  {:ok, result} ->
    # result.state_changes - what changed
    # result.events - events to broadcast
    # result.messages - messages to send to player
    apply_result(result)

  {:error, reason} ->
    send_error(reason)
end
```

### ActionBridge (Channel Integration)

The `ActionBridge` module translates between GameChannel events and Game.Actions:

```elixir
# In GameChannel
def handle_in("action", %{"action" => action, "params" => params}, socket) do
  context = ActionBridge.build_context(socket)

  case ActionBridge.execute(action, params, context) do
    {:ok, result} ->
      ActionBridge.apply_result(result, socket)
      {:noreply, socket}

    {:error, reason} ->
      {:reply, {:error, %{reason: reason}}, socket}
  end
end
```

### Result Structure

```elixir
%Actions.Result{
  success: true,

  # State mutations to apply
  state_changes: [
    {:update_game_state, fn gs -> ... end},
    {:update_entity, entity_id, fn e -> ... end}
  ],

  # Events to broadcast
  events: [
    Event.new(:attack, ...),
    Event.new(:damage, ...)
  ],

  # Direct messages to player
  messages: [
    %{type: :combat, text: "You attack the goblin!"}
  ],

  # Data for client
  data: %{damage_dealt: 25}
}
```

### Trade-offs

| Pros | Cons |
|------|------|
| Single source of truth | Extra abstraction layer |
| Transport-agnostic testing | Learning curve |
| Consistent behavior everywhere | Must build context for each transport |
| Easy to add new transports | |

---

## 14. Game Mechanics Layer

**Location:** `lib/loka/mechanics/` and `lib/loka/primitives/`

### Why This Design?

The Mechanics layer sits between raw Framework subsystems and game logic. It provides **auditable, reproducible calculations** that can be debugged, replayed, and balanced without touching higher-level code.

**Design Rationale:**
- Separating mechanics from framework allows balance tuning without code changes
- Audit trails enable debugging ("why did I only do 5 damage?")
- Pure functions make testing trivial
- Primitives are building blocks; Mechanics compose them

### Primitives (Data Structures)

| Module | Purpose | Key Feature |
|--------|---------|-------------|
| `Primitives.Roll` | Dice notation parsing | `"2d6+3"` → weighted random with audit |
| `Primitives.ResourcePool` | Health/mana/stamina | `%{current: 50, max: 100}` with bounds |
| `Primitives.Value` | Type-safe quantities | Prevents mixing gold with damage |
| `Primitives.Timer` | Ecto timer schema | Database persistence for timers |

**Example: Roll with Audit Trail**
```elixir
{:ok, result, audit} = Roll.roll("2d6+5")
# result = 14
# audit = %{
#   expression: "2d6+5",
#   rolls: [5, 4],
#   modifier: 5,
#   total: 14
# }
```

### Mechanics (Composable Logic)

| Module | Purpose | Returns |
|--------|---------|---------|
| `Mechanics.Check` | Skill checks, opposed rolls | `{:success | :failure, margin, audit}` |
| `Mechanics.Cost` | Resource spending | `{:ok | :insufficient, updated_pool, audit}` |
| `Mechanics.Damage` | Damage calculation | `{:ok, final_damage, audit}` |
| `Mechanics.Heal` | Healing with caps | `{:ok, actual_healed, audit}` |

**Example: Damage Calculation**
```elixir
{:ok, damage, audit} = Mechanics.Damage.calculate(%{
  base_damage: 10,
  attacker_str: 15,
  weapon_damage: 5,
  defender_armor: 8
})
# damage = 22  (10 + 5 + 5 - 8 + modifiers)
# audit = %{
#   base: 10,
#   str_bonus: 5,
#   weapon: 5,
#   armor_reduction: -8,
#   final: 22
# }
```

### Trade-offs

| Pros | Cons |
|------|------|
| Debuggable (audit trails) | Slightly more verbose |
| Testable (pure functions) | Extra layer of abstraction |
| Balance tuning via YAML | Learning curve |
| Reproducible (same inputs = same outputs) | |

---

## 15. NPC Behaviors System

**Location:** `lib/loka/behaviors/`

### Why This Design?

NPCs need to act autonomously without hardcoding each behavior. The Behaviors system lets you assign AI behaviors via YAML, making NPCs configurable by content designers, not programmers.

**Design Rationale:**
- Behaviors are event-driven (respond to hooks)
- Multiple behaviors can compose (wander + guard + scavenger)
- Configuration via entity attributes, not code
- New behaviors can be added without touching existing ones

### Built-in Behaviors (8)

| Behavior | Trigger | Action |
|----------|---------|--------|
| `Aggressive` | Player enters room | Attack on sight |
| `Guard` | Threat enters zone | Protect area, attack threats |
| `Patrol` | Timer tick | Walk predefined room sequence |
| `Wander` | Timer tick | Random movement to adjacent rooms |
| `Janitor` | Item dropped | Pick up items on floor |
| `Scavenger` | Specific item appears | Collect specific item types |
| `Runner` | Combat damage | Flee when health low |
| `Follower` | Player moves | Follow designated player |

### Behavior Configuration (YAML)

```yaml
key: temple_guard
type: npc
parent: base_npc

behaviors:
  - Loka.Behaviors.Guard
  - Loka.Behaviors.Aggressive

attributes:
  behavior_config:
    guard:
      protected_room: "temple_inner"
      attack_on_intrusion: true
    aggressive:
      aggro_range: 1        # Rooms away
      attack_delay_ms: 2000
```

### Behavior Protocol

```elixir
@callback handle_event(event, entity, config) ::
  {:ok, [Event.t()]} | :ignore

@callback tick(entity, config) ::
  {:ok, [Event.t()]} | :noop
```

### Creating Custom Behaviors

```elixir
defmodule MyGame.Behaviors.Merchant do
  use Loka.Behaviors.Base

  def handle_event(%{type: :player_enter} = event, entity, config) do
    if should_greet?(config) do
      {:ok, [Event.new(:say,
        source: entity.id,
        payload: %{message: "Welcome to my shop!"})]}
    else
      :ignore
    end
  end

  def tick(_entity, _config), do: :noop
end
```

### Trade-offs

| Pros | Cons |
|------|------|
| Designer-configurable NPCs | Limited to predefined behaviors |
| Composable (stack behaviors) | Complex interactions can conflict |
| Event-driven (efficient) | Debugging behavior chains |
| Testable in isolation | |

---

## 16. Zone & World Systems

**Location:** `lib/loka/engine/` (zones) and `lib/loka/framework/world/`

### Why This Design?

Game worlds need organization beyond individual rooms. Zones group rooms for respawning, access control, and thematic consistency. World systems add atmosphere through weather, day/night cycles, and ambient actions.

**Design Rationale:**
- Zones enable batch operations (reset all enemies, lock area)
- Weather/atmosphere add immersion without per-room scripting
- Ambient systems run independently, reducing entity complexity
- WorldGraph enables pathfinding and connectivity analysis

### Zone System

| Module | Purpose |
|--------|---------|
| `Engine.Zone` | Zone data structure |
| `Engine.ZoneLoader` | Load zones from YAML |
| `Engine.ZoneRegistry` | Track all zones |
| `Engine.ZoneReset` | Periodic respawning |

**Zone Definition (YAML):**
```yaml
# priv/world/zones/monastery.yml
key: monastery_zone
name: "Ancient Monastery"
rooms:
  - monastery_gate
  - monastery_courtyard
  - temple_main_hall
  - meditation_garden

respawn:
  enabled: true
  interval_minutes: 30
  entities:
    - prototype: young_monk
      rooms: [monastery_courtyard, meditation_garden]
      max_count: 3
```

**Zone Operations:**
```elixir
# Get all rooms in zone
rooms = ZoneRegistry.get_rooms("monastery_zone")

# Reset zone (respawn all entities)
ZoneReset.reset_zone("monastery_zone")

# Check if room is in zone
ZoneRegistry.room_in_zone?("monastery_courtyard", "monastery_zone")
```

### World Graph

The WorldGraph provides room connectivity analysis:

```elixir
# Get connected rooms
exits = WorldGraph.get_exits("monastery_courtyard")
# => %{"north" => "temple_main_hall", "south" => "monastery_gate"}

# Find path between rooms (BFS)
{:ok, path} = WorldGraph.find_path("monastery_gate", "meditation_garden")
# => ["monastery_gate", "monastery_courtyard", "meditation_garden"]

# Check reachability
WorldGraph.reachable?("monastery_gate", "secret_cave")
# => false
```

### Atmosphere Systems

| System | Purpose | Configuration |
|--------|---------|---------------|
| `World.DayNight` | Time-of-day cycle | 24 real minutes = 1 game day |
| `World.Weather` | Dynamic weather | Per-zone weather patterns |
| `World.RoomAmbient` | Room ambient messages | Random atmospheric text |
| `World.NpcAmbient` | NPC idle actions | NPCs perform random actions |

**Day/Night Cycle:**
```elixir
# Get current time
DayNight.current_time()  # => :dusk

# Time affects visibility, NPC schedules, shop hours
# Times: :dawn, :morning, :noon, :afternoon, :dusk, :evening, :night, :midnight
```

**Weather System:**
```elixir
# Current weather in zone
Weather.current("monastery_zone")  # => :light_rain

# Weather affects: movement speed, combat, gathering success
# Types: :clear, :cloudy, :light_rain, :heavy_rain, :storm, :fog, :snow
```

**Room Ambient (YAML):**
```yaml
components:
  ambient_actions:
    messages:
      - "Prayer flags flutter in the mountain breeze."
      - "A distant bell echoes through the valley."
      - "Incense smoke curls upward from a nearby brazier."
    interval_min: 45
    interval_max: 90
```

**NPC Ambient:**
```yaml
# NPCs can perform idle actions
components:
  ambient_actions:
    actions:
      - type: emote
        message: "adjusts their robes"
      - type: say
        message: "Such a peaceful day..."
    interval_min: 60
    interval_max: 180
```

### WorldLoader

Loads the entire world from YAML at startup:

```elixir
# In application.ex (post-supervisor)
WorldLoader.spawn_world()

# Creates room entities from prototypes
# Establishes exits between rooms
# Spawns initial NPCs and items
```

### Trade-offs

| Pros | Cons |
|------|------|
| Organized world structure | Zone boundaries are rigid |
| Automatic respawning | Respawn timing affects balance |
| Immersive atmosphere | Ambient spam if misconfigured |
| Pathfinding built-in | Large worlds = memory for graph |

---

## 17. Elixir Scripting

**Key Files:**
- `lib/loka/engine/script/sandbox.ex` - Sandboxed execution
- `lib/loka/engine/script/executor.ex` - Script runner
- `lib/loka/engine/script/bindings.ex` - API bindings
- `lib/loka/framework/scripting/hook_integration.ex` - Hook integration

### Sandbox Security

**Blocked Patterns:** `System.`, `File.`, `IO.`, `Process.`, `Node.`, `Code.`, `Application.`, `Port.`, `Module.`, `:erlang.`, pipe operator (`|>`)

**Runtime Protections:**
- Configurable timeout (default 100ms, max 5s)
- 10KB result size limit
- 50KB script size limit
- Pattern validation before execution
- Restricted to safe Kernel and Enum functions

### Available API Functions

```elixir
# Context (read-only bindings)
entity           # Current entity map
player           # Player entity map
context          # Execution context

# Query Functions (capture-style closures)
quest_active?.("quest_id")
quest_completed?.("quest_id")
has_item?.("item_key")
has_flag?.("flag_name")
get_stat.("stat_name")

# Action Functions (queued, not immediate)
say.("Hello!")                    # Entity speaks
message.("Private message")       # Send to player
set_flag.("flag_name", true)      # Set player flag
give_item.("item_key")            # Give item to player
spawn_npc.("prototype_key")       # Spawn NPC

# World Manipulation
set_room_attr.("key", "value")    # Modify room
damage.(entity_id, amount)        # Deal damage
start_combat.(target_id)          # Initiate combat
```

### Script Hook Mapping

| Engine Hook | Script Hook | Mode | Return Values |
|-------------|-------------|------|---------------|
| `:at_before_look` | `:on_look` | validate | `:append`, `:replace`, `:default` |
| `:at_enter_room` | `:on_enter` | fire_and_forget | `:deny` to block |
| `:at_leave_room` | `:on_leave` | fire_and_forget | - |
| `:at_before_say` | `:on_say` | validate | `:respond` for auto-reply |
| `:at_before_move` | `:on_move` | validate | `:deny` to block |
| `:at_before_attack` | `:on_attack` | validate | `:deny` to block |

### Example Scripts

```elixir
# Quest-based look modification
if quest_active?.("main_sleeping_master") do
  {:append, "The elder watches you with knowing eyes."}
else
  :default
end
```

```elixir
# Conditional entry blocking
if has_flag?.("temple_banned") do
  say.("You are not welcome here!")
  {:deny, "The guards block your path."}
else
  :allow
end
```

### Script Storage

Scripts are stored as TypedObjects with type `:script`:

```yaml
# priv/world/scripts/elder_on_look.yml
key: elder_on_look
type: script
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

---

## 18. Database & Persistence

**Key Files:**
- `lib/loka/repo.ex` - Ecto repository
- `lib/loka/engine/schema/*.ex` - Schema definitions

### Database Schema (7 Tables)

| Table | Purpose | Primary Key |
|-------|---------|-------------|
| `players` | User accounts | integer |
| `players_tokens` | Session/email tokens | integer |
| `player_game_states` | Game data per player | UUID |
| `entities` | Game objects | UUID |
| `entity_attributes` | EAV pattern storage | integer |
| `scripts` | Elixir scripts | integer |
| `timers` | Persistent timers | UUID |

### Entity Schema Fields

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
  field :components, Loka.Ecto.Json
  field :behaviors, Loka.Ecto.Json
  field :tags, {:array, :string}
  field :locks, Loka.Ecto.Json
  field :scripts, Loka.Ecto.Json
  field :metadata, Loka.Ecto.Json

  has_many :attributes, EntityAttribute
  has_many :contents, __MODULE__, foreign_key: :location_id
end
```

### JSON Storage Strategy

Complex game data stored as JSON text via `Loka.Ecto.Json` custom type:
- Queryable in SQLite
- Human-readable
- Flexible schema
- **Note:** Map keys become strings on load (`map["key"]` not `map[:key]`)

### Entity-Attribute-Value Pattern

For unlimited custom attributes without schema changes:

```elixir
# Store any value type
Entities.set_attribute(entity_id, "custom_data", %{value: 42}, "my_category")
Entities.get_attribute(entity_id, "custom_data")
```

---

## 19. Authentication System

**Key Files:**
- `lib/loka/accounts/` - Account management
- `lib/loka/auth/guardian.ex` - JWT
- `lib/loka_web/player_auth.ex` - Session management

### Auth Methods

| Method | Use Case | Token Type |
|--------|----------|------------|
| **Magic Link** | Primary web auth | Session token (14 days) |
| **Email/Password** | Traditional auth | Session token |
| **JWT** | Mobile/API | Access (1hr) + Refresh (7d) |
| **Guest** | Anonymous play | JWT (device_id based) |

### Magic Link Flow

```
1. POST /players/log-in {email}
2. Email with magic link sent
3. GET /players/log-in/:token
4. Token verified (15 min validity)
5. Session created, cookies set
6. Redirect to game
```

### JWT API Flow

```
1. POST /api/v1/auth/login {email, password}
2. Returns {token, expires_at, player}
3. All API calls: Authorization: Bearer <token>
4. POST /api/v1/auth/refresh when expired
```

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Registration | 3/hour per IP |
| Login | 5/minute per IP |

---

## 20. Web Layer & Middleware

**Location:** `lib/loka_web/`

### Why This Design?

The web layer handles multiple client types (browser, mobile, API) while maintaining security and performance. Custom plugs provide rate limiting, CORS, and metrics authentication without cluttering controller code.

### Plug Middleware Stack

| Plug | Purpose | Configuration |
|------|---------|---------------|
| `RateLimiter` | Prevent abuse | ETS-based, IP tracking |
| `AuthPipeline` | JWT verification for API | Guardian integration |
| `RequireAdmin` | Admin role enforcement | Redirect on failure |
| `MetricsAuth` | Protect /metrics endpoint | Token + IP allowlist |
| `CORS` | Cross-origin requests | Development permissive |

**RateLimiter Implementation:**
```elixir
# Rate limits per endpoint
:auth_endpoints   -> 5 requests/minute
:register_endpoint -> 3 requests/hour

# Uses ETS for fast lookups
# Tracks by IP (supports X-Forwarded-For)
# Auto-cleanup every 5 minutes
```

**Custom Plug Example:**
```elixir
defmodule LokaWeb.Plugs.RateLimiter do
  def call(conn, opts) do
    ip = get_client_ip(conn)
    key = {ip, opts[:bucket]}

    case check_rate(key, opts[:limit], opts[:window]) do
      :ok -> conn
      :rate_limited ->
        conn
        |> put_status(429)
        |> json(%{error: "Rate limit exceeded"})
        |> halt()
    end
  end
end
```

### Route Structure

| Path | Auth | Purpose |
|------|------|---------|
| `/` | No | Home (redirects to login) |
| `/players/register` | No | Registration |
| `/players/log-in` | No | Login |
| `/character/create` | Yes | Character creation |
| `/admin` | Admin | Admin dashboard |
| `/api/v1/auth/*` | Varies | REST API |
| `/socket` | JWT | WebSocket |

### WebSocket Channel

```javascript
// Client connection
let socket = new Socket("/socket", {params: {token: jwt}})
socket.connect()

let channel = socket.channel("game:lobby", {client_version: "1.0.0"})
channel.join()
  .receive("ok", resp => console.log("Joined!", resp))

// Send events
channel.push("navigate", {direction: "north"})

// Receive events
channel.on("game_state", payload => updateUI(payload))
channel.on("event", payload => showMessage(payload.text))
```

### Version Compatibility

Channel join validates client version:
- Current: 1.0.0
- Minimum: 1.0.0
- Features negotiated per version

---

## 21. Channel Protocol & Validation

**Location:** `lib/loka_web/channels/`

### Why This Design?

The WebSocket protocol is the primary real-time communication layer. Schema validation ensures client-server contract compliance, version negotiation handles API evolution, and structured serializers maintain consistency.

### Version Compatibility

```elixir
# On channel join, versions are negotiated
def join("game:lobby", %{"client_version" => version}, socket) do
  case VersionCompatibility.check(version) do
    {:ok, features} ->
      {:ok, %{features: features}, socket}

    {:error, :update_required} ->
      {:error, %{reason: "update_required", min_version: "1.0.0"}}
  end
end
```

**Version Features (1.0.0 baseline):**
- 14 core features negotiated
- Major version mismatch = rejection
- Minor version = graceful degradation

### Channel Schema Validation

Events are validated against JSON Schema at compile time:

```elixir
# priv/schemas/channel_events.json defines:
# - Event names
# - Required/optional payload fields
# - Field types

# ChannelSchema module loads schemas at compile time
defmodule LokaWeb.Channels.ChannelSchema do
  @events File.read!("priv/schemas/channel_events.json") |> Jason.decode!()

  def validate(event, payload) do
    case JsonSchema.validate(@events[event], payload) do
      :ok -> :ok
      {:error, errors} -> {:error, format_errors(errors)}
    end
  end
end
```

**Validated Events (30+):**
```
navigate, action, combat_action, dialogue_select, shop_action,
inventory, chat, emote, gather, craft, use_ability, text_command...
```

### Serializers

Consistent data transformation for client consumption:

| Serializer | Purpose |
|------------|---------|
| `Serializers.GameState` | Full player state on join |
| `Serializers.Room` | Room with occupants, exits |
| `Serializers.Combat` | Combat state, turns, actions |
| `Serializers.Dialogue` | Dialogue tree, current node |
| `Serializers.Shop` | Shop inventory, prices |
| `Serializers.Inventory` | Player inventory, equipment |

**Serializer Example:**
```elixir
defmodule Serializers.Room do
  def serialize(room, player) do
    %{
      id: room.id,
      key: room.key,
      name: room.short_desc,
      description: room.long_desc,
      exits: serialize_exits(room),
      occupants: serialize_occupants(room, player),
      items: serialize_items(room)
    }
  end
end
```

### TypeScript Generation

Keep mobile app types in sync:

```bash
# Generate TypeScript from channel schema
mix loka.generate.channel_types --output ../mobile/src/types/channel.ts
```

**Generated Types:**
```typescript
export type ChannelEvent = "navigate" | "action" | "combat_action" | ...;

export interface NavigatePayload {
  direction: Direction;
}

export interface ActionPayload {
  action: string;
  target_id?: string;
}
```

---

## 22. Analytics & Observability

**Location:** `lib/loka/` (posthog.ex, prom_ex/)

### Why This Design?

Production games need visibility into player behavior and system health. Loka integrates PostHog for product analytics and Prometheus for operational metrics, with circuit breakers to prevent cascading failures.

### PostHog Analytics

**Purpose:** Track player behavior, feature usage, conversion funnels.

```elixir
# Track events
Posthog.capture(player_id, "quest_completed", %{
  quest_id: "main_sleeping_master",
  time_to_complete_minutes: 45
})

# Identify users
Posthog.identify(player_id, %{
  level: 10,
  background: "scholar",
  created_at: ~U[2025-01-01 00:00:00Z]
})
```

**Circuit Breaker:**
- Opens after 5 failures in 60 seconds
- Prevents analytics from affecting gameplay
- Auto-recovers after cooldown

**Configuration:**
```elixir
# config/runtime.exs
config :loka, :posthog,
  api_key: System.get_env("POSTHOG_API_KEY"),
  api_url: "https://us.i.posthog.com"
```

### Prometheus Metrics (PromEx)

**Purpose:** System health, performance monitoring, alerting.

**Game-Specific Metrics:**
```elixir
# Custom metrics plugin
defmodule Loka.PromEx.GamePlugin do
  def metrics do
    [
      counter("loka.players.active", description: "Active player count"),
      counter("loka.commands.executed", tags: [:command]),
      histogram("loka.combat.duration_seconds"),
      gauge("loka.entities.count", tags: [:type]),
      counter("loka.logins.total"),
      counter("loka.rate_limits.triggered")
    ]
  end
end
```

**Built-in Metrics:**
- Phoenix HTTP request duration, status codes
- WebSocket connection count, message rates
- LiveView mount/handle_event timing
- Database query duration, pool utilization
- VM memory, process count, scheduler utilization

**Endpoint:**
```
GET /metrics
Authorization: Bearer <METRICS_AUTH_TOKEN>
```

**Protected by:**
- Bearer token authentication
- IP allowlist (default: localhost only)

### Admin GameLog

**Purpose:** Debug player sessions, replay events.

```elixir
# All game events logged to ETS
GameLog.log(:quest, player_id, %{
  action: :accept,
  quest_id: "main_sleeping_master"
})

# Query recent events
GameLog.get_events(player_id, type: :combat, limit: 50)

# Events auto-prune after 24 hours
```

**Event Categories:**
- `:quest` - Quest accept/complete/fail
- `:combat` - Attacks, damage, deaths
- `:social` - Messages, parties
- `:exploration` - Room visits
- `:economy` - Purchases, sales

### Trade-offs

| Pros | Cons |
|------|------|
| Product insights (PostHog) | External service dependency |
| Operational visibility (Prometheus) | Metric cardinality management |
| Debug player issues (GameLog) | ETS memory for logs |
| Circuit breakers protect gameplay | Analytics may be delayed/dropped |

---

## 23. Admin Dashboard

**Location:** `lib/loka_web/live/admin_live/`

Access at `/admin` (requires admin role).

### Dashboard Tabs (10)

| Tab | Features |
|-----|----------|
| **Dashboard** | System stats, quick links |
| **Players** | List, admin toggle, delete |
| **Rooms** | Create, edit, connect exits |
| **Entities** | NPC/item CRUD |
| **Prototypes** | Browse, spawn, filter |
| **Quests** | Debug player quest state |
| **Scripts** | Elixir editor, test execution |
| **Testing** | Run validators, combat simulator |
| **System** | Server info, export world |
| **World Designer** | Visual map editor |

### Validation Tools

```bash
# Run from Testing tab or command line:
mix loka.test.validate

# Validators:
# - World connectivity
# - Quest completability
# - Prototype syntax
# - Dialogue trees
# - Reachability analysis
# - Combat balance simulation
```

---

## 24. Testing Framework

**Location:** `lib/loka/testing/` and `test/`

### Why This Design?

A MUD has complex interdependencies: quests reference NPCs, dialogues unlock areas, items spawn in specific rooms. Manual testing is impractical. Loka's testing framework **validates content at build time** and **simulates gameplay automatically**.

**Design Rationale:**
- Content validation catches broken references before players see them
- Bot testing simulates real gameplay without manual QA
- Balance testing uses Monte Carlo simulation for statistical confidence
- All testing runs headlessly in CI/CD pipelines

### Testing Layers

```
┌────────────────────────────────────────────┐
│ Balance Testing (Monte Carlo Simulations)  │
├────────────────────────────────────────────┤
│ Integration Testing (Bot Playthroughs)     │
├────────────────────────────────────────────┤
│ Content Validation (YAML Integrity)        │
├────────────────────────────────────────────┤
│ Unit Testing (ExUnit)                      │
└────────────────────────────────────────────┘
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
| `UIValidator` | UI element consistency |
| `WanderValidator` | NPC wander paths valid |
| `EntitySyncValidator` | Prototypes match database entities |
| `ChannelSchemaValidator` | WebSocket events match schema |

### Bot Testing Framework

**Why Bots?** Bots play the game automatically to verify quest completability and catch regressions.

```elixir
# Start a bot that follows a storyline
{:ok, pid} = BotSupervisor.spawn_bot(
  strategy: StorylineRunner,
  strategy_opts: [storyline_id: "monastery_arc"]
)

# Assertions automatically verified
assert Bot.get_assertions(pid).all_passed?
```

**Bot Strategies:**
- `RandomWalker` - Explores randomly (stress testing)
- `StorylineRunner` - Completes quests in order (regression testing)
- Custom strategies via `Strategy` behavior

### Balance Simulators

| Simulator | Purpose |
|-----------|---------|
| `CombatSimulator` | Monte Carlo combat (win rates, damage distribution) |
| `ProgressionSimulator` | XP curve analysis (time-to-level) |

**Example: Combat Balance Check**
```elixir
results = CombatSimulator.simulate(
  player: %{health: 100, attack: 50, defense: 20, level: 5},
  enemy: %{health: 80, attack: 40, defense: 15, level: 4},
  iterations: 1000
)

assert results.win_rate > 0.55  # Player should win 55%+
assert results.avg_turns < 10   # Combat shouldn't drag
```

### Test Fixtures

| Fixture | Creates |
|---------|---------|
| `AccountsFixtures` | Players, tokens, sessions |
| `EngineFixtures` | Entities, rooms, NPCs, items |
| `PluginFixtures` | Test plugins (minimal, full, cyclic deps) |

### Running Tests

```bash
mix test                        # Unit tests
mix loka.test                   # All tests (unit + validate + balance)
mix loka.test.validate          # Content validation only
mix loka.test.validate --only quest  # Specific validator
mix loka.test.balance           # Balance simulations
mix loka.test.storyline monastery_arc --run  # Bot playthrough
```

### Trade-offs

| Pros | Cons |
|------|------|
| Catches content errors at build time | Initial setup overhead |
| Automated regression testing | Bots can't test UX |
| Statistical balance analysis | Monte Carlo takes time |
| CI/CD integration | Need content to validate |

---

## 25. Mix Tasks & CLI

**Location:** `lib/mix/tasks/`

Loka provides 11 custom Mix tasks for development, testing, and content management.

### Content Generation

```bash
# Generate scaffolded content
mix loka.new quest rescue_villagers --giver=elder_npc --type=main
mix loka.new npc village_elder --type=friendly
mix loka.new room village_square --connects=north:town_gate
mix loka.new storyline village_arc

# Options: --force to overwrite
```

### Testing & Validation

```bash
# Master test runner (unit + validate + storyline + balance)
mix loka.test
mix loka.test --quick           # Skip balance simulations
mix loka.test --only unit,validate
mix loka.test --strict          # Fail on warnings

# Content validation
mix loka.test.validate
mix loka.test.validate --only world,quest,dialogue
mix loka.test.validate --skip crafting

# Quest testing
mix loka.test.quest                    # All quests
mix loka.test.quest find_treasure      # Specific quest
mix loka.test.quest --storyline monastery_arc
mix loka.test.quest --walkthrough find_treasure  # Generate guide

# Balance analysis
mix loka.test.balance --iterations 5000
mix loka.test.balance --output report.md
mix loka.test.balance --format json --output data.json

# Storyline validation
mix loka.test.storyline monastery_arc --run --verbose
```

### Development

```bash
# Start Phoenix + Expo servers together
mix loka.dev

# Start only Phoenix
mix loka.dev --server

# Start only Expo (mobile)
mix loka.dev --mobile
```

### Administration

```bash
# Grant admin to all players
mix loka.admin.grant_all

# Sync prototype descriptions to entities
mix loka.sync_descriptions
mix loka.sync_descriptions --dry-run
```

### Code Generation

```bash
# Export E2E test data (for Playwright)
mix loka.export_test_data
# Outputs: world-graph.json, quests.json, npcs.json, items.json

# Generate TypeScript types from channel schema
mix loka.generate.channel_types
mix loka.generate.channel_types --output ../mobile/src/types/channel.ts
```

### Task Workflow Examples

**Pre-commit validation:**
```bash
mix loka.test --strict
```

**Content iteration:**
```bash
mix loka.new quest my_quest
# Edit priv/world/quests/my_quest.yml
mix loka.test.validate --only quest
mix loka.test.quest my_quest --walkthrough
```

**Balance tuning:**
```bash
# Edit priv/config/balance.yml
mix loka.test.balance --iterations 10000 --output report.md
# Review report.md, adjust values, repeat
```

---

## 26. Creating New Plugins

**Key File:** `lib/loka/engine/plugin.ex`

### Plugin Behavior

```elixir
@callback name() :: String.t()
@callback version() :: String.t()
@callback init(opts :: keyword()) :: {:ok, state :: term()} | {:error, term()}
@callback commands() :: [module()]
@callback hooks() :: [{hook_type(), module(), function_name(), opts()}]
@callback validators() :: [module()]
@callback scripts() :: [%{name: String.t(), source: String.t(), hook: String.t()}]
```

### Example Plugin: Guilds

```elixir
# lib/loka/plugins/guilds/plugin.ex
defmodule Loka.Plugins.Guilds.Plugin do
  use Loka.Engine.Plugin

  def name, do: "Guilds"
  def version, do: "1.0.0"

  def commands, do: [Loka.Plugins.Guilds.Commands.GuildCommand]

  def hooks, do: [
    {:at_entity_creation, Loka.Plugins.Guilds.Hooks.GuildHooks, :on_create, priority: 50}
  ]

  def validators, do: [Loka.Plugins.Guilds.Validators.GuildValidator]
end
```

### Plugin Structure

```
lib/loka/plugins/guilds/
├── plugin.ex           # Entry point
├── guilds.ex           # Core logic
├── guild_registry.ex   # Registry
├── commands/
│   └── guild_command.ex
├── hooks/
│   └── guild_hooks.ex
└── validators/
    └── guild_validator.ex
```

### Creating a New Command

```elixir
defmodule MyPlugin.Commands.MyCommand do
  use Loka.Engine.Command

  def key, do: "mycommand"
  def aliases, do: ["mc"]
  def help, do: "Description of my command."

  def parse(args, context), do: {:ok, %{input: args}}

  def execute(%{input: input}, context) do
    # Your logic here
    {:ok, [%{type: :message, text: "Result: #{input}"}]}
  end
end
```

### Creating a New Hook Handler

```elixir
defmodule MyPlugin.Hooks.MyHooks do
  def on_room_entry(player_context, room_info) do
    # Custom logic on room entry
    Logger.info("Player entered room!")
    :ok
  end
end

# Register in plugin.ex:
def hooks, do: [
  {:at_enter_room, MyPlugin.Hooks.MyHooks, :on_room_entry, priority: 60}
]
```

---

## 27. World Builder System

**Location:** `lib/loka/world_builder/`

The World Builder is a comprehensive UI-driven content creation system (~7,600 LOC) that allows non-technical builders to create and edit game content through the admin dashboard.

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│ World Builder UI (lib/loka_web/live/admin_live/)            │
├─────────────────────────────────────────────────────────────┤
│ Manager Classes (EntityManager, RoomManager, etc.)          │
├─────────────────────────────────────────────────────────────┤
│ Content Modules (Content.Quest, Content.Dialogue, etc.)     │
├─────────────────────────────────────────────────────────────┤
│ TypedObject.Loader + PrototypeLoader                        │
├─────────────────────────────────────────────────────────────┤
│ YAML Files (priv/world/prototypes/, quests/, etc.)          │
└─────────────────────────────────────────────────────────────┘
```

### Core Managers

| Manager | Purpose | Key Methods |
|---------|---------|-------------|
| **EntityManager** | Generic CRUD for NPCs, items, etc. | `create_entity/2`, `update_entity/2`, `list_entities/1` |
| **RoomManager** | Room CRUD with exits and coordinates | `create_room/1`, `add_exit/3`, `update_exits/2` |
| **QuestManager** | Quest definition management | `create_quest/1`, `update_quest/2`, `delete_quest/1` |
| **ScriptManager** | Script YAML management | `create_script/1`, `list_scripts/0` |
| **TemplateManager** | Room template system | `save_as_template/3`, `create_from_template/2` |
| **CutsceneManager** | Timeline-based cutscenes | `create_cutscene/1`, `update_cutscene/2` |

### EntityManager Details

`EntityManager` is the unified CRUD layer for all entity types in the World Builder:

```elixir
# Create an NPC with dialogue
EntityManager.create_entity(:npc, %{
  key: "village_elder",
  name: "Elder Dawa",
  description: "A wise elder",
  components: %{
    "dialogue_tree" => %{
      "start" => %{
        "text" => "Greetings, traveler!",
        "choices" => [
          %{"text" => "Hello", "next" => nil}
        ]
      }
    }
  }
})

# Update entity
EntityManager.update_entity("village_elder", %{
  components: %{dialogue_tree: updated_tree}
})

# List all NPCs
npcs = EntityManager.list_entities(:npc)
```

**Key Features:**
- Merges default components with user-provided components
- Reloads both `PrototypeLoader` and `TypedObject.Loader` on save
- Serializes nested maps (including dialogue trees) to proper YAML format
- Validates safe key names (no path traversal)

### YAML Serialization

The EntityManager handles complex nested structures like dialogue trees:

```yaml
# Generated YAML for NPC with dialogue
key: village_elder
type: npc
parent: base_npc
components:
  dialogue_tree:
    start:
      text: "Greetings, traveler!"
      choices:
        - next: "more_info"
          text: "Tell me more"
        - next: null
          text: "Goodbye"
```

### Supporting Systems

| Module | Purpose |
|--------|---------|
| `BatchOperations` | Cross-cutting operations for multiple entities |
| `GitManager` | Git integration for version control |
| `ValidationManager` | Content integrity checking |
| `ToolExecutor` | Executes World Builder tools |
| `LayoutManager` | Room layout and coordinate management |
| `CoordinateUtils` | Spatial math helpers |

### Usage Guidelines

**DO:**
- Use `EntityManager` for simple entity CRUD (NPCs, items)
- Use specialized managers for complex needs (RoomManager for exits)
- Use Content modules when game logic needs entity data

**DON'T:**
- Create redundant managers like `NPCManager` (use EntityManager)
- Put UI-specific code in Content modules
- Duplicate CRUD logic across managers

---

## 28. Spark Companion System

**Location:** `lib/loka/framework/spark/`

Spark is a player-bonded AI companion that provides hints, tracks world events, and grows alongside the player.

### Core Components

| Module | Purpose |
|--------|---------|
| `Spark` | Main API for lifecycle and interactions |
| `SparkState` | Ecto schema for persistent state |
| `SparkEvent` | Ecto schema for "while you were away" events |

### Database Schema

**spark_states table:**
```elixir
%SparkState{
  player_id: integer,
  personality_traits: ["curious", "warm"],  # Exactly 2 traits
  bond_level: "stranger",                   # stranger→acquaintance→companion→friend→bonded
  bond_points: 0,                           # Numeric accumulation
  awakening_stage: "dormant",               # dormant→stirring→aware→awakened
  visual_form: "mote",                      # mote, flame, geometric, aurora, constellation
  unlocked_forms: ["mote"],
  unlocked_memories: [],
  name: nil,                                # Revealed at "friend" level
  verbosity: "normal"                       # quiet, normal, verbose
}
```

**spark_events table:**
```elixir
%SparkEvent{
  player_id: integer,
  event_type: "quest_update",               # 8 types available
  event_key: "main_sleeping_master",
  summary: "You completed the quest!",
  details: %{},                             # Flexible JSON
  delivered: false
}
```

### Event Types

| Type | Purpose |
|------|---------|
| `time_event` | Time-of-day changes |
| `weather_event` | Weather changes |
| `npc_activity` | NPC status changes |
| `quest_update` | Quest progress |
| `zone_event` | Zone-level events |
| `world_event` | Global events |
| `message` | Direct messages |
| `achievement` | Achievement unlocks |

### Bond Progression

| Level | Points | Unlocks |
|-------|--------|---------|
| Stranger | 0 | Basic hints |
| Acquaintance | 25 | More dialogue |
| Companion | 75 | Visual forms |
| Friend | 150 | Name revealed |
| Bonded | 300 | Full awakening |

**Bond Point Sources:**
- Daily login: +1
- Quest completion: +2-5
- Visiting awakening sites: +3
- Asking questions: +1
- Compassionate choices: +2
- Story milestones: +10

### API Usage

```elixir
# Create Spark during character creation
Spark.create_for_player(player_id, ["curious", "warm"])

# Add bond points
Spark.add_bond_points(player_id, 5)

# Record world event
Spark.record_event(player_id, :quest_update, %{
  quest_id: "main_sleeping_master",
  summary: "Quest completed!"
})

# Get pending updates (for "while you were away")
{:ok, updates} = Spark.get_pending_updates(player_id)
```

### Mobile Integration

Spark appears in the MenuPanel with:
- Bond progress visualization
- Awakening stage display
- Personality trait badges
- Pending updates viewer
- Question input field

### Game Channel Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `spark:ask_question` | Client→Server | Ask Spark a question |
| `spark_status` | Server→Client | Spark state update |
| `spark_updates` | Server→Client | Pending update list |
| `spark_has_updates` | Server→Client | Update count notification |

---

## 29. Mobile App Architecture

**Location:** `mobile/`

A full-stack React Native app with TypeScript, running on Expo for web, iOS, and Android.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.81.5 + Expo 54 |
| Navigation | Expo Router 6.0.21 (file-based) |
| State | React Context + hooks |
| Styling | React Native StyleSheet |
| WebSocket | Phoenix client library |
| Testing | Playwright + Maestro |

### Directory Structure

```
mobile/
├── app/                           # Expo Router pages
│   ├── _layout.tsx               # Navigation root
│   ├── index.tsx                 # Login/auth
│   └── game.tsx                  # Main game screen
├── src/
│   ├── components/               # 28 UI components
│   │   ├── RoomView.tsx          # Game display
│   │   ├── BottomBar.tsx         # Action menu
│   │   ├── MenuPanel.tsx         # Main menu (includes Spark)
│   │   ├── CombatOverlay.tsx     # Combat UI
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.ts            # Auth management
│   │   └── usePhoenix.ts         # WebSocket connection
│   ├── types/                    # TypeScript interfaces
│   ├── audio/                    # Sound effects
│   └── theme.ts                  # Design system
└── e2e/                          # E2E tests
```

### Key Components

| Component | Purpose | Size |
|-----------|---------|------|
| `game.tsx` | Main game orchestration | 22KB |
| `MenuPanel.tsx` | Navigation hub (quests, inventory, Spark) | 32KB |
| `RoomView.tsx` | Location display | ~8KB |
| `BottomBar.tsx` | Action shortcuts | 8KB |
| `usePhoenix.ts` | WebSocket management | ~12KB |

### WebSocket Connection

The `usePhoenix` hook manages real-time communication:

```typescript
const {
  connected,
  gameState,
  events,
  dialogueState,
  combatState,
  sparkUpdates,
  navigate,
  say,
  clickEntity,
  performAction,
  sparkAsk,
  sparkGetUpdates,
} = usePhoenix({ token, onDisconnect });
```

**Channel Events:**
- Outgoing: `move`, `talk`, `dialogue_choice`, `action`, `spark:ask_question`
- Incoming: `room_update`, `game_state`, `combat_start`, `dialogue_start`, `spark_status`

### TypeScript Game Types

```typescript
// src/types/game.ts
interface GameState {
  room: Room;
  player: Player;
  inventory: InventoryItem[];
  quests: Quest[];
  health: { current: number; max: number };
  spark?: SparkState;
  combat?: CombatState;
  // ...
}

interface SparkState {
  bond_level: SparkBondLevel;
  bond_progress: number;
  awakening_stage: SparkAwakeningStage;
  personality_traits: SparkTrait[];
  visual_form: SparkVisualForm;
  name: string | null;
  pending_updates: number;
}
```

### Server Connection

The app auto-detects the appropriate server URL:

| Platform | URL |
|----------|-----|
| iOS Simulator | `localhost:4000` |
| Android Emulator | `10.0.2.2:4000` |
| Physical Device | LAN IP (auto-detected) |
| Web | `localhost:4000` |
| Production | `https://loka.fly.dev` |

### UI Design Pattern: Living Ebook

The mobile app follows a "Living Ebook" aesthetic:
- Sepia/parchment backgrounds
- Serif fonts for narrative text
- Minimal chrome, story-focused
- Phase-aware theming (dawn, day, dusk, night)
- Subtle particle effects for atmosphere

### Running the Mobile App

```bash
cd mobile
npm install

# Start both Phoenix server and Expo
cd ../server
mix loka.dev

# Or start Expo only
npx expo start

# Run on specific platform
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

---

## 30. Quick Reference

### Common Commands

```bash
# Development
cd server
mix deps.get && mix ecto.setup    # Setup
mix phx.server                     # Start at localhost:4000
mix test                           # Run tests

# Validation
mix loka.test                     # All tests
mix loka.test.validate            # Validate prototypes, quests, dialogues

# Deployment
fly deploy
```

### Key Directories

| Path | Purpose |
|------|---------|
| `lib/loka/engine/` | Core engine primitives |
| `lib/loka/framework/` | Game subsystems |
| `lib/loka/session/` | Client communication |
| `lib/loka_web/` | Web layer (routes, channels, LiveView) |
| `priv/world/prototypes/` | YAML game content |
| `priv/world/quests/` | Quest definitions |
| `docs/` | Documentation |

### Module Counts

| Layer | Count |
|-------|-------|
| Engine Core | 43 modules |
| Framework | 100+ modules (33 subsystems) |
| World Builder | 12 modules |
| Session/Auth | 8 modules |
| Game Actions | 10 modules |
| Content Modules | 4 modules |
| Web Layer | 40+ modules |
| **Total** | 250+ modules |

### PubSub Topics

| Topic | Purpose |
|-------|---------|
| `events:global` | All events |
| `events:{type}` | Events by type |
| `room:{id}` | Room-scoped events |
| `entity:{id}` | Entity-scoped events |
| `player:{id}` | Player-scoped events |

### Database Migrations

```bash
mix ecto.migrate        # Run migrations
mix ecto.rollback       # Rollback last migration
mix ecto.reset          # Drop, create, migrate, seed
```

### Useful Mix Tasks

```bash
mix loka.test.validate --only prototype    # Validate specific type
mix loka.test.balance                       # Run balance simulation
mix loka.admin.grant_all                    # Grant admin to all users
```

---

## Appendix A: Entity Type Reference

### Room Entity

```yaml
type: room
key: monastery_courtyard
short_desc: "Monastery Courtyard"
long_desc: "A peaceful courtyard with ancient stones."
extra_desc: "Detailed description..."
keywords: [courtyard, monastery]
exits:
  north: temple
  south: gates
spawns:
  - prototype: young_monk
components:
  ambient_actions:
    messages: ["Wind rustles the prayer flags..."]
    interval_min: 30
    interval_max: 60
tags: [outdoor, safe_zone]
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
components:
  combatant:
    health: {current: 35, max: 35}
    stats: {str: 8, dex: 9, sta: 7}
    level: 1
  dialogue_tree:
    start:
      text: "Greetings, traveler..."
      choices:
        - text: "Tell me more."
          next: "more"
```

### Item Entity

```yaml
type: item
key: wisdom_blade
parent: base_weapon
short_desc: "Wisdom Blade"
long_desc: "A singing blade that cuts through illusion."
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

---

## Appendix B: Complete Module List

### Engine Core (36 modules)
- `Entity`, `EntityServer`, `EntityRegistry`, `EntitySupervisor`, `Entities`
- `Event`, `EventBus`
- `Command`, `CommandRegistry`
- `Prototype`, `PrototypeLoader`
- `Spawner`, `Spawner.Editor`, `Spawner.Templates`
- `Hooks`, `Locks`, `Scripting`, `ScriptingExtension`, `Scripts`
- `Behavior`
- `Zone`, `ZoneLoader`, `ZoneRegistry`, `ZoneReset`
- `WorldLoader`, `WorldExporter`, `WorldImporter`, `WorldGraph`
- `ContentValidator`, `ContentValidator.Plugin`, `ContentValidator.PrototypePlugin`
- `Directions`, `TextParser`, `Social`, `SocialLoader`, `SocialRegistry`, `SocialSubstitution`
- `Plugin`, `PluginLoader`, `PluginSupervisor`
- Schema modules: `EntitySchema`, `EntityAttribute`, `ScriptSchema`

### Framework (85 modules across 27 subsystems)
- Player, Inventory (7), Combat (10), Quest (19)
- Skills (3), Resources (5), Status (3)
- Social (7), Dialogue, Crafting (4), Gathering (3), Farming (4)
- World (8), Economy (3), Progression
- And more...

---

*This guide was generated by comprehensive analysis of the Loka codebase.*
*For the latest documentation, see `docs/` in the repository.*
