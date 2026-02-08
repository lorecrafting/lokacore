defmodule Loka.Framework.Quest.Validator do
  @moduledoc """
  Comprehensive validation for YAML-based quest definitions.

  Validates quests loaded from `priv/world/quests/` via the QuestRegistry:
  - Objective handlers are registered and validate successfully
  - Target IDs exist (rooms, NPCs, items as prototypes)
  - Dialogue topics exist in NPC dialogue trees
  - No circular quest prerequisites
  - Quest givers have dialogue with accept actions
  - Reward items are valid prototypes
  - Quests are assigned to storylines (warns on orphans)

  ## Usage

      {:ok, results} = Quest.Validator.validate()

      # Check specific quest
      {:ok, issues} = Quest.Validator.validate_quest("find_sword")

      # Format as report
      Quest.Validator.format_report(results)

  ## Result Structure

      %{
        quests_checked: 8,
        errors: [
          {:invalid_objective, "quest_id", "obj_id", "kill requires target_id"},
          {:missing_target, "quest_id", :go_to, "nonexistent_room"},
          {:missing_dialogue_topic, "quest_id", "npc_key", "missing_topic"}
        ],
        warnings: [
          {:orphaned_quest, "side_quest"},
          {:reward_item_not_found, "quest_id", "rare_gem"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader
  alias Loka.Framework.Quest.{QuestRegistry, ObjectiveRegistry, ChainRegistry}
  alias Loka.Framework.Storyline.StorylineRegistry

  @type validation_result :: %{
          quests_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:invalid_objective, String.t(), String.t(), String.t()}
          | {:unknown_objective_type, String.t(), String.t(), atom()}
          | {:missing_target, String.t(), atom(), String.t()}
          | {:missing_dialogue_topic, String.t(), String.t(), String.t()}
          | {:missing_quest_giver, String.t(), String.t()}
          | {:giver_no_dialogue, String.t(), String.t()}
          | {:circular_prerequisite, String.t(), [String.t()]}
          | {:missing_prerequisite, String.t(), String.t()}
          | {:circular_chain, String.t(), String.t(), [String.t()]}
          | {:invalid_time_limit, String.t()}

  @type warning ::
          {:orphaned_quest, String.t()}
          | {:reward_item_not_found, String.t(), String.t()}
          | {:no_objectives, String.t()}
          | {:giver_no_accept_action, String.t(), String.t()}

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates all quests from the QuestRegistry.

  Returns `{:ok, results}` with validation results.
  """
  @spec validate() :: {:ok, validation_result()}
  def validate do
    quests = QuestRegistry.all()

    # Build lookup maps
    all_quest_ids = MapSet.new(Enum.map(quests, & &1.id))
    storyline_quests = get_storyline_quest_ids()

    # Validate each quest
    {errors, warnings} =
      Enum.reduce(quests, {[], []}, fn quest, {errs, warns} ->
        {quest_errors, quest_warnings} =
          validate_single_quest(quest, all_quest_ids, storyline_quests)

        {errs ++ quest_errors, warns ++ quest_warnings}
      end)

    # Check for circular prerequisites
    circular_errors = check_circular_prerequisites(quests)

    # Check for circular chain dependencies
    chain_errors = check_circular_chains()

    results = %{
      quests_checked: length(quests),
      errors: errors ++ circular_errors ++ chain_errors,
      warnings: warnings
    }

    Logger.info(
      "Quest.Validator: Checked #{results.quests_checked} quests, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Validates a specific quest by ID.

  Returns `{:ok, {errors, warnings}}` or `{:error, :not_found}`.
  """
  @spec validate_quest(String.t()) :: {:ok, {[error()], [warning()]}} | {:error, :not_found}
  def validate_quest(quest_id) do
    case QuestRegistry.get(quest_id) do
      {:error, :not_found} ->
        {:error, :not_found}

      {:ok, quest} ->
        all_quest_ids = MapSet.new([quest_id])
        storyline_quests = get_storyline_quest_ids()
        {:ok, validate_single_quest(quest, all_quest_ids, storyline_quests)}
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
      "=== Quest Validation Report ===",
      "",
      "Quests checked: #{results.quests_checked}",
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
  # Private - Quest Validation
  # =============================================================================

  defp validate_single_quest(quest, all_quest_ids, storyline_quests) do
    quest_id = quest.id
    objectives = quest.objectives || []
    rewards = quest.rewards || %{}
    giver = Map.get(quest, :giver)
    requires = Map.get(quest, :requires_quest)

    # Check for empty objectives
    warnings =
      if Enum.empty?(objectives) do
        [{:no_objectives, quest_id}]
      else
        []
      end

    # Validate objectives using ObjectiveRegistry
    {obj_errors, obj_warnings} = validate_objectives(quest_id, objectives)

    # Validate quest giver (skip accept_action check if quest has requires_quest - it auto-unlocks)
    {giver_errors, giver_warnings} = validate_quest_giver(quest_id, giver, requires)

    # Validate prerequisites exist
    prereq_errors = validate_prerequisite(quest_id, requires, all_quest_ids)

    # Check if orphaned (not in any storyline)
    orphan_warnings =
      if not MapSet.member?(storyline_quests, quest_id) do
        [{:orphaned_quest, quest_id}]
      else
        []
      end

    # Validate rewards
    reward_warnings = validate_rewards(quest_id, rewards)

    errors = obj_errors ++ giver_errors ++ prereq_errors

    all_warnings =
      warnings ++ obj_warnings ++ giver_warnings ++ orphan_warnings ++ reward_warnings

    {errors, all_warnings}
  end

  # =============================================================================
  # Private - Objective Validation
  # =============================================================================

  defp validate_objectives(quest_id, objectives) do
    Enum.reduce(objectives, {[], []}, fn obj, {errs, warns} ->
      {obj_errs, obj_warns} = validate_objective(quest_id, obj)
      {errs ++ obj_errs, warns ++ obj_warns}
    end)
  end

  defp validate_objective(quest_id, obj) do
    obj_id = Map.get(obj, :id) || Map.get(obj, "id") || "unknown"
    obj_type = get_objective_type(obj)

    # First, validate using ObjectiveRegistry
    handler_errors =
      if Process.whereis(ObjectiveRegistry) do
        case ObjectiveRegistry.validate_objective(obj) do
          :ok -> []
          {:error, reason} -> [{:invalid_objective, quest_id, obj_id, reason}]
        end
      else
        []
      end

    # Then validate target exists
    target_errors = validate_target_exists(quest_id, obj_type, obj)

    # For talk objectives, validate dialogue topic exists
    dialogue_errors = validate_dialogue_topic(quest_id, obj)

    # Validate time_limit if present
    time_limit_errors = validate_time_limit(quest_id, obj_id, obj)

    {handler_errors ++ target_errors ++ dialogue_errors ++ time_limit_errors, []}
  end

  defp get_objective_type(obj) do
    type = Map.get(obj, :type) || Map.get(obj, "type")

    cond do
      is_atom(type) -> type
      is_binary(type) -> String.to_existing_atom(type)
      true -> nil
    end
  rescue
    ArgumentError -> nil
  end

  defp validate_target_exists(quest_id, obj_type, obj) do
    target_id = Map.get(obj, :target_id) || Map.get(obj, "target_id")

    if is_nil(target_id) or target_id == "" do
      []
    else
      case obj_type do
        :go_to ->
          validate_room_exists(quest_id, target_id)

        :kill ->
          validate_npc_exists(quest_id, target_id, :kill)

        :get_item ->
          validate_item_exists(quest_id, target_id)

        :talk ->
          validate_npc_exists(quest_id, target_id, :talk)

        _ ->
          # Unknown type, skip target validation
          []
      end
    end
  end

  defp validate_room_exists(quest_id, room_key) do
    case TypedObjectLoader.get(room_key) do
      {:ok, proto} ->
        if proto.subtype == :room do
          []
        else
          [{:missing_target, quest_id, :go_to, room_key}]
        end

      {:error, :not_found} ->
        [{:missing_target, quest_id, :go_to, room_key}]
    end
  end

  defp validate_npc_exists(quest_id, npc_key, obj_type) do
    case TypedObjectLoader.get(npc_key) do
      {:ok, _proto} ->
        []

      {:error, :not_found} ->
        [{:missing_target, quest_id, obj_type, npc_key}]
    end
  end

  defp validate_item_exists(quest_id, item_key) do
    case TypedObjectLoader.get(item_key) do
      {:ok, _proto} ->
        []

      {:error, :not_found} ->
        [{:missing_target, quest_id, :get_item, item_key}]
    end
  end

  defp validate_time_limit(_quest_id, _obj_id, obj) do
    time_limit = Map.get(obj, :time_limit) || Map.get(obj, "time_limit")

    cond do
      is_nil(time_limit) ->
        # No time limit is valid
        []

      is_integer(time_limit) and time_limit > 0 ->
        # Positive integer is valid
        []

      is_integer(time_limit) ->
        # Non-positive integer
        [{:invalid_time_limit, "time_limit must be a positive integer (got #{time_limit})"}]

      true ->
        # Not an integer
        [
          {:invalid_time_limit,
           "time_limit must be a positive integer (got #{inspect(time_limit)})"}
        ]
    end
  end

  defp validate_dialogue_topic(quest_id, obj) do
    obj_type = get_objective_type(obj)
    target_id = Map.get(obj, :target_id) || Map.get(obj, "target_id")
    topic = Map.get(obj, :dialogue_topic) || Map.get(obj, "dialogue_topic")

    if obj_type == :talk and not is_nil(topic) and topic != "" do
      case TypedObjectLoader.get(target_id) do
        {:ok, proto} ->
          dialogue_tree = get_dialogue_tree(proto)

          if has_dialogue_topic?(dialogue_tree, topic) do
            []
          else
            [{:missing_dialogue_topic, quest_id, target_id, topic}]
          end

        {:error, :not_found} ->
          # Already caught by validate_npc_exists
          []
      end
    else
      []
    end
  end

  # Extract dialogue tree from prototype components
  # Only checks for dialogue_tree component - old dialogue format is deprecated
  defp get_dialogue_tree(proto) do
    components = proto.components || %{}

    # dialogue_tree is the only supported format
    Map.get(components, "dialogue_tree") ||
      Map.get(components, :dialogue_tree) ||
      %{}
  end

  defp has_dialogue_topic?(dialogue_tree, topic) when is_map(dialogue_tree) do
    Map.has_key?(dialogue_tree, topic) or
      Map.has_key?(dialogue_tree, String.to_atom(topic))
  rescue
    ArgumentError -> false
  end

  defp has_dialogue_topic?(_, _), do: false

  # =============================================================================
  # Private - Quest Giver Validation
  # =============================================================================

  defp validate_quest_giver(_quest_id, nil, _requires), do: {[], []}
  defp validate_quest_giver(_quest_id, "", _requires), do: {[], []}
  # "system" is used for auto-seeded quests (e.g., starting quest on character creation)
  defp validate_quest_giver(_quest_id, "system", _requires), do: {[], []}

  defp validate_quest_giver(quest_id, giver_key, requires_quest) do
    case TypedObjectLoader.get(giver_key) do
      {:error, :not_found} ->
        {[{:missing_quest_giver, quest_id, giver_key}], []}

      {:ok, proto} ->
        dialogue_tree = get_dialogue_tree(proto)

        if map_size(dialogue_tree) == 0 do
          {[{:giver_no_dialogue, quest_id, giver_key}], []}
        else
          # Skip accept_action check for quests that auto-unlock via requires_quest
          # These quests activate when the prerequisite quest is completed
          warnings =
            cond do
              # Quest auto-unlocks when prerequisite completed - no accept action needed
              requires_quest && requires_quest != "" ->
                []

              # Check if any dialogue node has accept_quest action for this quest
              has_accept_action?(dialogue_tree, quest_id) ->
                []

              true ->
                [{:giver_no_accept_action, quest_id, giver_key}]
            end

          {[], warnings}
        end
    end
  end

  defp has_accept_action?(dialogue_tree, quest_id) when is_map(dialogue_tree) do
    Enum.any?(dialogue_tree, fn {_node_id, node} ->
      check_node_for_accept_action(node, quest_id)
    end)
  end

  defp has_accept_action?(_, _), do: false

  defp check_node_for_accept_action(node, quest_id) when is_map(node) do
    choices = Map.get(node, "choices") || Map.get(node, :choices) || []
    options = Map.get(node, "options") || Map.get(node, :options) || []

    Enum.any?(choices ++ options, fn choice ->
      action = Map.get(choice, "action") || Map.get(choice, :action)
      is_accept_quest_action?(action, quest_id)
    end)
  end

  defp check_node_for_accept_action(_, _), do: false

  defp is_accept_quest_action?(["accept_quest", qid], quest_id), do: qid == quest_id
  defp is_accept_quest_action?([:accept_quest, qid], quest_id), do: qid == quest_id
  defp is_accept_quest_action?(_, _), do: false

  # =============================================================================
  # Private - Prerequisite Validation
  # =============================================================================

  defp validate_prerequisite(_quest_id, nil, _all_quest_ids), do: []
  defp validate_prerequisite(_quest_id, "", _all_quest_ids), do: []

  defp validate_prerequisite(quest_id, requires, all_quest_ids) do
    if MapSet.member?(all_quest_ids, requires) do
      []
    else
      [{:missing_prerequisite, quest_id, requires}]
    end
  end

  defp check_circular_prerequisites(quests) do
    # Build dependency graph
    graph =
      Enum.reduce(quests, %{}, fn quest, acc ->
        requires = Map.get(quest, :requires_quest)

        if requires && requires != "" do
          Map.put(acc, quest.id, requires)
        else
          acc
        end
      end)

    # Check for cycles
    Enum.reduce(graph, [], fn {quest_id, _}, errors ->
      case detect_cycle(quest_id, graph, []) do
        nil -> errors
        cycle -> [{:circular_prerequisite, quest_id, cycle} | errors]
      end
    end)
    |> Enum.uniq()
  end

  defp detect_cycle(quest_id, graph, visited) do
    if quest_id in visited do
      [quest_id | visited]
    else
      case Map.get(graph, quest_id) do
        nil -> nil
        next -> detect_cycle(next, graph, [quest_id | visited])
      end
    end
  end

  # =============================================================================
  # Private - Chain Circular Dependency Validation
  # =============================================================================

  defp check_circular_chains do
    if Process.whereis(ChainRegistry) do
      chains = ChainRegistry.all()

      Enum.flat_map(chains, fn chain ->
        check_chain_for_cycles(chain)
      end)
    else
      []
    end
  end

  defp check_chain_for_cycles(chain) do
    # Build a graph from quest_id -> [next_quest_ids]
    # Include both `next` and `branches.next` as edges
    graph = build_chain_graph(chain.nodes)

    # Check each node for cycles using DFS
    chain.nodes
    |> Enum.flat_map(fn node ->
      case detect_chain_cycle(node.quest_id, graph, [], MapSet.new()) do
        nil -> []
        cycle -> [{:circular_chain, chain.id, node.quest_id, Enum.reverse(cycle)}]
      end
    end)
    |> Enum.uniq_by(fn {:circular_chain, _, _, cycle} -> Enum.sort(cycle) end)
  end

  defp build_chain_graph(nodes) do
    Enum.reduce(nodes, %{}, fn node, acc ->
      # Get all next quest IDs from the node
      next_from_next = node.next || []

      next_from_branches =
        (node.branches || [])
        |> Enum.map(& &1.next)
        |> Enum.reject(&is_nil/1)
        |> List.flatten()

      all_next = (next_from_next ++ next_from_branches) |> Enum.uniq()

      if Enum.empty?(all_next) do
        acc
      else
        Map.put(acc, node.quest_id, all_next)
      end
    end)
  end

  defp detect_chain_cycle(quest_id, graph, path, visited) do
    cond do
      quest_id in path ->
        # Found a cycle - return the path from the repeated node
        [quest_id | path]

      MapSet.member?(visited, quest_id) ->
        # Already checked this node in another path, no cycle from here
        nil

      true ->
        case Map.get(graph, quest_id) do
          nil ->
            # No outgoing edges, no cycle
            nil

          next_quests ->
            # Check each next quest for cycles
            new_path = [quest_id | path]
            new_visited = MapSet.put(visited, quest_id)

            Enum.find_value(next_quests, fn next_quest ->
              detect_chain_cycle(next_quest, graph, new_path, new_visited)
            end)
        end
    end
  end

  # =============================================================================
  # Private - Reward Validation
  # =============================================================================

  defp validate_rewards(quest_id, rewards) do
    items = Map.get(rewards, "items") || Map.get(rewards, :items) || []

    # Items can be a flat list of strings or a nested map (for conditional rewards)
    item_keys = extract_item_keys(items)

    Enum.flat_map(item_keys, fn item_key ->
      case TypedObjectLoader.get(item_key) do
        {:error, :not_found} ->
          [{:reward_item_not_found, quest_id, item_key}]

        {:ok, _} ->
          []
      end
    end)
  end

  # Extract all item keys from reward items (handles nested structures)
  defp extract_item_keys(items) when is_list(items) do
    Enum.flat_map(items, fn
      item when is_binary(item) -> [item]
      item when is_map(item) -> extract_item_keys(Map.values(item))
      {_key, value} when is_list(value) -> extract_item_keys(value)
      _ -> []
    end)
  end

  defp extract_item_keys(items) when is_map(items) do
    # Nested map like %{"destroy" => ["item1"], "liberate" => ["item2"]}
    items
    |> Map.values()
    |> Enum.flat_map(&extract_item_keys/1)
  end

  defp extract_item_keys(_), do: []

  # =============================================================================
  # Private - Storyline Integration
  # =============================================================================

  defp get_storyline_quest_ids do
    if Process.whereis(StorylineRegistry) do
      StorylineRegistry.all()
      |> Enum.flat_map(fn storyline ->
        # Collect quests from acts
        acts = Map.get(storyline, :acts) || []

        act_quests =
          Enum.flat_map(acts, fn act ->
            Map.get(act, :quests) || []
          end)

        # Also include side_quests
        side_quests = Map.get(storyline, :side_quests) || []

        act_quests ++ side_quests
      end)
      |> MapSet.new()
    else
      MapSet.new()
    end
  end

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:invalid_objective, quest, obj_id, reason}) do
    "  - Quest '#{quest}' objective '#{obj_id}': #{reason}"
  end

  defp format_error({:unknown_objective_type, quest, obj_id, type}) do
    "  - Quest '#{quest}' objective '#{obj_id}': Unknown type '#{type}'"
  end

  defp format_error({:missing_target, quest, obj_type, target}) do
    "  - Quest '#{quest}': #{obj_type} target '#{target}' not found"
  end

  defp format_error({:missing_dialogue_topic, quest, npc, topic}) do
    "  - Quest '#{quest}': NPC '#{npc}' missing dialogue topic '#{topic}'"
  end

  defp format_error({:missing_quest_giver, quest, giver}) do
    "  - Quest '#{quest}': Giver NPC '#{giver}' not found"
  end

  defp format_error({:giver_no_dialogue, quest, giver}) do
    "  - Quest '#{quest}': Giver '#{giver}' has no dialogue tree"
  end

  defp format_error({:circular_prerequisite, quest, cycle}) do
    cycle_str = Enum.join(cycle, " → ")
    "  - Quest '#{quest}': Circular prerequisite: #{cycle_str}"
  end

  defp format_error({:missing_prerequisite, quest, prereq}) do
    "  - Quest '#{quest}': Prerequisite '#{prereq}' not found"
  end

  defp format_error({:circular_chain, chain_id, quest_id, cycle}) do
    cycle_str = Enum.join(cycle, " → ")
    "  - Chain '#{chain_id}' quest '#{quest_id}': Circular dependency: #{cycle_str}"
  end

  defp format_error({:invalid_time_limit, reason}) do
    "  - #{reason}"
  end

  defp format_warning({:orphaned_quest, quest}) do
    "  - Quest '#{quest}': Not assigned to any storyline"
  end

  defp format_warning({:reward_item_not_found, quest, item}) do
    "  - Quest '#{quest}': Reward item '#{item}' not found"
  end

  defp format_warning({:no_objectives, quest}) do
    "  - Quest '#{quest}': Has no objectives defined"
  end

  defp format_warning({:giver_no_accept_action, quest, giver}) do
    "  - Quest '#{quest}': Giver '#{giver}' has no accept_quest action for this quest"
  end
end
