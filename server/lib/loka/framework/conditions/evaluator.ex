defmodule Loka.Framework.Conditions.Evaluator do
  @moduledoc """
  Unified condition evaluation for game state checks.

  Used by:
  - Quest chains (next quest selection)
  - Journal entries (visibility conditions)
  - Dialogue choices (show_if conditions)
  - Ability requirements

  ## Supported Conditions

  ### Quest Conditions
  - `quest_completed` / `quest_not_completed` - Quest completion status
  - `quest_active` / `quest_not_active` - Quest active status

  ### Player State Conditions
  - `flag` - Player has flag set
  - `level_gte` - Player level >= value
  - `has_item` / `item_has` - Player has item in inventory
  - `not_has_item` - Player does NOT have item in inventory
  - `stat_gte` - Player stat >= value
  - `faction_gte` - Faction reputation >= value

  ## Condition Formats

  Conditions can be specified in multiple formats:

  ### Tuple Format (used in code)
      {:flag, "spoke_to_elder"}
      {:quest_completed, "monastery_arc"}
      {:level_gte, 5}

  ### Map Format (from YAML/JSON)
      %{"flag" => "spoke_to_elder"}
      %{"quest_completed" => "monastery_arc"}
      %{"level_gte" => 5}

  ### Atom Map Format
      %{flag: "spoke_to_elder"}
      %{quest_completed: "monastery_arc"}
      %{level_gte: 5}

  ## Examples

      iex> Evaluator.evaluate({:flag, "spoke_to_elder"}, entity)
      true

      iex> Evaluator.evaluate(%{"quest_completed" => "main_quest"}, entity)
      false

      iex> Evaluator.evaluate_all([{:level_gte, 5}, {:flag, "unlocked"}], entity)
      true
  """

  require Logger

  alias Loka.Engine.Entity
  alias Loka.Framework.Quest.StateHelper

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Evaluate a single condition against a character entity.

  Returns `true` if condition is met, `false` otherwise.
  Unknown conditions return `true` (permissive default).
  """
  @spec evaluate(term(), Entity.t()) :: boolean()
  def evaluate(condition, %Entity{} = entity) do
    condition
    |> normalize()
    |> do_evaluate(entity)
  end

  @doc """
  Evaluate multiple conditions, all must pass (AND logic).

  Returns `true` if all conditions are met, `false` if any fails.
  """
  @spec evaluate_all(list(), Entity.t()) :: boolean()
  def evaluate_all(conditions, %Entity{} = entity) when is_list(conditions) do
    Enum.all?(conditions, &evaluate(&1, entity))
  end

  def evaluate_all(nil, _entity), do: true
  def evaluate_all([], _entity), do: true

  @doc """
  Evaluate multiple conditions, any must pass (OR logic).

  Returns `true` if any condition is met.
  """
  @spec evaluate_any(list(), Entity.t()) :: boolean()
  def evaluate_any(conditions, %Entity{} = entity) when is_list(conditions) do
    Enum.any?(conditions, &evaluate(&1, entity))
  end

  def evaluate_any(nil, _entity), do: false
  def evaluate_any([], _entity), do: false

  @doc """
  Evaluate a show_if map condition (commonly used in dialogue/journal).

  This is a convenience function for map-based conditions that may have
  multiple keys. Evaluates all keys as AND conditions.
  """
  @spec evaluate_show_if(map() | nil, Entity.t()) :: boolean()
  def evaluate_show_if(nil, _entity), do: true

  def evaluate_show_if(condition, %Entity{} = entity) when is_map(condition) do
    # Each key in the map is an independent condition
    Enum.all?(condition, fn {key, value} ->
      evaluate({key, value}, entity)
    end)
  end

  # =============================================================================
  # Normalization - Convert Various Formats to Standard Tuples
  # =============================================================================

  defp normalize(:default), do: :default
  defp normalize(nil), do: :default

  # Already normalized tuple format
  defp normalize({:flag, _} = c), do: c
  defp normalize({:quest_completed, _} = c), do: c
  defp normalize({:quest_not_completed, _} = c), do: c
  defp normalize({:quest_active, _} = c), do: c
  defp normalize({:quest_not_active, _} = c), do: c
  defp normalize({:level_gte, _} = c), do: c
  defp normalize({:item_has, _} = c), do: c
  defp normalize({:has_item, _} = c), do: c
  defp normalize({:not_has_item, _} = c), do: c
  defp normalize({:stat_gte, _, _} = c), do: c
  defp normalize({:faction_gte, _, _} = c), do: c

  # String key/value pairs (from map iteration or YAML)
  defp normalize({"flag", value}), do: {:flag, value}
  defp normalize({"quest_completed", value}), do: {:quest_completed, value}
  defp normalize({"quest_not_completed", value}), do: {:quest_not_completed, value}
  defp normalize({"quest_active", value}), do: {:quest_active, value}
  defp normalize({"quest_not_active", value}), do: {:quest_not_active, value}
  defp normalize({"level_gte", value}), do: {:level_gte, value}
  defp normalize({"item_has", value}), do: {:item_has, value}
  defp normalize({"has_item", value}), do: {:has_item, value}
  defp normalize({"not_has_item", value}), do: {:not_has_item, value}
  defp normalize({"stat_gte", [stat, value]}), do: {:stat_gte, stat, value}
  defp normalize({"faction_gte", [faction, value]}), do: {:faction_gte, faction, value}

  # Map format (from YAML) - string keys
  defp normalize(%{"flag" => value}), do: {:flag, value}
  defp normalize(%{"quest_completed" => value}), do: {:quest_completed, value}
  defp normalize(%{"quest_not_completed" => value}), do: {:quest_not_completed, value}
  defp normalize(%{"quest_active" => value}), do: {:quest_active, value}
  defp normalize(%{"quest_not_active" => value}), do: {:quest_not_active, value}
  defp normalize(%{"level_gte" => value}), do: {:level_gte, value}
  defp normalize(%{"item_has" => value}), do: {:item_has, value}
  defp normalize(%{"has_item" => value}), do: {:has_item, value}
  defp normalize(%{"not_has_item" => value}), do: {:not_has_item, value}

  defp normalize(%{"stat_gte" => %{"stat" => stat, "value" => value}}),
    do: {:stat_gte, stat, value}

  defp normalize(%{"faction_gte" => %{"faction" => faction, "value" => value}}),
    do: {:faction_gte, faction, value}

  # Map format - atom keys
  defp normalize(%{flag: value}), do: {:flag, value}
  defp normalize(%{quest_completed: value}), do: {:quest_completed, value}
  defp normalize(%{quest_not_completed: value}), do: {:quest_not_completed, value}
  defp normalize(%{quest_active: value}), do: {:quest_active, value}
  defp normalize(%{quest_not_active: value}), do: {:quest_not_active, value}
  defp normalize(%{level_gte: value}), do: {:level_gte, value}
  defp normalize(%{item_has: value}), do: {:item_has, value}
  defp normalize(%{has_item: value}), do: {:has_item, value}
  defp normalize(%{not_has_item: value}), do: {:not_has_item, value}
  defp normalize(%{stat_gte: %{stat: stat, value: value}}), do: {:stat_gte, stat, value}

  defp normalize(%{faction_gte: %{faction: faction, value: value}}),
    do: {:faction_gte, faction, value}

  # Type-based format (used in some YAML configs)
  defp normalize(%{"type" => "default"}), do: :default
  defp normalize(%{"type" => "flag", "flag" => flag}), do: {:flag, flag}
  defp normalize(%{"type" => "quest_completed", "quest_id" => id}), do: {:quest_completed, id}
  defp normalize(%{"type" => "quest_active", "quest_id" => id}), do: {:quest_active, id}
  defp normalize(%{"type" => "level_gte", "level" => level}), do: {:level_gte, level}
  defp normalize(%{"type" => "item_has", "item_id" => id}), do: {:item_has, id}

  defp normalize(%{type: "default"}), do: :default
  defp normalize(%{type: "flag", flag: flag}), do: {:flag, flag}
  defp normalize(%{type: "quest_completed", quest_id: id}), do: {:quest_completed, id}
  defp normalize(%{type: "quest_active", quest_id: id}), do: {:quest_active, id}
  defp normalize(%{type: "level_gte", level: level}), do: {:level_gte, level}
  defp normalize(%{type: "item_has", item_id: id}), do: {:item_has, id}

  # Unknown format - log warning and return default
  defp normalize(unknown) do
    Logger.warning("[ConditionEvaluator] Unknown condition format: #{inspect(unknown)}")
    :default
  end

  # =============================================================================
  # Evaluation - Actual Condition Checks
  # =============================================================================

  defp do_evaluate(:default, _entity), do: true

  # Flag conditions
  defp do_evaluate({:flag, flag_name}, %Entity{} = entity) do
    flags = Entity.get_component(entity, "flags") || %{}
    truthy?(get_flexible(flags, flag_name, nil))
  end

  # Quest completion conditions
  defp do_evaluate({:quest_completed, quest_id}, %Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    completed = StateHelper.get_completed(quests)
    quest_id in completed
  end

  defp do_evaluate({:quest_not_completed, quest_id}, %Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    completed = StateHelper.get_completed(quests)
    quest_id not in completed
  end

  # Quest active conditions
  defp do_evaluate({:quest_active, quest_id}, %Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active_quests = StateHelper.get_active(quests)
    Map.has_key?(active_quests, quest_id)
  end

  defp do_evaluate({:quest_not_active, quest_id}, %Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active_quests = StateHelper.get_active(quests)
    not Map.has_key?(active_quests, quest_id)
  end

  # Level condition
  defp do_evaluate({:level_gte, level}, %Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    player_level = get_flexible(stats, :level, 1)
    player_level >= level
  end

  # Item conditions (both aliases)
  defp do_evaluate({:item_has, item_id}, %Entity{} = entity) do
    inventory = Entity.get_component(entity, "inventory") || []
    has_item?(inventory, item_id)
  end

  defp do_evaluate({:has_item, item_id}, entity) do
    do_evaluate({:item_has, item_id}, entity)
  end

  defp do_evaluate({:not_has_item, item_id}, entity) do
    not do_evaluate({:item_has, item_id}, entity)
  end

  # Stat condition
  defp do_evaluate({:stat_gte, stat, value}, %Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    current = get_flexible(stats, stat, 0)
    current >= value
  end

  # Faction reputation condition
  # Note: Factions are stored in flags as "faction_<id>" keys
  defp do_evaluate({:faction_gte, faction_id, value}, %Entity{} = entity) do
    flags = Entity.get_component(entity, "flags") || %{}
    # Look for faction reputation in flags (e.g., "faction_monastery" => 50)
    faction_key = "faction_#{faction_id}"
    current = get_flexible(flags, faction_key, 0)
    current >= value
  end

  # Unknown condition - permissive default
  defp do_evaluate(unknown, _entity) do
    Logger.warning("[ConditionEvaluator] Unknown normalized condition: #{inspect(unknown)}")
    true
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  # Get value with flexible string/atom key support
  defp get_flexible(map, key, default) when is_map(map) do
    cond do
      # Try exact key first
      Map.has_key?(map, key) ->
        Map.get(map, key)

      # If key is a string, try atom version
      is_binary(key) and Map.has_key?(map, String.to_atom(key)) ->
        Map.get(map, String.to_atom(key))

      # If key is an atom, try string version
      is_atom(key) and Map.has_key?(map, to_string(key)) ->
        Map.get(map, to_string(key))

      true ->
        default
    end
  end

  # Check if inventory contains item (handles various inventory formats)
  # item_key_or_id can be either an item key (e.g., "meditation_incense") or entity ID
  defp has_item?(inventory, item_key_or_id) when is_list(inventory) do
    Enum.any?(inventory, fn
      item when is_binary(item) ->
        # Direct match (could be entity ID matching entity ID, or item key matching item key)
        if item == item_key_or_id do
          true
        else
          # Look up entity in database to check if its key matches
          # This handles the case where inventory contains entity IDs but we're checking for item keys
          try do
            case Loka.Engine.Entities.get_entity(item) do
              %{key: entity_key} when is_binary(entity_key) ->
                entity_key == item_key_or_id

              nil ->
                false

              entity ->
                # Try to get key from entity map
                entity_key = Map.get(entity, :key) || Map.get(entity, "key")
                entity_key == item_key_or_id
            end
          rescue
            # Handle database connection errors (e.g., in async tests without DB access)
            _ -> false
          end
        end

      item when is_map(item) ->
        get_flexible(item, :key, nil) == item_key_or_id or
          get_flexible(item, :id, nil) == item_key_or_id

      _ ->
        false
    end)
  end

  defp has_item?(_, _), do: false

  # Check if value is truthy (not nil, not false)
  defp truthy?(nil), do: false
  defp truthy?(false), do: false
  defp truthy?(_), do: true
end
