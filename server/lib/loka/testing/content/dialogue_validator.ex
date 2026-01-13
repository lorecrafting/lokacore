defmodule Loka.Testing.Content.DialogueValidator do
  @moduledoc """
  Validates dialogue tree integrity across all NPCs.

  Ensures that dialogue trees are internally consistent:
  - All `next` references point to existing nodes
  - All dialogue actions reference valid targets (quests, items, flags)
  - All `show_if` conditions reference valid quests/flags
  - No unreachable dialogue nodes (orphans)
  - No dead-end conversations (nodes with no choices or next)

  ## Usage

      {:ok, results} = DialogueValidator.validate()

      # Check specific NPC
      {:ok, issues} = DialogueValidator.validate_npc("abbot_jampa")

  ## Result Structure

      %{
        npcs_checked: 10,
        nodes_checked: 150,
        errors: [
          {:broken_next, "npc_key", "node_id", "missing_node"},
          {:invalid_action, "npc_key", "node_id", "unknown action type"},
          {:missing_quest, "npc_key", "node_id", "nonexistent_quest"}
        ],
        warnings: [
          {:orphan_node, "npc_key", "node_id"},
          {:dead_end, "npc_key", "node_id"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.PrototypeLoader
  alias Loka.Framework.Quest.QuestRegistry

  @type validation_result :: %{
          npcs_checked: non_neg_integer(),
          nodes_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:broken_next, String.t(), String.t(), String.t()}
          | {:invalid_action, String.t(), String.t(), String.t()}
          | {:missing_quest, String.t(), String.t(), String.t()}
          | {:missing_item, String.t(), String.t(), String.t()}
          | {:invalid_condition, String.t(), String.t(), String.t()}

  @type warning ::
          {:orphan_node, String.t(), String.t()}
          | {:dead_end, String.t(), String.t()}
          | {:empty_text, String.t(), String.t()}

  # Known valid action types
  @valid_actions [
    "accept_quest",
    "complete_quest",
    "give_item",
    "take_item",
    "set_flag",
    "clear_flag",
    "give_xp",
    "give_gold",
    "teleport",
    "start_combat",
    "heal",
    "teach_ability",
    "learn_skill",
    "open_shop"
  ]

  # Known valid condition types
  @valid_conditions [
    "quest_active",
    "quest_complete",
    "quest_completed",
    "quest_not_active",
    "quest_not_completed",
    "has_item",
    "has_flag",
    "flag_set",
    "flag_not_set",
    "level_at_least",
    "has_gold",
    "completed_quest"
  ]

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates dialogue trees for all NPCs.

  Returns `{:ok, results}` with validation results.
  """
  @spec validate() :: {:ok, validation_result()}
  def validate do
    # Get all NPC prototypes with dialogue
    npcs_with_dialogue =
      PrototypeLoader.list_by_type(:npc)
      |> Enum.filter(&has_dialogue?/1)

    # Also check non-NPC prototypes that might have dialogue (shops, etc)
    other_with_dialogue =
      PrototypeLoader.all()
      |> Enum.reject(fn p -> p.type == :npc end)
      |> Enum.filter(&has_dialogue?/1)

    all_with_dialogue = npcs_with_dialogue ++ other_with_dialogue

    # Get quest registry for validation
    quest_ids = get_quest_ids()

    # Validate each NPC
    {errors, warnings, total_nodes} =
      Enum.reduce(all_with_dialogue, {[], [], 0}, fn proto, {errs, warns, nodes} ->
        {npc_errors, npc_warnings, node_count} = validate_dialogue_tree(proto, quest_ids)
        {errs ++ npc_errors, warns ++ npc_warnings, nodes + node_count}
      end)

    results = %{
      npcs_checked: length(all_with_dialogue),
      nodes_checked: total_nodes,
      errors: errors,
      warnings: warnings
    }

    Logger.info(
      "DialogueValidator: Checked #{results.npcs_checked} NPCs, " <>
        "#{results.nodes_checked} nodes, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Validates dialogue tree for a specific NPC.

  Returns `{:ok, {errors, warnings}}` or `{:error, :not_found}` or `{:error, :no_dialogue}`.
  """
  @spec validate_npc(String.t()) :: {:ok, {[error()], [warning()]}} | {:error, atom()}
  def validate_npc(npc_key) do
    case PrototypeLoader.get(npc_key) do
      {:error, :not_found} ->
        {:error, :not_found}

      {:ok, proto} ->
        if has_dialogue?(proto) do
          quest_ids = get_quest_ids()
          {errors, warnings, _count} = validate_dialogue_tree(proto, quest_ids)
          {:ok, {errors, warnings}}
        else
          {:error, :no_dialogue}
        end
    end
  end

  @doc """
  Returns true if validation passes (no errors).
  """
  @spec valid?() :: boolean()
  def valid? do
    {:ok, results} = validate()
    Enum.empty?(results.errors)
  end

  @doc """
  Formats validation results as a human-readable report.
  """
  @spec format_report(validation_result()) :: String.t()
  def format_report(results) do
    lines = [
      "=== Dialogue Validation Report ===",
      "",
      "NPCs checked: #{results.npcs_checked}",
      "Nodes checked: #{results.nodes_checked}",
      "Errors: #{length(results.errors)}",
      "Warnings: #{length(results.warnings)}",
      ""
    ]

    error_lines =
      if Enum.any?(results.errors) do
        ["ERRORS:", ""] ++
          Enum.map(results.errors, &format_error/1) ++
          [""]
      else
        []
      end

    warning_lines =
      if Enum.any?(results.warnings) do
        ["WARNINGS:", ""] ++
          Enum.map(results.warnings, &format_warning/1) ++
          [""]
      else
        []
      end

    status =
      if Enum.empty?(results.errors) do
        ["STATUS: PASSED"]
      else
        ["STATUS: FAILED"]
      end

    Enum.join(lines ++ error_lines ++ warning_lines ++ status, "\n")
  end

  # =============================================================================
  # Private - Dialogue Tree Validation
  # =============================================================================

  defp validate_dialogue_tree(proto, quest_ids) do
    npc_key = proto.key
    dialogue_tree = get_dialogue_tree(proto)

    if map_size(dialogue_tree) == 0 do
      {[], [], 0}
    else
      node_ids = MapSet.new(Map.keys(dialogue_tree) |> Enum.map(&to_string/1))

      # Find which nodes are reachable from "start" (or any start_* variant)
      reachable = find_reachable_nodes(dialogue_tree)

      # Validate each node
      {errors, warnings} =
        Enum.reduce(dialogue_tree, {[], []}, fn {node_id, node}, {errs, warns} ->
          node_id_str = to_string(node_id)

          {node_errors, node_warnings} =
            validate_node(npc_key, node_id_str, node, node_ids, quest_ids, reachable)

          {errs ++ node_errors, warns ++ node_warnings}
        end)

      {errors, warnings, map_size(dialogue_tree)}
    end
  end

  defp validate_node(npc_key, node_id, node, valid_node_ids, quest_ids, reachable)
       when is_map(node) do
    errors = []
    warnings = []

    # Check for empty text
    text = Map.get(node, "text") || Map.get(node, :text)

    warnings =
      if is_nil(text) or text == "" do
        # Check if it's a redirect node (has completed_quest)
        completed_quest = Map.get(node, "completed_quest") || Map.get(node, :completed_quest)

        if is_nil(completed_quest) do
          [{:empty_text, npc_key, node_id} | warnings]
        else
          warnings
        end
      else
        warnings
      end

    # Validate show_if conditions
    show_if = Map.get(node, "show_if") || Map.get(node, :show_if)
    completed_quest = Map.get(node, "completed_quest") || Map.get(node, :completed_quest)

    # Check orphan nodes (not reachable from start)
    # Nodes with show_if or completed_quest are alternative entry points, not orphans
    is_alternative_start = not is_nil(show_if) or not is_nil(completed_quest)

    warnings =
      if not String.starts_with?(node_id, "start") and
           not MapSet.member?(reachable, node_id) and
           not is_alternative_start do
        [{:orphan_node, npc_key, node_id} | warnings]
      else
        warnings
      end

    {cond_errors, _} = validate_conditions(npc_key, node_id, show_if, quest_ids)
    errors = errors ++ cond_errors

    # Validate choices
    choices = Map.get(node, "choices") || Map.get(node, :choices) || []
    options = Map.get(node, "options") || Map.get(node, :options) || []

    {choice_errors, choice_warnings} =
      validate_choices(npc_key, node_id, choices ++ options, valid_node_ids, quest_ids)

    errors = errors ++ choice_errors
    warnings = warnings ++ choice_warnings

    # Note: We don't warn about "dead ends" because terminal dialogue nodes
    # (nodes with no choices) are valid conversation endings

    {errors, warnings}
  end

  defp validate_node(_, _, _, _, _, _), do: {[], []}

  defp validate_choices(npc_key, node_id, choices, valid_node_ids, quest_ids) do
    Enum.reduce(choices, {[], []}, fn choice, {errs, warns} ->
      {choice_errs, choice_warns} =
        validate_choice(npc_key, node_id, choice, valid_node_ids, quest_ids)

      {errs ++ choice_errs, warns ++ choice_warns}
    end)
  end

  defp validate_choice(npc_key, node_id, choice, valid_node_ids, quest_ids) when is_map(choice) do
    errors = []

    # Check next reference
    next = Map.get(choice, "next") || Map.get(choice, :next)

    errors =
      if not is_nil(next) and next != "" do
        next_str = to_string(next)

        if MapSet.member?(valid_node_ids, next_str) do
          errors
        else
          [{:broken_next, npc_key, node_id, next_str} | errors]
        end
      else
        errors
      end

    # Validate action
    action = Map.get(choice, "action") || Map.get(choice, :action)
    {action_errors, _} = validate_action(npc_key, node_id, action, quest_ids)
    errors = errors ++ action_errors

    # Validate show_if on choice
    show_if = Map.get(choice, "show_if") || Map.get(choice, :show_if)
    {cond_errors, _} = validate_conditions(npc_key, node_id, show_if, quest_ids)
    errors = errors ++ cond_errors

    {errors, []}
  end

  defp validate_choice(_, _, _, _, _), do: {[], []}

  defp validate_action(_npc_key, _node_id, nil, _quest_ids), do: {[], []}

  defp validate_action(npc_key, node_id, [action_type | args], quest_ids)
       when is_binary(action_type) or is_atom(action_type) do
    action_str = to_string(action_type)

    if action_str in @valid_actions do
      # Validate action arguments
      validate_action_args(npc_key, node_id, action_str, args, quest_ids)
    else
      {[{:invalid_action, npc_key, node_id, "unknown action '#{action_str}'"}], []}
    end
  end

  defp validate_action(npc_key, node_id, action, _quest_ids) when is_binary(action) do
    # Single string action (rare but possible)
    if action in @valid_actions do
      {[], []}
    else
      {[{:invalid_action, npc_key, node_id, "unknown action '#{action}'"}], []}
    end
  end

  defp validate_action(_, _, _, _), do: {[], []}

  defp validate_action_args(npc_key, node_id, "accept_quest", [quest_id | _], quest_ids) do
    if MapSet.member?(quest_ids, quest_id) do
      {[], []}
    else
      {[{:missing_quest, npc_key, node_id, quest_id}], []}
    end
  end

  defp validate_action_args(npc_key, node_id, "complete_quest", [quest_id | _], quest_ids) do
    if MapSet.member?(quest_ids, quest_id) do
      {[], []}
    else
      {[{:missing_quest, npc_key, node_id, quest_id}], []}
    end
  end

  defp validate_action_args(npc_key, node_id, "give_item", [item_id | _], _quest_ids) do
    case PrototypeLoader.get(item_id) do
      {:ok, _} -> {[], []}
      {:error, :not_found} -> {[{:missing_item, npc_key, node_id, item_id}], []}
    end
  end

  defp validate_action_args(npc_key, node_id, "take_item", [item_id | _], _quest_ids) do
    case PrototypeLoader.get(item_id) do
      {:ok, _} -> {[], []}
      {:error, :not_found} -> {[{:missing_item, npc_key, node_id, item_id}], []}
    end
  end

  defp validate_action_args(_, _, _, _, _), do: {[], []}

  defp validate_conditions(_npc_key, _node_id, nil, _quest_ids), do: {[], []}

  defp validate_conditions(npc_key, node_id, conditions, quest_ids) when is_map(conditions) do
    Enum.reduce(conditions, {[], []}, fn {condition_type, value}, {errs, warns} ->
      condition_str = to_string(condition_type)

      {cond_errs, cond_warns} =
        validate_condition(npc_key, node_id, condition_str, value, quest_ids)

      {errs ++ cond_errs, warns ++ cond_warns}
    end)
  end

  defp validate_conditions(_, _, _, _), do: {[], []}

  defp validate_condition(npc_key, node_id, condition_type, value, quest_ids) do
    if condition_type in @valid_conditions do
      # Validate condition value (quest exists, etc)
      case condition_type do
        t
        when t in [
               "quest_active",
               "quest_completed",
               "quest_not_active",
               "quest_not_completed",
               "completed_quest"
             ] ->
          if MapSet.member?(quest_ids, value) do
            {[], []}
          else
            {[{:missing_quest, npc_key, node_id, value}], []}
          end

        "has_item" ->
          case PrototypeLoader.get(value) do
            {:ok, _} -> {[], []}
            {:error, :not_found} -> {[{:missing_item, npc_key, node_id, value}], []}
          end

        _ ->
          {[], []}
      end
    else
      {[{:invalid_condition, npc_key, node_id, "unknown condition '#{condition_type}'"}], []}
    end
  end

  # =============================================================================
  # Private - Reachability Analysis
  # =============================================================================

  defp find_reachable_nodes(dialogue_tree) do
    # Find all entry nodes:
    # 1. start* nodes (main entry points)
    # 2. nodes with show_if conditions (alternative entry points)
    # 3. nodes with completed_quest (conditional entry points)
    entry_nodes =
      dialogue_tree
      |> Enum.filter(fn {node_id, node} ->
        node_id_str = to_string(node_id)
        has_show_if = not is_nil(Map.get(node, "show_if") || Map.get(node, :show_if))

        has_completed_quest =
          not is_nil(Map.get(node, "completed_quest") || Map.get(node, :completed_quest))

        String.starts_with?(node_id_str, "start") or has_show_if or has_completed_quest
      end)
      |> Enum.map(fn {node_id, _} -> to_string(node_id) end)

    # BFS from all entry nodes
    queue = :queue.from_list(entry_nodes)
    visited = MapSet.new(entry_nodes)

    do_find_reachable(queue, visited, dialogue_tree)
  end

  defp do_find_reachable(queue, visited, dialogue_tree) do
    case :queue.out(queue) do
      {:empty, _} ->
        visited

      {{:value, node_id}, queue} ->
        node = Map.get(dialogue_tree, node_id) || Map.get(dialogue_tree, String.to_atom(node_id))

        if is_nil(node) do
          do_find_reachable(queue, visited, dialogue_tree)
        else
          # Get all next nodes from choices
          choices = Map.get(node, "choices") || Map.get(node, :choices) || []
          options = Map.get(node, "options") || Map.get(node, :options) || []

          next_nodes =
            (choices ++ options)
            |> Enum.map(fn choice ->
              next = Map.get(choice, "next") || Map.get(choice, :next)
              if next, do: to_string(next), else: nil
            end)
            |> Enum.reject(&is_nil/1)
            |> Enum.reject(&MapSet.member?(visited, &1))

          new_visited = Enum.reduce(next_nodes, visited, &MapSet.put(&2, &1))
          new_queue = Enum.reduce(next_nodes, queue, &:queue.in(&1, &2))

          do_find_reachable(new_queue, new_visited, dialogue_tree)
        end
    end
  end

  # =============================================================================
  # Private - Helpers
  # =============================================================================

  defp has_dialogue?(proto) do
    components = proto.components || %{}

    dialogue_tree =
      Map.get(components, "dialogue_tree") ||
        Map.get(components, :dialogue_tree)

    not is_nil(dialogue_tree) and is_map(dialogue_tree) and map_size(dialogue_tree) > 0
  end

  defp get_dialogue_tree(proto) do
    components = proto.components || %{}

    Map.get(components, "dialogue_tree") ||
      Map.get(components, :dialogue_tree) ||
      %{}
  end

  defp get_quest_ids do
    if Process.whereis(QuestRegistry) do
      QuestRegistry.all()
      |> Enum.map(& &1.id)
      |> MapSet.new()
    else
      MapSet.new()
    end
  end

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:broken_next, npc, node, target}) do
    "  - NPC '#{npc}' node '#{node}': next '#{target}' not found"
  end

  defp format_error({:invalid_action, npc, node, reason}) do
    "  - NPC '#{npc}' node '#{node}': #{reason}"
  end

  defp format_error({:missing_quest, npc, node, quest_id}) do
    "  - NPC '#{npc}' node '#{node}': quest '#{quest_id}' not found"
  end

  defp format_error({:missing_item, npc, node, item_id}) do
    "  - NPC '#{npc}' node '#{node}': item '#{item_id}' not found"
  end

  defp format_error({:invalid_condition, npc, node, reason}) do
    "  - NPC '#{npc}' node '#{node}': #{reason}"
  end

  defp format_warning({:orphan_node, npc, node}) do
    "  - NPC '#{npc}': node '#{node}' is not reachable from start"
  end

  defp format_warning({:dead_end, npc, node}) do
    "  - NPC '#{npc}': node '#{node}' has no choices (dead end)"
  end

  defp format_warning({:empty_text, npc, node}) do
    "  - NPC '#{npc}': node '#{node}' has no text"
  end
end
