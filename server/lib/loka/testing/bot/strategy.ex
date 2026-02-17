defmodule Loka.Testing.Bot.Strategy do
  @moduledoc """
  Behaviour for bot decision-making strategies.

  Strategies define how bots make decisions about what actions to take
  based on their current context (room, nearby entities, game state).

  ## Implementing a Strategy

      defmodule MyStrategy do
        @behaviour Loka.Testing.Bot.Strategy

        @impl true
        def init(opts) do
          {:ok, %{step_count: 0, max_steps: Keyword.get(opts, :max_steps, 100)}}
        end

        @impl true
        def decide(context, state) do
          # Decide what action to take based on context
          action = pick_action(context)
          new_state = %{state | step_count: state.step_count + 1}
          {action, new_state}
        end

        @impl true
        def handle_event(event, state) do
          # React to game events
          {:ok, state}
        end
      end

  ## Action Types

  Actions are tuples where the first element is the action type:

  ### Movement
  - `{:move, direction}` - Move in a direction (e.g., "north", "south")

  ### Combat
  - `{:attack, entity_id}` - Start combat with an entity
  - `{:combat_action, :attack | :defend | :flee}` - Basic combat action
  - `{:use_ability, ability_key}` - Use an ability in combat (e.g., "power_strike")

  ### Dialogue
  - `{:start_dialogue, npc_id}` - Start talking to an NPC
  - `{:dialogue_choice, choice_index}` - Select a dialogue option (0-indexed)
  - `{:dialogue_action, action}` - Execute a dialogue action directly

  ### Gathering & Crafting
  - `{:gather, node_key}` - Gather from a resource node in the room
  - `{:craft, recipe_key, tool_id}` - Craft a recipe using a tool

  ### Inventory
  - `{:interact, entity_id}` - Interact with an entity (NPC dialogue, pick up item)
  - `{:use_item, item_id}` - Use an item from inventory
  - `{:equip, item_id, slot}` - Equip an item
  - `{:unequip, slot}` - Unequip from a slot

  ### Utility
  - `{:wait, duration_ms}` - Wait before next decision
  - `:idle` - Do nothing this tick

  ## Context Structure

  The context passed to `decide/2` contains:

      %{
        bot: %{id: "uuid", name: "Bot 1"},
        game_state: %{...},
        room: %Entity{...} | nil,
        nearby_entities: [%Entity{...}],
        in_combat: false,
        combat_state: nil | %{...}
      }
  """

  alias Loka.Engine.Entity

  # =============================================================================
  # Types
  # =============================================================================

  @type direction :: String.t()
  @type entity_id :: String.t()
  @type item_id :: String.t()
  @type slot :: :weapon | :armor | :accessory

  @type ability_key :: String.t()
  @type node_key :: String.t()
  @type recipe_key :: String.t()
  @type choice_index :: non_neg_integer()
  @type dialogue_action ::
          {:accept_quest, String.t()}
          | {:complete_quest, String.t()}
          | {:give_item, String.t()}
          | {:set_flag, String.t()}

  # Movement
  @type action ::
          {:move, direction()}
          # Combat
          | {:attack, entity_id()}
          | {:combat_action, :attack | :defend | :flee}
          | {:use_ability, ability_key()}
          # Dialogue
          | {:start_dialogue, entity_id()}
          | {:dialogue_choice, choice_index()}
          | {:dialogue_action, dialogue_action()}
          # Gathering & Crafting
          | {:gather, node_key()}
          | {:craft, recipe_key(), item_id()}
          # Inventory
          | {:interact, entity_id()}
          | {:use_item, item_id()}
          | {:equip, item_id(), slot()}
          | {:unequip, slot()}
          # Utility
          | {:wait, non_neg_integer()}
          | :idle

  @type context :: %{
          bot: %{id: String.t(), name: String.t()},
          game_state: map(),
          room: Entity.t() | nil,
          nearby_entities: [Entity.t()],
          in_combat: boolean(),
          combat_state: map() | nil
        }

  @type state :: map()
  @type opts :: keyword()

  # =============================================================================
  # Callbacks
  # =============================================================================

  @doc """
  Initializes the strategy state.

  Called once when the bot starts with the given strategy.
  Returns `{:ok, initial_state}`.
  """
  @callback init(opts()) :: {:ok, state()}

  @doc """
  Decides what action to take based on current context.

  Called each tick (or when the bot is ready for a new action).
  Returns `{action, new_state}`.

  The context contains:
  - `bot` - Bot identification info
  - `game_state` - Current game state map (inventory, stats, health, etc.)
  - `room` - Current room entity (or nil if unknown)
  - `nearby_entities` - Entities in the current room
  - `in_combat` - Whether the bot is currently in combat
  - `combat_state` - Combat state if in combat
  """
  @callback decide(context(), state()) :: {action(), state()}

  @doc """
  Handles game events.

  Called when the bot receives events from the game (via EventBus).
  This allows strategies to react to events like taking damage,
  combat ending, etc.

  Returns `{:ok, new_state}`.
  """
  @callback handle_event(event :: map(), state()) :: {:ok, state()}

  # =============================================================================
  # Optional Callbacks
  # =============================================================================

  @doc """
  Called when the bot is about to stop.

  Allows strategies to perform cleanup or final actions.
  """
  @callback terminate(reason :: term(), state()) :: :ok

  @optional_callbacks [terminate: 2]

  # =============================================================================
  # Helper Functions
  # =============================================================================

  @doc """
  Builds a context map for a bot decision.

  Used by the Bot GenServer to construct the context for `decide/2`.
  """
  def build_context(opts) do
    %{
      bot: Keyword.fetch!(opts, :bot),
      game_state: Keyword.fetch!(opts, :game_state),
      room: Keyword.get(opts, :room),
      nearby_entities: Keyword.get(opts, :nearby_entities, []),
      in_combat: Keyword.get(opts, :in_combat, false),
      combat_state: Keyword.get(opts, :combat_state),
      dialogue_state: Keyword.get(opts, :dialogue_state),
      bot_state: Keyword.get(opts, :bot_state)
    }
  end

  @doc """
  Returns a list of available exits from a room entity.

  Useful for strategies that need to pick a direction to move.
  """
  def get_available_exits(nil), do: []

  def get_available_exits(%Entity{} = room) do
    # Get exit entities in the room's contents or from room attributes
    exits = Map.get(room.components || %{}, "exits", %{})

    exits
    |> Map.keys()
    |> Enum.map(&to_string/1)
  end

  # Handle plain map room format (from Room.load_for_display)
  def get_available_exits(%{exits: exits}) when is_list(exits) do
    Enum.map(exits, fn exit ->
      exit[:direction] || exit["direction"]
    end)
    |> Enum.reject(&is_nil/1)
  end

  def get_available_exits(%{"exits" => exits}) when is_list(exits) do
    Enum.map(exits, fn exit ->
      exit[:direction] || exit["direction"]
    end)
    |> Enum.reject(&is_nil/1)
  end

  def get_available_exits(_), do: []

  @doc """
  Filters entities by type.
  """
  def filter_by_type(entities, type) when is_atom(type) do
    Enum.filter(entities, &(&1.type == type))
  end

  @doc """
  Finds combatant entities (NPCs that can be attacked).
  """
  def find_combatants(entities) do
    Enum.filter(entities, fn entity ->
      entity.type == :npc &&
        Map.has_key?(entity.components || %{}, "combatant")
    end)
  end

  @doc """
  Finds interactable entities (NPCs with dialogue_tree, items on ground).
  """
  def find_interactables(entities) do
    Enum.filter(entities, fn entity ->
      case entity.type do
        :npc -> Map.has_key?(entity.components || %{}, "dialogue_tree")
        :item -> true
        _ -> false
      end
    end)
  end

  @doc """
  Checks if health is below a threshold (percentage).
  """
  def health_below?(game_state, threshold_percent) do
    health = Map.get(game_state, :health) || Map.get(game_state, "health") || %{}
    current = Map.get(health, "current") || Map.get(health, :current) || 100
    max = Map.get(health, "max") || Map.get(health, :max) || 100

    if max > 0 do
      current / max * 100 < threshold_percent
    else
      false
    end
  end

  @doc """
  Finds NPCs with dialogue in the list of entities.
  """
  def find_dialogue_npcs(entities) do
    Enum.filter(entities, fn entity ->
      entity.type == :npc &&
        Map.has_key?(entity.components || %{}, "dialogue_tree")
    end)
  end

  @doc """
  Finds gathering nodes in the room.

  Returns a list of {node_key, node_def} tuples.
  """
  def find_gathering_nodes(%Entity{} = room) do
    gathering_nodes = Map.get(room.components || %{}, "gathering_nodes", %{})

    Enum.map(gathering_nodes, fn {node_key, node_state} ->
      uses = Map.get(node_state, "uses_remaining", 1)
      {to_string(node_key), uses}
    end)
    |> Enum.filter(fn {_key, uses} -> uses > 0 end)
  end

  def find_gathering_nodes(_), do: []

  @doc """
  Checks if the bot has an item in their inventory.
  """
  def has_item?(game_state, item_key) do
    inventory = game_state.inventory || []
    Enum.any?(inventory, fn item_id -> String.contains?(item_id, item_key) end)
  end

  @doc """
  Counts items matching a key pattern in inventory.
  """
  def count_items(game_state, item_key) do
    inventory = game_state.inventory || []
    Enum.count(inventory, fn item_id -> String.contains?(item_id, item_key) end)
  end

  @doc """
  Returns available abilities for the bot based on level and cooldowns.

  NOTE: The ability system is not yet implemented. This returns an empty list
  until AbilityRegistry and AbilityCooldowns modules are created.
  """
  def get_available_abilities(_game_state) do
    # Ability system not yet implemented - return empty list
    []
  end

  @doc """
  Checks if an ability is off cooldown.

  NOTE: The ability system is not yet implemented. This always returns true
  until AbilityCooldowns module is created.
  """
  def ability_ready?(_game_state, _ability_key) do
    # Ability system not yet implemented - assume always ready
    true
  end

  @doc """
  Gets quest state from game_state.

  Returns a map with :active, :completed, and :available lists.
  """
  def get_quest_state(game_state) do
    quests = game_state.quests || %{}

    %{
      active: Map.get(quests, "active", []),
      completed: Map.get(quests, "completed", []),
      available: Map.get(quests, "available", [])
    }
  end

  @doc """
  Checks if a quest is active.
  """
  def has_active_quest?(game_state, quest_id) do
    quest_state = get_quest_state(game_state)
    quest_id in quest_state.active
  end

  @doc """
  Checks if a quest is completed.
  """
  def quest_completed?(game_state, quest_id) do
    quest_state = get_quest_state(game_state)
    quest_id in quest_state.completed
  end
end
