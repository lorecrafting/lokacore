# Loka: Elixir MUD Engine Framework
## Architecture Design Document

*A framework for building text-based RPGs and MUDs in Elixir/Phoenix/LiveView*

---

> **Mobile Client Update (2026-01):** Sections referencing React Native/Expo are historical. The mobile client was migrated to **Godot 4.6** - see `docs/decisions/2026-01-26-godot-client-migration.md`. For current client architecture, see `CLAUDE.md`.

> **Document Role:** This is a comprehensive reference document (~200KB). For everyday development, prefer the modular docs in `docs/architecture/` which are actively maintained. Use this document for deep dives into system design philosophy or when you need the full picture in one place.

---

## Executive Summary

Loka is an **engine framework** (not a game) built on Elixir/Phoenix/LiveView, designed to provide the primitives, abstractions, and skeleton that game creators—and LLMs assisting them—can build upon. Loka leverages Elixir's unique strengths in concurrency, fault-tolerance, and real-time communication to create a modern MUD development platform.

---

## Part 1: Core Architecture Philosophy

### 1.1 The Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│                        GAME CONTENT                              │
│  (Worlds, NPCs, Items, Quests, Scripts - Creator Defined)       │
├─────────────────────────────────────────────────────────────────┤
│                      GAME FRAMEWORK                              │
│  (Combat, Magic, Skills, Progression - Configurable Systems)    │
├─────────────────────────────────────────────────────────────────┤
│                       ENGINE CORE                                │
│  (Entities, Commands, Events, Scripting, Persistence)           │
├─────────────────────────────────────────────────────────────────┤
│                    PLATFORM LAYER                                │
│  (Phoenix, LiveView, Ecto, PubSub, Telemetry)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 What Loka Provides (Engine Core)

**Unchangeable Core Infrastructure:**
- Entity system with behaviors and components
- Command parsing and routing
- Event bus and pub/sub
- Persistence and state management
- Scripting sandbox (Lua via Luerl)
- Session and connection management
- Encrypted messaging infrastructure

**Configurable Framework Systems:**
- Combat mechanics (turn-based, real-time, hybrid)
- Progression systems (XP, skills, levels)
- Inventory and equipment
- Economy and trading
- Social systems (channels, tells, groups)
- World simulation (ticks, weather, time)

### 1.3 What Creators Define (Content)

- World geography (rooms, areas, regions)
- Entities (NPCs, items, objects)
- Narrative (quests, dialogue, cutscenes)
- Custom behaviors (via Lua scripts)
- Visual presentation (LiveView components)
- Game rules and balance

---

## Part 2: Entity System Architecture

### 2.1 The Entity-Component-Behavior Model

Loka uses a composition-based **Entity-Component-Behavior** model that maps naturally to Elixir's functional paradigm.

```elixir
defmodule Loka.Entity do
  @moduledoc """
  Core entity structure. Entities are data containers with
  attached behaviors that define how they interact with the world.
  """
  
  defstruct [
    :id,                    # Unique identifier (UUID)
    :type,                  # :character | :room | :item | :npc | :exit
    :key,                   # Human-readable identifier
    :name,                  # Display name
    :description,           # Full description
    :location_id,           # Where this entity is (parent entity ID)
    :contents,              # List of entity IDs contained within
    :components,            # Map of component_type => component_data
    :behaviors,             # List of behavior modules
    :attributes,            # Flexible key-value storage (EAV pattern)
    :tags,                  # Categorization tags
    :scripts,               # Attached Lua scripts
    :locks,                 # Access control rules
    :metadata,              # System metadata (timestamps, versions)
  ]
end
```

### 2.2 Component System

Components are pure data containers that can be attached to any entity:

```elixir
defmodule Loka.Components do
  @moduledoc """
  Component definitions. Components are just data - behaviors
  provide the logic.
  """
  
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
  
  # Purchasable/sellable entities
  defmodule Tradeable do
    defstruct [
      :base_price,
      :currency_type,
      :vendor_markup,
      :can_sell?,
    ]
  end
  
  # Entities affected by world ticks
  defmodule Tickable do
    defstruct [
      :tick_interval,     # How often to process
      :last_tick,         # Timestamp of last tick
      :tick_script,       # Lua script to run on tick
    ]
  end
  
  # Equipable items
  defmodule Equipable do
    defstruct [
      :slot,              # :head | :body | :hands | :wielded | etc
      :requirements,      # %{level: 5, strength: 10}
      :stat_modifiers,    # %{defense: +5, attack: +3}
    ]
  end
end
```

### 2.3 Behavior System

Behaviors define HOW entities act. They're Elixir modules that implement specific callbacks:

```elixir
defmodule Loka.Behavior do
  @moduledoc """
  Behavior protocol - defines how entities respond to events.
  """
  
  @callback handle_event(entity :: Entity.t(), event :: Event.t(), context :: map()) ::
    {:ok, Entity.t()} | {:ok, Entity.t(), [Event.t()]} | {:error, term()}
    
  @callback can_handle?(entity :: Entity.t(), event_type :: atom()) :: boolean()
end

# Example: Default Object Behavior
defmodule Loka.Behaviors.DefaultObject do
  @behaviour Loka.Behavior
  
  @impl true
  def can_handle?(_entity, event_type) do
    event_type in [:look, :get, :drop, :examine]
  end
  
  @impl true
  def handle_event(entity, %Event{type: :look}, context) do
    description = Loka.Entity.get_description(entity, context.viewer)
    {:ok, entity, [%Event{type: :display, payload: description}]}
  end
  
  @impl true  
  def handle_event(entity, %Event{type: :get, actor: actor}, context) do
    case Loka.Lock.check(entity, :get, actor) do
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

# Example: NPC Behavior with AI
defmodule Loka.Behaviors.NPC do
  @behaviour Loka.Behavior
  
  @impl true
  def handle_event(entity, %Event{type: :tick}, _context) do
    # Run Lua AI script if present
    case entity.scripts[:on_tick] do
      nil -> {:ok, entity}
      script -> 
        Loka.Scripting.execute(script, entity)
    end
  end
  
  @impl true
  def handle_event(entity, %Event{type: :player_entered, payload: player}, context) do
    # NPCs can react to players entering their location
    case entity.scripts[:on_player_enter] do
      nil -> {:ok, entity}
      script ->
        Loka.Scripting.execute(script, entity, %{player: player})
    end
  end
end
```

### 2.4 Entity Lifecycle

```elixir
defmodule Loka.EntityLifecycle do
  @moduledoc """
  Manages entity creation, persistence, and caching.
  """
  
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
    case Registry.lookup(Loka.EntityRegistry, entity_id) do
      [{pid, _}] -> 
        {:ok, pid}
      [] -> 
        # Load from database, start GenServer
        start_entity_process(entity_id)
    end
  end
end
```

---

## Part 3: Process Architecture

### 3.1 Supervision Tree

```
                           Loka.Application
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    Loka.Platform          Loka.Engine            Loka.Game
          │                       │                       │
    ┌─────┴─────┐         ┌───────┴───────┐              │
    │           │         │               │              │
  Phoenix    PubSub   EntitySup      WorldSup       SessionMgr
  Endpoint              │               │              │
                   ┌────┴────┐     ┌────┴────┐    ┌────┴────┐
                   │         │     │         │    │         │
              EntityReg  EntityPool TickSup  WorldReg   Sessions
                                      RoomSups    NPCSups
```

### 3.2 Key Process Types

```elixir
# Each active entity is a GenServer
defmodule Loka.EntityServer do
  use GenServer
  
  defstruct [:entity, :dirty?, :last_saved]
  
  def start_link(entity_id) do
    GenServer.start_link(__MODULE__, entity_id,
      name: via_tuple(entity_id))
  end
  
  defp via_tuple(entity_id) do
    {:via, Registry, {Loka.EntityRegistry, entity_id}}
  end
  
  @impl true
  def init(entity_id) do
    # Load entity from database
    entity = Loka.Repo.get_entity(entity_id)
    entity = Loka.EntityLifecycle.at_entity_init(entity)
    
    # Schedule periodic saves
    Process.send_after(self(), :auto_save, :timer.minutes(5))
    
    {:ok, %__MODULE__{entity: entity, dirty?: false, last_saved: DateTime.utc_now()}}
  end
  
  @impl true
  def handle_call({:process_event, event, context}, _from, state) do
    case Loka.EventProcessor.process(state.entity, event, context) do
      {:ok, updated_entity, emitted_events} ->
        # Broadcast emitted events
        Enum.each(emitted_events, &Loka.EventBus.broadcast/1)
        {:reply, :ok, %{state | entity: updated_entity, dirty?: true}}
      
      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end
  
  @impl true
  def handle_info(:auto_save, %{dirty?: true} = state) do
    Loka.Repo.save_entity(state.entity)
    Process.send_after(self(), :auto_save, :timer.minutes(5))
    {:noreply, %{state | dirty?: false, last_saved: DateTime.utc_now()}}
  end
end
```

### 3.3 World Tick System

```elixir
defmodule Loka.World.TickServer do
  @moduledoc """
  Manages world simulation ticks for weather, NPC AI, respawns, etc.
  """
  use GenServer
  
  @tick_interval_ms 1000  # 1 second base tick
  
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end
  
  @impl true
  def init(_) do
    schedule_tick()
    {:ok, %{
      tick_count: 0,
      game_time: %{hour: 8, minute: 0, day: 1, season: :spring}
    }}
  end
  
  @impl true
  def handle_info(:tick, state) do
    new_state = state
    |> advance_game_time()
    |> process_weather()
    |> process_npc_ai()
    |> process_respawns()
    |> broadcast_tick()
    
    schedule_tick()
    {:noreply, %{new_state | tick_count: state.tick_count + 1}}
  end
  
  defp schedule_tick do
    Process.send_after(self(), :tick, @tick_interval_ms)
  end
  
  defp broadcast_tick(state) do
    Phoenix.PubSub.broadcast(
      Loka.PubSub, 
      "world:tick",
      {:tick, state.tick_count, state.game_time}
    )
    state
  end
end
```

---

## Part 4: Command System

### 4.1 Command Architecture

```elixir
defmodule Loka.Command do
  @moduledoc """
  Command behaviour and routing system.
  
  Commands are the primary way players interact with the world.
  They are parsed, validated, and executed in a pipeline.
  """
  
  @type parse_result :: {:ok, map()} | {:error, String.t()}
  @type execute_result :: {:ok, [Event.t()]} | {:error, String.t()}
  
  @callback key() :: String.t()
  @callback aliases() :: [String.t()]
  @callback help() :: String.t()
  @callback parse(args :: String.t(), context :: map()) :: parse_result()
  @callback execute(parsed :: map(), context :: map()) :: execute_result()
  @callback locks() :: [atom()]  # Required permissions
end

# Example Command Implementation
defmodule Loka.Commands.Look do
  @behaviour Loka.Command
  
  @impl true
  def key, do: "look"
  
  @impl true
  def aliases, do: ["l", "examine", "ex"]
  
  @impl true
  def help, do: "Look at your surroundings or a specific object."
  
  @impl true
  def locks, do: []  # No special permissions needed
  
  @impl true
  def parse("", context), do: {:ok, %{target: :room}}
  def parse(args, context) do
    case Loka.Search.find_target(args, context) do
      {:ok, target} -> {:ok, %{target: target}}
      :not_found -> {:error, "You don't see '#{args}' here."}
    end
  end
  
  @impl true
  def execute(%{target: :room}, %{actor: actor, location: room}) do
    events = [
      %Event{type: :display, target: actor.id, payload: describe_room(room, actor)},
      %Event{type: :notify_room, location: room.id, 
             payload: "#{actor.name} looks around.", exclude: [actor.id]}
    ]
    {:ok, events}
  end
  
  def execute(%{target: target}, %{actor: actor}) do
    events = [
      %Event{type: :display, target: actor.id, payload: describe_entity(target, actor)}
    ]
    {:ok, events}
  end
end
```

### 4.2 Command Pipeline

```elixir
defmodule Loka.CommandPipeline do
  @moduledoc """
  Pipeline for processing player commands.
  
  Input -> Parse -> Validate -> Execute -> Output
  """
  
  def process(raw_input, session) do
    with {:ok, {command_module, args}} <- route(raw_input, session),
         :ok <- check_locks(command_module, session),
         {:ok, parsed} <- command_module.parse(args, build_context(session)),
         {:ok, events} <- command_module.execute(parsed, build_context(session)) do
      
      # Process all emitted events
      Enum.each(events, &Loka.EventBus.emit/1)
      :ok
    else
      {:error, message} ->
        Loka.Session.send_message(session, message)
        :ok
    end
  end
  
  defp route(raw_input, session) do
    [cmd | args] = String.split(raw_input, " ", parts: 2)
    args = List.first(args) || ""
    
    case Loka.CommandRegistry.find(cmd, session.command_sets) do
      {:ok, module} -> {:ok, {module, args}}
      :not_found -> {:error, "Unknown command: #{cmd}"}
    end
  end
end
```

### 4.3 Command Sets (Composable Command Groups)

```elixir
defmodule Loka.CommandSet do
  @moduledoc """
  Command sets allow entities to contribute commands.
  
  For example:
  - A player has the "default" command set
  - When holding a weapon, they gain "combat" commands
  - When in a shop, they gain "shopping" commands
  """
  
  # Default commands everyone has
  defmodule Default do
    def commands do
      [
        Loka.Commands.Look,
        Loka.Commands.Inventory,
        Loka.Commands.Say,
        Loka.Commands.Move,
        Loka.Commands.Get,
        Loka.Commands.Drop,
        Loka.Commands.Help,
      ]
    end
  end
  
  # Combat commands (added when in combat)
  defmodule Combat do
    def commands do
      [
        Loka.Commands.Attack,
        Loka.Commands.Defend,
        Loka.Commands.Flee,
        Loka.Commands.UseSkill,
        Loka.Commands.CastSpell,
      ]
    end
  end
  
  # Builder commands (for world creators)
  defmodule Builder do
    def commands do
      [
        Loka.Commands.Admin.Create,
        Loka.Commands.Admin.Edit,
        Loka.Commands.Admin.Delete,
        Loka.Commands.Admin.Teleport,
        Loka.Commands.Admin.Spawn,
      ]
    end
  end
end
```

---

## Part 5: Event System

### 5.1 Event Structure

```elixir
defmodule Loka.Event do
  @moduledoc """
  Events are the primary communication mechanism in Loka.
  
  Events can be:
  - Synchronous (must be handled before continuing)
  - Asynchronous (fire and forget)
  - Cancellable (handlers can prevent the event)
  """
  
  defstruct [
    :id,              # Unique event ID
    :type,            # Event type atom
    :source,          # Entity that caused the event
    :target,          # Entity receiving the event (optional)
    :location,        # Room where event occurred
    :payload,         # Event-specific data
    :timestamp,       # When event was created
    :cancellable?,    # Can handlers cancel this?
    :cancelled?,      # Has it been cancelled?
    :metadata,        # Additional tracking info
  ]
  
  # Common event types
  @type event_type ::
    # Movement
    :move | :enter_room | :leave_room |
    # Communication
    :say | :tell | :whisper | :shout | :emote |
    # Combat
    :attack | :defend | :damage | :heal | :death |
    # Items
    :get | :drop | :give | :equip | :unequip | :use |
    # World
    :tick | :weather_change | :time_change |
    # System
    :connect | :disconnect | :save | :load
end
```

### 5.2 Event Bus

```elixir
defmodule Loka.EventBus do
  @moduledoc """
  Central event routing system using Phoenix.PubSub.
  """
  
  @pubsub Loka.PubSub
  
  def emit(%Event{} = event) do
    # Broadcast to relevant topics
    topics = build_topics(event)
    
    Enum.each(topics, fn topic ->
      Phoenix.PubSub.broadcast(@pubsub, topic, {:event, event})
    end)
    
    # Also process through entity behaviors
    if event.target do
      Loka.EntityServer.process_event(event.target, event)
    end
  end
  
  def subscribe(topic) do
    Phoenix.PubSub.subscribe(@pubsub, topic)
  end
  
  defp build_topics(event) do
    base = ["events:global"]
    
    base
    |> maybe_add_type_topic(event)
    |> maybe_add_location_topic(event)
    |> maybe_add_entity_topic(event)
  end
  
  defp maybe_add_location_topic(topics, %{location: nil}), do: topics
  defp maybe_add_location_topic(topics, %{location: loc}) do
    ["room:#{loc}" | topics]
  end
end
```

### 5.3 Event Hooks for Scripting

```elixir
defmodule Loka.EventHooks do
  @moduledoc """
  Predefined hook points that Lua scripts can attach to.
  """
  
  @hooks %{
    # Entity lifecycle
    at_entity_creation: "Called when entity is first created",
    at_entity_init: "Called when entity is loaded into memory",
    at_entity_save: "Called before entity is saved",
    
    # Room events
    at_pre_move: "Before an entity moves (cancellable)",
    at_post_move: "After an entity has moved",
    at_player_enter: "When a player enters the room",
    at_player_leave: "When a player leaves the room",
    
    # Object events
    at_pre_get: "Before object is picked up (cancellable)",
    at_post_get: "After object is picked up",
    at_pre_drop: "Before object is dropped (cancellable)",
    at_post_drop: "After object is dropped",
    at_use: "When object is used",
    
    # Combat events
    at_pre_attack: "Before attack is processed (cancellable)",
    at_post_attack: "After attack is processed",
    at_damage: "When entity takes damage",
    at_death: "When entity dies",
    
    # NPC events
    at_tick: "On world tick (for AI)",
    at_greet: "When player first interacts",
    at_dialogue: "During conversation",
  }
  
  def available_hooks, do: @hooks
end
```

---

## Part 6: Scripting System (Lua Integration)

### 6.1 Sandboxed Lua Execution

```elixir
defmodule Loka.Scripting do
  @moduledoc """
  Lua scripting integration using Luerl.
  
  Scripts are executed in a sandboxed environment with:
  - No file system access
  - No network access
  - CPU/memory limits
  - Controlled API exposure
  """
  
  alias Lua, as: LuaVM
  
  @max_reductions 10_000  # CPU limit
  @max_memory_kb 1024     # Memory limit
  
  def execute(script, entity, context \\ %{}) do
    lua = init_sandbox()
    |> inject_entity(entity)
    |> inject_context(context)
    |> inject_api()
    
    case LuaVM.eval(lua, script, max_reductions: @max_reductions) do
      {:ok, result, new_lua} ->
        {:ok, extract_changes(new_lua, entity)}
      {:error, reason} ->
        {:error, {:script_error, reason}}
    end
  end
  
  defp init_sandbox do
    LuaVM.init()  # Sandbox mode by default
  end
  
  defp inject_api(lua) do
    lua
    |> LuaVM.set!([:game, :message], &api_message/2)
    |> LuaVM.set!([:game, :move_entity], &api_move_entity/2)
    |> LuaVM.set!([:game, :spawn_entity], &api_spawn_entity/2)
    |> LuaVM.set!([:game, :set_flag], &api_set_flag/2)
    |> LuaVM.set!([:game, :get_flag], &api_get_flag/2)
    |> LuaVM.set!([:game, :start_quest], &api_start_quest/2)
    |> LuaVM.set!([:game, :gain_xp], &api_gain_xp/2)
    |> LuaVM.set!([:game, :emit_event], &api_emit_event/2)
    |> LuaVM.set!([:game, :delay], &api_delay/2)
    |> LuaVM.set!([:game, :random], &api_random/2)
  end
  
  # Example API function exposed to Lua
  defp api_message(lua, args) do
    [target_id, message] = args
    event = %Event{
      type: :message,
      target: target_id,
      payload: message
    }
    Loka.EventBus.emit(event)
    {[], lua}
  end
end
```

### 6.2 Script Examples

```lua
-- NPC greeting script (attached to at_player_enter hook)
function on_player_enter(player)
  if player.level < 5 then
    game.message(player.id, "Welcome, young adventurer! I am the village elder.")
    game.message(player.id, "Would you like me to explain how things work here?")
  else
    game.message(player.id, "Greetings, " .. player.name .. ". How may I assist you?")
  end
end

-- Shop keeper behavior (attached to at_greet hook)
function on_greet(player)
  local relationship = entity.get_relationship(player.id)
  
  if relationship < 0 then
    game.message(player.id, "I don't do business with troublemakers.")
    return false  -- Cancel interaction
  end
  
  if relationship > 50 then
    game.message(player.id, "Ah, my favorite customer! Let me show you the good stuff.")
    entity.set_flag("show_rare_items", true)
  else
    game.message(player.id, "Welcome to my shop. Browse at your leisure.")
  end
  
  return true
end

-- Combat AI for boss monster (attached to at_tick hook)
function on_tick()
  local health_percent = entity.health.current / entity.health.max
  
  if health_percent < 0.25 and not entity.get_flag("enraged") then
    entity.set_flag("enraged", true)
    game.message_room(entity.location, entity.name .. " becomes enraged!")
    entity.stats.strength = entity.stats.strength * 1.5
  end
  
  -- Random ability usage
  if entity.in_combat and game.random() < 0.3 then
    local abilities = {"fireball", "tail_sweep", "roar"}
    local ability = abilities[game.random(1, #abilities)]
    game.use_ability(entity.id, ability, entity.combat_target)
  end
end
```

### 6.3 Script Security Model

```elixir
defmodule Loka.Scripting.Security do
  @moduledoc """
  Security policies for Lua scripts.
  """
  
  @blocked_globals [
    "os", "io", "file", "require", "dofile", "loadfile",
    "debug", "package", "rawget", "rawset", "rawequal"
  ]
  
  @allowed_math [
    "abs", "ceil", "floor", "max", "min", "random", "sqrt"
  ]
  
  @allowed_string [
    "byte", "char", "find", "format", "gsub", "len", 
    "lower", "match", "rep", "sub", "upper"
  ]
  
  @allowed_table [
    "concat", "insert", "remove", "sort", "unpack"
  ]
  
  def validate_script(source) do
    # Static analysis for dangerous patterns
    checks = [
      &check_blocked_globals/1,
      &check_infinite_loops/1,
      &check_memory_abuse/1,
    ]
    
    Enum.reduce_while(checks, :ok, fn check, _acc ->
      case check.(source) do
        :ok -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end
end
```

---

## Part 7: LiveView Integration

### 8.1 Game Client Architecture

```elixir
defmodule LokaWeb.GameLive do
  use LokaWeb, :live_view
  
  @impl true
  def mount(%{"game_id" => game_id}, session, socket) do
    if connected?(socket) do
      # Subscribe to relevant PubSub topics
      Phoenix.PubSub.subscribe(Loka.PubSub, "player:#{session.player_id}")
      Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{session.location_id}")
      
      # Join the game session
      {:ok, session_pid} = Loka.Session.join(session.player_id)
      
      socket = assign(socket,
        player_id: session.player_id,
        session_pid: session_pid,
        room: nil,
        messages: [],
        inventory: [],
        stats: nil
      )
      
      # Request initial state
      send(self(), :load_initial_state)
      
      {:ok, socket}
    else
      {:ok, assign(socket, loading: true)}
    end
  end
  
  @impl true
  def handle_info({:event, %Event{type: :display, payload: message}}, socket) do
    {:noreply, push_message(socket, message)}
  end
  
  def handle_info({:event, %Event{type: :room_update, payload: room}}, socket) do
    {:noreply, assign(socket, room: room)}
  end
  
  def handle_info({:event, %Event{type: :stats_update, payload: stats}}, socket) do
    {:noreply, assign(socket, stats: stats)}
  end
  
  @impl true
  def handle_event("command", %{"input" => input}, socket) do
    Loka.Session.process_command(socket.assigns.session_pid, input)
    {:noreply, socket}
  end
  
  def handle_event("move", %{"direction" => dir}, socket) do
    Loka.Session.process_command(socket.assigns.session_pid, dir)
    {:noreply, socket}
  end
  
  defp push_message(socket, message) do
    messages = [message | socket.assigns.messages] |> Enum.take(100)
    assign(socket, messages: messages)
  end
end
```

### 8.2 Composable UI Components

```elixir
defmodule LokaWeb.Components.RoomView do
  use Phoenix.Component
  
  attr :room, :map, required: true
  attr :player, :map, required: true
  
  def room_view(assigns) do
    ~H"""
    <div class="room-view">
      <h2 class="room-title"><%= @room.name %></h2>
      
      <div class="room-description">
        <%= raw(format_description(@room, @player)) %>
      </div>
      
      <.exits_display exits={@room.exits} />
      
      <.entities_present 
        npcs={@room.npcs} 
        items={@room.items} 
        players={@room.players -- [@player]} 
      />
    </div>
    """
  end
  
  def exits_display(assigns) do
    ~H"""
    <div class="exits">
      <span class="label">Exits:</span>
      <%= for {dir, _} <- @exits do %>
        <button phx-click="move" phx-value-direction={dir} class="exit-btn">
          <%= String.upcase(to_string(dir)) %>
        </button>
      <% end %>
    </div>
    """
  end
end
```

---

## Part 8: Encrypted Messaging System

### 9.1 Architecture for E2E Encrypted Tells

For the encrypted messenger feature (player-to-player tells), we implement a Signal Protocol-inspired system:

```elixir
defmodule Loka.Crypto.E2E do
  @moduledoc """
  End-to-end encryption for private messages using X25519 key exchange
  and AES-256-GCM for message encryption.
  
  Each player generates a key pair. Public keys are stored server-side.
  Private keys remain on the client (in browser localStorage/IndexedDB).
  """
  
  # Server-side key bundle storage
  defmodule KeyBundle do
    use Ecto.Schema
    
    schema "e2e_key_bundles" do
      field :player_id, :binary_id
      field :identity_public_key, :binary  # Long-term public key
      field :signed_prekey, :binary        # Rotated periodically
      field :prekey_signature, :binary     # Signature over signed_prekey
      field :one_time_prekeys, {:array, :binary}  # Single-use keys
      timestamps()
    end
  end
  
  @doc """
  Generate initial key bundle for a new player.
  Called client-side, only public portions sent to server.
  """
  def generate_key_bundle do
    # These happen in the browser via Web Crypto API
    %{
      identity_key_pair: generate_x25519_keypair(),
      signed_prekey_pair: generate_x25519_keypair(),
      one_time_prekeys: Enum.map(1..100, fn _ -> generate_x25519_keypair() end)
    }
  end
  
  @doc """
  Establish session between two players (X3DH-like).
  Returns shared secret for symmetric encryption.
  """
  def establish_session(sender_identity, sender_ephemeral, recipient_bundle) do
    # X3DH key agreement
    # DH1 = DH(sender_identity_private, recipient_signed_prekey)
    # DH2 = DH(sender_ephemeral_private, recipient_identity_public)
    # DH3 = DH(sender_ephemeral_private, recipient_signed_prekey)
    # DH4 = DH(sender_ephemeral_private, recipient_one_time_prekey) [if available]
    # shared_secret = KDF(DH1 || DH2 || DH3 || DH4)
  end
end
```

### 9.2 Client-Side Encryption (Browser)

```javascript
// loka_crypto.js - Runs in browser
class LokaCrypto {
  constructor() {
    this.identityKeyPair = null;
    this.sessions = new Map(); // playerId -> session
  }
  
  async generateIdentity() {
    this.identityKeyPair = await crypto.subtle.generateKey(
      { name: "X25519" },
      true,
      ["deriveBits"]
    );
    
    // Store private key locally
    await this.storePrivateKey(this.identityKeyPair.privateKey);
    
    // Return public key to send to server
    return await crypto.subtle.exportKey("raw", this.identityKeyPair.publicKey);
  }
  
  async encryptMessage(recipientId, plaintext) {
    const session = await this.getOrCreateSession(recipientId);
    
    // Generate message key from ratchet
    const messageKey = await session.ratchet.getMessageKey();
    
    // Encrypt with AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      messageKey,
      new TextEncoder().encode(plaintext)
    );
    
    return {
      ciphertext: encrypted,
      iv: iv,
      messageNumber: session.messageNumber++
    };
  }
  
  async decryptMessage(senderId, encryptedMessage) {
    const session = this.sessions.get(senderId);
    if (!session) {
      throw new Error("No session with sender");
    }
    
    const messageKey = await session.ratchet.getMessageKey(
      encryptedMessage.messageNumber
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: encryptedMessage.iv },
      messageKey,
      encryptedMessage.ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  }
}
```

### 9.3 Server-Side Message Routing

```elixir
defmodule Loka.Messaging.E2E do
  @moduledoc """
  Server acts only as a relay for encrypted messages.
  Cannot read message contents.
  """
  
  def send_encrypted_tell(sender_id, recipient_id, encrypted_payload) do
    # Server only sees:
    # - Who is sending
    # - Who is receiving  
    # - Encrypted blob
    # - Timestamp
    
    # Store for offline delivery
    message = %EncryptedMessage{
      sender_id: sender_id,
      recipient_id: recipient_id,
      ciphertext: encrypted_payload.ciphertext,
      iv: encrypted_payload.iv,
      message_number: encrypted_payload.message_number,
      sent_at: DateTime.utc_now()
    }
    
    Loka.Repo.insert!(message)
    
    # If recipient online, deliver immediately
    case Loka.Session.find(recipient_id) do
      {:ok, session_pid} ->
        Loka.Session.deliver_encrypted_message(session_pid, message)
      :not_found ->
        :ok  # Will be delivered when they log in
    end
  end
  
  def get_pending_messages(player_id) do
    EncryptedMessage
    |> where([m], m.recipient_id == ^player_id)
    |> where([m], is_nil(m.delivered_at))
    |> order_by([m], asc: m.sent_at)
    |> Loka.Repo.all()
  end
end
```

---

## Part 9: Persistence Layer

### 10.1 Database Schema

```elixir
# Core entity storage
defmodule Loka.Schema.Entity do
  use Ecto.Schema
  
  @primary_key {:id, :binary_id, autogenerate: true}
  
  schema "entities" do
    field :type, Ecto.Enum, values: [:room, :character, :npc, :item, :exit]
    field :key, :string
    field :name, :string
    field :description, :text
    field :location_id, :binary_id
    field :behaviors, {:array, :string}
    field :tags, {:array, :string}
    field :locks, :map
    field :metadata, :map
    
    timestamps()
  end
end

# Flexible attribute storage (EAV pattern)
defmodule Loka.Schema.Attribute do
  use Ecto.Schema
  
  schema "attributes" do
    field :entity_id, :binary_id
    field :key, :string
    field :category, :string
    field :value, :binary  # Erlang term storage
    field :str_value, :string  # For searching
    
    timestamps()
  end
end

# Component storage (JSON columns)
defmodule Loka.Schema.Component do
  use Ecto.Schema
  
  schema "components" do
    field :entity_id, :binary_id
    field :type, :string
    field :data, :map
    
    timestamps()
  end
end

# Script storage
defmodule Loka.Schema.Script do
  use Ecto.Schema
  
  schema "scripts" do
    field :entity_id, :binary_id
    field :hook, :string  # e.g., "at_player_enter"
    field :source, :text  # Lua source code
    field :compiled, :binary  # Pre-compiled chunk
    field :enabled, :boolean, default: true
    
    timestamps()
  end
end
```

### 10.2 Caching Strategy

```elixir
defmodule Loka.Cache do
  @moduledoc """
  Multi-layer caching using ETS.
  
  Layer 1: Entity process state (GenServer)
  Layer 2: ETS tables (shared read)
  Layer 3: SQLite (persistent)
  """
  
  def init_cache() do
    # Create ETS tables
    :ets.new(:loka_entities, [
      :set, :public, :named_table,
      read_concurrency: true
    ])
    
    :ets.new(:loka_rooms, [
      :set, :public, :named_table,
      read_concurrency: true
    ])
    
    :ets.new(:loka_templates, [
      :set, :public, :named_table,
      read_concurrency: true
    ])
  end
  
  def get_entity(entity_id) do
    case :ets.lookup(:loka_entities, entity_id) do
      [{^entity_id, entity}] -> {:ok, entity}
      [] -> 
        # Cache miss - load from database
        case load_from_db(entity_id) do
          {:ok, entity} ->
            :ets.insert(:loka_entities, {entity_id, entity})
            {:ok, entity}
          error -> error
        end
    end
  end
end
```

---

## Part 10: Creator Tools

### 10.1 World Builder Interface

```elixir
defmodule LokaWeb.Admin.WorldBuilderLive do
  use LokaWeb, :live_view
  
  @impl true
  def mount(_params, session, socket) do
    {:ok, assign(socket,
      selected_room: nil,
      rooms: [],
      mode: :view
    )}
  end
  
  @impl true
  def render(assigns) do
    ~H"""
    <div class="world-builder">
      <.sidebar>
        <.room_tree rooms={@rooms} selected={@selected_room} />
      </.sidebar>
      
      <.main_panel>
        <%= case @mode do %>
          <% :view -> %>
            <.room_viewer room={@selected_room} />
          <% :edit -> %>
            <.room_editor room={@selected_room} on_save="save_room" />
          <% :script -> %>
            <.script_editor entity={@selected_room} />
        <% end %>
      </.main_panel>
      
      <.properties_panel>
        <.entity_properties entity={@selected_room} />
      </.properties_panel>
    </div>
    """
  end
  
  @impl true
  def handle_event("create_room", params, socket) do
    room = Loka.Builder.create_room(params)
    {:noreply, update(socket, :rooms, &[room | &1])}
  end
  
  def handle_event("connect_rooms", %{"from" => from, "to" => to, "direction" => dir}, socket) do
    Loka.Builder.connect_rooms(from, to, dir)
    {:noreply, socket}
  end
end
```

### 11.2 Script Editor with Validation

```elixir
defmodule LokaWeb.Admin.ScriptEditorLive do
  use LokaWeb, :live_view
  
  @impl true
  def render(assigns) do
    ~H"""
    <div class="script-editor">
      <div class="editor-header">
        <select phx-change="select_hook">
          <%= for hook <- Loka.EventHooks.available_hooks() do %>
            <option value={hook}><%= hook %></option>
          <% end %>
        </select>
        
        <button phx-click="validate">Validate</button>
        <button phx-click="test">Test</button>
        <button phx-click="save">Save</button>
      </div>
      
      <div class="editor-body" phx-hook="CodeEditor" id="script-editor">
        <textarea name="source"><%= @source %></textarea>
      </div>
      
      <%= if @validation_result do %>
        <div class={"validation-result #{@validation_result.status}"}>
          <%= @validation_result.message %>
        </div>
      <% end %>
      
      <%= if @test_output do %>
        <div class="test-output">
          <h4>Test Output:</h4>
          <pre><%= @test_output %></pre>
        </div>
      <% end %>
    </div>
    """
  end
  
  @impl true
  def handle_event("validate", _params, socket) do
    result = Loka.Scripting.Security.validate_script(socket.assigns.source)
    {:noreply, assign(socket, validation_result: result)}
  end
  
  def handle_event("test", _params, socket) do
    # Run script in isolated test environment
    output = Loka.Scripting.test_run(
      socket.assigns.source,
      socket.assigns.entity,
      socket.assigns.test_context
    )
    {:noreply, assign(socket, test_output: output)}
  end
end
```

---

## Part 11: Configuration System

### 12.1 Game Configuration Schema

```elixir
defmodule Loka.Config.GameRules do
  @moduledoc """
  Creator-configurable game rules.
  These are the "knobs" that make different games possible.
  """
  
  use Ecto.Schema
  import Ecto.Changeset
  
  embedded_schema do
    # Progression
    embeds_one :progression, Progression do
      field :level_cap, :integer, default: 50
      field :xp_formula, :string, default: "linear"
      field :base_xp_per_level, :integer, default: 100
      field :xp_multiplier, :float, default: 1.15
    end
    
    # Combat
    embeds_one :combat, Combat do
      field :system, Ecto.Enum, values: [:turn_based, :real_time, :hybrid]
      field :base_action_points, :integer, default: 100
      field :death_penalty, Ecto.Enum, values: [:none, :xp_loss, :item_drop, :permadeath]
      field :pvp_enabled, :boolean, default: false
    end
    
    # Economy
    embeds_one :economy, Economy do
      field :currencies, {:array, :string}, default: ["gold"]
      field :starting_currency, :map, default: %{"gold" => 100}
      field :vendor_markup, :float, default: 1.5
    end
    
    # World
    embeds_one :world, World do
      field :tick_interval_ms, :integer, default: 1000
      field :time_enabled, :boolean, default: true
      field :time_ratio, :integer, default: 4  # 4x real time
      field :seasons_enabled, :boolean, default: true
      field :weather_enabled, :boolean, default: true
    end
    
    # Social
    embeds_one :social, Social do
      field :max_party_size, :integer, default: 6
      field :guilds_enabled, :boolean, default: true
      field :channels, {:array, :string}, default: ["global", "trade", "help"]
    end
  end
  
  def changeset(config, attrs) do
    config
    |> cast(attrs, [])
    |> cast_embed(:progression)
    |> cast_embed(:combat)
    |> cast_embed(:economy)
    |> cast_embed(:world)
    |> cast_embed(:social)
  end
end
```

---

## Part 12: Multi-Platform Client Architecture

Loka supports multiple client types connecting to the same game engine:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                      │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   iOS App    │  │ Android App  │  │  Web Client  │  │   Terminal   │    │
│  │              │  │              │  │              │  │    Client    │    │
│  │ SwiftUI +    │  │ Jetpack      │  │              │  │              │    │
│  │ Phoenix      │  │ Compose +    │  │  LiveView    │  │  Raw Socket  │    │
│  │ Channels     │  │ Phoenix      │  │  (Browser)   │  │  or WebSocket│    │
│  │              │  │ Channels     │  │              │  │              │    │
│  │ Touch UI     │  │ Touch UI     │  │  Click/Key   │  │  Text Input  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │                 │
          │   WebSocket     │   WebSocket     │   WebSocket     │  TCP/WS
          │   (Channels)    │   (Channels)    │   (LiveView)    │
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │        PHOENIX SERVER           │
                    │                                 │
                    │  ┌───────────┐ ┌───────────┐   │
                    │  │  Phoenix  │ │  LiveView │   │
                    │  │  Channels │ │  (Web UI) │   │
                    │  └─────┬─────┘ └─────┬─────┘   │
                    │        │             │         │
                    │        └──────┬──────┘         │
                    │               │                │
                    │  ┌────────────┴────────────┐   │
                    │  │    Loka Game Engine    │   │
                    │  │                         │   │
                    │  │  • Entity System        │   │
                    │  │  • Command Pipeline     │   │
                    │  │  • Event Bus            │   │
                    │  │  • Scripting Engine     │   │
                    │  └─────────────────────────┘   │
                    │                                 │
                    │  ┌─────────────────────────┐   │
                    │  │      REST API           │   │
                    │  │  • Auth / Account       │   │
                    │  │  • IAP Verification     │   │
                    │  │  • Static Data          │   │
                    │  └─────────────────────────┘   │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │   PostgreSQL + Redis Cache      │
                    └─────────────────────────────────┘
```

### 13.1 Client Type Summary

| Client Type | Transport | UI Framework | Primary Use |
|-------------|-----------|--------------|-------------|
| iOS Native | Phoenix Channels | SwiftUI | Players (Touch) |
| Android Native | Phoenix Channels | Jetpack Compose | Players (Touch) |
| Web Browser | LiveView | Server-rendered HTML | Players, Creators, Admins |
| Terminal/CLI | WebSocket or TCP | Text-based | Power users, nostalgia, accessibility |

### 13.2 Phoenix Channels Game Protocol

All clients (except web LiveView, which is higher-level) use the same Phoenix Channels protocol:

```elixir
defmodule LokaWeb.GameChannel do
  use Phoenix.Channel
  
  @moduledoc """
  Main game channel - unified protocol for all client types.
  iOS, Android, Terminal clients all use this same interface.
  """
  
  # ============================================================
  # CONNECTION & AUTHENTICATION
  # ============================================================
  
  def join("game:" <> game_id, %{"token" => token}, socket) do
    case Loka.Auth.verify_token(token) do
      {:ok, player_id} ->
        # Start or resume player session
        {:ok, session} = Loka.Session.join(player_id, game_id)
        
        # Subscribe to player-specific events
        Phoenix.PubSub.subscribe(Loka.PubSub, "player:#{player_id}")
        Phoenix.PubSub.subscribe(Loka.PubSub, "game:#{game_id}")
        
        socket = socket
        |> assign(:player_id, player_id)
        |> assign(:game_id, game_id)
        |> assign(:session, session)
        |> assign(:client_type, detect_client_type(socket))
        
        # Send initial game state
        send(self(), :after_join)
        
        {:ok, %{status: "connected"}, socket}
        
      {:error, _reason} ->
        {:error, %{reason: "unauthorized"}}
    end
  end
  
  defp detect_client_type(socket) do
    # Can detect from user-agent or explicit parameter
    case get_connect_info(socket, :user_agent) do
      ua when is_binary(ua) ->
        cond do
          String.contains?(ua, "Loka-iOS") -> :ios
          String.contains?(ua, "Loka-Android") -> :android
          String.contains?(ua, "Loka-Terminal") -> :terminal
          true -> :web
        end
      _ -> :unknown
    end
  end
  
  def handle_info(:after_join, socket) do
    state = Loka.Session.get_state(socket.assigns.session)
    
    # Push initial state - format varies slightly by client type
    push(socket, "game_state", format_game_state(state, socket.assigns.client_type))
    
    {:noreply, socket}
  end
  
  defp format_game_state(state, :terminal) do
    # Terminal gets plain text format
    %{
      room_text: Loka.Formatter.to_plain_text(state.room),
      prompt: build_prompt(state.player)
    }
  end
  
  defp format_game_state(state, _client_type) do
    # Native/Web clients get structured JSON
    %{
      room: %{
        id: state.room.id,
        name: state.room.name,
        description: state.room.description,
        exits: format_exits(state.room),
        entities: format_entities(state.room.contents)
      },
      player: %{
        id: state.player.id,
        name: state.player.name,
        health: state.player.components.combatant.health,
        mana: state.player.components.combatant.mana,
        level: state.player.attributes[:level],
        xp: state.player.attributes[:xp]
      },
      inventory: format_inventory(state.inventory),
      wallet: format_wallet(state.wallet)
    }
  end
  
  # ============================================================
  # COMMAND HANDLING
  # ============================================================
  
  @doc """
  Handle raw text commands - works for all client types.
  Touch UI can send pre-formatted commands, terminal sends raw input.
  """
  def handle_in("command", %{"input" => input}, socket) do
    result = Loka.Session.process_command(
      socket.assigns.session, 
      String.trim(input)
    )
    
    # Command results are pushed via events, not direct reply
    {:reply, {:ok, %{accepted: true, command_id: UUID.uuid4()}}, socket}
  end
  
  @doc """
  Quick action shortcuts - for touch UI convenience.
  These just translate to the underlying text commands.
  """
  def handle_in("move", %{"direction" => dir}, socket) do
    Loka.Session.process_command(socket.assigns.session, dir)
    {:noreply, socket}
  end
  
  def handle_in("look", params, socket) do
    target = Map.get(params, "target", "")
    Loka.Session.process_command(socket.assigns.session, "look #{target}")
    {:noreply, socket}
  end
  
  def handle_in("get", %{"item" => item}, socket) do
    Loka.Session.process_command(socket.assigns.session, "get #{item}")
    {:noreply, socket}
  end
  
  def handle_in("attack", %{"target" => target}, socket) do
    Loka.Session.process_command(socket.assigns.session, "attack #{target}")
    {:noreply, socket}
  end
  
  def handle_in("use_skill", %{"skill" => skill, "target" => target}, socket) do
    Loka.Session.process_command(socket.assigns.session, "use #{skill} #{target}")
    {:noreply, socket}
  end
  
  def handle_in("cast", %{"spell" => spell, "target" => target}, socket) do
    Loka.Session.process_command(socket.assigns.session, "cast #{spell} #{target}")
    {:noreply, socket}
  end
  
  # ============================================================
  # ENCRYPTED MESSAGING (E2E)
  # ============================================================
  
  def handle_in("encrypted_tell", payload, socket) do
    %{
      "recipient_id" => recipient_id,
      "ciphertext" => ciphertext,
      "iv" => iv,
      "ephemeral_key" => ephemeral_key,
      "message_number" => msg_num
    } = payload
    
    Loka.Messaging.E2E.send_encrypted_tell(
      socket.assigns.player_id,
      recipient_id,
      %{
        ciphertext: Base.decode64!(ciphertext),
        iv: Base.decode64!(iv),
        ephemeral_key: Base.decode64!(ephemeral_key),
        message_number: msg_num
      }
    )
    
    {:reply, {:ok, %{delivered: true}}, socket}
  end
  
  def handle_in("get_key_bundle", %{"player_id" => target_id}, socket) do
    case Loka.Messaging.E2E.get_key_bundle(target_id) do
      {:ok, bundle} ->
        {:reply, {:ok, %{
          identity_key: Base.encode64(bundle.identity_public_key),
          signed_prekey: Base.encode64(bundle.signed_prekey),
          prekey_signature: Base.encode64(bundle.prekey_signature),
          one_time_prekey: bundle.one_time_prekey && Base.encode64(bundle.one_time_prekey)
        }}, socket}
      
      {:error, :not_found} ->
        {:reply, {:error, %{reason: "player_not_found"}}, socket}
    end
  end
  
  # ============================================================
  # SERVER -> CLIENT EVENT PUSH
  # ============================================================
  
  @doc """
  Handle PubSub messages and forward to client.
  """
  def handle_info({:game_event, event}, socket) do
    # Format event based on client type
    formatted = format_event(event, socket.assigns.client_type)
    push(socket, event_type_to_channel(event.type), formatted)
    {:noreply, socket}
  end
  
  def handle_info({:encrypted_message, message}, socket) do
    push(socket, "encrypted_message", %{
      sender_id: message.sender_id,
      ciphertext: Base.encode64(message.ciphertext),
      iv: Base.encode64(message.iv),
      message_number: message.message_number,
      sent_at: message.sent_at
    })
    {:noreply, socket}
  end
  
  defp event_type_to_channel(:room_update), do: "room_update"
  defp event_type_to_channel(:message), do: "message"
  defp event_type_to_channel(:combat_update), do: "combat_update"
  defp event_type_to_channel(:inventory_update), do: "inventory_update"
  defp event_type_to_channel(:stats_update), do: "stats_update"
  defp event_type_to_channel(:wallet_update), do: "wallet_update"
  defp event_type_to_channel(:quest_update), do: "quest_update"
  defp event_type_to_channel(_), do: "game_event"
  
  defp format_event(event, :terminal) do
    # Terminal gets ANSI-formatted text
    %{
      text: Loka.Formatter.to_ansi(event),
      raw: event.payload
    }
  end
  
  defp format_event(event, _client_type) do
    # Structured JSON for native/web clients
    event.payload
  end
end
```

### 13.3 Terminal/CLI Client Support

For users who want the classic MUD experience:

```elixir
defmodule Loka.Telnet.Server do
  @moduledoc """
  Optional TCP server for traditional telnet/terminal clients.
  Bridges raw TCP connections to the Phoenix Channels protocol.
  """
  
  use GenServer
  require Logger
  
  @default_port 4000
  
  def start_link(opts) do
    port = Keyword.get(opts, :port, @default_port)
    GenServer.start_link(__MODULE__, port, name: __MODULE__)
  end
  
  @impl true
  def init(port) do
    {:ok, listen_socket} = :gen_tcp.listen(port, [
      :binary,
      packet: :line,
      active: false,
      reuseaddr: true
    ])
    
    Logger.info("Telnet server listening on port #{port}")
    
    # Accept connections in a separate process
    spawn_link(fn -> accept_loop(listen_socket) end)
    
    {:ok, %{listen_socket: listen_socket, port: port}}
  end
  
  defp accept_loop(listen_socket) do
    case :gen_tcp.accept(listen_socket) do
      {:ok, client_socket} ->
        {:ok, pid} = Loka.Telnet.Session.start_link(client_socket)
        :gen_tcp.controlling_process(client_socket, pid)
        accept_loop(listen_socket)
        
      {:error, reason} ->
        Logger.error("Accept error: #{inspect(reason)}")
        accept_loop(listen_socket)
    end
  end
end

defmodule Loka.Telnet.Session do
  @moduledoc """
  Handles a single telnet client session.
  Translates between raw text I/O and the game engine.
  """
  
  use GenServer
  require Logger
  
  defstruct [:socket, :player_id, :game_session, :buffer, :state]
  
  def start_link(socket) do
    GenServer.start_link(__MODULE__, socket)
  end
  
  @impl true
  def init(socket) do
    :inet.setopts(socket, active: true)
    
    # Send welcome banner
    send_text(socket, welcome_banner())
    send_text(socket, "\r\nLogin: ")
    
    {:ok, %__MODULE__{
      socket: socket,
      buffer: "",
      state: :login
    }}
  end
  
  @impl true
  def handle_info({:tcp, socket, data}, %{state: :login} = state) do
    username = String.trim(data)
    send_text(socket, "Password: ")
    # Note: In production, implement IAC WILL ECHO for hidden password
    {:noreply, %{state | state: {:password, username}}}
  end
  
  @impl true
  def handle_info({:tcp, socket, data}, %{state: {:password, username}} = state) do
    password = String.trim(data)
    
    case Loka.Auth.authenticate(username, password) do
      {:ok, player_id, token} ->
        # Join the game
        {:ok, game_session} = Loka.Session.join(player_id, "default")
        
        # Subscribe to events
        Phoenix.PubSub.subscribe(Loka.PubSub, "player:#{player_id}")
        
        # Send initial room description
        game_state = Loka.Session.get_state(game_session)
        send_text(socket, "\r\n" <> format_room_text(game_state.room))
        send_prompt(socket, game_state.player)
        
        {:noreply, %{state | 
          player_id: player_id,
          game_session: game_session,
          state: :playing
        }}
        
      {:error, _reason} ->
        send_text(socket, "\r\nInvalid credentials.\r\nLogin: ")
        {:noreply, %{state | state: :login}}
    end
  end
  
  @impl true
  def handle_info({:tcp, socket, data}, %{state: :playing} = state) do
    input = String.trim(data)
    
    unless input == "" do
      Loka.Session.process_command(state.game_session, input)
    end
    
    {:noreply, state}
  end
  
  @impl true
  def handle_info({:tcp_closed, _socket}, state) do
    Logger.info("Telnet client disconnected")
    {:stop, :normal, state}
  end
  
  # Handle game events
  @impl true
  def handle_info({:game_event, event}, state) do
    text = format_event_text(event)
    send_text(state.socket, "\r\n" <> text)
    
    game_state = Loka.Session.get_state(state.game_session)
    send_prompt(state.socket, game_state.player)
    
    {:noreply, state}
  end
  
  # Handle encrypted messages (display notification only)
  @impl true
  def handle_info({:encrypted_message, message}, state) do
    # Terminal can't decrypt E2E messages - notify user
    sender = Loka.Entities.get_name(message.sender_id)
    send_text(state.socket, "\r\n[Encrypted message from #{sender} - view in app]\r\n")
    {:noreply, state}
  end
  
  defp send_text(socket, text) do
    :gen_tcp.send(socket, text)
  end
  
  defp send_prompt(socket, player) do
    health = player.components.combatant.health
    mana = player.components.combatant.mana
    prompt = "\r\n<#{health.current}/#{health.max}hp #{mana.current}/#{mana.max}mp> "
    send_text(socket, prompt)
  end
  
  defp format_room_text(room) do
    exits = room.exits |> Map.keys() |> Enum.join(", ")
    entities = room.contents
    |> Enum.map(&"  #{&1.name}")
    |> Enum.join("\r\n")
    
    """
    \e[1;36m#{room.name}\e[0m
    #{room.description}
    
    \e[1;33mExits:\e[0m #{exits}
    #{if entities != "", do: "\r\n\e[1;32mYou see:\e[0m\r\n#{entities}", else: ""}
    """
  end
  
  defp format_event_text(%{type: :message, payload: %{text: text}}), do: text
  defp format_event_text(%{type: :room_update, payload: room}), do: format_room_text(room)
  defp format_event_text(%{type: :combat_update, payload: p}), do: p.message
  defp format_event_text(event), do: inspect(event.payload)
  
  defp welcome_banner do
    """
    \e[1;35m
    ███████╗██╗  ██╗███╗   ███╗██╗   ██╗██████╗ 
    ██╔════╝╚██╗██╔╝████╗ ████║██║   ██║██╔══██╗
    █████╗   ╚███╔╝ ██╔████╔██║██║   ██║██║  ██║
    ██╔══╝   ██╔██╗ ██║╚██╔╝██║██║   ██║██║  ██║
    ███████╗██╔╝ ██╗██║ ╚═╝ ██║╚██████╔╝██████╔╝
    ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝ 
    \e[0m
    Welcome to Loka - A Modern Text Adventure
    
    """
  end
end
```

### 13.4 Command Parser Architecture

The command parser is text-first, making it work identically across all client types:

```elixir
defmodule Loka.Command.Parser do
  @moduledoc """
  Text-based command parser. The touch UI sends pre-formatted text commands,
  terminal sends raw input - both go through the same parser.
  
  This ensures consistent behavior across all client types.
  """
  
  @doc """
  Parse raw input into a command and arguments.
  
  Examples:
    "look"           -> {:ok, {LookCommand, ""}}
    "l sword"        -> {:ok, {LookCommand, "sword"}}
    "go north"       -> {:ok, {MoveCommand, "north"}}
    "n"              -> {:ok, {MoveCommand, "north"}}
    "say hello all"  -> {:ok, {SayCommand, "hello all"}}
    "'hello all"     -> {:ok, {SayCommand, "hello all"}}
  """
  def parse(input, command_sets) do
    input = String.trim(input)
    
    # Handle special character shortcuts
    case input do
      "'" <> rest -> {:ok, {Loka.Commands.Say, String.trim(rest)}}
      "\"" <> rest -> {:ok, {Loka.Commands.Say, String.trim(rest)}}
      ":" <> rest -> {:ok, {Loka.Commands.Emote, String.trim(rest)}}
      ";" <> rest -> {:ok, {Loka.Commands.SemiEmote, String.trim(rest)}}
      _ -> parse_standard(input, command_sets)
    end
  end
  
  defp parse_standard(input, command_sets) do
    case String.split(input, ~r/\s+/, parts: 2) do
      [cmd] -> find_command(cmd, "", command_sets)
      [cmd, args] -> find_command(cmd, args, command_sets)
      [] -> {:error, "No command given."}
    end
  end
  
  defp find_command(cmd, args, command_sets) do
    cmd_lower = String.downcase(cmd)
    
    # Check direction shortcuts first
    case direction_shortcut(cmd_lower) do
      {:ok, direction} ->
        {:ok, {Loka.Commands.Move, direction}}
      
      :not_direction ->
        # Search through command sets
        find_in_command_sets(cmd_lower, args, command_sets)
    end
  end
  
  defp direction_shortcut("n"), do: {:ok, "north"}
  defp direction_shortcut("s"), do: {:ok, "south"}
  defp direction_shortcut("e"), do: {:ok, "east"}
  defp direction_shortcut("w"), do: {:ok, "west"}
  defp direction_shortcut("u"), do: {:ok, "up"}
  defp direction_shortcut("d"), do: {:ok, "down"}
  defp direction_shortcut("ne"), do: {:ok, "northeast"}
  defp direction_shortcut("nw"), do: {:ok, "northwest"}
  defp direction_shortcut("se"), do: {:ok, "southeast"}
  defp direction_shortcut("sw"), do: {:ok, "southwest"}
  defp direction_shortcut("north"), do: {:ok, "north"}
  defp direction_shortcut("south"), do: {:ok, "south"}
  defp direction_shortcut("east"), do: {:ok, "east"}
  defp direction_shortcut("west"), do: {:ok, "west"}
  defp direction_shortcut("up"), do: {:ok, "up"}
  defp direction_shortcut("down"), do: {:ok, "down"}
  defp direction_shortcut(_), do: :not_direction
  
  defp find_in_command_sets(cmd, args, command_sets) do
    # Flatten all commands from all active command sets
    all_commands = Enum.flat_map(command_sets, & &1.commands())
    
    # Find matching command (supports prefix matching)
    case Enum.find(all_commands, &command_matches?(&1, cmd)) do
      nil -> {:error, "Unknown command: #{cmd}. Type 'help' for a list of commands."}
      command_module -> {:ok, {command_module, args}}
    end
  end
  
  defp command_matches?(command_module, input) do
    key = command_module.key()
    aliases = command_module.aliases()
    
    # Exact match on key or aliases
    input == key or input in aliases or
    # Prefix match on key (e.g., "inv" matches "inventory")
    String.starts_with?(key, input)
  end
end
```

### 13.5 Client-Specific Formatting

```elixir
defmodule Loka.Formatter do
  @moduledoc """
  Formats game output for different client types.
  """
  
  @doc "Format for terminal/telnet clients with ANSI colors"
  def to_ansi(%{type: :room} = room) do
    """
    \e[1;36m#{room.name}\e[0m
    #{room.description}
    
    \e[1;33m[Exits: #{format_exits(room.exits)}]\e[0m
    #{format_entities_ansi(room.contents)}
    """
  end
  
  def to_ansi(%{type: :message, text: text, style: :say, speaker: speaker}) do
    "\e[1;33m#{speaker}\e[0m says, \"#{text}\""
  end
  
  def to_ansi(%{type: :message, text: text, style: :combat}) do
    "\e[1;31m#{text}\e[0m"
  end
  
  def to_ansi(%{type: :message, text: text}) do
    text
  end
  
  @doc "Format for plain text (no colors)"
  def to_plain_text(%{type: :room} = room) do
    """
    #{room.name}
    #{String.duplicate("-", String.length(room.name))}
    #{room.description}
    
    [Exits: #{format_exits(room.exits)}]
    #{format_entities_plain(room.contents)}
    """
  end
  
  @doc "Format as structured data for native clients"
  def to_structured(%{type: :room} = room) do
    %{
      name: room.name,
      description: room.description,
      exits: room.exits,
      entities: Enum.map(room.contents, &entity_summary/1),
      ambient: room.ambient
    }
  end
  
  defp format_exits(exits) do
    exits
    |> Map.keys()
    |> Enum.map(&to_string/1)
    |> Enum.join(", ")
  end
  
  defp format_entities_ansi(entities) when entities == [], do: ""
  defp format_entities_ansi(entities) do
    items = Enum.map(entities, fn e -> "  \e[0;32m#{e.name}\e[0m" end)
    "\e[1;32mYou see:\e[0m\n" <> Enum.join(items, "\n")
  end
  
  defp format_entities_plain(entities) when entities == [], do: ""
  defp format_entities_plain(entities) do
    items = Enum.map(entities, fn e -> "  #{e.name}" end)
    "You see:\n" <> Enum.join(items, "\n")
  end
  
  defp entity_summary(entity) do
    %{
      id: entity.id,
      key: entity.key,
      name: entity.name,
      type: entity.type,
      short_desc: entity.short_description
    }
  end
end
```

---

## Part 13: In-App Purchase & Currency System

### 14.1 Unified Currency Architecture

```elixir
defmodule Loka.Economy.Wallet do
  @moduledoc """
  Manages player currency across all platforms.
  Gems purchased on iOS/Android/Web are unified.
  """
  
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query
  
  @primary_key {:id, :binary_id, autogenerate: true}
  
  schema "wallets" do
    field :player_id, :binary_id
    
    # Premium currency (purchased)
    field :gems, :integer, default: 0
    
    # Earned in-game currencies
    field :gold, :integer, default: 0
    field :silver, :integer, default: 0
    field :copper, :integer, default: 0
    
    # Subscription status
    field :subscription_tier, Ecto.Enum, values: [:none, :basic, :premium, :ultimate]
    field :subscription_expires_at, :utc_datetime
    field :subscription_platform, :string  # "apple", "google", "stripe"
    
    timestamps()
  end
  
  def changeset(wallet, attrs) do
    wallet
    |> cast(attrs, [:gems, :gold, :silver, :copper, :subscription_tier, :subscription_expires_at])
    |> validate_number(:gems, greater_than_or_equal_to: 0)
    |> validate_number(:gold, greater_than_or_equal_to: 0)
  end
  
  @doc """
  Credit premium currency (gems) to a player.
  Used after successful IAP verification.
  """
  def credit_gems(player_id, amount, source, transaction_id) do
    Loka.Repo.transaction(fn ->
      wallet = get_or_create_wallet(player_id)
      
      # Update balance
      {:ok, updated_wallet} = wallet
      |> changeset(%{gems: wallet.gems + amount})
      |> Loka.Repo.update()
      
      # Log transaction
      create_transaction(%{
        player_id: player_id,
        currency: :gems,
        amount: amount,
        type: :credit,
        source: source,
        external_transaction_id: transaction_id
      })
      
      # Notify connected clients
      broadcast_wallet_update(player_id, updated_wallet)
      
      updated_wallet
    end)
  end
  
  @doc """
  Spend premium currency.
  """
  def spend_gems(player_id, amount, reason) do
    Loka.Repo.transaction(fn ->
      wallet = get_wallet!(player_id)
      
      if wallet.gems >= amount do
        {:ok, updated_wallet} = wallet
        |> changeset(%{gems: wallet.gems - amount})
        |> Loka.Repo.update()
        
        create_transaction(%{
          player_id: player_id,
          currency: :gems,
          amount: -amount,
          type: :debit,
          source: reason
        })
        
        broadcast_wallet_update(player_id, updated_wallet)
        
        {:ok, updated_wallet}
      else
        {:error, :insufficient_funds}
      end
    end)
  end
  
  @doc """
  Check if subscription is active.
  """
  def subscription_active?(player_id) do
    wallet = get_wallet(player_id)
    
    wallet && 
    wallet.subscription_tier != :none &&
    wallet.subscription_expires_at &&
    DateTime.compare(wallet.subscription_expires_at, DateTime.utc_now()) == :gt
  end
  
  defp broadcast_wallet_update(player_id, wallet) do
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "player:#{player_id}",
      {:wallet_update, %{
        gems: wallet.gems,
        gold: wallet.gold,
        subscription_tier: wallet.subscription_tier,
        subscription_active: subscription_active?(player_id)
      }}
    )
  end
  
  defp get_or_create_wallet(player_id) do
    case Loka.Repo.get_by(__MODULE__, player_id: player_id) do
      nil ->
        %__MODULE__{}
        |> changeset(%{player_id: player_id})
        |> Loka.Repo.insert!()
      
      wallet ->
        wallet
    end
  end
end
```

### 14.2 Store Product Definitions

```elixir
defmodule Loka.Store.Products do
  @moduledoc """
  Product catalog synchronized across all platforms.
  Product IDs must match App Store / Play Store / Stripe configurations.
  """
  
  @products %{
    # Gem Packs
    "gems_100" => %{
      name: "100 Gems",
      gems: 100,
      price_usd: 0.99,
      type: :consumable,
      apple_product_id: "com.loka.gems100",
      google_product_id: "gems_100",
      stripe_price_id: "price_gems100_xxx"
    },
    "gems_500" => %{
      name: "500 Gems",
      gems: 500,
      price_usd: 4.99,
      bonus_gems: 50,  # 10% bonus
      type: :consumable,
      apple_product_id: "com.loka.gems500",
      google_product_id: "gems_500",
      stripe_price_id: "price_gems500_xxx"
    },
    "gems_1200" => %{
      name: "1,200 Gems",
      gems: 1200,
      price_usd: 9.99,
      bonus_gems: 200,  # ~17% bonus
      type: :consumable,
      apple_product_id: "com.loka.gems1200",
      google_product_id: "gems_1200",
      stripe_price_id: "price_gems1200_xxx"
    },
    "gems_2500" => %{
      name: "2,500 Gems",
      gems: 2500,
      price_usd: 19.99,
      bonus_gems: 500,  # 20% bonus
      type: :consumable,
      apple_product_id: "com.loka.gems2500",
      google_product_id: "gems_2500",
      stripe_price_id: "price_gems2500_xxx"
    },
    "gems_6500" => %{
      name: "6,500 Gems",
      gems: 6500,
      price_usd: 49.99,
      bonus_gems: 1500,  # ~23% bonus
      type: :consumable,
      apple_product_id: "com.loka.gems6500",
      google_product_id: "gems_6500",
      stripe_price_id: "price_gems6500_xxx"
    },
    
    # Subscriptions
    "sub_basic_monthly" => %{
      name: "Basic Membership",
      tier: :basic,
      period: :monthly,
      price_usd: 4.99,
      benefits: [
        "20% XP bonus",
        "Extra character slot",
        "Exclusive chat colors"
      ],
      type: :subscription,
      apple_product_id: "com.loka.sub.basic.monthly",
      google_product_id: "sub_basic_monthly",
      stripe_price_id: "price_sub_basic_monthly_xxx"
    },
    "sub_premium_monthly" => %{
      name: "Premium Membership",
      tier: :premium,
      period: :monthly,
      price_usd: 9.99,
      benefits: [
        "50% XP bonus",
        "3 extra character slots",
        "Monthly gem allowance (500)",
        "Exclusive areas access",
        "Priority queue"
      ],
      type: :subscription,
      apple_product_id: "com.loka.sub.premium.monthly",
      google_product_id: "sub_premium_monthly",
      stripe_price_id: "price_sub_premium_monthly_xxx"
    }
  }
  
  def get_product(product_id), do: Map.get(@products, product_id)
  
  def list_products(type \\ nil) do
    @products
    |> Enum.filter(fn {_id, p} -> is_nil(type) or p.type == type end)
    |> Enum.into(%{})
  end
  
  def total_gems(product) do
    product.gems + Map.get(product, :bonus_gems, 0)
  end
end
```

### 14.3 Apple App Store Verification

```elixir
defmodule Loka.Store.Apple do
  @moduledoc """
  Apple App Store receipt verification.
  Uses App Store Server API (StoreKit 2).
  """
  
  require Logger
  
  @app_store_connect_api "https://api.storekit.itunes.apple.com"
  @sandbox_api "https://api.storekit-sandbox.itunes.apple.com"
  
  @doc """
  Verify a transaction from StoreKit 2.
  """
  def verify_transaction(transaction_id, environment \\ :production) do
    base_url = if environment == :sandbox, do: @sandbox_api, else: @app_store_connect_api
    url = "#{base_url}/inApps/v1/transactions/#{transaction_id}"
    
    headers = [
      {"Authorization", "Bearer #{generate_jwt()}"},
      {"Content-Type", "application/json"}
    ]
    
    case HTTPoison.get(url, headers) do
      {:ok, %{status_code: 200, body: body}} ->
        response = Jason.decode!(body)
        {:ok, parse_transaction(response)}
        
      {:ok, %{status_code: 404}} ->
        {:error, :transaction_not_found}
        
      {:ok, %{status_code: status, body: body}} ->
        Logger.error("Apple verification failed: #{status} - #{body}")
        {:error, :verification_failed}
        
      {:error, reason} ->
        Logger.error("Apple API error: #{inspect(reason)}")
        {:error, :api_error}
    end
  end
  
  @doc """
  Verify a subscription status.
  """
  def get_subscription_status(original_transaction_id) do
    url = "#{@app_store_connect_api}/inApps/v1/subscriptions/#{original_transaction_id}"
    
    headers = [
      {"Authorization", "Bearer #{generate_jwt()}"},
      {"Content-Type", "application/json"}
    ]
    
    case HTTPoison.get(url, headers) do
      {:ok, %{status_code: 200, body: body}} ->
        response = Jason.decode!(body)
        {:ok, parse_subscription_status(response)}
        
      _ ->
        {:error, :verification_failed}
    end
  end
  
  defp generate_jwt do
    # Generate ES256 signed JWT for App Store Connect API
    signer = Joken.Signer.create("ES256", %{
      "pem" => get_private_key()
    })
    
    claims = %{
      "iss" => app_store_issuer_id(),
      "aud" => "appstoreconnect-v1",
      "iat" => System.system_time(:second),
      "exp" => System.system_time(:second) + 3600,
      "bid" => bundle_id()
    }
    
    {:ok, token, _claims} = Joken.encode_and_sign(claims, signer)
    token
  end
  
  defp parse_transaction(%{"signedTransactionInfo" => signed_info}) do
    # Decode the JWS (signed transaction)
    {:ok, claims} = decode_signed_data(signed_info)
    
    %{
      transaction_id: claims["transactionId"],
      original_transaction_id: claims["originalTransactionId"],
      product_id: claims["productId"],
      purchase_date: DateTime.from_unix!(claims["purchaseDate"] / 1000),
      type: claims["type"],
      environment: claims["environment"]
    }
  end
  
  defp parse_subscription_status(%{"data" => data}) do
    latest = List.first(data)
    last_transaction = latest["lastTransactions"] |> List.first()
    
    %{
      status: last_transaction["status"],
      expires_date: parse_date(last_transaction["expiresDate"]),
      auto_renew: last_transaction["autoRenewStatus"] == 1,
      product_id: last_transaction["productId"]
    }
  end
  
  defp get_private_key do
    Application.get_env(:loka, :apple_private_key)
  end
  
  defp app_store_issuer_id do
    Application.get_env(:loka, :apple_issuer_id)
  end
  
  defp bundle_id do
    Application.get_env(:loka, :apple_bundle_id)
  end
end
```

### 14.4 Google Play Billing Verification

```elixir
defmodule Loka.Store.Google do
  @moduledoc """
  Google Play billing verification using Google Play Developer API v3.
  """
  
  require Logger
  
  @play_api "https://androidpublisher.googleapis.com/androidpublisher/v3"
  
  @doc """
  Verify a one-time purchase.
  """
  def verify_purchase(product_id, purchase_token) do
    package_name = package_name()
    url = "#{@play_api}/applications/#{package_name}/purchases/products/#{product_id}/tokens/#{purchase_token}"
    
    headers = [
      {"Authorization", "Bearer #{get_access_token()}"},
      {"Content-Type", "application/json"}
    ]
    
    case HTTPoison.get(url, headers) do
      {:ok, %{status_code: 200, body: body}} ->
        purchase = Jason.decode!(body)
        
        case purchase["purchaseState"] do
          0 ->  # Purchased
            {:ok, %{
              order_id: purchase["orderId"],
              purchase_time: DateTime.from_unix!(purchase["purchaseTimeMillis"] |> String.to_integer() |> div(1000)),
              product_id: product_id,
              acknowledged: purchase["acknowledgementState"] == 1
            }}
            
          1 ->  # Canceled
            {:error, :purchase_canceled}
            
          2 ->  # Pending
            {:error, :purchase_pending}
        end
        
      {:ok, %{status_code: 404}} ->
        {:error, :purchase_not_found}
        
      {:ok, %{status_code: status, body: body}} ->
        Logger.error("Google verification failed: #{status} - #{body}")
        {:error, :verification_failed}
        
      {:error, reason} ->
        Logger.error("Google API error: #{inspect(reason)}")
        {:error, :api_error}
    end
  end
  
  @doc """
  Acknowledge a purchase (required to prevent auto-refund).
  """
  def acknowledge_purchase(product_id, purchase_token) do
    package_name = package_name()
    url = "#{@play_api}/applications/#{package_name}/purchases/products/#{product_id}/tokens/#{purchase_token}:acknowledge"
    
    headers = [
      {"Authorization", "Bearer #{get_access_token()}"},
      {"Content-Type", "application/json"}
    ]
    
    case HTTPoison.post(url, "", headers) do
      {:ok, %{status_code: 204}} -> :ok
      {:ok, %{status_code: 200}} -> :ok
      _ -> {:error, :acknowledge_failed}
    end
  end
  
  @doc """
  Verify a subscription purchase.
  """
  def verify_subscription(subscription_id, purchase_token) do
    package_name = package_name()
    url = "#{@play_api}/applications/#{package_name}/purchases/subscriptions/#{subscription_id}/tokens/#{purchase_token}"
    
    headers = [
      {"Authorization", "Bearer #{get_access_token()}"},
      {"Content-Type", "application/json"}
    ]
    
    case HTTPoison.get(url, headers) do
      {:ok, %{status_code: 200, body: body}} ->
        sub = Jason.decode!(body)
        
        {:ok, %{
          order_id: sub["orderId"],
          start_time: parse_millis(sub["startTimeMillis"]),
          expiry_time: parse_millis(sub["expiryTimeMillis"]),
          auto_renewing: sub["autoRenewing"],
          price_currency: sub["priceCurrencyCode"],
          price_amount: sub["priceAmountMicros"] / 1_000_000,
          cancel_reason: sub["cancelReason"],
          payment_state: sub["paymentState"]
        }}
        
      _ ->
        {:error, :verification_failed}
    end
  end
  
  defp get_access_token do
    # Use Google Service Account for server-to-server auth
    {:ok, %{token: token}} = Goth.Token.for_scope(
      "https://www.googleapis.com/auth/androidpublisher"
    )
    token
  end
  
  defp package_name do
    Application.get_env(:loka, :google_package_name)
  end
  
  defp parse_millis(nil), do: nil
  defp parse_millis(millis) when is_binary(millis) do
    millis |> String.to_integer() |> div(1000) |> DateTime.from_unix!()
  end
end
```

### 14.5 Stripe Web Payments

```elixir
defmodule Loka.Store.Stripe do
  @moduledoc """
  Stripe integration for web-based purchases.
  Allows players to buy from website (not through app stores).
  """
  
  require Logger
  
  @doc """
  Create a Stripe Checkout session for a product.
  """
  def create_checkout_session(player_id, product_id, success_url, cancel_url) do
    product = Loka.Store.Products.get_product(product_id)
    
    params = %{
      payment_method_types: ["card"],
      line_items: [
        %{
          price: product.stripe_price_id,
          quantity: 1
        }
      ],
      mode: payment_mode(product.type),
      success_url: success_url <> "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancel_url,
      client_reference_id: "#{player_id}:#{product_id}",
      metadata: %{
        player_id: player_id,
        product_id: product_id,
        product_type: to_string(product.type)
      }
    }
    
    # Add subscription-specific options
    params = if product.type == :subscription do
      Map.put(params, :subscription_data, %{
        metadata: %{player_id: player_id}
      })
    else
      params
    end
    
    case Stripe.Checkout.Session.create(params) do
      {:ok, session} ->
        {:ok, %{
          session_id: session.id,
          url: session.url
        }}
        
      {:error, %Stripe.Error{} = error} ->
        Logger.error("Stripe session creation failed: #{inspect(error)}")
        {:error, :checkout_failed}
    end
  end
  
  @doc """
  Handle Stripe webhook events.
  """
  def handle_webhook(payload, signature) do
    webhook_secret = Application.get_env(:loka, :stripe_webhook_secret)
    
    case Stripe.Webhook.construct_event(payload, signature, webhook_secret) do
      {:ok, event} ->
        process_event(event)
        
      {:error, reason} ->
        Logger.error("Stripe webhook verification failed: #{inspect(reason)}")
        {:error, :invalid_signature}
    end
  end
  
  defp process_event(%{type: "checkout.session.completed"} = event) do
    session = event.data.object
    [player_id, product_id] = String.split(session.client_reference_id, ":")
    
    product = Loka.Store.Products.get_product(product_id)
    
    case product.type do
      :consumable ->
        # Credit gems
        total_gems = Loka.Store.Products.total_gems(product)
        Loka.Economy.Wallet.credit_gems(
          player_id,
          total_gems,
          "stripe:#{session.payment_intent}",
          session.id
        )
        
      :subscription ->
        # Activate subscription
        Loka.Economy.Wallet.activate_subscription(
          player_id,
          product.tier,
          session.subscription,
          "stripe"
        )
    end
    
    :ok
  end
  
  defp process_event(%{type: "customer.subscription.updated"} = event) do
    subscription = event.data.object
    player_id = subscription.metadata["player_id"]
    
    if subscription.status == "active" do
      Loka.Economy.Wallet.update_subscription_expiry(
        player_id,
        DateTime.from_unix!(subscription.current_period_end)
      )
    end
    
    :ok
  end
  
  defp process_event(%{type: "customer.subscription.deleted"} = event) do
    subscription = event.data.object
    player_id = subscription.metadata["player_id"]
    
    Loka.Economy.Wallet.cancel_subscription(player_id)
    :ok
  end
  
  defp process_event(_event), do: :ok
  
  defp payment_mode(:subscription), do: "subscription"
  defp payment_mode(_), do: "payment"
end
```

### 14.6 REST API for IAP

```elixir
defmodule LokaWeb.API.StoreController do
  use LokaWeb, :controller
  
  @doc """
  List available products.
  """
  def products(conn, _params) do
    products = Loka.Store.Products.list_products()
    json(conn, %{products: products})
  end
  
  @doc """
  Verify Apple App Store purchase.
  """
  def verify_apple(conn, %{"transaction_id" => transaction_id}) do
    player_id = conn.assigns.current_player.id
    
    case Loka.Store.Apple.verify_transaction(transaction_id) do
      {:ok, transaction} ->
        product = Loka.Store.Products.get_product(transaction.product_id)
        
        case product.type do
          :consumable ->
            total_gems = Loka.Store.Products.total_gems(product)
            {:ok, wallet} = Loka.Economy.Wallet.credit_gems(
              player_id,
              total_gems,
              "apple:#{transaction_id}",
              transaction_id
            )
            
            json(conn, %{
              success: true,
              gems_added: total_gems,
              new_balance: wallet.gems
            })
            
          :subscription ->
            {:ok, _wallet} = Loka.Economy.Wallet.activate_subscription(
              player_id,
              product.tier,
              transaction.original_transaction_id,
              "apple"
            )
            
            json(conn, %{success: true, subscription: product.tier})
        end
        
      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: reason})
    end
  end
  
  @doc """
  Verify Google Play purchase.
  """
  def verify_google(conn, %{"product_id" => product_id, "purchase_token" => token}) do
    player_id = conn.assigns.current_player.id
    product = Loka.Store.Products.get_product(product_id)
    
    verify_fn = case product.type do
      :subscription -> &Loka.Store.Google.verify_subscription/2
      _ -> &Loka.Store.Google.verify_purchase/2
    end
    
    case verify_fn.(product.google_product_id, token) do
      {:ok, purchase} ->
        # Acknowledge the purchase
        :ok = Loka.Store.Google.acknowledge_purchase(product.google_product_id, token)
        
        case product.type do
          :consumable ->
            total_gems = Loka.Store.Products.total_gems(product)
            {:ok, wallet} = Loka.Economy.Wallet.credit_gems(
              player_id,
              total_gems,
              "google:#{purchase.order_id}",
              purchase.order_id
            )
            
            json(conn, %{
              success: true,
              gems_added: total_gems,
              new_balance: wallet.gems
            })
            
          :subscription ->
            {:ok, _wallet} = Loka.Economy.Wallet.activate_subscription(
              player_id,
              product.tier,
              purchase.order_id,
              "google",
              purchase.expiry_time
            )
            
            json(conn, %{success: true, subscription: product.tier})
        end
        
      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: reason})
    end
  end
  
  @doc """
  Create Stripe checkout session for web purchases.
  """
  def create_checkout(conn, %{"product_id" => product_id}) do
    player_id = conn.assigns.current_player.id
    
    success_url = LokaWeb.Router.Helpers.store_url(conn, :success)
    cancel_url = LokaWeb.Router.Helpers.store_url(conn, :cancel)
    
    case Loka.Store.Stripe.create_checkout_session(player_id, product_id, success_url, cancel_url) do
      {:ok, session} ->
        json(conn, %{checkout_url: session.url})
        
      {:error, _reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to create checkout session"})
    end
  end
  
  @doc """
  Handle Stripe webhooks.
  """
  def stripe_webhook(conn, _params) do
    payload = conn.assigns.raw_body
    signature = get_req_header(conn, "stripe-signature") |> List.first()
    
    case Loka.Store.Stripe.handle_webhook(payload, signature) do
      :ok ->
        json(conn, %{received: true})
        
      {:error, _reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Webhook processing failed"})
    end
  end
end
```

### 14.7 Transaction Logging & Audit Trail

```elixir
defmodule Loka.Store.Transaction do
  @moduledoc """
  Transaction logging for audit and support.
  Every currency change is logged.
  """
  
  use Ecto.Schema
  
  @primary_key {:id, :binary_id, autogenerate: true}
  
  schema "transactions" do
    field :player_id, :binary_id
    field :currency, Ecto.Enum, values: [:gems, :gold, :silver, :copper]
    field :amount, :integer  # Positive for credit, negative for debit
    field :type, Ecto.Enum, values: [:credit, :debit]
    field :source, :string  # "apple:txn123", "stripe:pi_xxx", "quest:quest_id"
    field :external_transaction_id, :string
    field :balance_before, :integer
    field :balance_after, :integer
    field :metadata, :map
    
    timestamps()
  end
  
  def create(attrs) do
    %__MODULE__{}
    |> Ecto.Changeset.cast(attrs, [
      :player_id, :currency, :amount, :type, :source,
      :external_transaction_id, :balance_before, :balance_after, :metadata
    ])
    |> Loka.Repo.insert()
  end
  
  @doc """
  Get transaction history for a player.
  """
  def history(player_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    currency = Keyword.get(opts, :currency)
    
    query = from t in __MODULE__,
      where: t.player_id == ^player_id,
      order_by: [desc: t.inserted_at],
      limit: ^limit
    
    query = if currency do
      from t in query, where: t.currency == ^currency
    else
      query
    end
    
    Loka.Repo.all(query)
  end
end
```

---

## Part 14: LiveView Web Interfaces

### 15.1 Client Routing Strategy

```elixir
defmodule LokaWeb.Router do
  use LokaWeb, :router
  
  # ============================================================
  # PUBLIC / MARKETING
  # ============================================================
  
  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, {LokaWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end
  
  scope "/", LokaWeb do
    pipe_through :browser
    
    get "/", PageController, :home
    get "/about", PageController, :about
    get "/download", PageController, :download
  end
  
  # ============================================================
  # PLAYER WEB CLIENT (LiveView)
  # ============================================================
  
  pipeline :player do
    plug :browser
    plug LokaWeb.Auth.PlayerAuthPlug
    plug :put_root_layout, {LokaWeb.Layouts, :game}
  end
  
  scope "/play", LokaWeb do
    pipe_through :player
    
    live_session :game, on_mount: [LokaWeb.Auth.LiveAuth] do
      live "/", GameLive.Lobby, :index
      live "/game/:game_id", GameLive.Play, :play
      live "/character/new", CharacterLive.New, :new
      live "/character/:id", CharacterLive.Show, :show
      live "/store", StoreLive.Index, :index
      live "/store/success", StoreLive.Success, :success
      live "/settings", SettingsLive.Index, :index
    end
  end
  
  # ============================================================
  # CREATOR TOOLS (LiveView)
  # ============================================================
  
  pipeline :creator do
    plug :browser
    plug LokaWeb.Auth.CreatorAuthPlug
    plug :put_root_layout, {LokaWeb.Layouts, :creator}
  end
  
  scope "/create", LokaWeb.Creator do
    pipe_through :creator
    
    live_session :creator, on_mount: [LokaWeb.Auth.CreatorLiveAuth] do
      live "/", DashboardLive, :index
      live "/worlds", WorldsLive.Index, :index
      live "/worlds/new", WorldsLive.New, :new
      live "/worlds/:id/edit", WorldsLive.Edit, :edit
      
      # World Builder
      live "/worlds/:world_id/builder", BuilderLive.Index, :index
      live "/worlds/:world_id/rooms", BuilderLive.Rooms, :rooms
      live "/worlds/:world_id/rooms/:room_id", BuilderLive.RoomEdit, :edit
      live "/worlds/:world_id/entities", BuilderLive.Entities, :entities
      live "/worlds/:world_id/scripts", BuilderLive.Scripts, :scripts
      live "/worlds/:world_id/scripts/:script_id", BuilderLive.ScriptEdit, :edit
      live "/worlds/:world_id/test", BuilderLive.Test, :test
      
      # Quest Designer
      live "/worlds/:world_id/quests", QuestLive.Index, :index
      live "/worlds/:world_id/quests/new", QuestLive.New, :new
      live "/worlds/:world_id/quests/:quest_id", QuestLive.Edit, :edit
      
      # Dialogue Editor
      live "/worlds/:world_id/dialogues", DialogueLive.Index, :index
      live "/worlds/:world_id/dialogues/:dialogue_id", DialogueLive.Edit, :edit
      
      # Analytics
      live "/analytics", AnalyticsLive.Index, :index
      live "/analytics/players", AnalyticsLive.Players, :players
      live "/analytics/economy", AnalyticsLive.Economy, :economy
    end
  end
  
  # ============================================================
  # ADMIN DASHBOARD (LiveView)
  # ============================================================
  
  pipeline :admin do
    plug :browser
    plug LokaWeb.Auth.AdminAuthPlug
    plug :put_root_layout, {LokaWeb.Layouts, :admin}
  end
  
  scope "/admin", LokaWeb.Admin do
    pipe_through :admin
    
    live_session :admin, on_mount: [LokaWeb.Auth.AdminLiveAuth] do
      live "/", DashboardLive, :index
      
      # User Management
      live "/users", UsersLive.Index, :index
      live "/users/:id", UsersLive.Show, :show
      
      # System Health
      live "/system", SystemLive.Index, :index
      live "/system/processes", SystemLive.Processes, :processes
      live "/system/metrics", SystemLive.Metrics, :metrics
      
      # Moderation
      live "/moderation", ModerationLive.Index, :index
      live "/moderation/reports", ModerationLive.Reports, :reports
      live "/moderation/bans", ModerationLive.Bans, :bans
      
      # Revenue & IAP
      live "/revenue", RevenueLive.Index, :index
      live "/revenue/transactions", RevenueLive.Transactions, :transactions
      live "/revenue/subscriptions", RevenueLive.Subscriptions, :subscriptions
    end
  end
  
  # ============================================================
  # REST API (for mobile apps)
  # ============================================================
  
  pipeline :api do
    plug :accepts, ["json"]
    plug LokaWeb.API.AuthPlug
  end
  
  pipeline :public_api do
    plug :accepts, ["json"]
  end
  
  scope "/api/v1", LokaWeb.API do
    pipe_through :public_api
    
    post "/auth/register", AuthController, :register
    post "/auth/login", AuthController, :login
    post "/auth/refresh", AuthController, :refresh
    post "/auth/apple", AuthController, :apple_sign_in
    post "/auth/google", AuthController, :google_sign_in
  end
  
  scope "/api/v1", LokaWeb.API do
    pipe_through :api
    
    # Account
    get "/account", AccountController, :show
    put "/account", AccountController, :update
    
    # Characters
    resources "/characters", CharacterController, only: [:index, :show, :create, :delete]
    
    # Store / IAP
    get "/store/products", StoreController, :products
    post "/store/verify/apple", StoreController, :verify_apple
    post "/store/verify/google", StoreController, :verify_google
    post "/store/checkout", StoreController, :create_checkout
    
    # Wallet
    get "/wallet", WalletController, :show
    get "/wallet/transactions", WalletController, :transactions
    
    # E2E Encryption Keys
    post "/keys/bundle", KeysController, :upload_bundle
    get "/keys/bundle/:player_id", KeysController, :get_bundle
    post "/keys/prekeys", KeysController, :replenish_prekeys
  end
  
  # Stripe webhooks (no auth)
  scope "/webhooks", LokaWeb.API do
    pipe_through :public_api
    post "/stripe", StoreController, :stripe_webhook
  end
end
```

### 15.2 Game Client LiveView

```elixir
defmodule LokaWeb.GameLive.Play do
  use LokaWeb, :live_view
  
  @impl true
  def mount(%{"game_id" => game_id}, session, socket) do
    if connected?(socket) do
      # Join the game session
      player_id = socket.assigns.current_player.id
      {:ok, game_session} = Loka.Session.join(player_id, game_id)
      
      # Subscribe to events
      Phoenix.PubSub.subscribe(Loka.PubSub, "player:#{player_id}")
      Phoenix.PubSub.subscribe(Loka.PubSub, "game:#{game_id}")
      
      # Get initial state
      game_state = Loka.Session.get_state(game_session)
      
      {:ok, assign(socket,
        game_session: game_session,
        game_id: game_id,
        room: game_state.room,
        player: game_state.player,
        inventory: game_state.inventory,
        messages: [],
        command_history: [],
        history_index: 0,
        in_combat: false
      )}
    else
      {:ok, assign(socket, loading: true)}
    end
  end
  
  @impl true
  def render(assigns) do
    ~H"""
    <div class="game-container flex flex-col h-screen bg-gray-900 text-gray-100">
      <!-- Top: Room Info -->
      <header class="flex-none p-4 bg-gray-800 border-b border-gray-700">
        <h1 class="text-xl font-bold text-cyan-400"><%= @room.name %></h1>
        <div class="flex gap-4 mt-2 text-sm">
          <.player_stats player={@player} />
        </div>
      </header>
      
      <!-- Middle: Scrollable Content -->
      <main class="flex-1 overflow-y-auto p-4" id="game-output" phx-hook="ScrollToBottom">
        <!-- Room Description -->
        <div class="mb-4 p-4 bg-gray-800 rounded-lg">
          <p class="text-gray-300"><%= @room.description %></p>
          
          <!-- Exits -->
          <div class="mt-3 text-yellow-400">
            <span class="font-semibold">Exits:</span>
            <%= for {dir, _room_id} <- @room.exits do %>
              <button 
                phx-click="move" 
                phx-value-direction={dir}
                class="ml-2 px-2 py-1 bg-yellow-900 hover:bg-yellow-800 rounded text-sm"
              >
                <%= dir %>
              </button>
            <% end %>
          </div>
          
          <!-- Entities in room -->
          <%= if length(@room.contents) > 0 do %>
            <div class="mt-3">
              <span class="font-semibold text-green-400">You see:</span>
              <ul class="mt-1">
                <%= for entity <- @room.contents do %>
                  <li class="ml-4">
                    <button 
                      phx-click="look" 
                      phx-value-target={entity.key}
                      class="text-green-300 hover:text-green-100 hover:underline"
                    >
                      <%= entity.name %>
                    </button>
                  </li>
                <% end %>
              </ul>
            </div>
          <% end %>
        </div>
        
        <!-- Message Log -->
        <div class="space-y-2">
          <%= for message <- @messages do %>
            <.message_line message={message} />
          <% end %>
        </div>
      </main>
      
      <!-- Bottom: Input & Quick Actions -->
      <footer class="flex-none p-4 bg-gray-800 border-t border-gray-700">
        <!-- Quick action buttons (touch-friendly) -->
        <div class="flex gap-2 mb-3 overflow-x-auto pb-2">
          <button phx-click="command" phx-value-cmd="look" 
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded whitespace-nowrap">
            Look
          </button>
          <button phx-click="command" phx-value-cmd="inventory" 
                  class="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded whitespace-nowrap">
            Inventory
          </button>
          <button phx-click="command" phx-value-cmd="skills" 
                  class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded whitespace-nowrap">
            Skills
          </button>
          <button phx-click="command" phx-value-cmd="quests" 
                  class="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded whitespace-nowrap">
            Quests
          </button>
        </div>
        
        <!-- Text input -->
        <form phx-submit="submit_command" class="flex gap-2">
          <input 
            type="text" 
            name="command" 
            placeholder="Enter command..." 
            autocomplete="off"
            phx-hook="CommandInput"
            class="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded 
                   focus:outline-none focus:border-cyan-500 text-white"
          />
          <button type="submit" 
                  class="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold">
            Send
          </button>
        </form>
      </footer>
    </div>
    """
  end
  
  # Handle text command submission
  @impl true
  def handle_event("submit_command", %{"command" => command}, socket) do
    command = String.trim(command)
    
    if command != "" do
      Loka.Session.process_command(socket.assigns.game_session, command)
      
      {:noreply, update(socket, :command_history, fn history ->
        [command | history] |> Enum.take(100)
      end)}
    else
      {:noreply, socket}
    end
  end
  
  # Handle quick action buttons
  @impl true
  def handle_event("command", %{"cmd" => cmd}, socket) do
    Loka.Session.process_command(socket.assigns.game_session, cmd)
    {:noreply, socket}
  end
  
  @impl true
  def handle_event("move", %{"direction" => direction}, socket) do
    Loka.Session.process_command(socket.assigns.game_session, direction)
    {:noreply, socket}
  end
  
  @impl true
  def handle_event("look", %{"target" => target}, socket) do
    Loka.Session.process_command(socket.assigns.game_session, "look #{target}")
    {:noreply, socket}
  end
  
  # Handle game events from PubSub
  @impl true
  def handle_info({:game_event, %{type: :room_update, payload: room}}, socket) do
    {:noreply, assign(socket, room: room)}
  end
  
  @impl true
  def handle_info({:game_event, %{type: :message, payload: message}}, socket) do
    {:noreply, update(socket, :messages, fn msgs ->
      [message | msgs] |> Enum.take(500)
    end)}
  end
  
  @impl true
  def handle_info({:game_event, %{type: :stats_update, payload: stats}}, socket) do
    {:noreply, update(socket, :player, fn player ->
      %{player | components: Map.merge(player.components, stats)}
    end)}
  end
  
  @impl true
  def handle_info({:game_event, %{type: :inventory_update, payload: inventory}}, socket) do
    {:noreply, assign(socket, inventory: inventory)}
  end
  
  @impl true
  def handle_info({:wallet_update, wallet}, socket) do
    {:noreply, assign(socket, wallet: wallet)}
  end
  
  # Component for player stats display
  defp player_stats(assigns) do
    ~H"""
    <div class="flex gap-4">
      <span class="text-red-400">
        HP: <%= @player.components.combatant.health.current %>/<%= @player.components.combatant.health.max %>
      </span>
      <span class="text-blue-400">
        MP: <%= @player.components.combatant.mana.current %>/<%= @player.components.combatant.mana.max %>
      </span>
      <span class="text-yellow-400">
        Level: <%= @player.attributes[:level] || 1 %>
      </span>
    </div>
    """
  end
  
  defp message_line(assigns) do
    ~H"""
    <div class={message_class(@message)}>
      <%= @message.text %>
    </div>
    """
  end
  
  defp message_class(%{style: :combat}), do: "text-red-400"
  defp message_class(%{style: :system}), do: "text-yellow-400 italic"
  defp message_class(%{style: :say}), do: "text-cyan-300"
  defp message_class(_), do: "text-gray-300"
end
```

---

## Part 15: SQLite + LiteFS Configuration

### 16.1 Why SQLite for a MUD Engine

SQLite is **ideal** for Loka because:

1. **Game state is mostly in memory** - GenServers hold active entities, DB is for persistence
2. **Writes are batched** - Save on disconnect, periodic snapshots, not per-action
3. **Reads are fast** - World definitions loaded at startup and cached
4. **Zero latency** - Same machine, no network hop
5. **Simple backups** - Single file, easy to copy

### 16.2 Ecto SQLite Configuration

```elixir
# mix.exs
defp deps do
  [
    {:ecto_sqlite3, "~> 0.15"},
    {:exqlite, "~> 0.20"},  # SQLite driver
    # ... other deps
  ]
end
```

```elixir
# config/config.exs
config :loka, Loka.Repo,
  database: Path.expand("../data/loka.db", __DIR__),
  pool_size: 5,
  # SQLite-specific settings
  journal_mode: :wal,  # Write-Ahead Logging for better concurrency
  cache_size: -64000,  # 64MB cache
  temp_store: :memory,
  synchronous: :normal
```

```elixir
# config/runtime.exs (for Fly.io)
if config_env() == :prod do
  config :loka, Loka.Repo,
    database: "/data/loka.db",  # Fly volume mount point
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "5")
end
```

### 16.3 Fly.io Volume Configuration

```toml
# fly.toml
app = "loka"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  PHX_HOST = "loka.fly.dev"
  PORT = "8080"
  POOL_SIZE = "5"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false  # Keep running for WebSockets
  auto_start_machines = true
  min_machines_running = 1

# Mount a volume for SQLite persistence
[mounts]
  source = "loka_data"
  destination = "/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512  # 512MB is plenty for SQLite + Phoenix
```

```bash
# Create the volume (run once)
fly volumes create loka_data --region sjc --size 1

# Size is in GB, 1GB = $0.15/month
# Can expand later: fly volumes extend <volume_id> --size 10
```

### 16.4 LiteFS for Replication (Optional)

If you later need read replicas or automatic failover:

```yaml
# litefs.yml
fuse:
  dir: "/litefs"

data:
  dir: "/data"

proxy:
  addr: ":8081"
  target: "localhost:8080"
  db: "loka.db"

lease:
  type: "consul"
  advertise-url: "http://${HOSTNAME}.vm.${FLY_APP_NAME}.internal:20202"
  consul:
    url: "${FLY_CONSUL_URL}"
    key: "litefs/${FLY_APP_NAME}"
```

For now, single-node SQLite is perfect. Add LiteFS when you need multiple regions.

### 16.5 SQLite Migrations

```elixir
# priv/repo/migrations/20240101000000_create_players.exs
defmodule Loka.Repo.Migrations.CreatePlayers do
  use Ecto.Migration

  def change do
    create table(:players, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :email, :string, null: false
      add :username, :string, null: false
      add :hashed_password, :string, null: false
      add :display_name, :string
      add :role, :string, default: "player"
      add :confirmed_at, :naive_datetime
      add :banned_at, :utc_datetime
      add :ban_reason, :string

      timestamps()
    end

    create unique_index(:players, [:email])
    create unique_index(:players, [:username])
  end
end
```

### 16.6 Backup Strategy

```bash
# Simple backup script - run via cron or Fly.io scheduled machine
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/data/backups/loka_${DATE}.db"

# SQLite backup while database is running (uses WAL)
sqlite3 /data/loka.db ".backup '${BACKUP_FILE}'"

# Optional: Upload to S3/R2/B2
# aws s3 cp "${BACKUP_FILE}" "s3://my-bucket/backups/"

# Keep only last 7 days locally
find /data/backups -name "*.db" -mtime +7 -delete
```

### 16.7 SQLite vs PostgreSQL Feature Comparison

| Feature | SQLite | PostgreSQL | Loka Needs |
|---------|--------|------------|-------------|
| **JSON support** | ✅ Yes | ✅ Yes | ✅ Good enough |
| **Full-text search** | ✅ FTS5 | ✅ Yes | ✅ Built-in! |
| **Concurrent writes** | ⚠️ Limited | ✅ Excellent | ✅ Fine (GenServers batch) |
| **Concurrent reads** | ✅ Unlimited | ✅ Unlimited | ✅ Same |
| **Network latency** | 0ms | 1-50ms | ✅ SQLite wins |
| **Cost** | $0 | $15+/mo | ✅ SQLite wins |
| **Horizontal scaling** | ❌ No | ✅ Yes | ⚠️ Add later if needed |
| **Array columns** | ❌ No | ✅ Yes | ⚠️ Use JSON instead |

For Loka's scale (starting out), SQLite is **actually better** because:
- Zero latency beats features you don't need
- Simpler deployment and backup
- Cost savings go toward more RAM/CPU

---

## Part 16: Authentication System

### 16.1 Custom Phoenix Authentication

Using `phx.gen.auth` + Guardian for JWT tokens:

```elixir
# Generate base authentication (run once)
# mix phx.gen.auth Accounts Player players

# mix.exs dependencies
defp deps do
  [
    {:guardian, "~> 2.3"},      # JWT tokens for mobile
    {:argon2_elixir, "~> 4.0"}, # Secure password hashing (included by gen.auth)
    # Optional: Add later for social login
    # {:ueberauth, "~> 0.10"},
    # {:ueberauth_google, "~> 0.10"},
  ]
end
```

### 16.2 Player Schema (Generated + Extended)

```elixir
defmodule Loka.Accounts.Player do
  use Ecto.Schema
  import Ecto.Changeset
  
  @primary_key {:id, :binary_id, autogenerate: true}
  
  schema "players" do
    # Generated by phx.gen.auth
    field :email, :string
    field :password, :string, virtual: true, redact: true
    field :hashed_password, :string, redact: true
    field :confirmed_at, :naive_datetime
    
    # Extended for game
    field :username, :string
    field :display_name, :string
    field :role, Ecto.Enum, values: [:player, :creator, :admin], default: :player
    field :banned_at, :utc_datetime
    field :ban_reason, :string
    
    # Relationships
    has_many :characters, Loka.Game.Character
    has_one :wallet, Loka.Economy.Wallet
    has_many :player_tokens, Loka.Accounts.PlayerToken
    
    timestamps()
  end
  
  def registration_changeset(player, attrs, opts \\ []) do
    player
    |> cast(attrs, [:email, :password, :username, :display_name])
    |> validate_required([:email, :password, :username])
    |> validate_email(opts)
    |> validate_password(opts)
    |> validate_username()
  end
  
  defp validate_username(changeset) do
    changeset
    |> validate_required([:username])
    |> validate_length(:username, min: 3, max: 20)
    |> validate_format(:username, ~r/^[a-zA-Z0-9_]+$/, message: "only letters, numbers, and underscores")
    |> unsafe_validate_unique(:username, Loka.Repo)
    |> unique_constraint(:username)
  end
end
```

### 16.3 Guardian Configuration (JWT for Mobile)

```elixir
# lib/loka/auth/guardian.ex
defmodule Loka.Auth.Guardian do
  use Guardian, otp_app: :loka
  
  alias Loka.Accounts
  
  def subject_for_token(%{id: id}, _claims) do
    {:ok, to_string(id)}
  end
  
  def resource_from_claims(%{"sub" => id}) do
    case Accounts.get_player(id) do
      nil -> {:error, :player_not_found}
      player -> {:ok, player}
    end
  end
  
  # Custom claims for mobile tokens
  def build_claims(claims, player, _opts) do
    claims
    |> Map.put("role", player.role)
    |> Map.put("username", player.username)
  end
end

# config/config.exs
config :loka, Loka.Auth.Guardian,
  issuer: "loka",
  secret_key: System.get_env("GUARDIAN_SECRET_KEY"),
  ttl: {30, :days}
```

### 16.4 Authentication Controller (Mobile API)

```elixir
defmodule LokaWeb.API.AuthController do
  use LokaWeb, :controller
  
  alias Loka.Accounts
  alias Loka.Auth.Guardian
  
  @doc """
  Register a new player account.
  POST /api/v1/auth/register
  """
  def register(conn, %{"email" => email, "password" => password, "username" => username}) do
    case Accounts.register_player(%{
      email: email,
      password: password,
      username: username
    }) do
      {:ok, player} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(player)
        
        conn
        |> put_status(:created)
        |> json(%{
          token: token,
          player: %{
            id: player.id,
            email: player.email,
            username: player.username,
            role: player.role
          }
        })
        
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end
  
  @doc """
  Login with email and password.
  POST /api/v1/auth/login
  """
  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.get_player_by_email_and_password(email, password) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid email or password"})
        
      player ->
        if player.banned_at do
          conn
          |> put_status(:forbidden)
          |> json(%{error: "Account banned", reason: player.ban_reason})
        else
          {:ok, token, _claims} = Guardian.encode_and_sign(player)
          
          json(conn, %{
            token: token,
            player: %{
              id: player.id,
              email: player.email,
              username: player.username,
              role: player.role
            }
          })
        end
    end
  end
  
  @doc """
  Refresh an existing token.
  POST /api/v1/auth/refresh
  """
  def refresh(conn, _params) do
    player = Guardian.Plug.current_resource(conn)
    {:ok, _old, {new_token, _claims}} = Guardian.refresh(conn.assigns.guardian_token)
    
    json(conn, %{token: new_token})
  end
  
  @doc """
  Get current player info.
  GET /api/v1/auth/me
  """
  def me(conn, _params) do
    player = Guardian.Plug.current_resource(conn)
    
    json(conn, %{
      player: %{
        id: player.id,
        email: player.email,
        username: player.username,
        display_name: player.display_name,
        role: player.role
      }
    })
  end
  
  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
```

### 16.5 Auth Plugs and Pipelines

```elixir
# lib/loka_web/plugs/api_auth_plug.ex
defmodule LokaWeb.Plugs.APIAuth do
  @moduledoc """
  Authenticates API requests using Guardian JWT tokens.
  """
  
  import Plug.Conn
  alias Loka.Auth.Guardian
  
  def init(opts), do: opts
  
  def call(conn, _opts) do
    case get_token_from_header(conn) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> Phoenix.Controller.json(%{error: "Missing authorization token"})
        |> halt()
        
      token ->
        case Guardian.decode_and_verify(token) do
          {:ok, claims} ->
            case Guardian.resource_from_claims(claims) do
              {:ok, player} ->
                conn
                |> assign(:current_player, player)
                |> assign(:guardian_token, token)
                
              {:error, _} ->
                unauthorized(conn)
            end
            
          {:error, _} ->
            unauthorized(conn)
        end
    end
  end
  
  defp get_token_from_header(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end
  
  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> Phoenix.Controller.json(%{error: "Invalid or expired token"})
    |> halt()
  end
end

# Channel authentication
defmodule LokaWeb.Plugs.ChannelAuth do
  @moduledoc """
  Verifies token for Phoenix Channel connections.
  """
  
  alias Loka.Auth.Guardian
  
  def authenticate(token) do
    case Guardian.decode_and_verify(token) do
      {:ok, claims} ->
        Guardian.resource_from_claims(claims)
      {:error, reason} ->
        {:error, reason}
    end
  end
end
```

### 16.6 React Native Auth Service

```typescript
// src/services/api/auth.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

const TOKEN_KEY = '@loka_auth_token';
const PLAYER_KEY = '@loka_player';

export interface Player {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  role: 'player' | 'creator' | 'admin';
}

export interface AuthResponse {
  token: string;
  player: Player;
}

class AuthService {
  private token: string | null = null;
  private player: Player | null = null;

  async initialize(): Promise<boolean> {
    try {
      const [token, playerJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(PLAYER_KEY),
      ]);

      if (token && playerJson) {
        this.token = token;
        this.player = JSON.parse(playerJson);
        apiClient.setAuthToken(token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      return false;
    }
  }

  async register(email: string, password: string, username: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/v1/auth/register', {
      email,
      password,
      username,
    });

    await this.saveAuth(response.data);
    return response.data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', {
      email,
      password,
    });

    await this.saveAuth(response.data);
    return response.data;
  }

  async logout(): Promise<void> {
    this.token = null;
    this.player = null;
    apiClient.setAuthToken(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, PLAYER_KEY]);
  }

  async refreshToken(): Promise<string> {
    const response = await apiClient.post<{ token: string }>('/api/v1/auth/refresh');
    this.token = response.data.token;
    apiClient.setAuthToken(this.token);
    await AsyncStorage.setItem(TOKEN_KEY, this.token);
    return this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  getPlayer(): Player | null {
    return this.player;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  private async saveAuth(auth: AuthResponse): Promise<void> {
    this.token = auth.token;
    this.player = auth.player;
    apiClient.setAuthToken(auth.token);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, auth.token],
      [PLAYER_KEY, JSON.stringify(auth.player)],
    ]);
  }
}

export const authService = new AuthService();
```

---

## Part 17: Debug Logging System

### 17.1 Overview

Real-time log streaming from both server and mobile client to a debug dashboard, accessible for Claude Code debugging.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEBUG LOG ARCHITECTURE                                │
│                                                                              │
│  ┌─────────────────┐                           ┌─────────────────┐          │
│  │  React Native   │──── client logs ─────────►│                 │          │
│  │     Client      │                           │   Debug Live    │          │
│  └─────────────────┘                           │    Dashboard    │          │
│                                                │                 │          │
│  ┌─────────────────┐                           │  /debug/logs    │          │
│  │  Phoenix        │──── server logs ─────────►│                 │          │
│  │  Server         │                           │  (LiveView)     │          │
│  └─────────────────┘                           └─────────────────┘          │
│                                                         │                    │
│                                                         ▼                    │
│                                                ┌─────────────────┐          │
│                                                │  Claude Code    │          │
│                                                │  (via browser)  │          │
│                                                └─────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 17.2 Server-Side Debug Logger

```elixir
# lib/loka/debug/logger.ex
defmodule Loka.Debug.Logger do
  @moduledoc """
  Custom logger backend that broadcasts logs to the debug dashboard.
  Only active in dev/staging environments.
  """
  
  use GenServer
  require Logger
  
  @max_logs 500
  
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end
  
  def init(_) do
    # Attach to Elixir Logger
    :logger.add_handler(:debug_handler, __MODULE__, %{})
    {:ok, %{logs: :queue.new(), count: 0}}
  end
  
  # Logger handler callback
  def log(%{level: level, msg: {:string, msg}, meta: meta}, _config) do
    if should_broadcast?() do
      log_entry = %{
        id: System.unique_integer([:positive]),
        level: level,
        message: IO.iodata_to_binary(msg),
        module: meta[:module],
        function: meta[:function],
        line: meta[:line],
        timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
        source: :server
      }
      
      Phoenix.PubSub.broadcast(Loka.PubSub, "debug:logs", {:log, log_entry})
    end
  end
  
  def log(_event, _config), do: :ok
  
  defp should_broadcast? do
    Application.get_env(:loka, :debug_logging, false) &&
    Mix.env() in [:dev, :staging]
  end
  
  # API for manual logging with extra context
  def debug(message, metadata \\ %{}) do
    Logger.debug(message, Map.to_list(metadata))
  end
  
  def game_event(event_type, data) do
    Logger.info("[GameEvent] #{event_type}", game_data: inspect(data))
  end
end
```

### 17.3 Debug Channel for Client Logs

```elixir
# lib/loka_web/channels/debug_channel.ex
defmodule LokaWeb.DebugChannel do
  use Phoenix.Channel
  
  @moduledoc """
  Channel for receiving client logs and broadcasting to debug dashboard.
  Protected by admin token in non-dev environments.
  """
  
  def join("debug:logs", %{"token" => token}, socket) do
    if authorized?(token) do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end
  
  # Receive log from client
  def handle_in("client_log", payload, socket) do
    log_entry = %{
      id: System.unique_integer([:positive]),
      level: payload["level"],
      message: payload["message"],
      data: payload["data"],
      timestamp: payload["timestamp"] || DateTime.utc_now() |> DateTime.to_iso8601(),
      source: :client,
      client_id: socket.assigns[:client_id]
    }
    
    # Broadcast to debug dashboard
    Phoenix.PubSub.broadcast(Loka.PubSub, "debug:logs", {:log, log_entry})
    
    {:noreply, socket}
  end
  
  defp authorized?(token) do
    case Mix.env() do
      :dev -> true  # Always allow in dev
      :staging -> token == Application.get_env(:loka, :debug_token)
      :prod -> false  # Never allow in prod
    end
  end
end
```

### 17.4 Debug Dashboard (LiveView)

```elixir
# lib/loka_web/live/debug/logs_live.ex
defmodule LokaWeb.Debug.LogsLive do
  use LokaWeb, :live_view
  
  @max_logs 200
  
  @impl true
  def mount(_params, session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Loka.PubSub, "debug:logs")
    end
    
    {:ok, assign(socket,
      logs: [],
      filter_level: :all,
      filter_source: :all,
      search: "",
      paused: false,
      connected_clients: 0
    )}
  end
  
  @impl true
  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-gray-900 text-gray-100 p-4">
      <header class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-cyan-400">🔧 Debug Logs</h1>
        <div class="flex gap-4">
          <span class="text-sm text-gray-400">
            <%= length(@logs) %> logs | <%= @connected_clients %> clients
          </span>
          <button 
            phx-click="toggle_pause" 
            class={"px-3 py-1 rounded #{if @paused, do: "bg-green-600", else: "bg-red-600"}"}
          >
            <%= if @paused, do: "▶ Resume", else: "⏸ Pause" %>
          </button>
          <button phx-click="clear" class="px-3 py-1 bg-gray-700 rounded">
            🗑 Clear
          </button>
        </div>
      </header>
      
      <!-- Filters -->
      <div class="flex gap-4 mb-4">
        <select phx-change="filter_level" name="level" class="bg-gray-800 rounded px-3 py-1">
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        
        <select phx-change="filter_source" name="source" class="bg-gray-800 rounded px-3 py-1">
          <option value="all">All Sources</option>
          <option value="server">Server</option>
          <option value="client">Client</option>
        </select>
        
        <input 
          type="text" 
          phx-change="search" 
          phx-debounce="300"
          name="search"
          placeholder="Search logs..."
          class="flex-1 bg-gray-800 rounded px-3 py-1"
        />
      </div>
      
      <!-- Log List -->
      <div class="space-y-1 font-mono text-sm" id="log-container" phx-hook="ScrollToBottom">
        <%= for log <- filter_logs(@logs, @filter_level, @filter_source, @search) do %>
          <div class={"p-2 rounded flex gap-2 #{log_bg_color(log.level)}"}>
            <span class={"font-bold #{log_text_color(log.level)}"}>
              [<%= String.upcase(to_string(log.level)) %>]
            </span>
            <span class="text-gray-400">
              [<%= log.source %>]
            </span>
            <span class="text-gray-500 text-xs">
              <%= format_timestamp(log.timestamp) %>
            </span>
            <span class="flex-1">
              <%= log.message %>
            </span>
            <%= if log[:module] do %>
              <span class="text-gray-500 text-xs">
                <%= log.module %>:<%= log[:line] %>
              </span>
            <% end %>
          </div>
        <% end %>
      </div>
    </div>
    """
  end
  
  @impl true
  def handle_info({:log, log_entry}, socket) do
    if socket.assigns.paused do
      {:noreply, socket}
    else
      logs = [log_entry | socket.assigns.logs] |> Enum.take(@max_logs)
      {:noreply, assign(socket, logs: logs)}
    end
  end
  
  @impl true
  def handle_event("toggle_pause", _, socket) do
    {:noreply, assign(socket, paused: !socket.assigns.paused)}
  end
  
  @impl true
  def handle_event("clear", _, socket) do
    {:noreply, assign(socket, logs: [])}
  end
  
  @impl true
  def handle_event("filter_level", %{"level" => level}, socket) do
    {:noreply, assign(socket, filter_level: String.to_atom(level))}
  end
  
  @impl true
  def handle_event("filter_source", %{"source" => source}, socket) do
    {:noreply, assign(socket, filter_source: String.to_atom(source))}
  end
  
  @impl true
  def handle_event("search", %{"search" => search}, socket) do
    {:noreply, assign(socket, search: search)}
  end
  
  defp filter_logs(logs, level, source, search) do
    logs
    |> Enum.filter(fn log ->
      (level == :all || log.level == level) &&
      (source == :all || log.source == source) &&
      (search == "" || String.contains?(String.downcase(log.message), String.downcase(search)))
    end)
  end
  
  defp log_bg_color(:error), do: "bg-red-900/30"
  defp log_bg_color(:warning), do: "bg-yellow-900/30"
  defp log_bg_color(:info), do: "bg-blue-900/20"
  defp log_bg_color(_), do: "bg-gray-800/50"
  
  defp log_text_color(:error), do: "text-red-400"
  defp log_text_color(:warning), do: "text-yellow-400"
  defp log_text_color(:info), do: "text-blue-400"
  defp log_text_color(_), do: "text-gray-400"
  
  defp format_timestamp(ts) when is_binary(ts) do
    ts |> String.split("T") |> List.last() |> String.slice(0..7)
  end
end
```

### 17.5 React Native Remote Logger

```typescript
// src/utils/remoteLogger.ts

import { Channel } from 'phoenix';
import { phoenixSocket } from '../services/phoenix/socket';
import Config from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class RemoteLogger {
  private channel: Channel | null = null;
  private buffer: LogEntry[] = [];
  private isConnected = false;

  async connect(debugToken?: string): Promise<void> {
    if (!Config.DEBUG_LOGGING) return;

    try {
      this.channel = phoenixSocket.joinChannel('debug:logs', {
        token: debugToken || 'dev',
      });

      this.channel.join()
        .receive('ok', () => {
          this.isConnected = true;
          // Flush buffered logs
          this.buffer.forEach(log => this.sendLog(log));
          this.buffer = [];
          console.log('[RemoteLogger] Connected to debug channel');
        })
        .receive('error', (err) => {
          console.warn('[RemoteLogger] Failed to join debug channel:', err);
        });
    } catch (error) {
      console.warn('[RemoteLogger] Connection failed:', error);
    }
  }

  disconnect(): void {
    this.channel?.leave();
    this.channel = null;
    this.isConnected = false;
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    // Always log to console
    const consoleMethod = level === 'debug' ? 'log' : level;
    console[consoleMethod](`[${level.toUpperCase()}]`, message, data || '');

    // Send to remote if enabled
    if (!Config.DEBUG_LOGGING) return;

    const entry: LogEntry = {
      level,
      message,
      data: data ? JSON.stringify(data) : undefined,
      timestamp: new Date().toISOString(),
    };

    if (this.isConnected) {
      this.sendLog(entry);
    } else {
      // Buffer until connected
      this.buffer.push(entry);
      if (this.buffer.length > 100) {
        this.buffer.shift();
      }
    }
  }

  private sendLog(entry: LogEntry): void {
    this.channel?.push('client_log', entry);
  }
}

export const remoteLogger = new RemoteLogger();

// Usage example:
// remoteLogger.info('User logged in', { userId: player.id });
// remoteLogger.error('Failed to load room', { error: err.message });
```

### 17.6 Integration with Game Code

```typescript
// src/hooks/useGameConnection.ts

import { remoteLogger } from '../utils/remoteLogger';

export const useGameConnection = (gameId: string) => {
  // ...

  const connect = useCallback(async () => {
    remoteLogger.info('Connecting to game', { gameId });
    
    try {
      await phoenixSocket.connect(token);
      remoteLogger.info('Socket connected');
      
      channelRef.current = new GameChannel(gameId);
      await channelRef.current.join();
      remoteLogger.info('Joined game channel', { gameId });
      
      setConnected(true);
    } catch (error) {
      remoteLogger.error('Connection failed', { error: error.message, gameId });
      setError('Failed to connect to game');
    }
  }, [gameId, token]);

  const sendCommand = useCallback((command: string) => {
    remoteLogger.debug('Sending command', { command });
    channelRef.current?.sendCommand(command);
  }, []);

  // ...
};
```

```elixir
# lib/loka/game/session.ex

defmodule Loka.Game.Session do
  require Logger
  alias Loka.Debug.Logger, as: DebugLog
  
  def process_command(session, raw_input) do
    DebugLog.debug("Processing command", %{
      player_id: session.player_id,
      input: raw_input
    })
    
    case Loka.Command.Parser.parse(raw_input, session.command_sets) do
      {:ok, {command_module, args}} ->
        DebugLog.game_event(:command_parsed, %{
          command: command_module,
          args: args
        })
        
        execute_command(command_module, args, session)
        
      {:error, reason} ->
        DebugLog.debug("Command parse failed", %{reason: reason})
        {:error, reason}
    end
  end
end
```

### 17.7 Quick Access Script for Claude Code

```bash
#!/bin/bash
# scripts/debug.sh
# Quick debug access for Claude Code

echo "🔧 Loka Debug Tools"
echo "===================="
echo ""
echo "1. View live logs:     https://loka.fly.dev/debug/logs"
echo "2. Stream server logs: fly logs -a loka"
echo "3. SSH into server:    fly ssh console -a loka"
echo ""
echo "Quick commands:"
echo "  fly logs -a loka                    # Stream all logs"
echo "  fly logs -a loka | grep ERROR       # Only errors"
echo "  fly logs -a loka | grep GameEvent   # Game events only"
echo ""

# If argument provided, execute it
case "$1" in
  logs)
    fly logs -a loka
    ;;
  errors)
    fly logs -a loka | grep -E "(ERROR|error|Error)"
    ;;
  ssh)
    fly ssh console -a loka
    ;;
  *)
    echo "Usage: ./scripts/debug.sh [logs|errors|ssh]"
    ;;
esac
```

---

## Part 18: API for External Integration

```elixir
defmodule Loka.API.MCP do
  @moduledoc """
  API endpoints for AI/LLM integration via MCP (Model Context Protocol).
  """
  
  use Phoenix.Router
  
  pipeline :mcp do
    plug :accepts, ["json"]
    plug Loka.API.AuthPlug
    plug Loka.API.RateLimitPlug
  end
  
  scope "/api/mcp", Loka.API.MCP do
    pipe_through :mcp
    
    # Content generation
    post "/generate/room", GenerateController, :room
    post "/generate/npc", GenerateController, :npc
    post "/generate/item", GenerateController, :item
    post "/generate/quest", GenerateController, :quest
    post "/generate/dialogue", GenerateController, :dialogue
    
    # World building
    post "/build/area", BuildController, :area
    post "/build/storyline", BuildController, :storyline
    
    # Validation
    post "/validate/content", ValidateController, :content
    post "/validate/script", ValidateController, :script
    post "/validate/balance", ValidateController, :balance
    
    # Query
    get "/query/world", QueryController, :world_state
    get "/query/entity/:id", QueryController, :entity
  end
end

defmodule Loka.API.MCP.GenerateController do
  use Phoenix.Controller
  
  def room(conn, params) do
    # Structured output for AI to populate
    template = %{
      key: nil,
      name: nil,
      description: nil,
      exits: %{},
      items: [],
      npcs: [],
      scripts: %{},
      ambient: %{
        sounds: [],
        atmosphere: nil,
        lighting: nil
      }
    }
    
    # AI fills in the template based on context
    json(conn, %{template: template, context: params})
  end
end
```

---

## Part 19: Deployment Architecture

### 14.1 Distributed Deployment

```elixir
# config/runtime.exs
config :loka, Loka.Cluster,
  # Use libcluster for automatic node discovery
  topologies: [
    loka: [
      strategy: Cluster.Strategy.Kubernetes,
      config: [
        kubernetes_selector: "app=loka",
        kubernetes_node_basename: "loka"
      ]
    ]
  ]

# Horde for distributed process registry
config :loka, :distributed,
  entity_registry: Loka.Horde.EntityRegistry,
  entity_supervisor: Loka.Horde.EntitySupervisor
```

### 14.2 Single Node vs Cluster Mode

```elixir
defmodule Loka.Distribution do
  @moduledoc """
  Handles both single-node and clustered deployments.
  """
  
  def entity_registry do
    if clustered?() do
      Loka.Horde.EntityRegistry
    else
      Loka.Local.EntityRegistry
    end
  end
  
  def start_entity(entity_id) do
    if clustered?() do
      Horde.DynamicSupervisor.start_child(
        Loka.Horde.EntitySupervisor,
        {Loka.EntityServer, entity_id}
      )
    else
      DynamicSupervisor.start_child(
        Loka.Local.EntitySupervisor,
        {Loka.EntityServer, entity_id}
      )
    end
  end
  
  defp clustered? do
    Application.get_env(:loka, :distributed, false)
  end
end
```

---

## Part 20: Testing Strategy

### 15.1 Entity and Behavior Testing

```elixir
defmodule Loka.EntityTest do
  use Loka.DataCase
  
  describe "entity creation" do
    test "creates entity with components" do
      entity = Loka.Builder.create_entity(:npc, %{
        name: "Test NPC",
        components: [
          {Combatant, %{health: %{current: 100, max: 100}}},
          {Conversant, %{dialogue_tree_id: "npc_001"}}
        ]
      })
      
      assert entity.name == "Test NPC"
      assert Loka.Entity.has_component?(entity, Combatant)
      assert Loka.Entity.get_component(entity, Combatant).health.max == 100
    end
  end
  
  describe "behavior processing" do
    test "handles look event" do
      room = create_test_room()
      player = create_test_player(location: room.id)
      
      event = %Event{type: :look, source: player.id, location: room.id}
      
      {:ok, _entity, events} = Loka.Behaviors.DefaultRoom.handle_event(room, event, %{})
      
      assert Enum.any?(events, &(&1.type == :display))
    end
  end
end
```

### 15.2 Script Sandbox Testing

```elixir
defmodule Loka.ScriptingTest do
  use ExUnit.Case
  
  describe "sandbox security" do
    test "blocks file system access" do
      script = """
      local f = io.open("/etc/passwd", "r")
      return f:read("*a")
      """
      
      assert {:error, _} = Loka.Scripting.execute(script, %{})
    end
    
    test "enforces CPU limits" do
      script = """
      while true do end
      """
      
      assert {:error, :reduction_limit_exceeded} = 
        Loka.Scripting.execute(script, %{})
    end
    
    test "allows game API calls" do
      script = """
      game.message(player.id, "Hello!")
      return true
      """
      
      assert {:ok, _} = Loka.Scripting.execute(script, mock_entity(), %{player: mock_player()})
    end
  end
end
```

---

## Summary: Key Architectural Decisions

### Why These Choices?

| Decision | Rationale |
|----------|-----------|
| **Entity-Component-Behavior over Typeclasses** | Better composition, easier to reason about, works naturally with Elixir's functional paradigm |
| **GenServer per active entity** | Natural isolation, crash resilience, easy state management |
| **ETS for caching** | Blazing fast reads without GenServer bottleneck, concurrent access |
| **Lua for scripting (via Luerl)** | Runs on BEAM (no external process), sandboxable, familiar to game devs |
| **SQLite on same machine** | Zero network latency, ~$5/month total, simple backups, upgrade to PostgreSQL later if needed |
| **Custom Phoenix Auth (phx.gen.auth + Guardian)** | Single auth system, no external dependencies, full control |
| **Phoenix PubSub for events** | Built-in, scales to clusters, LiveView integration |
| **Phoenix Channels for all clients** | Same protocol for React Native, Web, Terminal - WebSocket-based, battle-tested |
| **LiveView for web interfaces** | Real-time by default, server-side state, no separate API layer |
| **REST API for IAP/Account** | Stateless operations, easy platform integration |
| **Text-based command parser** | Unified input handling for touch UI, terminal, and web clients |
| **Signal-inspired E2E encryption** | Industry standard, forward secrecy, minimal server knowledge |


### Simplified Architecture (SQLite on Same Machine)

```
+-------------------------------------------------------------------------+
|                          CLIENT APPLICATIONS                             |
+-------------------------------------+-----------------------------------+
|        React Native App             |            Web Clients             |
|       (iOS + Android)               |    (LiveView - Player/Creator/Admin|
|                                     |                                    |
|   Phoenix Channels (WebSocket)      |   LiveView (WebSocket under hood)  |
+----------------+--------------------+------------------+-----------------+
                 |                                        |
                 |              WebSocket                 |
                 |                                        |
                 +------------------+---------------------+
                                    |
       +----------------------------+----------------------------+
       |                    FLY.IO MACHINE                        |
       |                  (~$5/month total)                       |
       |                                                          |
       |  +----------------------------------------------------+  |
       |  |                 PHOENIX SERVER                      |  |
       |  |                                                     |  |
       |  |  +-------------+  +-------------+  +------------+   |  |
       |  |  |    Auth     |  |   Channels  |  |  REST API  |   |  |
       |  |  |  (Guardian) |  |   (Game)    |  |   (IAP)    |   |  |
       |  |  +-------------+  +-------------+  +------------+   |  |
       |  |                                                     |  |
       |  |  +---------------------------------------------+    |  |
       |  |  |              Loka Game Engine               |    |  |
       |  |  |  * Entity GenServers  * Command Pipeline    |    |  |
       |  |  |  * Lua Scripting      * Event Bus (PubSub)  |    |  |
       |  |  +---------------------------------------------+    |  |
       |  |                         |                           |  |
       |  |                         | Ecto (ecto_sqlite3)       |  |
       |  |                         v                           |  |
       |  |  +---------------------------------------------+    |  |
       |  |  |              SQLite + LiteFS                 |    |  |
       |  |  |  * Zero network latency (same machine)      |    |  |
       |  |  |  * Players, Characters, World, Transactions |    |  |
       |  |  |  * Automatic replication via LiteFS         |    |  |
       |  |  +---------------------------------------------+    |  |
       |  |                         |                           |  |
       |  +-------------------------+---------------------------+  |
       |                            |                              |
       |                    +-------v-------+                      |
       |                    |  Fly Volume   |                      |
       |                    |  (1GB = $0.15)|                      |
       |                    +---------------+                      |
       +-----------------------------------------------------------+
       
       Cost: ~$5/month (1 shared CPU, 256MB RAM, 1GB volume)
       Latency: 0ms to database (same machine!)
```

### What We're NOT Using (And Why)

| Technology | Why Not (For Now) |
|------------|-------------------|
| **PostgreSQL** | Costs extra ($15+/mo); SQLite is free and on same machine |
| **Supabase** | External dependency with network latency; SQLite is 0ms |
| **ElectricSQL** | Adds complexity; Phoenix Channels handles real-time fine |
| **Redis** | Not needed initially; ETS handles caching |

### Future Additions (When Needed)

| Feature | When to Add | Technology |
|---------|-------------|------------|
| Horizontal scaling | Multiple servers needed | PostgreSQL + Redis + Horde |
| Offline mode | 10K+ users or creator demand | ElectricSQL |
| Social login | User demand | Ueberauth (Google, Apple, Discord) |
| Full-text search | Large content libraries | SQLite FTS5 (built-in!) |


---

## Appendix A: React Native Mobile Client

### A.1 Project Structure

```
loka-mobile/
├── package.json
├── app.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── eas.json                      # EAS Build configuration
├── .env.development
├── .env.staging
├── .env.production
│
├── src/
│   ├── App.tsx                   # Main app entry
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── GameNavigator.tsx
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── CharacterSelectScreen.tsx
│   │   ├── game/
│   │   │   ├── GameScreen.tsx
│   │   │   ├── InventoryScreen.tsx
│   │   │   ├── SkillsScreen.tsx
│   │   │   ├── QuestsScreen.tsx
│   │   │   └── MapScreen.tsx
│   │   ├── store/
│   │   │   ├── StoreScreen.tsx
│   │   │   └── WalletScreen.tsx
│   │   └── settings/
│   │       └── SettingsScreen.tsx
│   │
│   ├── components/
│   │   ├── game/
│   │   │   ├── RoomView.tsx
│   │   │   ├── MessageLog.tsx
│   │   │   ├── CommandInput.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── DirectionPad.tsx
│   │   │   ├── PlayerStats.tsx
│   │   │   ├── EntityList.tsx
│   │   │   └── CombatView.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Loading.tsx
│   │   └── store/
│   │       ├── ProductCard.tsx
│   │       └── PurchaseButton.tsx
│   │
│   ├── hooks/
│   │   ├── useGameConnection.ts
│   │   ├── useAuth.ts
│   │   ├── useWallet.ts
│   │   ├── usePurchases.ts
│   │   └── useEncryption.ts
│   │
│   ├── services/
│   │   ├── phoenix/
│   │   │   ├── socket.ts
│   │   │   ├── gameChannel.ts
│   │   │   └── types.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── store.ts
│   │   │   └── account.ts
│   │   ├── crypto/
│   │   │   ├── e2e.ts
│   │   │   └── keyStore.ts
│   │   └── purchases/
│   │       ├── index.ts
│   │       ├── apple.ts
│   │       └── google.ts
│   │
│   ├── store/                    # Zustand stores
│   │   ├── authStore.ts
│   │   ├── gameStore.ts
│   │   ├── walletStore.ts
│   │   └── settingsStore.ts
│   │
│   ├── types/
│   │   ├── game.ts
│   │   ├── entities.ts
│   │   ├── player.ts
│   │   └── store.ts
│   │
│   └── utils/
│       ├── config.ts
│       ├── storage.ts
│       └── formatting.ts
│
├── ios/                          # iOS native code
│   └── Loka/
│
├── android/                      # Android native code
│   └── app/
│
└── __tests__/
```

### A.2 Phoenix Channel Connection (TypeScript)

```typescript
// src/services/phoenix/socket.ts

import { Socket, Channel } from 'phoenix';
import Config from '../../utils/config';

class PhoenixSocket {
  private socket: Socket | null = null;
  private channels: Map<string, Channel> = new Map();

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new Socket(Config.SOCKET_URL, {
        params: { token },
        reconnectAfterMs: (tries) => Math.min(tries * 1000, 10000),
      });

      this.socket.onOpen(() => {
        console.log('Socket connected');
        resolve();
      });

      this.socket.onError((error) => {
        console.error('Socket error:', error);
        reject(error);
      });

      this.socket.onClose(() => {
        console.log('Socket closed');
      });

      this.socket.connect();
    });
  }

  disconnect(): void {
    this.channels.forEach((channel) => channel.leave());
    this.channels.clear();
    this.socket?.disconnect();
    this.socket = null;
  }

  joinChannel(topic: string, params: object = {}): Channel {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    const existing = this.channels.get(topic);
    if (existing) {
      return existing;
    }

    const channel = this.socket.channel(topic, params);
    this.channels.set(topic, channel);
    return channel;
  }

  leaveChannel(topic: string): void {
    const channel = this.channels.get(topic);
    if (channel) {
      channel.leave();
      this.channels.delete(topic);
    }
  }

  getChannel(topic: string): Channel | undefined {
    return this.channels.get(topic);
  }
}

export const phoenixSocket = new PhoenixSocket();
```

```typescript
// src/services/phoenix/gameChannel.ts

import { Channel } from 'phoenix';
import { phoenixSocket } from './socket';
import { useGameStore } from '../../store/gameStore';
import { 
  Room, 
  GameMessage, 
  PlayerState, 
  CombatState,
  GameEvent 
} from '../../types/game';

export class GameChannel {
  private channel: Channel | null = null;
  private gameId: string;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  async join(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel = phoenixSocket.joinChannel(`game:${this.gameId}`);

      // Set up event handlers before joining
      this.setupEventHandlers();

      this.channel
        .join()
        .receive('ok', (response) => {
          console.log('Joined game channel', response);
          resolve();
        })
        .receive('error', (error) => {
          console.error('Failed to join game channel', error);
          reject(error);
        })
        .receive('timeout', () => {
          console.error('Join timeout');
          reject(new Error('Join timeout'));
        });
    });
  }

  private setupEventHandlers(): void {
    if (!this.channel) return;

    const store = useGameStore.getState();

    // Initial game state
    this.channel.on('game_state', (payload: {
      room: Room;
      player: PlayerState;
      inventory: any[];
      wallet: any;
    }) => {
      store.setRoom(payload.room);
      store.setPlayer(payload.player);
      store.setInventory(payload.inventory);
      store.setWallet(payload.wallet);
    });

    // Room updates
    this.channel.on('room_update', (room: Room) => {
      store.setRoom(room);
    });

    // Messages
    this.channel.on('message', (message: GameMessage) => {
      store.addMessage(message);
    });

    // Stats updates
    this.channel.on('stats_update', (stats: Partial<PlayerState>) => {
      store.updatePlayerStats(stats);
    });

    // Combat updates
    this.channel.on('combat_update', (combat: CombatState) => {
      store.setCombat(combat);
    });

    // Inventory updates
    this.channel.on('inventory_update', (inventory: any[]) => {
      store.setInventory(inventory);
    });

    // Wallet updates
    this.channel.on('wallet_update', (wallet: any) => {
      store.setWallet(wallet);
    });

    // Quest updates
    this.channel.on('quest_update', (quest: any) => {
      store.updateQuest(quest);
    });

    // Encrypted messages (E2E)
    this.channel.on('encrypted_message', async (payload: {
      sender_id: string;
      ciphertext: string;
      iv: string;
      message_number: number;
    }) => {
      // Decrypt and add to messages
      // This will be handled by the encryption service
      store.addEncryptedMessage(payload);
    });
  }

  // ============================================================
  // COMMANDS
  // ============================================================

  sendCommand(command: string): void {
    this.channel?.push('command', { input: command });
  }

  move(direction: string): void {
    this.channel?.push('move', { direction });
  }

  look(target?: string): void {
    this.channel?.push('look', { target: target || '' });
  }

  get(item: string): void {
    this.channel?.push('get', { item });
  }

  drop(item: string): void {
    this.channel?.push('drop', { item });
  }

  attack(target: string): void {
    this.channel?.push('attack', { target });
  }

  useSkill(skill: string, target: string): void {
    this.channel?.push('use_skill', { skill, target });
  }

  cast(spell: string, target: string): void {
    this.channel?.push('cast', { spell, target });
  }

  // E2E Encrypted messaging
  sendEncryptedTell(
    recipientId: string,
    ciphertext: string,
    iv: string,
    ephemeralKey: string,
    messageNumber: number
  ): void {
    this.channel?.push('encrypted_tell', {
      recipient_id: recipientId,
      ciphertext,
      iv,
      ephemeral_key: ephemeralKey,
      message_number: messageNumber,
    });
  }

  leave(): void {
    phoenixSocket.leaveChannel(`game:${this.gameId}`);
    this.channel = null;
  }
}
```

### A.3 Zustand Game Store

```typescript
// src/store/gameStore.ts

import { create } from 'zustand';
import { 
  Room, 
  GameMessage, 
  PlayerState, 
  CombatState,
  InventoryItem,
  Quest,
  Wallet 
} from '../types/game';

interface GameState {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Game state
  room: Room | null;
  player: PlayerState | null;
  inventory: InventoryItem[];
  wallet: Wallet | null;
  quests: Quest[];
  combat: CombatState | null;
  messages: GameMessage[];

  // Actions
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRoom: (room: Room) => void;
  setPlayer: (player: PlayerState) => void;
  updatePlayerStats: (stats: Partial<PlayerState>) => void;
  setInventory: (inventory: InventoryItem[]) => void;
  setWallet: (wallet: Wallet) => void;
  setCombat: (combat: CombatState | null) => void;
  addMessage: (message: GameMessage) => void;
  addEncryptedMessage: (payload: any) => void;
  updateQuest: (quest: Quest) => void;
  clearMessages: () => void;
  reset: () => void;
}

const MAX_MESSAGES = 500;

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  isConnected: false,
  isLoading: false,
  error: null,
  room: null,
  player: null,
  inventory: [],
  wallet: null,
  quests: [],
  combat: null,
  messages: [],

  // Actions
  setConnected: (connected) => set({ isConnected: connected }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setRoom: (room) => set({ room }),

  setPlayer: (player) => set({ player }),

  updatePlayerStats: (stats) => set((state) => ({
    player: state.player ? { ...state.player, ...stats } : null,
  })),

  setInventory: (inventory) => set({ inventory }),

  setWallet: (wallet) => set({ wallet }),

  setCombat: (combat) => set({ combat }),

  addMessage: (message) => set((state) => {
    const messages = [...state.messages, message];
    // Keep only last MAX_MESSAGES
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }
    return { messages };
  }),

  addEncryptedMessage: (payload) => {
    // This will be processed by encryption service
    // and then call addMessage with decrypted content
  },

  updateQuest: (quest) => set((state) => {
    const quests = state.quests.filter(q => q.id !== quest.id);
    return { quests: [...quests, quest] };
  }),

  clearMessages: () => set({ messages: [] }),

  reset: () => set({
    isConnected: false,
    isLoading: false,
    error: null,
    room: null,
    player: null,
    inventory: [],
    wallet: null,
    quests: [],
    combat: null,
    messages: [],
  }),
}));
```

### A.4 Game Screen Component

```tsx
// src/screens/game/GameScreen.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../store/gameStore';
import { useGameConnection } from '../../hooks/useGameConnection';
import { RoomView } from '../../components/game/RoomView';
import { MessageLog } from '../../components/game/MessageLog';
import { CommandInput } from '../../components/game/CommandInput';
import { QuickActions } from '../../components/game/QuickActions';
import { DirectionPad } from '../../components/game/DirectionPad';
import { PlayerStats } from '../../components/game/PlayerStats';
import { CombatView } from '../../components/game/CombatView';
import { Loading } from '../../components/ui/Loading';
import { colors } from '../../theme';

interface GameScreenProps {
  route: {
    params: {
      gameId: string;
    };
  };
}

export const GameScreen: React.FC<GameScreenProps> = ({ route }) => {
  const { gameId } = route.params;
  const scrollViewRef = useRef<ScrollView>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  const { connect, disconnect, sendCommand, move } = useGameConnection(gameId);
  const { 
    isConnected, 
    isLoading, 
    room, 
    player, 
    messages, 
    combat 
  } = useGameStore();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [gameId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleCommand = (command: string) => {
    if (!command.trim()) return;
    
    sendCommand(command);
    setCommandHistory(prev => [command, ...prev.slice(0, 99)]);
  };

  const handleMove = (direction: string) => {
    move(direction);
  };

  const handleQuickAction = (action: string) => {
    sendCommand(action);
  };

  if (isLoading || !isConnected) {
    return <Loading message="Connecting to world..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Player Stats Header */}
        {player && <PlayerStats player={player} />}

        {/* Main Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Room View */}
          {room && (
            <RoomView 
              room={room} 
              onEntityPress={(entity) => sendCommand(`look ${entity.key}`)}
              onExitPress={handleMove}
            />
          )}

          {/* Combat View (if in combat) */}
          {combat && (
            <CombatView 
              combat={combat}
              onAction={sendCommand}
            />
          )}

          {/* Message Log */}
          <MessageLog messages={messages} />
        </ScrollView>

        {/* Quick Actions */}
        <QuickActions onAction={handleQuickAction} />

        {/* Direction Pad & Command Input */}
        <View style={styles.inputArea}>
          <DirectionPad 
            onMove={handleMove}
            exits={room?.exits || {}}
          />
          <CommandInput 
            onSubmit={handleCommand}
            history={commandHistory}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
```

### A.5 Room View Component

```tsx
// src/components/game/RoomView.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Room, Entity } from '../../types/game';
import { colors } from '../../theme';

interface RoomViewProps {
  room: Room;
  onEntityPress: (entity: Entity) => void;
  onExitPress: (direction: string) => void;
}

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  onEntityPress,
  onExitPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Room Title */}
      <Text style={styles.title}>{room.name}</Text>

      {/* Room Description */}
      <Text style={styles.description}>{room.description}</Text>

      {/* Exits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exits:</Text>
        <View style={styles.exitContainer}>
          {Object.keys(room.exits).map((direction) => (
            <TouchableOpacity
              key={direction}
              style={styles.exitButton}
              onPress={() => onExitPress(direction)}
            >
              <Text style={styles.exitText}>{direction}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Entities in Room */}
      {room.entities && room.entities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You see:</Text>
          {room.entities.map((entity) => (
            <TouchableOpacity
              key={entity.id}
              style={styles.entityItem}
              onPress={() => onEntityPress(entity)}
            >
              <Text style={styles.entityName}>{entity.name}</Text>
              {entity.shortDescription && (
                <Text style={styles.entityDesc}>{entity.shortDescription}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Ambient Description */}
      {room.ambient?.atmosphere && (
        <Text style={styles.ambient}>{room.ambient.atmosphere}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  exitContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exitButton: {
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  exitText: {
    color: colors.text,
    fontWeight: '500',
  },
  entityItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entityName: {
    fontSize: 16,
    color: colors.success,
    fontWeight: '500',
  },
  entityDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ambient: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 16,
  },
});
```

### A.6 In-App Purchases (react-native-iap)

```typescript
// src/services/purchases/index.ts

import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductPurchase,
  type SubscriptionPurchase,
  type Product,
} from 'react-native-iap';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// Product IDs - must match App Store / Play Store
const PRODUCT_IDS = {
  gems: [
    'com.loka.gems100',
    'com.loka.gems500',
    'com.loka.gems1200',
    'com.loka.gems2500',
  ],
  subscriptions: [
    'com.loka.sub.basic.monthly',
    'com.loka.sub.premium.monthly',
  ],
};

class PurchaseService {
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  async initialize(): Promise<void> {
    try {
      await initConnection();
      this.setupListeners();
    } catch (error) {
      console.error('IAP initialization failed:', error);
      throw error;
    }
  }

  private setupListeners(): void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase | SubscriptionPurchase) => {
        console.log('Purchase updated:', purchase);
        await this.handlePurchase(purchase);
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener((error) => {
      console.error('Purchase error:', error);
    });
  }

  async getAvailableProducts(): Promise<Product[]> {
    try {
      const products = await getProducts({
        skus: [...PRODUCT_IDS.gems, ...PRODUCT_IDS.subscriptions],
      });
      return products;
    } catch (error) {
      console.error('Failed to get products:', error);
      return [];
    }
  }

  async purchaseProduct(productId: string): Promise<void> {
    try {
      await requestPurchase({ sku: productId });
    } catch (error) {
      console.error('Purchase request failed:', error);
      throw error;
    }
  }

  private async handlePurchase(
    purchase: ProductPurchase | SubscriptionPurchase
  ): Promise<void> {
    const receipt = purchase.transactionReceipt;
    if (!receipt) {
      console.warn('No receipt found');
      return;
    }

    try {
      // Verify with server
      const verifyEndpoint = Platform.OS === 'ios'
        ? '/api/v1/store/verify/apple'
        : '/api/v1/store/verify/google';

      const verifyPayload = Platform.OS === 'ios'
        ? { transaction_id: purchase.transactionId }
        : {
            product_id: purchase.productId,
            purchase_token: purchase.purchaseToken,
          };

      const response = await apiClient.post(verifyEndpoint, verifyPayload);

      if (response.data.success) {
        // Finish the transaction
        await finishTransaction({ purchase, isConsumable: true });
        console.log('Purchase verified and finished');
      } else {
        console.error('Server verification failed:', response.data);
      }
    } catch (error) {
      console.error('Purchase handling failed:', error);
    }
  }

  async restorePurchases(): Promise<void> {
    // Implementation for restoring purchases
    // Primarily for subscriptions
  }

  cleanup(): void {
    this.purchaseUpdateSubscription?.remove();
    this.purchaseErrorSubscription?.remove();
    endConnection();
  }
}

export const purchaseService = new PurchaseService();
```

### A.7 Custom Hook for Game Connection

```typescript
// src/hooks/useGameConnection.ts

import { useCallback, useEffect, useRef } from 'react';
import { phoenixSocket } from '../services/phoenix/socket';
import { GameChannel } from '../services/phoenix/gameChannel';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';

export const useGameConnection = (gameId: string) => {
  const channelRef = useRef<GameChannel | null>(null);
  const { token } = useAuthStore();
  const { setConnected, setLoading, setError, reset } = useGameStore();

  const connect = useCallback(async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Connect socket if not connected
      await phoenixSocket.connect(token);

      // Create and join game channel
      channelRef.current = new GameChannel(gameId);
      await channelRef.current.join();

      setConnected(true);
    } catch (error) {
      console.error('Connection failed:', error);
      setError('Failed to connect to game');
    } finally {
      setLoading(false);
    }
  }, [gameId, token]);

  const disconnect = useCallback(() => {
    channelRef.current?.leave();
    channelRef.current = null;
    reset();
  }, []);

  const sendCommand = useCallback((command: string) => {
    channelRef.current?.sendCommand(command);
  }, []);

  const move = useCallback((direction: string) => {
    channelRef.current?.move(direction);
  }, []);

  const look = useCallback((target?: string) => {
    channelRef.current?.look(target);
  }, []);

  const attack = useCallback((target: string) => {
    channelRef.current?.attack(target);
  }, []);

  const useSkill = useCallback((skill: string, target: string) => {
    channelRef.current?.useSkill(skill, target);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    connect,
    disconnect,
    sendCommand,
    move,
    look,
    attack,
    useSkill,
  };
};
```

---

## Appendix B: Development & Deployment Workflow

### B.1 Repository Structure (Monorepo)

```
loka/
├── .github/
│   └── workflows/
│       ├── server-ci.yml        # Server CI/CD
│       ├── server-deploy.yml    # Deploy to Fly.io
│       ├── mobile-ci.yml        # Mobile CI
│       └── mobile-preview.yml   # EAS Preview builds
│
├── apps/
│   ├── server/                  # Elixir/Phoenix server
│   │   ├── lib/
│   │   ├── config/
│   │   ├── priv/
│   │   ├── test/
│   │   ├── mix.exs
│   │   ├── mix.lock
│   │   ├── Dockerfile
│   │   └── fly.toml
│   │
│   └── mobile/                  # React Native app
│       ├── src/
│       ├── ios/
│       ├── android/
│       ├── package.json
│       ├── app.json
│       ├── eas.json
│       └── tsconfig.json
│
├── packages/                    # Shared code (if needed)
│   └── shared-types/
│       ├── src/
│       └── package.json
│
├── docs/                        # Documentation
│   └── architecture.md
│
├── scripts/                     # Development scripts
│   ├── setup.sh
│   ├── deploy-server.sh
│   └── build-mobile.sh
│
├── .gitignore
├── README.md
└── package.json                 # Root package.json for monorepo
```

### B.2 CI/CD Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DEVELOPMENT WORKFLOW                              │
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│  │ Claude Code  │         │   GitHub     │         │   Fly.io     │        │
│  │ (on phone)   │────────▶│   Actions    │────────▶│   Server     │        │
│  │              │  push   │              │  deploy │              │        │
│  └──────────────┘         └──────┬───────┘         └──────────────┘        │
│                                  │                                          │
│                                  │ trigger                                  │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │  EAS Build   │                                  │
│                           │  (Expo)      │                                  │
│                           └──────┬───────┘                                  │
│                                  │                                          │
│                                  │ OTA update                               │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │ Expo Go /    │                                  │
│                           │ Dev Client   │                                  │
│                           │ (on phone)   │                                  │
│                           └──────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.3 GitHub Actions - Server Deploy

```yaml
# .github/workflows/server-deploy.yml

name: Deploy Server to Fly.io

on:
  push:
    branches: [main]
    paths:
      - 'server/**'
      - '.github/workflows/server-deploy.yml'
  workflow_dispatch:

env:
  FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    
    # No services needed! SQLite runs in-process
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Elixir
        uses: erlef/setup-beam@v1
        with:
          elixir-version: '1.16'
          otp-version: '26'
      
      - name: Cache deps
        uses: actions/cache@v4
        with:
          path: |
            server/deps
            server/_build
          key: ${{ runner.os }}-mix-${{ hashFiles('**/mix.lock') }}
          restore-keys: ${{ runner.os }}-mix-
      
      - name: Install dependencies
        run: mix deps.get
      
      - name: Compile
        run: mix compile --warnings-as-errors
      
      - name: Setup test database
        run: mix ecto.create && mix ecto.migrate
        env:
          MIX_ENV: test
      
      - name: Run tests
        run: mix test
        env:
          MIX_ENV: test
      
      - name: Check formatting
        run: mix format --check-formatted
      
      - name: Run Credo
        run: mix credo --strict

  deploy:
    needs: test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Fly.io
        uses: superfly/flyctl-actions/setup-flyctl@master
      
      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
      
      - name: Run migrations
        run: flyctl ssh console -C "/app/bin/migrate"
      
      - name: Notify success
        if: success()
        run: |
          echo "✅ Server deployed successfully!"
          echo "URL: https://loka.fly.dev"

  notify-mobile:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Trigger mobile preview rebuild
        uses: peter-evans/repository-dispatch@v2
        with:
          event-type: server-deployed
          client-payload: '{"ref": "${{ github.ref }}", "sha": "${{ github.sha }}"}'
```

### B.4 GitHub Actions - Mobile Preview

```yaml
# .github/workflows/mobile-preview.yml

name: Mobile Preview Build

on:
  push:
    branches: [main, develop]
    paths:
      - 'apps/mobile/**'
      - '.github/workflows/mobile-preview.yml'
  repository_dispatch:
    types: [server-deployed]
  workflow_dispatch:

jobs:
  preview:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/mobile/package-lock.json
      
      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: TypeScript check
        run: npm run type-check
      
      - name: Run tests
        run: npm test
      
      - name: Configure environment
        run: |
          echo "API_URL=https://loka.fly.dev" >> .env.preview
          echo "SOCKET_URL=wss://loka.fly.dev/socket" >> .env.preview
      
      - name: Build preview
        run: eas build --profile preview --platform all --non-interactive
      
      # For development builds that update automatically
      - name: Publish update
        run: eas update --branch preview --message "Auto-update from ${{ github.sha }}"

  notify:
    needs: preview
    runs-on: ubuntu-latest
    steps:
      - name: Send notification
        run: |
          echo "📱 Mobile preview updated!"
          echo "Open Expo Go and scan the QR code to test"
```

### B.5 Fly.io Configuration

```toml
# server/fly.toml

app = "loka"
primary_region = "sjc"  # San Jose, or your preferred region

[build]
  dockerfile = "Dockerfile"

[env]
  PHX_HOST = "loka.fly.dev"
  PORT = "8080"
  POOL_SIZE = "10"
  ECTO_IPV6 = "true"
  ERL_AFLAGS = "-proto_dist inet6_tcp"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false  # Keep running for WebSocket connections
  auto_start_machines = true
  min_machines_running = 1
  
  [http_service.concurrency]
    type = "connections"
    hard_limit = 1000
    soft_limit = 800

[[services]]
  protocol = "tcp"
  internal_port = 4000  # Telnet port
  
  [[services.ports]]
    port = 4000
    handlers = ["tls"]
  
  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"

[mounts]
  source = "loka_data"
  destination = "/app/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512

[metrics]
  port = 9091
  path = "/metrics"
```

### B.6 Server Dockerfile

```dockerfile
# server/Dockerfile

# Build stage
FROM hexpm/elixir:1.16.0-erlang-26.2.1-debian-bookworm-20231009-slim AS build

RUN apt-get update -y && apt-get install -y build-essential git \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*

WORKDIR /app

# Install hex + rebar
RUN mix local.hex --force && \
    mix local.rebar --force

ENV MIX_ENV=prod

# Install dependencies
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# Copy compile-time config
COPY config/config.exs config/${MIX_ENV}.exs config/
RUN mix deps.compile

# Copy application code
COPY priv priv
COPY lib lib
COPY assets assets

# Compile assets
RUN mix assets.deploy

# Compile application
RUN mix compile

# Copy runtime config
COPY config/runtime.exs config/

# Build release
COPY rel rel
RUN mix release

# Runtime stage
FROM debian:bookworm-slim AS app

RUN apt-get update -y && \
    apt-get install -y libstdc++6 openssl libncurses5 locales ca-certificates \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*

# Set locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

WORKDIR /app
RUN chown nobody /app

ENV MIX_ENV=prod

# Copy release from build stage
COPY --from=build --chown=nobody:root /app/_build/${MIX_ENV}/rel/loka ./

USER nobody

# Start command
CMD ["/app/bin/server"]
```

### B.7 EAS Build Configuration

```json
// apps/mobile/eas.json

{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m1-medium"
      },
      "env": {
        "API_URL": "http://localhost:4000",
        "SOCKET_URL": "ws://localhost:4000/socket"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m1-medium",
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "API_URL": "https://loka.fly.dev",
        "SOCKET_URL": "wss://loka.fly.dev/socket"
      },
      "channel": "preview"
    },
    "production": {
      "ios": {
        "resourceClass": "m1-medium"
      },
      "env": {
        "API_URL": "https://loka.fly.dev",
        "SOCKET_URL": "wss://loka.fly.dev/socket"
      },
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### B.8 Mobile App Configuration

```json
// apps/mobile/app.json

{
  "expo": {
    "name": "Loka",
    "slug": "loka",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a1a2e"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.loka.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Used for profile photos",
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      },
      "package": "com.loka.app",
      "versionCode": 1,
      "permissions": ["INTERNET", "VIBRATE"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "react-native-iap",
        {
          "android": {
            "productIds": [
              "com.loka.gems100",
              "com.loka.gems500",
              "com.loka.gems1200"
            ]
          },
          "ios": {
            "productIds": [
              "com.loka.gems100",
              "com.loka.gems500",
              "com.loka.gems1200"
            ]
          }
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id"
    },
    "runtimeVersion": {
      "policy": "sdkVersion"
    }
  }
}
```

### B.9 Development Workflow Scripts

```bash
#!/bin/bash
# scripts/setup.sh - Initial project setup

set -e

echo "🚀 Setting up Loka development environment..."

# Check prerequisites
command -v elixir >/dev/null 2>&1 || { echo "Elixir is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v flyctl >/dev/null 2>&1 || { echo "Fly CLI is required but not installed."; exit 1; }

# Setup server
echo "📦 Setting up server..."
cd server
mix deps.get
mix ecto.setup
cd ../..

# Setup mobile
echo "📱 Setting up mobile app..."
cd apps/mobile
npm install
cd ../..

# Setup environment files
echo "⚙️ Creating environment files..."

cat > server/.env << EOF
SECRET_KEY_BASE=$(mix phx.gen.secret)
GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
PHX_HOST=localhost
# SQLite uses local file - no DATABASE_URL needed
EOF

cat > apps/mobile/.env.development << EOF
API_URL=http://localhost:4000
SOCKET_URL=ws://localhost:4000/socket
DEBUG_LOGGING=true
EOF

echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  Server: cd server && mix ecto.create && mix ecto.migrate && mix phx.server"
echo "  Mobile: cd apps/mobile && npx expo start"
```

```bash
#!/bin/bash
# scripts/dev.sh - Start development environment

set -e

# No Docker needed for SQLite!

# Start server in background
echo "🔥 Starting Phoenix server..."
cd server
mix ecto.create 2>/dev/null || true  # Create if not exists
mix ecto.migrate
mix phx.server &
SERVER_PID=$!
cd ../..

# Start mobile
echo "📱 Starting Expo..."
cd apps/mobile
npx expo start

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null" EXIT
```

### B.10 Claude Code Workflow (Phone Development)

When using Claude Code on your phone to make changes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PHONE-BASED DEVELOPMENT WORKFLOW                         │
│                                                                              │
│  1. EDIT CODE (Claude Code on phone)                                        │
│     ┌──────────────────────────────────────────────────────────┐            │
│     │  • Open Claude Code app                                   │            │
│     │  • Connect to GitHub repo                                 │            │
│     │  • Make code changes                                      │            │
│     │  • Commit and push to branch                             │            │
│     └──────────────────────────────────────────────────────────┘            │
│                              │                                               │
│                              ▼                                               │
│  2. AUTOMATIC CI/CD (GitHub Actions)                                        │
│     ┌──────────────────────────────────────────────────────────┐            │
│     │  • Tests run automatically                                │            │
│     │  • Server deploys to Fly.io (if tests pass)              │            │
│     │  • Mobile preview build triggered                         │            │
│     └──────────────────────────────────────────────────────────┘            │
│                              │                                               │
│                              ▼                                               │
│  3. TEST ON PHONE (Expo Go / Development Build)                             │
│     ┌──────────────────────────────────────────────────────────┐            │
│     │  Option A: Expo Go (fastest for JS-only changes)         │            │
│     │    • Open Expo Go app                                     │            │
│     │    • Scan QR code or open from recent projects           │            │
│     │    • Changes reflect via OTA update                       │            │
│     │                                                           │            │
│     │  Option B: Development Build (for native changes)        │            │
│     │    • EAS builds new dev client                            │            │
│     │    • Install via TestFlight (iOS) or direct APK (Android)│            │
│     │    • Connect to same preview server                       │            │
│     └──────────────────────────────────────────────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.11 Quick Commands Reference

```bash
# ============================================================
# SERVER COMMANDS
# ============================================================

# Local development
cd server
mix phx.server                    # Start server
mix test                          # Run tests
mix ecto.migrate                  # Run migrations
mix ecto.reset                    # Reset database

# Fly.io deployment
flyctl deploy                     # Deploy to Fly.io
flyctl logs                       # View logs
flyctl ssh console                # SSH into server
flyctl ssh console -C "/app/bin/migrate"  # Run migrations

# ============================================================
# MOBILE COMMANDS
# ============================================================

# Local development
cd apps/mobile
npx expo start                    # Start Expo dev server
npx expo start --tunnel           # Start with tunnel (for phone)
npm test                          # Run tests
npm run type-check                # TypeScript check

# EAS builds
eas build --profile development   # Development build
eas build --profile preview       # Preview build
eas build --profile production    # Production build

# EAS updates (OTA)
eas update --branch preview       # Push OTA update to preview
eas update --branch production    # Push OTA update to production

# ============================================================
# USEFUL ALIASES (add to .bashrc/.zshrc)
# ============================================================

alias loka-server="cd ~/loka/server && mix phx.server"
alias loka-mobile="cd ~/loka/apps/mobile && npx expo start --tunnel"
alias loka-deploy="cd ~/loka/server && flyctl deploy"
alias loka-logs="flyctl logs -a loka"
```

---

## Next Steps

### Phase 1: Core Framework & CI/CD Setup (Weeks 1-4)
- [ ] Initialize monorepo structure
- [ ] Set up GitHub repository with branch protection
- [ ] Configure GitHub Actions for CI/CD
- [ ] Set up Fly.io project with SQLite volume
- [ ] Entity system implementation
- [ ] Basic behaviors (Object, Room, Character)
- [ ] Command pipeline with text parser
- [ ] Simple persistence (Ecto + SQLite)
- [ ] Phoenix Channels game protocol
- [ ] Custom auth with phx.gen.auth + Guardian

### Phase 2: Web Interfaces with LiveView (Weeks 5-8)
- [ ] Game client interface (LiveView)
- [ ] Basic creator tools foundation (LiveView)
- [ ] Admin dashboard skeleton (LiveView)
- [ ] Real-time updates and PubSub integration
- [ ] Mobile-responsive CSS

### Phase 3: React Native Mobile Client (Weeks 9-12)
- [ ] Initialize Expo/React Native project
- [ ] Configure EAS Build for preview builds
- [ ] Phoenix Channel connection (TypeScript)
- [ ] Zustand stores for game state
- [ ] Core game screens (Game, Inventory, Skills)
- [ ] Direction pad and command input
- [ ] Set up OTA updates with EAS Update

### Phase 4: Scripting System (Weeks 13-16)
- [ ] Lua integration via Luerl
- [ ] Security sandbox implementation
- [ ] Script editor UI in creator tools
- [ ] Script testing and validation
- [ ] Example scripts library

### Phase 5: IAP & Monetization (Weeks 17-20)
- [ ] react-native-iap integration
- [ ] Apple App Store verification
- [ ] Google Play Billing verification
- [ ] Stripe integration for web purchases
- [ ] Wallet and transaction system
- [ ] Revenue analytics dashboard

### Phase 6: Polish & Testing (Weeks 21-24)
- [ ] E2E encrypted messaging
- [ ] Terminal/Telnet client (optional)
- [ ] Performance optimization
- [ ] Documentation and examples
- [ ] Beta testing with TestFlight/Internal Track

### Phase 7: Production Launch (Weeks 25-28)
- [ ] App Store submission
- [ ] Play Store submission
- [ ] Production monitoring setup
- [ ] Marketing site and documentation
- [ ] Community Discord/forums

---

## Implementation Checklist for Claude Code

When Claude Code builds this project, follow this order:

### 1. Repository Setup
```bash
# Create monorepo structure
mkdir -p loka/{apps/{server,mobile},packages,docs,scripts,.github/workflows}
cd loka
git init

# Initialize root package.json for monorepo scripts
cat > package.json << 'EOF'
{
  "name": "loka",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "server": "cd server && mix phx.server",
    "mobile": "cd apps/mobile && npx expo start",
    "mobile:tunnel": "cd apps/mobile && npx expo start --tunnel",
    "deploy": "cd server && fly deploy",
    "logs": "fly logs -a loka",
    "debug": "./scripts/debug.sh"
  }
}
EOF
```

### 2. Server Setup (Elixir/Phoenix)
```bash
cd server

# Create new Phoenix app with SQLite
mix phx.new . --app loka --database sqlite --live

# Add to mix.exs deps:
# {:ecto_sqlite3, "~> 0.15"},       # SQLite adapter
# {:guardian, "~> 2.3"},            # JWT for mobile auth
# {:luerl, "~> 1.0"},               # Lua scripting
# {:phoenix_live_dashboard, "~> 0.8"}, # Already included
# {:argon2_elixir, "~> 4.0"},       # Secure password hashing

# Install dependencies
mix deps.get

# Generate authentication
mix phx.gen.auth Accounts Player players

# Create database directory and run migrations
mkdir -p data
mix ecto.create
mix ecto.migrate
```

### 3. Mobile Setup (React Native/Expo)
```bash
cd apps/mobile

# Create Expo app with TypeScript
npx create-expo-app . --template expo-template-blank-typescript

# Install core dependencies
npm install phoenix zustand @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install @react-native-async-storage/async-storage
npm install react-native-iap  # For in-app purchases

# Install dev dependencies
npm install -D @types/phoenix

# Initialize EAS
npx eas-cli init
npx eas-cli build:configure
```

### 4. Fly.io Setup (SQLite + Volume)
```bash
cd server

# Launch Fly app (creates fly.toml)
fly launch --name loka --region sjc --no-deploy

# Create a volume for SQLite persistence (1GB = $0.15/month)
fly volumes create loka_data --region sjc --size 1

# Set secrets
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
fly secrets set DEBUG_TOKEN=$(openssl rand -hex 16)

# Deploy
fly deploy

# Run migrations (after first deploy)
fly ssh console -C "/app/bin/migrate"
```

**Important fly.toml settings for SQLite:**
```toml
# Add to fly.toml
[mounts]
  source = "loka_data"
  destination = "/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

### 5. Key Files to Create (In Order)

**Phase 1: Server Foundation**
```
server/
├── mix.exs                              # Dependencies
├── config/config.exs                    # Base config
├── config/dev.exs                       # Dev config
├── config/runtime.exs                   # Runtime/production config
├── fly.toml                             # Fly.io config
├── Dockerfile                           # Container build
├── lib/loka/
│   ├── accounts/                        # Generated by phx.gen.auth
│   │   ├── player.ex
│   │   └── player_token.ex
│   ├── auth/
│   │   └── guardian.ex                  # JWT configuration
│   └── application.ex                   # App supervisor
└── lib/loka_web/
    ├── router.ex                        # Routes
    ├── channels/
    │   ├── game_channel.ex              # Main game channel
    │   └── debug_channel.ex             # Debug logging
    └── controllers/api/
        └── auth_controller.ex           # Mobile auth API
```

**Phase 2: Game Engine Core**
```
lib/loka/
├── engine/
│   ├── entity.ex                        # Entity struct
│   ├── entity_server.ex                 # GenServer per entity
│   ├── entity_registry.ex               # Process registry
│   └── entity_supervisor.ex             # Dynamic supervisor
├── components/
│   ├── combatant.ex
│   ├── container.ex
│   └── ...
├── behaviors/
│   ├── default_object.ex
│   ├── default_room.ex
│   └── ...
├── commands/
│   ├── command.ex                       # Command behaviour
│   ├── parser.ex                        # Text parser
│   ├── look.ex
│   ├── move.ex
│   └── ...
└── game/
    ├── session.ex                       # Player session
    └── world.ex                         # World state
```

**Phase 3: Mobile Client**
```
apps/mobile/src/
├── App.tsx                              # Entry point
├── services/
│   ├── phoenix/
│   │   ├── socket.ts                    # Socket connection
│   │   └── gameChannel.ts               # Game channel
│   └── api/
│       ├── client.ts                    # HTTP client
│       └── auth.ts                      # Auth service
├── store/
│   ├── authStore.ts                     # Zustand auth state
│   └── gameStore.ts                     # Zustand game state
├── hooks/
│   ├── useAuth.ts
│   └── useGameConnection.ts
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   └── game/
│       └── GameScreen.tsx
├── components/
│   └── game/
│       ├── RoomView.tsx
│       ├── MessageLog.tsx
│       ├── CommandInput.tsx
│       └── DirectionPad.tsx
└── utils/
    ├── config.ts                        # Environment config
    └── remoteLogger.ts                  # Debug logging
```

**Phase 4: CI/CD**
```
.github/workflows/
├── server-ci.yml                        # Server tests
├── server-deploy.yml                    # Deploy to Fly.io
├── mobile-ci.yml                        # Mobile tests
└── mobile-preview.yml                   # EAS preview builds
```

### 6. Environment Variables

**Fly.io Secrets (set via `fly secrets set`):**
```bash
SECRET_KEY_BASE          # Phoenix secret (required)
GUARDIAN_SECRET_KEY      # JWT signing key (required)
DEBUG_TOKEN              # Debug dashboard access (optional)
APPLE_SHARED_SECRET      # App Store IAP (add later)
GOOGLE_SERVICE_ACCOUNT   # Play Store IAP (add later)
STRIPE_SECRET_KEY        # Web payments (add later)

# Note: No DATABASE_URL needed! SQLite uses local file at /data/loka.db
```

**Mobile Environment (.env files):**
```bash
# .env.development
API_URL=http://localhost:4000
SOCKET_URL=ws://localhost:4000/socket
DEBUG_LOGGING=true

# .env.preview
API_URL=https://loka.fly.dev
SOCKET_URL=wss://loka.fly.dev/socket
DEBUG_LOGGING=true

# .env.production
API_URL=https://loka.fly.dev
SOCKET_URL=wss://loka.fly.dev/socket
DEBUG_LOGGING=false
```

**GitHub Secrets (for Actions):**
```
FLY_API_TOKEN            # fly auth token
EXPO_TOKEN               # npx eas-cli login
```

### 7. Development Commands Quick Reference

```bash
# Local development
cd server && mix phx.server          # Start server
cd apps/mobile && npx expo start --tunnel # Start mobile (accessible from phone)

# Deployment
cd server && fly deploy              # Deploy server
cd apps/mobile && eas build --profile preview # Build mobile preview

# Debugging
fly logs -a loka                         # Stream server logs
open https://loka.fly.dev/debug/logs     # Debug dashboard

# Database (SQLite)
fly ssh console -a loka                  # SSH into server
/app/bin/loka remote                     # IEx console
sqlite3 /data/loka.db                    # SQLite CLI (inside SSH)

# Backup database
fly ssh console -C "sqlite3 /data/loka.db '.backup /data/backup.db'"
fly sftp get /data/backup.db              # Download backup locally

# Testing
cd server && mix test                # Server tests
cd apps/mobile && npm test                # Mobile tests
```

---

This architecture provides a complete foundation for building a modern MUD engine with:
- **Single React Native codebase** for iOS and Android
- **Custom Phoenix authentication** with no external dependencies
- **SQLite database** on same machine (zero latency, ~$5/month total)
- **Real-time updates** via Phoenix Channels
- **Debug log streaming** for Claude Code development
- **Instant preview** on your phone via Expo/EAS
- **Automatic deployment** via GitHub Actions to Fly.io
