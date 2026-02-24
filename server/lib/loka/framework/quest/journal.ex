defmodule Loka.Framework.Quest.Journal do
  @moduledoc """
  Dynamic quest journal entries with Elixir scripting support.

  Allows journal entries to be dynamically generated or modified based on player
  state, quest progress, and game world state using Elixir scripts.

  ## Features

  - Static journal entries from YAML
  - Dynamic entries via Elixir scripts
  - Conditional entry visibility
  - Entry templating with variable substitution
  - Entry ordering and grouping

  ## YAML Format

  Quest journal entries are defined in the `journal_entries` field:

      # Static entries
      journal_entries:
        accepted: "I've agreed to help Elder Maren find what was lost."
        objective_complete_find_grove_path: "I found the path deeper into the grove."
        completed: "Thera is safe. The grove is at peace."

      # Dynamic entries with Elixir
      journal_entries:
        accepted:
          elixir: |
            gold = get_stat("gold") || 0
            if gold > 100 do
              "The abbot promised a generous reward for my services."
            else
              "I hope this quest pays well. My coin purse is light."
            end
        objective_progress_kill_goblins:
          elixir: |
            count = get_objective_progress("kill_goblins")
            target = 5
            "Goblins slain: \#{count} of \#{target}"
        completed:
          condition: { flag: "spared_boss" }
          text: "I showed mercy to the goblin king."
          alt_text: "The goblin king fell by my blade."

  ## Elixir Script API

  Additional API available for journal scripts:

      get_objective_progress(objective_id)  # Returns current progress
      get_objective_target(objective_id)    # Returns target count
      get_time_remaining(objective_id)      # Returns seconds for timed
      format_time(seconds)                  # Formats as "5m 30s"
      get_stat(stat_name)                   # Get player stat
      has_flag?(flag_name)                  # Check if player has flag
      has_item?(item_key)                   # Check if player has item

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

  alias Loka.Content
  alias Loka.Engine.Entity
  alias Loka.Framework.Conditions.Evaluator
  alias Loka.Framework.Quest.Progress

  @doc """
  Renders all visible journal entries for a quest.

  Returns a list of rendered entries with their IDs and text.
  """
  def render_journal(%Entity{} = state, quest_id) do
    case Content.Quest.definition(quest_id) do
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
  def render_entry(%Entity{} = state, quest_id, entry_id) do
    case Content.Quest.definition(quest_id) do
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
  def entry_visible?(%Entity{} = state, quest_id, entry_id, progress \\ nil) do
    case Content.Quest.definition(quest_id) do
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
  def get_journal_context(%Entity{} = state, quest_id) do
    quest_def = Content.Quest.definition(quest_id)
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
            time_remaining: get_time_remaining(state.account_id, quest_id, obj, progress)
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
      # Elixir script entry
      Map.has_key?(entry, "elixir") || Map.has_key?(entry, :elixir) ->
        elixir_script = entry["elixir"] || entry[:elixir]
        execute_elixir_entry(state, quest_id, elixir_script, progress)

      # Legacy Lua script entry (convert to Elixir warning)
      Map.has_key?(entry, "lua") || Map.has_key?(entry, :lua) ->
        Logger.warning(
          "[Journal] Lua scripts are deprecated, please convert to Elixir: #{quest_id}"
        )

        {:ok, "[Script error: Lua not supported, use 'elixir:' instead]"}

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

  defp execute_elixir_entry(%Entity{} = state, quest_id, script, progress) do
    # Build bindings for journal script execution
    bindings = build_journal_bindings(state, quest_id, progress)

    try do
      {result, _bindings} = Code.eval_string(script, bindings)

      case result do
        text when is_binary(text) -> {:ok, text}
        nil -> {:ok, ""}
        other -> {:ok, to_string(other)}
      end
    rescue
      e ->
        Logger.warning("[Journal] Elixir error for #{quest_id}: #{Exception.message(e)}")
        {:error, {:script_error, Exception.message(e)}}
    end
  end

  defp build_journal_bindings(%Entity{} = entity, quest_id, progress) do
    quest_def = Content.Quest.definition(quest_id)
    stats = Entity.get_component(entity, "stats") || %{}
    flags = Entity.get_component(entity, "flags") || %{}
    inventory = Entity.get_component(entity, "inventory") || []

    [
      # Player state queries
      get_stat: fn stat_name ->
        Map.get(stats, stat_name) ||
          Map.get(stats, to_string(stat_name), 0)
      end,
      has_flag?: fn flag_name ->
        !!Map.get(flags, flag_name) ||
          !!Map.get(flags, to_string(flag_name))
      end,
      get_flag: fn flag_name ->
        Map.get(flags, flag_name) ||
          Map.get(flags, to_string(flag_name))
      end,
      has_item?: fn item_key ->
        item_key in inventory
      end,

      # Quest queries
      quest_active?: fn qid ->
        Progress.get_quest_progress(entity, qid || quest_id) != nil
      end,
      quest_complete?: fn qid ->
        Progress.is_complete?(entity, qid || quest_id)
      end,
      get_objective_progress: fn obj_id ->
        objectives = (progress || %{})["objectives"] || %{}
        obj_data = objectives[obj_id] || %{}
        Map.get(obj_data, "progress") || 0
      end,
      get_objective_target: fn obj_id ->
        obj = quest_def && Enum.find(quest_def.objectives, &(&1.id == obj_id))
        (obj && obj.target_count) || 1
      end,
      get_time_remaining: fn obj_id ->
        obj = quest_def && Enum.find(quest_def.objectives, &(&1.id == obj_id))
        get_time_remaining(entity.account_id, quest_id, obj, progress) || 0
      end,

      # Utility
      format_time: &format_time_display/1
    ]
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

  defp substitute_stat_vars(text, %Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}

    Regex.replace(~r/\{\{stat_(\w+)\}\}/, text, fn _match, stat_name ->
      value = Map.get(stats, stat_name) || Map.get(stats, String.to_atom(stat_name), 0)
      to_string(value)
    end)
  end

  defp substitute_flag_vars(text, %Entity{} = entity) do
    flags = Entity.get_component(entity, "flags") || %{}

    Regex.replace(~r/\{\{flag_(\w+)\}\}/, text, fn _match, flag_name ->
      value = Map.get(flags, flag_name) || Map.get(flags, String.to_atom(flag_name), "")
      to_string(value)
    end)
  end

  defp get_player_name(%Entity{} = entity) do
    # In V2, character name is stored in short_desc
    entity.short_desc || "Traveler"
  end

  defp get_quest_name(quest_id) do
    case Content.Quest.definition(quest_id) do
      nil -> quest_id
      quest -> quest.name || quest_id
    end
  end

  # =============================================================================
  # Private - Helpers
  # =============================================================================

  defp get_time_remaining(_player_id, _quest_id, nil, _progress), do: nil

  defp get_time_remaining(_player_id, _quest_id, obj, progress) do
    if obj.time_limit do
      objectives = (progress || %{})["objectives"] || %{}
      obj_data = objectives[obj.id] || %{}

      case Map.get(obj_data, "expires_at") do
        nil -> nil
        expires_at -> max(0, expires_at - System.os_time(:second))
      end
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
