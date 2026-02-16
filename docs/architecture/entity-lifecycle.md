# Entity Lifecycle

Loka uses a lazy-loading pattern where entities only become active GenServer processes when accessed. This reduces memory usage at scale while maintaining responsive gameplay.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Entity Lifecycle                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATION                                                │
│     Prototype (YAML) → Spawner.spawn() → Entity in DB       │
│                                                             │
│  2. ACTIVATION (lazy)                                       │
│     EntityRegistry.get_or_start(id) → EntityServer starts   │
│     EntityServer loads entity from DB into memory           │
│                                                             │
│  3. ACTIVE                                                  │
│     Handle events, mark dirty, reset idle timer             │
│     Auto-save every 60s if dirty                            │
│                                                             │
│  4. HIBERNATE                                               │
│     After 120s idle → :hibernate (reduce memory)            │
│                                                             │
│  5. STOP                                                    │
│     After 300s idle → final save → process removed          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### EntitySupervisor

DynamicSupervisor that manages EntityServer processes:

```elixir
# Started in application.ex
children = [
  {DynamicSupervisor, name: Loka.Engine.EntitySupervisor, strategy: :one_for_one}
]
```

### EntityRegistry

Provides process lookup and room-based broadcasting:

```elixir
# Get or start an EntityServer process (lazy loading)
{:ok, pid} = EntityRegistry.get_or_start(entity_id)

# Check if entity is active
case EntityRegistry.lookup(entity_id) do
  {:ok, pid} -> # Entity is active
  nil -> # Entity is not active (in database only)
end

# Stop an entity process
EntityRegistry.stop(entity_id)

# Broadcast event to all active entities in a room
EntityRegistry.broadcast_to_room(room_id, event)

# Send event to specific entity
EntityRegistry.broadcast_to_entity(entity_id, event)
```

### EntityServer

GenServer holding entity state with auto-save and hibernation:

```elixir
# Key API
EntityServer.get_entity(pid)           # Get current entity state
EntityServer.update(pid, update_fn)    # Update entity (marks dirty)
EntityServer.handle_event(pid, event)  # Process event
EntityServer.save_now(pid)             # Force immediate save
EntityServer.touch(pid)                # Reset idle timer
```

## Lifecycle Timings

```elixir
# Configurable in EntityServer
@save_interval 60_000     # 60 seconds - auto-save if dirty
@hibernate_after 120_000  # 2 minutes - reduce memory usage
@idle_timeout 300_000     # 5 minutes - stop process
```

### Auto-Save

Every 60 seconds, EntityServer checks if entity is dirty:

```elixir
def handle_info(:auto_save, %{dirty: true} = state) do
  save_entity(state.entity)
  schedule_auto_save()
  {:noreply, %{state | dirty: false, last_saved: now()}}
end
```

### Hibernation

After 2 minutes of inactivity, process hibernates to reduce memory:

```elixir
def handle_info(:hibernate_check, state) do
  if idle_for?(state, @hibernate_after) do
    {:noreply, state, :hibernate}  # BEAM hibernation
  else
    schedule_hibernate_check()
    {:noreply, state}
  end
end
```

### Idle Stop

After 5 minutes of inactivity, process stops:

```elixir
def handle_info(:idle_check, state) do
  if idle_for?(state, @idle_timeout) do
    save_entity(state.entity)  # Final save
    {:stop, :normal, state}    # Stop process
  else
    schedule_idle_check()
    {:noreply, state}
  end
end
```

## Room-Based Broadcasting

The EntityRegistry tracks which entities are in each room:

```elixir
# When entity enters a room
EntityRegistry.entity_entered_room(entity_id, room_id)

# When entity leaves a room
EntityRegistry.entity_left_room(entity_id, room_id)

# Broadcast to all active entities in room
EntityRegistry.broadcast_to_room(room_id, %Event{type: :say, payload: "Hello!"})
```

This enables efficient event delivery without querying all entities.

## Entity State Flow

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────┐     ┌─────────────┐     ┌──────────────┐       │
│  │  YAML   │ ──► │   Spawner   │ ──► │   Database   │       │
│  │Prototype│     │             │     │ (EntitySchema)│       │
│  └─────────┘     └─────────────┘     └──────┬───────┘       │
│                                             │               │
│                                             ▼               │
│                                    ┌────────────────┐       │
│                                    │ EntityRegistry │       │
│                                    │ get_or_start() │       │
│                                    └───────┬────────┘       │
│                                            │                │
│                                            ▼                │
│                                   ┌─────────────────┐       │
│                                   │  EntityServer   │       │
│                                   │ (GenServer)     │       │
│                                   │                 │       │
│                                   │ - entity state  │       │
│                                   │ - dirty flag    │       │
│                                   │ - last_activity │       │
│                                   └─────────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Working with Entity State

### Reading Entity State

```elixir
# Get process for entity
{:ok, pid} = EntityRegistry.get_or_start(entity_id)

# Read current state
entity = EntityServer.get_entity(pid)
entity.name  # => "Goblin"
entity.components["combatant"]["health"]  # => %{"current" => 30, "max" => 30}
```

### Updating Entity State

```elixir
# Update via function (marks dirty automatically)
EntityServer.update(pid, fn entity ->
  put_in(entity.components["combatant"]["health"]["current"], 20)
end)

# Force immediate save
EntityServer.save_now(pid)
```

### Handling Events

```elixir
# Send event to entity
EntityServer.handle_event(pid, %Event{
  type: :damage,
  actor: attacker_id,
  payload: %{amount: 10, type: :physical}
})
```

## Supervision Tree

```
Loka.Application
       │
       ├── Loka.Engine.Hooks
       ├── Loka.Engine.TypedObject.Loader
       ├── Loka.Engine.EntitySupervisor (DynamicSupervisor)
       │         │
       │         ├── EntityServer (room:abc123)
       │         ├── EntityServer (npc:def456)
       │         └── EntityServer (item:ghi789)
       │
       └── Loka.Engine.EntityRegistry
```

## Related

- [Entity System](./entity-system.md) - Entity structure and behaviors
- [Prototypes](./prototypes.md) - YAML-based entity templates
- [Hooks & Locks](./hooks-and-locks.md) - Lifecycle callbacks
- [Persistence](./persistence.md) - Database storage
- [Events](./events.md) - Event bus and PubSub
