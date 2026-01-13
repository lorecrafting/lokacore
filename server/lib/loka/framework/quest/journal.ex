defmodule Loka.Framework.Quest.Journal do
  @moduledoc """
  Dynamic quest journal entries with Lua scripting support.

  Allows journal entries to be dynamically generated or modified based on player
  state, quest progress, and game world state using Lua scripts.

  ## Features

  - Static journal entries from YAML
  - Dynamic entries via Lua scripts
  - Conditional entry visibility
  - Entry templating with variable substitution
  - Entry ordering and grouping

  ## YAML Format

  Quest journal entries are defined in the `journal_entries` field:

      # Static entries
      journal_entries:
        accepted: "I've agreed to help Abbot Jampa find the missing master."
        objective_complete_find_temple: "I found the temple entrance."
        completed: "Master Tenzin is safe. The monastery is at peace."

      # Dynamic entries with Lua
      journal_entries:
        accepted:
          lua: |
            local gold = game.player.get_stat("gold") or 0
            if gold > 100 then
              return "The abbot promised a generous reward for my services."
            else
              return "I hope this quest pays well. My coin purse is light."
            end
        objective_progress_kill_goblins:
          lua: |
            local count = game.quest.get_objective_progress("kill_goblins")
            local target = 5
            return string.format("Goblins slain: %d of %d", count, target)
        completed:
          condition: { flag: "spared_boss" }
          text: "I showed mercy to the goblin king."
          alt_text: "The goblin king fell by my blade."

  ## Lua API

  Additional API available for journal scripts:

      game.quest.get_objective_progress(objective_id)  -- Returns current progress
      game.quest.get_objective_target(objective_id)    -- Returns target count
      game.quest.get_time_remaining(objective_id)      -- Returns seconds for timed
      game.journal.format_time(seconds)                -- Formats as "5m 30s"

  ## Usage

      alias Loka.Framework.Quest.Journal

      # Get rendered journal for a quest
      {:ok, entries} = Journal.render_journal(player_state, "quest_id")

      # Get specific entry
      {:ok, text} = Journal.render_entry(player_state, "quest_id", "accepted")

      # Check if entry is visible
      Journal.entry_visible?(player_state, "quest_id", "secret_entry")
  """

  require Logger

  alias Loka.Framework.Conditions.Evaluator
  alias Loka.Framework.Player.GameState
  alias Loka.Framework.Quest.{Definitions, Progress, TimerManager}

  @doc """
  Renders all visible journal entries for a quest.

  Returns a list of rendered entries with their IDs and text.
  """
  def render_journal(%GameState{} = state, quest_id) do
    case Definitions.get_quest_definition(quest_id) do
      nil ->
        {:error, :quest_not_found}

      quest_def ->
        journal_entries = Map.get(quest_def, :journal_entries) || %{}
        progress = Progress.get_quest_progress(state, quest_id)

        entries =
          journal_entries
          |> Enum.filter(fn {entry_id, _entry} ->
            entry_visible?(state, quest_id, entry_id, progress)
          end)
          |> Enum.map(fn {entry_id, entry} ->
            case render_entry_internal(state, quest_id, entry, progress) do
              {:ok, text} -> %{id: entry_id, text: text}
              {:error, _} -> nil
            end
          end)
          |> Enum.reject(&is_nil/1)
          |> sort_entries()

        {:ok, entries}
    end
  end

  @doc """
  Renders a specific journal entry.

  Returns `{:ok, text}` or `{:error, reason}`.
  """
  def render_entry(%GameState{} = state, quest_id, entry_id) do
    case Definitions.get_quest_definition(quest_id) do
      nil ->
        {:error, :quest_not_found}

      quest_def ->
        journal_entries = Map.get(quest_def, :journal_entries) || %{}

        entry =
          Map.get(journal_entries, entry_id) || Map.get(journal_entries, to_string(entry_id))

        if entry do
          progress = Progress.get_quest_progress(state, quest_id)
          render_entry_internal(state, quest_id, entry, progress)
        else
          {:error, :entry_not_found}
        end
    end
  end

  @doc """
  Checks if a journal entry is visible based on conditions.
  """
  def entry_visible?(%GameState{} = state, quest_id, entry_id, progress \\ nil) do
    case Definitions.get_quest_definition(quest_id) do
      nil ->
        false

      quest_def ->
        journal_entries = Map.get(quest_def, :journal_entries) || %{}

        entry =
          Map.get(journal_entries, entry_id) || Map.get(journal_entries, to_string(entry_id))

        progress = progress || Progress.get_quest_progress(state, quest_id)

        check_entry_visibility(state, quest_id, entry_id, entry, progress)
    end
  end

  @doc """
  Gets the current journal context for a quest.

  Returns a map with current quest state useful for journal rendering.
  """
  def get_journal_context(%GameState{} = state, quest_id) do
    quest_def = Definitions.get_quest_definition(quest_id)
    progress = Progress.get_quest_progress(state, quest_id)

    objectives =
      if quest_def do
        Enum.map(quest_def.objectives, fn obj ->
          obj_progress = get_in(progress, ["objectives", obj.id]) || %{}

          %{
            id: obj.id,
            type: obj.type,
            description: obj.description,
            progress: Map.get(obj_progress, "progress") || 0,
            target: obj.target_count || 1,
            completed: Map.get(obj_progress, "completed") || false,
            time_remaining: get_time_remaining(state.player_id, quest_id, obj)
          }
        end)
      else
        []
      end

    %{
      quest_id: quest_id,
      quest_name: quest_def && quest_def.name,
      is_active: Progress.get_quest_progress(state, quest_id) != nil,
      is_complete: Progress.is_complete?(state, quest_id),
      objectives: objectives,
      accepted_at: progress && (progress["accepted_at"] || progress[:accepted_at])
    }
  end

  # =============================================================================
  # Private - Entry Rendering
  # =============================================================================

  defp render_entry_internal(state, quest_id, entry, progress) when is_binary(entry) do
    # Simple string entry - apply variable substitution
    {:ok, substitute_variables(entry, state, quest_id, progress)}
  end

  defp render_entry_internal(state, quest_id, entry, progress) when is_map(entry) do
    cond do
      # Lua script entry
      Map.has_key?(entry, "lua") || Map.has_key?(entry, :lua) ->
        lua_script = entry["lua"] || entry[:lua]
        execute_lua_entry(state, quest_id, lua_script, progress)

      # Conditional entry with alt_text
      Map.has_key?(entry, "condition") || Map.has_key?(entry, :condition) ->
        condition = entry["condition"] || entry[:condition]
        text = entry["text"] || entry[:text] || ""
        alt_text = entry["alt_text"] || entry[:alt_text] || text

        result_text =
          if Evaluator.evaluate_show_if(condition, state) do
            text
          else
            alt_text
          end

        {:ok, substitute_variables(result_text, state, quest_id, progress)}

      # Simple text field
      Map.has_key?(entry, "text") || Map.has_key?(entry, :text) ->
        text = entry["text"] || entry[:text]
        {:ok, substitute_variables(text, state, quest_id, progress)}

      true ->
        {:error, :invalid_entry_format}
    end
  end

  defp render_entry_internal(_state, _quest_id, _entry, _progress) do
    {:error, :invalid_entry_format}
  end

  defp execute_lua_entry(%GameState{} = state, quest_id, script, progress) do
    lua = init_journal_sandbox()
    lua = inject_journal_api(lua, state, quest_id, progress)
    lua = inject_player_api(lua, state)
    # Note: inject_quest_api is NOT called here because inject_journal_api
    # already sets up the complete game.quest API (including is_active, etc.)

    case :luerl.do(script, lua) do
      {:ok, [result | _], _new_lua} when is_binary(result) ->
        {:ok, result}

      {:ok, result, _new_lua} when is_binary(result) ->
        {:ok, result}

      {:ok, [], _new_lua} ->
        {:ok, ""}

      {:error, reason, _lua} ->
        Logger.warning("[Journal] Lua error for #{quest_id}: #{inspect(reason)}")
        {:error, {:lua_error, reason}}
    end
  rescue
    e ->
      Logger.warning("[Journal] Lua exception for #{quest_id}: #{inspect(e)}")
      {:error, {:lua_exception, e}}
  end

  # =============================================================================
  # Private - Visibility Checks
  # =============================================================================

  defp check_entry_visibility(_state, _quest_id, entry_id, nil, _progress) do
    # Entry not defined
    Logger.debug("[Journal] Entry #{entry_id} not found")
    false
  end

  defp check_entry_visibility(state, quest_id, entry_id, entry, progress) do
    # Check standard visibility conditions
    entry_id_str = to_string(entry_id)

    cond do
      # "accepted" entries are visible when quest is active
      String.starts_with?(entry_id_str, "accepted") ->
        progress != nil

      # "completed" entries are visible when quest is complete
      String.starts_with?(entry_id_str, "completed") ->
        Progress.is_complete?(state, quest_id)

      # "objective_complete_X" entries are visible when objective X is complete
      String.starts_with?(entry_id_str, "objective_complete_") ->
        obj_id = String.replace_prefix(entry_id_str, "objective_complete_", "")
        objective_completed?(progress, obj_id)

      # "objective_progress_X" entries are visible when working on objective X
      String.starts_with?(entry_id_str, "objective_progress_") ->
        obj_id = String.replace_prefix(entry_id_str, "objective_progress_", "")
        objective_in_progress?(progress, obj_id)

      # Check if entry has explicit visibility condition
      is_map(entry) && (Map.has_key?(entry, "show_if") || Map.has_key?(entry, :show_if)) ->
        condition = entry["show_if"] || entry[:show_if]
        Evaluator.evaluate_show_if(condition, state)

      # Default: visible if quest is active
      true ->
        progress != nil
    end
  end

  defp objective_completed?(nil, _obj_id), do: false

  defp objective_completed?(progress, obj_id) do
    objectives = progress["objectives"] || progress[:objectives] || %{}
    obj_data = objectives[obj_id] || objectives[to_string(obj_id)] || %{}
    Map.get(obj_data, "completed") || Map.get(obj_data, :completed, false)
  end

  defp objective_in_progress?(nil, _obj_id), do: false

  defp objective_in_progress?(progress, obj_id) do
    objectives = progress["objectives"] || progress[:objectives] || %{}
    obj_data = objectives[obj_id] || objectives[to_string(obj_id)] || %{}
    not (Map.get(obj_data, "completed") || Map.get(obj_data, :completed, false))
  end

  # =============================================================================
  # Private - Variable Substitution
  # =============================================================================

  defp substitute_variables(text, state, quest_id, progress) when is_binary(text) do
    text
    |> String.replace("{{player_name}}", get_player_name(state))
    |> String.replace("{{quest_name}}", get_quest_name(quest_id))
    |> substitute_objective_vars(progress)
    |> substitute_stat_vars(state)
    |> substitute_flag_vars(state)
  end

  defp substitute_objective_vars(text, nil), do: text

  defp substitute_objective_vars(text, progress) do
    objectives = progress["objectives"] || progress[:objectives] || %{}

    Enum.reduce(objectives, text, fn {obj_id, obj_data}, acc ->
      progress_val = Map.get(obj_data, "progress") || Map.get(obj_data, :progress, 0)

      acc
      |> String.replace("{{progress_#{obj_id}}}", to_string(progress_val))
    end)
  end

  defp substitute_stat_vars(text, %GameState{stats: stats}) do
    Regex.replace(~r/\{\{stat_(\w+)\}\}/, text, fn _match, stat_name ->
      value = Map.get(stats, stat_name) || Map.get(stats, String.to_atom(stat_name), 0)
      to_string(value)
    end)
  end

  defp substitute_flag_vars(text, %GameState{flags: flags}) do
    Regex.replace(~r/\{\{flag_(\w+)\}\}/, text, fn _match, flag_name ->
      value = Map.get(flags, flag_name) || Map.get(flags, String.to_atom(flag_name), "")
      to_string(value)
    end)
  end

  defp get_player_name(%GameState{player_id: player_id}) do
    case Loka.Accounts.get_player(player_id) do
      nil -> "Traveler"
      player -> player.email |> String.split("@") |> hd()
    end
  end

  defp get_quest_name(quest_id) do
    case Definitions.get_quest_definition(quest_id) do
      nil -> quest_id
      quest -> quest.name || quest_id
    end
  end

  # =============================================================================
  # Private - Lua Sandbox
  # =============================================================================

  defp init_journal_sandbox do
    lua = :luerl.init()

    # Remove dangerous functions
    dangerous = ["dofile", "loadfile", "load", "os", "io", "debug"]

    Enum.reduce(dangerous, lua, fn name, l ->
      {:ok, new_l} = :luerl.set_table_keys([name], nil, l)
      new_l
    end)
  end

  defp inject_journal_api(lua, state, quest_id, progress) do
    format_time_fn = fn [seconds], l ->
      formatted = format_time_display(seconds)
      {[formatted], l}
    end

    get_progress_fn = fn [obj_id], l ->
      objectives = (progress || %{})["objectives"] || %{}
      obj_data = objectives[obj_id] || %{}
      prog = Map.get(obj_data, "progress") || 0
      {[prog], l}
    end

    get_target_fn = fn [obj_id], l ->
      quest_def = Definitions.get_quest_definition(quest_id)
      obj = quest_def && Enum.find(quest_def.objectives, &(&1.id == obj_id))
      target = (obj && obj.target_count) || 1
      {[target], l}
    end

    get_time_fn = fn [obj_id], l ->
      quest_def = Definitions.get_quest_definition(quest_id)
      obj = quest_def && Enum.find(quest_def.objectives, &(&1.id == obj_id))
      remaining = get_time_remaining(state.player_id, quest_id, obj)
      {[remaining || 0], l}
    end

    # Quest state functions
    is_active_fn = fn [qid], l ->
      result = Progress.get_quest_progress(state, qid || quest_id) != nil
      {[result], l}
    end

    is_complete_fn = fn [qid], l ->
      result = Progress.is_complete?(state, qid || quest_id)
      {[result], l}
    end

    is_completed_fn = fn [qid], l ->
      result = (qid || quest_id) in Progress.get_completed_quests(state)
      {[result], l}
    end

    # Create game table first (required for nested tables)
    {:ok, lua} = :luerl.set_table_keys_dec(["game"], %{}, lua)

    # Add game.journal nested table
    journal_api = %{"format_time" => format_time_fn}
    {:ok, lua} = :luerl.set_table_keys_dec(["game", "journal"], journal_api, lua)

    # Add game.quest nested table
    quest_api = %{
      "get_objective_progress" => get_progress_fn,
      "get_objective_target" => get_target_fn,
      "get_time_remaining" => get_time_fn,
      "is_active" => is_active_fn,
      "is_complete" => is_complete_fn,
      "is_completed" => is_completed_fn
    }

    {:ok, lua} = :luerl.set_table_keys_dec(["game", "quest"], quest_api, lua)

    lua
  end

  defp inject_player_api(lua, %GameState{} = state) do
    has_item_fn = fn [item_id], l ->
      result = item_id in state.inventory
      {[result], l}
    end

    has_flag_fn = fn [flag_name], l ->
      result = Map.get(state.flags, flag_name) || Map.get(state.flags, to_string(flag_name))
      {[!!result], l}
    end

    get_flag_fn = fn [flag_name], l ->
      result = Map.get(state.flags, flag_name) || Map.get(state.flags, to_string(flag_name))
      {[result], l}
    end

    get_stat_fn = fn [stat_name], l ->
      result = Map.get(state.stats, stat_name) || Map.get(state.stats, to_string(stat_name)) || 0
      {[result], l}
    end

    player_api = %{
      "has_item" => has_item_fn,
      "has_flag" => has_flag_fn,
      "get_flag" => get_flag_fn,
      "get_stat" => get_stat_fn
    }

    # Add game.player nested table (game table already exists from inject_journal_api)
    {:ok, lua} = :luerl.set_table_keys_dec(["game", "player"], player_api, lua)
    lua
  end

  # =============================================================================
  # Private - Helpers
  # =============================================================================

  defp get_time_remaining(_player_id, _quest_id, nil), do: nil

  defp get_time_remaining(player_id, quest_id, obj) do
    if obj.time_limit && Process.whereis(TimerManager) do
      TimerManager.get_remaining_time(player_id, quest_id, obj.id)
    else
      nil
    end
  end

  defp format_time_display(nil), do: ""
  defp format_time_display(seconds) when seconds <= 0, do: "0s"

  defp format_time_display(seconds) do
    minutes = div(seconds, 60)
    secs = rem(seconds, 60)

    cond do
      minutes > 0 && secs > 0 -> "#{minutes}m #{secs}s"
      minutes > 0 -> "#{minutes}m"
      true -> "#{secs}s"
    end
  end

  defp sort_entries(entries) do
    # Sort by entry ID to maintain consistent ordering
    # Prioritize: accepted, objective_*, completed
    Enum.sort_by(entries, fn entry ->
      id = to_string(entry.id)

      cond do
        String.starts_with?(id, "accepted") -> {0, id}
        String.starts_with?(id, "objective_progress") -> {1, id}
        String.starts_with?(id, "objective_complete") -> {2, id}
        String.starts_with?(id, "completed") -> {9, id}
        true -> {5, id}
      end
    end)
  end
end
