# Entity System Architecture

ExMUD uses a composition-based **Entity-Component-Behavior** model that maps naturally to Elixir's functional paradigm, unlike Evennia's typeclass system which uses Python class inheritance.

## Core Entity Structure

```elixir
defmodule Exmud.Engine.Entity do
  defstruct [
    :id,              # Unique identifier (UUID)
    :type,            # :character | :room | :item | :npc | :exit
    :key,             # Human-readable identifier
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

## Component System

Components are pure data containers that can be attached to any entity:

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
defmodule Exmud.Engine.Behavior do
  @callback handle_event(entity :: Entity.t(), event :: Event.t(), context :: map()) ::
    {:ok, Entity.t()} | {:ok, Entity.t(), [Event.t()]} | {:error, term()}

  @callback can_handle?(entity :: Entity.t(), event_type :: atom()) :: boolean()
end

# Example: Default Object Behavior
defmodule DefaultObject do
  @behaviour Exmud.Engine.Behavior

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

```elixir
defmodule EntityLifecycle do
  # Creation hooks
  @doc "Called once when entity is first created"
  def at_entity_creation(entity), do: # Set initial state, defaults

  @doc "Called every time entity is loaded into memory"
  def at_entity_init(entity), do: # Restore runtime state

  @doc "Called before entity is persisted"
  def at_entity_save(entity), do: # Validate, clean up

  @doc "Called when entity is being destroyed"
  def at_entity_delete(entity), do: # Cleanup references

  # The Registry pattern for active entities
  def get_or_load(entity_id) do
    case Registry.lookup(Exmud.EntityRegistry, entity_id) do
      [{pid, _}] -> {:ok, pid}
      [] -> start_entity_process(entity_id)
    end
  end
end
```

## Entity GenServer

Each active entity is a GenServer process:

```elixir
defmodule EntityServer do
  use GenServer

  defstruct [:entity, :dirty?, :last_saved]

  def start_link(entity_id) do
    GenServer.start_link(__MODULE__, entity_id,
      name: via_tuple(entity_id))
  end

  defp via_tuple(entity_id) do
    {:via, Registry, {Exmud.EntityRegistry, entity_id}}
  end

  @impl true
  def init(entity_id) do
    # Load entity from database
    entity = Repo.get_entity(entity_id)
    entity = EntityLifecycle.at_entity_init(entity)

    # Schedule periodic saves (every 5 minutes)
    Process.send_after(self(), :auto_save, :timer.minutes(5))

    {:ok, %__MODULE__{entity: entity, dirty?: false}}
  end

  @impl true
  def handle_info(:auto_save, %{dirty?: true} = state) do
    Repo.save_entity(state.entity)
    Process.send_after(self(), :auto_save, :timer.minutes(5))
    {:noreply, %{state | dirty?: false}}
  end
end
```

## Entity Types

| Type | Description | Example Components |
|------|-------------|-------------------|
| room | A location in the world | Container, exits |
| character | Player character | Combatant, inventory |
| npc | Non-player character | Combatant, Conversant, AI scripts |
| item | Objects in the world | Equipable, Tradeable |
| exit | Connection between rooms | destination, locks |

## Related
- [Persistence](./persistence.md) - How entities are stored
- [Events](./events.md) - How entities communicate
- [Commands](./commands.md) - How players interact with entities
