defmodule Loka.Framework.Scripting.GameScriptAPI do
  @moduledoc """
  Game-specific Lua API extension for the scripting system.

  This module implements `Loka.Engine.ScriptingExtension` to provide game-specific
  Lua functions without polluting the Engine layer with domain concepts.

  ## Available Functions

  ### Quest Functions (`game.quest.*`)

  - `game.quest.is_active(quest_id)` - Check if quest is active for current player
  - `game.quest.is_complete(quest_id)` - Check if quest is completed
  - `game.quest.complete_objective(quest_id, objective_id)` - Complete an objective

  ### Player Functions (`game.player.*`)

  - `game.player.has_item(item_key)` - Check if current player has item
  - `game.player.has_flag(flag_name)` - Check if current player has flag
  - `game.player.get_stat(stat_name)` - Get a player stat value
  - `game.player.set_flag(flag_name, value)` - Set a player flag (logs intent only)
  - `game.player.get_skill_level(skill_name)` - Get a skill level

  ### Action Functions (`game.actions.*`)

  - `game.actions.is_granted(action_key)` - Check if action is script-granted
  - `game.actions.is_blocked(action_key)` - Check if action is script-blocked
  - `game.actions.get_granted()` - Get list of script-granted action keys
  - `game.actions.get_blocked()` - Get list of script-blocked action keys

  Note: Use dialogue actions to grant/block actions:
  - `set_flag: _granted_actions` with list of action maps
  - `set_flag: _blocked_actions` with list of action keys

  ## Context Requirements

  These functions require a `game_state` to be passed in the script context:

      Scripting.execute(script, entity, %{game_state: player_game_state})

  The `game_state` must be a `Loka.Framework.Player.GameState` struct or a plain map
  with the expected structure (useful for testing).

  ## Example Script

      -- Check quest state for dialogue branching
      if game.quest.is_active("main_sleeping_master") then
        game.message(entity.id, "You're on the right path, traveler.")
      else
        game.message(entity.id, "The monastery needs your help!")
      end

      -- Check player flags
      if game.player.has_flag("spoke_to_elder") then
        return "elder_greeting_return"
      else
        return "elder_greeting_first"
      end
  """

  @behaviour Loka.Engine.ScriptingExtension

  require Logger

  alias Loka.Framework.Player.GameState
  alias Loka.Framework.Quest.Progress
  alias Loka.Framework.Quest.StateHelper

  # =============================================================================
  # ScriptingExtension Callbacks
  # =============================================================================

  @impl true
  def api_namespace, do: "game"

  @impl true
  def api_functions do
    %{
      "quest" => %{
        "is_active" => &quest_is_active/2,
        "is_complete" => &quest_is_complete/2,
        "complete_objective" => &quest_complete_objective/2
      },
      "player" => %{
        "has_item" => &player_has_item/2,
        "has_flag" => &player_has_flag/2,
        "get_stat" => &player_get_stat/2,
        "set_flag" => &player_set_flag/2,
        "get_skill_level" => &player_get_skill_level/2
      },
      "actions" => %{
        "is_granted" => &action_is_granted/2,
        "is_blocked" => &action_is_blocked/2,
        "get_granted" => &action_get_granted/2,
        "get_blocked" => &action_get_blocked/2
      }
    }
  end

  # =============================================================================
  # Quest API Functions (game.quest.*)
  # =============================================================================

  @doc false
  def quest_is_active([quest_id], lua) when is_binary(quest_id) do
    case get_game_state(lua) do
      nil ->
        {[false], lua}

      game_state ->
        active = get_active_quests(game_state)
        result = Map.has_key?(active, quest_id)
        {[result], lua}
    end
  end

  def quest_is_active(_, lua), do: {[false], lua}

  @doc false
  def quest_is_complete([quest_id], lua) when is_binary(quest_id) do
    case get_game_state(lua) do
      nil ->
        {[false], lua}

      game_state ->
        completed = get_completed_quests(game_state)
        result = quest_id in completed
        {[result], lua}
    end
  end

  def quest_is_complete(_, lua), do: {[false], lua}

  @doc false
  def quest_complete_objective([quest_id, objective_id], lua)
      when is_binary(quest_id) and is_binary(objective_id) do
    case get_game_state(lua) do
      nil ->
        {[false], lua}

      game_state ->
        case complete_objective(game_state, quest_id, objective_id) do
          {:ok, _updated_state} ->
            # Note: The updated state isn't persisted here - scripts are read-only
            # Use dialogue actions for state-changing operations
            Logger.debug(
              "[Lua Script] Completed objective #{quest_id}/#{objective_id} (state not persisted)"
            )

            {[true], lua}

          {:error, _reason} ->
            {[false], lua}
        end
    end
  end

  def quest_complete_objective(_, lua), do: {[false], lua}

  # =============================================================================
  # Player API Functions (game.player.*)
  # =============================================================================

  @doc false
  def player_has_item([item_key], lua) when is_binary(item_key) do
    case get_game_state(lua) do
      nil ->
        {[false], lua}

      game_state ->
        result = has_item?(game_state, item_key)
        {[result], lua}
    end
  end

  def player_has_item(_, lua), do: {[false], lua}

  @doc false
  def player_has_flag([flag_name], lua) when is_binary(flag_name) do
    case get_game_state(lua) do
      nil ->
        {[false], lua}

      game_state ->
        result = has_flag?(game_state, flag_name)
        {[result], lua}
    end
  end

  def player_has_flag(_, lua), do: {[false], lua}

  @doc false
  def player_get_stat([stat_name], lua) when is_binary(stat_name) do
    case get_game_state(lua) do
      nil ->
        {[0], lua}

      game_state ->
        value = get_stat(game_state, stat_name)
        {[value], lua}
    end
  rescue
    ArgumentError -> {[0], lua}
  end

  def player_get_stat(_, lua), do: {[0], lua}

  @doc false
  def player_set_flag([flag_name, value], lua) when is_binary(flag_name) do
    Logger.debug(
      "[Lua Script] set_flag(#{flag_name}, #{inspect(value)}) - use dialogue action for persistence"
    )

    {[true], lua}
  end

  def player_set_flag(_, lua), do: {[false], lua}

  @doc false
  def player_get_skill_level([skill_name], lua) when is_binary(skill_name) do
    case get_game_state(lua) do
      nil ->
        {[0], lua}

      game_state ->
        level = get_skill_level(game_state, skill_name)
        {[level], lua}
    end
  end

  def player_get_skill_level(_, lua), do: {[0], lua}

  # =============================================================================
  # Action API Functions (game.actions.*)
  # =============================================================================

  @doc false
  def action_is_granted([action_key], lua) when is_binary(action_key) do
    case get_game_state(lua) do
      nil ->
        {[false], lua}

      game_state ->
        granted = get_granted_actions(game_state)
        result = Enum.any?(granted, fn action -> action["key"] == action_key end)
        {[result], lua}
    end
  end

  def action_is_granted(_, lua), do: {[false], lua}

  @doc false
  def action_is_blocked([action_key], lua) when is_binary(action_key) do
    case get_game_state(lua) do
      nil ->
        {[false], lua}

      game_state ->
        blocked = get_blocked_actions(game_state)
        result = action_key in blocked
        {[result], lua}
    end
  end

  def action_is_blocked(_, lua), do: {[false], lua}

  @doc false
  def action_get_granted([], lua) do
    case get_game_state(lua) do
      nil ->
        {[[]], lua}

      game_state ->
        granted = get_granted_actions(game_state)
        keys = Enum.map(granted, fn action -> action["key"] || action[:key] end)
        {[keys], lua}
    end
  end

  def action_get_granted(_, lua), do: {[[]], lua}

  @doc false
  def action_get_blocked([], lua) do
    case get_game_state(lua) do
      nil ->
        {[[]], lua}

      game_state ->
        blocked = get_blocked_actions(game_state)
        {[blocked], lua}
    end
  end

  def action_get_blocked(_, lua), do: {[[]], lua}

  # =============================================================================
  # Private Helpers - Game State Access
  # =============================================================================

  # Extract game_state from Lua context
  defp get_game_state(lua) do
    case :luerl.get_table_keys_dec(["context", "game_state"], lua) do
      {game_state, _lua} when is_map(game_state) ->
        game_state

      _ ->
        nil
    end
  rescue
    _ -> nil
  end

  # Game state accessors - work with GameState struct or plain maps

  defp get_active_quests(%GameState{quests: quests}), do: StateHelper.get_active(quests)

  defp get_active_quests(map) when is_map(map) do
    case Map.get(map, :quests) || Map.get(map, "quests") do
      nil -> %{}
      quests when is_map(quests) -> Map.get(quests, :active, %{})
      _ -> %{}
    end
  end

  defp get_completed_quests(%GameState{quests: quests}), do: StateHelper.get_completed(quests)

  defp get_completed_quests(map) when is_map(map) do
    case Map.get(map, :quests) || Map.get(map, "quests") do
      nil -> []
      quests when is_map(quests) -> Map.get(quests, :completed, [])
      _ -> []
    end
  end

  defp complete_objective(%GameState{} = game_state, quest_id, objective_id) do
    Progress.complete_objective(game_state, quest_id, objective_id)
  end

  defp complete_objective(_map, _quest_id, _objective_id) do
    {:error, :not_supported}
  end

  defp has_item?(%GameState{inventory: inventory}, item_key) do
    inventory = inventory || []
    Enum.any?(inventory, fn item -> (item[:key] || item["key"]) == item_key end)
  end

  defp has_item?(map, item_key) when is_map(map) do
    inventory = Map.get(map, :inventory) || Map.get(map, "inventory") || []
    Enum.any?(inventory, fn item -> (item[:key] || item["key"]) == item_key end)
  end

  defp has_flag?(%GameState{flags: flags}, flag_name) do
    flags = flags || %{}
    Map.get(flags, flag_name, false)
  end

  defp has_flag?(map, flag_name) when is_map(map) do
    flags = Map.get(map, :flags) || Map.get(map, "flags") || %{}
    Map.get(flags, flag_name, false)
  end

  # Action modifier accessors - reads from _granted_actions and _blocked_actions flags

  defp get_granted_actions(%GameState{flags: flags}) do
    flags = flags || %{}
    Map.get(flags, "_granted_actions") || Map.get(flags, :_granted_actions) || []
  end

  defp get_granted_actions(map) when is_map(map) do
    flags = Map.get(map, :flags) || Map.get(map, "flags") || %{}
    Map.get(flags, "_granted_actions") || Map.get(flags, :_granted_actions) || []
  end

  defp get_blocked_actions(%GameState{flags: flags}) do
    flags = flags || %{}
    Map.get(flags, "_blocked_actions") || Map.get(flags, :_blocked_actions) || []
  end

  defp get_blocked_actions(map) when is_map(map) do
    flags = Map.get(map, :flags) || Map.get(map, "flags") || %{}
    Map.get(flags, "_blocked_actions") || Map.get(flags, :_blocked_actions) || []
  end

  defp get_stat(%GameState{stats: stats}, stat_name) do
    stats = stats || %{}

    Map.get(stats, stat_name) ||
      try do
        Map.get(stats, String.to_existing_atom(stat_name)) || 0
      rescue
        ArgumentError -> 0
      end
  end

  defp get_stat(map, stat_name) when is_map(map) do
    stats = Map.get(map, :stats) || Map.get(map, "stats") || %{}

    Map.get(stats, stat_name) ||
      try do
        Map.get(stats, String.to_existing_atom(stat_name)) || 0
      rescue
        ArgumentError -> 0
      end
  end

  defp get_skill_level(%GameState{skills: skills}, skill_name) do
    skills = skills || %{}
    extract_skill_level(skills, skill_name)
  end

  defp get_skill_level(map, skill_name) when is_map(map) do
    skills = Map.get(map, :skills) || Map.get(map, "skills") || %{}
    extract_skill_level(skills, skill_name)
  end

  defp extract_skill_level(skills, skill_name) do
    case Map.get(skills, skill_name) ||
           (try do
              Map.get(skills, String.to_atom(skill_name))
            rescue
              ArgumentError -> nil
            end) do
      nil -> 0
      level when is_number(level) -> level
      %{"level" => level} -> level
      %{level: level} -> level
      _ -> 0
    end
  end
end
