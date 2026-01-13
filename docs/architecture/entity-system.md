# Entity System Architecture

Loka uses a composition-based **Entity-Component-Behavior** model that maps naturally to Elixir's functional paradigm, unlike Evennia's typeclass system which uses Python class inheritance.

## Core Entity Structure

```elixir
defmodule Loka.Engine.Entity do
  defstruct [
    :id,              # Unique identifier (UUID) - instance identity
    :type,            # :character | :room | :item | :npc | :exit
    :key,             # Prototype key (e.g., "goblin") - type identity
    :name,            # Display name
    :description,     # Full description
    :location_id,     # Where this entity is (parent entity ID)
    :contents,        # List of entity IDs contained within
    :components,      # Map of component_type => component_data
    :behaviors,       # List of behavior modules
    :attributes,      # Flexible key-value storage (EAV pattern)
    :tags,            # Categorization tags
    :scripts,         # Attached Lua scripts
    :locks,           # Access control rules
    :metadata,        # System metadata (timestamps, versions)
  ]
end
```

## Key vs ID: Unified Key System

Loka uses a unified key system where:
- **`id`** (UUID): Unique per instance - "which one is this?"
- **`key`** (prototype key): Shared by all instances of a prototype - "what type is this?"

```elixir
# Two goblins spawned from the same prototype:
goblin1 = %Entity{id: "abc123...", key: "goblin", ...}
goblin2 = %Entity{id: "def456...", key: "goblin", ...}  # Same key, different id
```

### Benefits
- **Quest matching**: Quest objectives can match `entity.key` directly (e.g., "kill goblin")
- **Simple mental model**: `key` = "what it is", `id` = "which one"
- **No metadata workarounds**: No need to extract `prototype_key` from metadata

### display_ref for Logging
For human-readable logging that includes instance identity:
```elixir
Entity.display_ref(goblin1)  # => "goblin#abc123"
Entity.display_ref(goblin2)  # => "goblin#def456"
```

### Finding Entities
```elixir
# Find all goblins
Entities.get_all_by_key("goblin")  # => [%Entity{...}, %Entity{...}]

# Find a specific goblin by UUID
Entities.get_entity("abc123...")  # => %Entity{key: "goblin", id: "abc123..."}
```

## Component System

Components are pure data containers that can be attached to any entity.

**Important**: Components are stored as JSON, so when loaded from the database, map keys become strings. Use atom keys when working with components in code:

```elixir
# Combat-capable entities
defmodule Combatant do
  defstruct [
    :health,          # %{current: integer, max: integer}
    :mana,            # %{current: integer, max: integer}
    :stats,           # %{strength: int, dexterity: int, ...}
    :combat_flags,    # [:can_attack, :can_defend, :can_flee]
  ]
end

# Entities that can hold other entities
defmodule Container do
  defstruct [
    :capacity,        # Max items/weight
    :accepts,         # Item types accepted
    :locked?,         # Whether container is locked
    :lock_id,         # Key item ID needed to unlock
  ]
end

# Entities with dialogue
defmodule Conversant do
  defstruct [
    :dialogue_tree_id,  # Reference to dialogue tree
    :current_node,      # Current conversation state
    :memory,            # Conversation history with players
  ]
end
```

## Behavior System

Behaviors define HOW entities act. They're Elixir modules that implement specific callbacks:

```elixir
defmodule Loka.Engine.Behavior do
  @callback handle_event(entity :: Entity.t(), event :: Event.t(), context :: map()) ::
    {:ok, Entity.t()} | {:ok, Entity.t(), [Event.t()]} | {:error, term()}

  @callback can_handle?(entity :: Entity.t(), event_type :: atom()) :: boolean()
end

# Example: Default Object Behavior
defmodule DefaultObject do
  @behaviour Loka.Engine.Behavior

  @impl true
  def can_handle?(_entity, event_type) do
    event_type in [:look, :get, :drop, :examine]
  end

  @impl true
  def handle_event(entity, %Event{type: :look}, context) do
    description = get_description(entity, context.viewer)
    {:ok, entity, [%Event{type: :display, payload: description}]}
  end

  @impl true
  def handle_event(entity, %Event{type: :get, actor: actor}, _context) do
    case Lock.check(entity, :get, actor) do
      :allowed ->
        {:ok, entity, [
          %Event{type: :move_entity, payload: %{entity: entity.id, to: actor.id}},
          %Event{type: :message, payload: "You pick up #{entity.name}."}
        ]}
      {:denied, reason} ->
        {:ok, entity, [%Event{type: :message, payload: reason}]}
    end
  end
end
```

## Entity Lifecycle

Entity lifecycle is managed via the **Hooks** system. Key lifecycle events:

| Hook | When Called | Purpose |
|------|-------------|---------|
| `:at_entity_creation` | Entity first created | Set initial state |
| `:at_post_load` | Entity loaded into memory | Restore runtime state |
| `:at_pre_save` | Before entity is persisted | Validate, clean up |
| `:at_entity_delete` | Entity being destroyed | Cleanup references |

```elixir
# Register a lifecycle hook
Hooks.register(:at_entity_creation, MyGame.Combat, :on_create, priority: 10)

# The Registry pattern for active entities (lazy loading)
EntityRegistry.get_or_start(entity_id)  # Returns {:ok, pid}
```

See [Entity Lifecycle](./entity-lifecycle.md) for detailed documentation of the EntityRegistry, EntityServer, and EntitySupervisor pattern.

## Entity GenServer

Each active entity runs as an `EntityServer` GenServer process:

```elixir
# Key API
EntityServer.get_entity(pid)           # Get current state
EntityServer.update(pid, update_fn)    # Update entity (marks dirty)
EntityServer.handle_event(pid, event)  # Process event
EntityServer.save_now(pid)             # Force immediate save
EntityServer.touch(pid)                # Reset idle timer
```

**Lifecycle timings** (configurable):
- Auto-save: Every 60 seconds if dirty
- Hibernate: After 120 seconds idle (reduce memory)
- Stop: After 300 seconds idle (final save, process removed)

See [Entity Lifecycle](./entity-lifecycle.md) for implementation details.

## Entity Types

| Type | Description | Example Components |
|------|-------------|-------------------|
| room | A location in the world | Container, exits |
| character | Player character | Combatant, inventory |
| npc | Non-player character | Combatant, Conversant, AI scripts |
| item | Objects in the world | Equipable, Tradeable |
| exit | Connection between rooms | destination, locks |

## Related
- [Entity Lifecycle](./entity-lifecycle.md) - EntityRegistry, EntityServer, EntitySupervisor
- [Prototypes](./prototypes.md) - YAML-based entity templates
- [Hooks & Locks](./hooks-and-locks.md) - Lifecycle hooks and access control
- [Persistence](./persistence.md) - How entities are stored
- [Events](./events.md) - How entities communicate
- [Commands](./commands.md) - How players interact with entities
