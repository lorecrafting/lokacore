defmodule Loka.Framework.Actions.Resolver do
  @moduledoc """
  Resolves available actions by layering modifiers.

  ## Action Resolution Layers

  Actions are computed through multiple layers:

  1. **Entity Base Actions** - Actions defined on the entity prototype
  2. **Equipment Grants** (Union) - Equipment can add actions to the player
  3. **Status Blocks** (Remove) - Status effects can disable certain actions
  4. **Room Restrictions** (Remove/Intersect) - Location can restrict actions
  5. **Script Modifiers** - Scripts can dynamically add/remove actions
  6. **Condition Filtering** - Final filter based on player state conditions

  ## Merge Types

  - **Union**: Combine actions, no duplicates (used for equipment grants)
  - **Remove**: Filter out specific actions (used for status blocks, room restrictions)
  - **Replace**: Completely replace all actions (used for transformations)
  - **Intersect**: Only actions in both sets survive (used for restricted zones)

  ## Usage

      alias Loka.Framework.Actions.Resolver

      # Get available actions for an entity given player state
      actions = Resolver.resolve(entity, game_state, room)

      # Returns list of %Action{} structs that are available
  """

  alias Loka.Framework.Actions.Action
  alias Loka.Framework.Conditions.Evaluator
  alias Loka.Framework.Status.StatusManager
  alias Loka.Framework.Player.GameState

  require Logger

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Resolves the available actions for an entity given the player's state.

  Returns a list of Action structs that are available to the player.
  """
  @spec resolve(map(), GameState.t(), map() | nil) :: [Action.t()]
  def resolve(entity, %GameState{} = game_state, room \\ nil) do
    # Check for full replacement first (transformation/possession)
    case get_replacement_actions(game_state) do
      {:replace, actions} ->
        # Player is transformed - use ONLY replacement actions
        actions
        |> filter_by_conditions(game_state)
        |> sort_by_priority()

      :none ->
        entity
        |> get_entity_actions()
        |> union_equipment_actions(game_state)
        |> union_script_granted_actions(game_state)
        |> remove_status_blocked(game_state)
        |> remove_script_blocked(game_state)
        |> apply_room_modifiers(room)
        |> filter_by_conditions(game_state)
        |> sort_by_priority()
    end
  end

  @doc """
  Serializes resolved actions for sending to the client.
  """
  @spec serialize([Action.t()]) :: [map()]
  def serialize(actions) do
    Enum.map(actions, &Action.to_map/1)
  end

  # =============================================================================
  # Layer 1: Entity Base Actions
  # =============================================================================

  @doc """
  Gets the base actions defined on an entity.

  Checks for explicit `actions` component first, falls back to defaults.
  """
  def get_entity_actions(entity) do
    explicit_actions = get_explicit_actions(entity)

    if Enum.any?(explicit_actions) do
      explicit_actions
    else
      get_default_actions(entity)
    end
  end

  defp get_explicit_actions(entity) do
    components = Map.get(entity, :components) || %{}

    actions_data =
      Map.get(components, "actions") ||
        Map.get(components, :actions) ||
        []

    actions_data
    |> List.wrap()
    |> Enum.map(&Action.from_map/1)
    |> Enum.reject(&is_nil/1)
  end

  defp get_default_actions(entity) do
    type = Map.get(entity, :type)
    components = Map.get(entity, :components) || %{}
    tags = Map.get(entity, :tags) || []

    case type do
      t when t in [:item, "item"] ->
        get_default_item_actions(components)

      t when t in [:npc, "npc"] ->
        get_default_npc_actions(components, tags)

      t when t in [:player, "player"] ->
        get_default_player_actions()

      _ ->
        []
    end
  end

  defp get_default_item_actions(components) do
    actions = [Action.new("get", "Get", priority: 100)]

    actions =
      if has_component?(components, "container") do
        actions ++ [Action.new("open", "Open", priority: 90)]
      else
        actions
      end

    actions =
      if has_component?(components, "equipable") do
        actions ++ [Action.new("equip", "Equip", priority: 80)]
      else
        actions
      end

    actions =
      if has_component?(components, "consumable") do
        actions ++ [Action.new("use", "Use", priority: 85)]
      else
        actions
      end

    actions
  end

  defp get_default_npc_actions(components, tags) do
    actions = []

    actions =
      if has_component?(components, "dialogue_tree") do
        actions ++ [Action.new("talk", "Talk", priority: 100)]
      else
        actions
      end

    actions =
      if has_component?(components, "shop") do
        actions ++ [Action.new("shop", "Browse Wares", priority: 90)]
      else
        actions
      end

    actions =
      if has_component?(components, "combatant") and "friendly" not in tags do
        actions ++ [Action.new("attack", "Attack", priority: 50)]
      else
        actions
      end

    actions =
      if has_component?(components, "container") do
        actions ++ [Action.new("open", "Open", priority: 80)]
      else
        actions
      end

    actions
  end

  defp get_default_player_actions do
    [
      Action.new("whisper", "Whisper", priority: 80),
      Action.new("invite", "Invite to Group", priority: 70),
      Action.new("inspect", "View Profile", priority: 60)
    ]
  end

  # =============================================================================
  # Layer 2: Equipment Grants (Union)
  # =============================================================================

  defp union_equipment_actions(actions, %GameState{} = game_state) do
    equipment = Map.get(game_state, :equipment) || %{}

    equipment_actions =
      equipment
      |> Map.values()
      |> Enum.reject(&is_nil/1)
      |> Enum.flat_map(&get_equipment_granted_actions/1)

    # Union = combine, keep first occurrence of each key
    union_actions(actions, equipment_actions)
  end

  defp get_equipment_granted_actions(item_id) when is_binary(item_id) do
    case Loka.Engine.Entities.get_entity(item_id) do
      nil ->
        []

      schema ->
        entity = Loka.Engine.Entities.to_entity(schema)
        components = Map.get(entity, :components) || %{}

        grants =
          Map.get(components, "grants_actions") ||
            Map.get(components, :grants_actions) ||
            []

        grants
        |> List.wrap()
        |> Enum.map(&Action.from_map/1)
        |> Enum.reject(&is_nil/1)
    end
  end

  defp get_equipment_granted_actions(_), do: []

  # =============================================================================
  # Layer 3: Script Grants (Union)
  # =============================================================================

  defp union_script_granted_actions(actions, %GameState{} = game_state) do
    # Scripts can store granted actions in player flags
    script_actions =
      game_state
      |> get_flag("_granted_actions", [])
      |> Enum.map(&Action.from_map/1)
      |> Enum.reject(&is_nil/1)

    union_actions(actions, script_actions)
  end

  # =============================================================================
  # Layer 4: Status Blocks (Remove)
  # =============================================================================

  defp remove_status_blocked(actions, %GameState{} = game_state) do
    player_id = to_string(game_state.player_id)
    active_statuses = StatusManager.get_active(player_id)

    blocked_keys =
      active_statuses
      |> Enum.flat_map(&get_status_blocked_actions/1)
      |> MapSet.new()

    Enum.reject(actions, fn action ->
      action.key in blocked_keys
    end)
  end

  defp get_status_blocked_actions(active_status) do
    case Loka.Framework.Status.StatusRegistry.get(active_status.status_key) do
      {:ok, status_def} ->
        Map.get(status_def, :removes_actions) ||
          Map.get(status_def, "removes_actions") ||
          []

      _ ->
        []
    end
  end

  # =============================================================================
  # Layer 5: Script Blocks (Remove)
  # =============================================================================

  defp remove_script_blocked(actions, %GameState{} = game_state) do
    blocked_keys =
      game_state
      |> get_flag("_blocked_actions", [])
      |> MapSet.new()

    Enum.reject(actions, fn action ->
      action.key in blocked_keys
    end)
  end

  # =============================================================================
  # Layer 6: Room Modifiers (Remove/Intersect)
  # =============================================================================

  defp apply_room_modifiers(actions, nil), do: actions

  defp apply_room_modifiers(actions, room) do
    components = Map.get(room, :components) || %{}

    restrictions =
      Map.get(components, "action_restrictions") ||
        Map.get(components, :action_restrictions) ||
        %{}

    actions
    |> apply_room_remove(restrictions)
    |> apply_room_intersect(restrictions)
  end

  defp apply_room_remove(actions, restrictions) do
    remove_keys =
      (Map.get(restrictions, "remove") || Map.get(restrictions, :remove) || [])
      |> MapSet.new()

    if MapSet.size(remove_keys) > 0 do
      Enum.reject(actions, fn action -> action.key in remove_keys end)
    else
      actions
    end
  end

  defp apply_room_intersect(actions, restrictions) do
    intersect_keys = Map.get(restrictions, "intersect") || Map.get(restrictions, :intersect)

    if intersect_keys && intersect_keys != [] do
      allowed_set = MapSet.new(intersect_keys)
      Enum.filter(actions, fn action -> action.key in allowed_set end)
    else
      actions
    end
  end

  # =============================================================================
  # Layer 7: Transformation/Replacement
  # =============================================================================

  defp get_replacement_actions(%GameState{} = game_state) do
    player_id = to_string(game_state.player_id)
    active_statuses = StatusManager.get_active(player_id)

    # Find any status that replaces all actions
    replacement =
      Enum.find_value(active_statuses, fn active_status ->
        case Loka.Framework.Status.StatusRegistry.get(active_status.status_key) do
          {:ok, status_def} ->
            if Map.get(status_def, :replaces_all_actions) ||
                 Map.get(status_def, "replaces_all_actions") do
              grants =
                Map.get(status_def, :grants_actions) ||
                  Map.get(status_def, "grants_actions") ||
                  []

              grants
              |> List.wrap()
              |> Enum.map(&Action.from_map/1)
              |> Enum.reject(&is_nil/1)
            else
              nil
            end

          _ ->
            nil
        end
      end)

    if replacement do
      {:replace, replacement}
    else
      :none
    end
  end

  # =============================================================================
  # Condition Filtering
  # =============================================================================

  defp filter_by_conditions(actions, %GameState{} = game_state) do
    Enum.filter(actions, fn action ->
      Evaluator.evaluate_all(action.conditions, game_state)
    end)
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp union_actions(base_actions, new_actions) do
    existing_keys = MapSet.new(base_actions, & &1.key)

    new_unique =
      Enum.reject(new_actions, fn action ->
        action.key in existing_keys
      end)

    base_actions ++ new_unique
  end

  defp sort_by_priority(actions) do
    Enum.sort_by(actions, & &1.priority, :desc)
  end

  defp has_component?(components, name) do
    Map.has_key?(components, name) or Map.has_key?(components, String.to_atom(name))
  end

  defp get_flag(%GameState{flags: flags}, key, default) when is_map(flags) do
    Map.get(flags, key) || Map.get(flags, to_string(key)) || default
  end

  defp get_flag(_, _, default), do: default
end
