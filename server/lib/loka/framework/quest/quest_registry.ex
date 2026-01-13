defmodule Loka.Framework.Quest.QuestRegistry do
  @moduledoc """
  Loads and stores quest definitions from YAML files.

  Quest definitions are stored in `priv/world/quests/` and define:
  - Quest metadata (name, description, giver)
  - Objectives (talk, kill, get_item, go_to)
  - Rewards (xp, items, unlocks)
  - Prerequisites

  ## YAML Format

      id: main_sleeping_master
      name: "The Sleeping Master"
      description: |
        Investigate what happened to Lama Tenzin...
      giver: abbot_jampa
      type: main
      act: 1
      requires_quest: null
      objectives:
        - id: talk_abbot
          type: talk
          target_id: abbot_jampa
          description: "Speak with Abbot Jampa"
      rewards:
        xp: 100
        items:
          - cave_entrance_key
        unlocks:
          - main_three_trials

  ## Template Inheritance

  Quests can inherit from template quests using the `parent` field:

      # Template quest (in _templates/fetch_template.yml)
      id: fetch_template
      is_template: true
      type: side
      rewards:
        xp: 50
      objectives:
        - id: get_item
          type: get_item
          target_id: null  # To be overridden
          description: "Collect the item"
        - id: return
          type: talk
          target_id: null  # To be overridden
          description: "Return to the quest giver"

      # Child quest
      id: fetch_herbs
      parent: fetch_template
      name: "Fetch Healing Herbs"
      giver: herbalist
      objectives:
        - id: get_item
          target_id: healing_herbs
        - id: return
          target_id: herbalist

  Child quests inherit all fields from parent and can selectively override.
  Objectives are merged by ID - only specified fields are overridden.

  ## Variable Substitution

  Templates can use `${variable}` placeholders that are replaced with values
  from the child quest's `variables` map. This reduces repetition for common
  quest patterns like "kill X enemies" or "fetch Y items".

      # Template with variables (in _templates/kill_template.yml)
      id: kill_template
      is_template: true
      type: side
      name: "Defeat the ${target_name}"
      description: "Eliminate ${count} ${target_name} threatening the area."
      objectives:
        - id: kill_target
          type: kill
          target_id: ${target}
          target_count: ${count}
          description: "Defeat ${count} ${target_name}"
      rewards:
        xp: ${xp_reward}
      journal_entries:
        start: "I must defeat ${count} ${target_name}."
        complete: "The ${target_name} have been defeated."

      # Child quest with variables
      id: kill_bandits
      parent: kill_template
      giver: village_elder
      variables:
        target: bandit
        target_name: bandits
        count: 5
        xp_reward: 75

  Variables are substituted in:
  - Quest fields: name, description, giver
  - Objective fields: description, target_id, dialogue_topic, target_count
  - Rewards (all string values)
  - Journal entries

  Variables can be inherited from parent templates and overridden in children.
  Undefined variables are left as-is (e.g., `${undefined}` stays literal).

  ## Usage

      alias Loka.Framework.Quest.QuestRegistry

      # Get a quest definition
      {:ok, quest} = QuestRegistry.get("main_sleeping_master")

      # List all quests
      quests = QuestRegistry.all()

      # Get quests by type
      main_quests = QuestRegistry.by_type("main")
  """

  use GenServer
  require Logger

  # Use Definitions structs - they're now defined before this module is referenced
  alias Loka.Framework.Quest.Definitions.Quest
  alias Loka.Framework.Quest.Definitions.Objective

  @table :loka_quests
  @default_path "priv/world/quests"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the quest registry.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a quest definition by ID.

  Returns `{:ok, quest}` or `{:error, :not_found}`.
  """
  def get(quest_id, server \\ __MODULE__) when is_binary(quest_id) do
    GenServer.call(server, {:get, quest_id})
  end

  @doc """
  Gets a quest definition by ID, raises if not found.
  """
  def get!(quest_id, server \\ __MODULE__) when is_binary(quest_id) do
    case get(quest_id, server) do
      {:ok, quest} -> quest
      {:error, :not_found} -> raise "Quest not found: #{quest_id}"
    end
  end

  @doc """
  Returns all loaded quests.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns quests of a specific type (main, side, etc.).
  """
  def by_type(type, server \\ __MODULE__) when is_binary(type) do
    GenServer.call(server, {:by_type, type})
  end

  @doc """
  Returns the count of loaded quests.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Checks if a quest exists.
  """
  def exists?(quest_id, server \\ __MODULE__) when is_binary(quest_id) do
    case get(quest_id, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Reloads all quests from disk.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@table, [:set, :protected, read_concurrency: true])

    state = %{table: table, path: path, quests: %{}}

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          count = map_size(new_state.quests)
          Logger.info("#{__MODULE__} loaded #{count} quests")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("#{__MODULE__} started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, quest_id}, _from, state) do
    result =
      case Map.get(state.quests, quest_id) do
        nil -> {:error, :not_found}
        quest -> {:ok, quest}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.quests), state}
  end

  @impl true
  def handle_call({:by_type, type}, _from, state) do
    quests =
      state.quests
      |> Map.values()
      |> Enum.filter(&(&1.type == type))

    {:reply, quests, state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.quests), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        count = map_size(new_state.quests)
        Logger.info("#{__MODULE__} reloaded #{count} quests")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  # =============================================================================
  # Private - Loading
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      yaml_files = Path.wildcard(Path.join([full_path, "**", "*.{yml,yaml}"]))
      {raw_quests, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        # Resolve parent inheritance
        resolved_quests = resolve_quest_inheritance(raw_quests)

        # Filter out templates (quests marked as is_template: true)
        final_quests =
          resolved_quests
          |> Enum.reject(fn {_id, quest} -> Map.get(quest, :is_template, false) end)
          |> Enum.into(%{})

        update_ets(state.table, final_quests)
        {:ok, %{state | quests: final_quests}}
      end
    else
      Logger.debug("#{__MODULE__}: path #{full_path} does not exist, starting empty")
      {:ok, %{state | quests: %{}}}
    end
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  defp parse_yaml_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {quests, errors} ->
      case parse_yaml_file(file) do
        {:ok, quest} ->
          {Map.put(quests, quest.id, quest), errors}

        {:error, reason} ->
          {quests, [{file, reason} | errors]}
      end
    end)
  end

  # sobelow_skip ["Traversal.FileModule"] - file paths from Path.wildcard on priv/world
  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, quest} <- quest_from_map(data) do
      {:ok, quest}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp quest_from_map(data) when is_map(data) do
    id = data["id"] || data[:id]

    if is_nil(id) do
      {:error, :missing_id}
    else
      objectives =
        (data["objectives"] || data[:objectives] || [])
        |> Enum.map(&objective_from_map/1)

      quest = %Quest{
        id: id,
        name: data["name"] || data[:name] || id,
        description: data["description"] || data[:description] || "",
        objectives: objectives,
        rewards: data["rewards"] || data[:rewards] || %{},
        status: :available,
        # Fields now part of the Quest struct
        type: data["type"] || data[:type] || "side",
        act: data["act"] || data[:act],
        giver: data["giver"] || data[:giver],
        turn_in_npc: data["turn_in_npc"] || data[:turn_in_npc],
        requires_quest: data["requires_quest"] || data[:requires_quest],
        level_requirement: data["level_requirement"] || data[:level_requirement] || 1,
        journal_entries: data["journal_entries"] || data[:journal_entries] || %{},
        parent: data["parent"] || data[:parent],
        is_template: data["is_template"] || data[:is_template] || false,
        variables: data["variables"] || data[:variables] || %{}
      }

      # Add raw data for debugging/reference
      quest = Map.put(quest, :_raw_data, data)

      {:ok, quest}
    end
  end

  defp quest_from_map(_), do: {:error, :invalid_data}

  # sobelow_skip ["DOS.StringToAtom"] - type values from internal quest YAML with known types
  defp objective_from_map(data) when is_map(data) do
    type_val = data["type"] || data[:type]
    type_atom = if is_binary(type_val), do: String.to_atom(type_val), else: type_val

    %Objective{
      id: data["id"] || data[:id],
      type: type_atom,
      description: data["description"] || data[:description] || "",
      target_id: data["target_id"] || data[:target_id],
      dialogue_topic: data["dialogue_topic"] || data[:dialogue_topic],
      target_count: data["target_count"] || data[:target_count] || 1,
      time_limit: data["time_limit"] || data[:time_limit]
    }
  end

  defp objective_from_map(_), do: %Objective{}

  defp update_ets(table, quests) do
    :ets.delete_all_objects(table)

    Enum.each(quests, fn {id, quest} ->
      :ets.insert(table, {id, quest})
    end)
  end

  # =============================================================================
  # Private - Inheritance Resolution
  # =============================================================================

  defp resolve_quest_inheritance(raw_quests) do
    # Sort by dependency order - templates first, then children
    sorted_ids = topological_sort(raw_quests)

    Enum.reduce(sorted_ids, %{}, fn quest_id, resolved ->
      quest = Map.get(raw_quests, quest_id)

      resolved_quest =
        case Map.get(quest, :parent) do
          nil ->
            quest

          parent_id ->
            case Map.get(resolved, parent_id) do
              nil ->
                Logger.warning(
                  "[QuestRegistry] Quest '#{quest_id}' has unknown parent '#{parent_id}'"
                )

                quest

              parent_quest ->
                merge_quest_with_parent(quest, parent_quest)
            end
        end

      # Only apply variables to non-templates (templates keep ${var} placeholders)
      resolved_quest =
        if Map.get(resolved_quest, :is_template, false) do
          resolved_quest
        else
          apply_variables(resolved_quest)
        end

      resolved_quest =
        resolved_quest
        |> Map.delete(:_raw_data)
        |> Map.delete(:variables)

      Map.put(resolved, quest_id, resolved_quest)
    end)
  end

  defp topological_sort(quests) do
    # Build dependency graph
    graph =
      Enum.reduce(quests, %{}, fn {id, quest}, acc ->
        parent = Map.get(quest, :parent)

        deps =
          if parent do
            [parent]
          else
            []
          end

        Map.put(acc, id, deps)
      end)

    # Kahn's algorithm for topological sort
    in_degree =
      Enum.reduce(graph, %{}, fn {id, _deps}, acc ->
        Map.put(acc, id, 0)
      end)

    in_degree =
      Enum.reduce(graph, in_degree, fn {_id, deps}, acc ->
        Enum.reduce(deps, acc, fn dep, inner_acc ->
          Map.update(inner_acc, dep, 0, & &1)
        end)
      end)

    in_degree =
      Enum.reduce(graph, in_degree, fn {id, _deps}, acc ->
        parent = graph[id] |> List.first()

        if parent do
          Map.update!(acc, id, &(&1 + 1))
        else
          acc
        end
      end)

    # Find all nodes with in-degree 0 (no dependencies)
    queue = Enum.filter(Map.keys(in_degree), fn id -> in_degree[id] == 0 end)
    do_topological_sort(queue, graph, in_degree, [])
  end

  defp do_topological_sort([], _graph, _in_degree, result), do: Enum.reverse(result)

  defp do_topological_sort([node | rest], graph, in_degree, result) do
    # Find nodes that depend on this one
    dependents =
      Enum.filter(Map.keys(graph), fn id ->
        Map.get(graph, id, []) |> Enum.member?(node)
      end)

    # Decrease in-degree for each dependent
    updated_in_degree =
      Enum.reduce(dependents, in_degree, fn dep, acc ->
        Map.update!(acc, dep, &(&1 - 1))
      end)

    # Add nodes that now have in-degree 0
    new_ready = Enum.filter(dependents, fn dep -> updated_in_degree[dep] == 0 end)
    new_queue = rest ++ new_ready

    do_topological_sort(new_queue, graph, updated_in_degree, [node | result])
  end

  defp merge_quest_with_parent(child, parent) do
    child_data = Map.get(child, :_raw_data, %{})

    # Start with parent quest
    merged = parent

    # Override with child fields only if explicitly set in YAML
    # (not defaulted values from quest_from_map)
    quest_fields = [
      {:name, "name"},
      {:description, "description"},
      {:type, "type"},
      {:act, "act"},
      {:giver, "giver"},
      {:turn_in_npc, "turn_in_npc"},
      {:requires_quest, "requires_quest"},
      {:level_requirement, "level_requirement"},
      {:rewards, "rewards"},
      {:journal_entries, "journal_entries"}
    ]

    merged =
      Enum.reduce(quest_fields, merged, fn {field, yaml_key}, acc ->
        # Check if field was explicitly set in the child's YAML
        yaml_value = child_data[yaml_key] || child_data[field]

        if yaml_value != nil do
          # Use the parsed value from the child struct
          child_value = Map.get(child, field)
          Map.put(acc, field, child_value)
        else
          acc
        end
      end)

    # Merge objectives by ID
    parent_objectives = parent.objectives || []
    child_objectives_data = child_data["objectives"] || child_data[:objectives] || []

    merged_objectives = merge_objectives(parent_objectives, child_objectives_data)

    # Merge rewards
    parent_rewards = Map.get(parent, :rewards) || %{}
    child_rewards_data = child_data["rewards"] || child_data[:rewards] || %{}
    merged_rewards = deep_merge_maps(parent_rewards, child_rewards_data)

    # Merge variables (child overrides parent)
    parent_vars = Map.get(parent, :variables) || %{}
    child_vars = child_data["variables"] || child_data[:variables] || %{}
    merged_vars = deep_merge_maps(parent_vars, child_vars)

    merged
    |> Map.put(:id, child.id)
    |> Map.put(:objectives, merged_objectives)
    |> Map.put(:rewards, merged_rewards)
    |> Map.put(:variables, merged_vars)
    |> Map.put(:parent, nil)
    |> Map.put(:is_template, false)
  end

  defp merge_objectives(parent_objectives, child_objectives_data) do
    Enum.map(parent_objectives, fn parent_obj ->
      # Find matching child override
      child_override =
        Enum.find(child_objectives_data, fn child ->
          (child["id"] || child[:id]) == parent_obj.id
        end)

      if child_override do
        merge_objective(parent_obj, child_override)
      else
        parent_obj
      end
    end)
  end

  defp merge_objective(parent_obj, child_data) do
    %{
      parent_obj
      | type: child_data["type"] || child_data[:type] || parent_obj.type,
        description:
          child_data["description"] || child_data[:description] || parent_obj.description,
        target_id: child_data["target_id"] || child_data[:target_id] || parent_obj.target_id,
        dialogue_topic:
          child_data["dialogue_topic"] || child_data[:dialogue_topic] || parent_obj.dialogue_topic,
        target_count:
          child_data["target_count"] || child_data[:target_count] || parent_obj.target_count
    }
  end

  defp deep_merge_maps(base, override) when is_map(base) and is_map(override) do
    Map.merge(base, override, fn _k, v1, v2 ->
      if is_map(v1) and is_map(v2) do
        deep_merge_maps(v1, v2)
      else
        v2
      end
    end)
  end

  defp deep_merge_maps(_base, override), do: override

  # =============================================================================
  # Private - Variable Substitution
  # =============================================================================

  @doc false
  # Applies variable substitution to a quest using its :variables map.
  # Variables use ${var_name} syntax and are replaced in all string fields.
  defp apply_variables(quest) do
    variables = Map.get(quest, :variables) || %{}

    if map_size(variables) == 0 do
      quest
    else
      quest
      |> substitute_in_quest(variables)
      |> substitute_in_objectives(variables)
      |> substitute_in_rewards(variables)
      |> substitute_in_journal(variables)
    end
  end

  defp substitute_in_quest(quest, variables) do
    quest
    |> Map.update(:name, "", &substitute_string(&1, variables))
    |> Map.update(:description, "", &substitute_string(&1, variables))
    |> Map.update(:giver, nil, &substitute_string(&1, variables))
    |> Map.update(:target_id, nil, &substitute_string(&1, variables))
  end

  defp substitute_in_objectives(quest, variables) do
    updated_objectives =
      Enum.map(quest.objectives || [], fn obj ->
        %{
          obj
          | description: substitute_string(obj.description, variables),
            target_id: substitute_string(obj.target_id, variables),
            dialogue_topic: substitute_string(obj.dialogue_topic, variables)
        }
        |> maybe_substitute_target_count(variables)
      end)

    %{quest | objectives: updated_objectives}
  end

  defp maybe_substitute_target_count(obj, variables) do
    case obj.target_count do
      count when is_binary(count) ->
        substituted = substitute_string(count, variables)

        case Integer.parse(substituted) do
          {int_val, ""} -> %{obj | target_count: int_val}
          _ -> obj
        end

      _ ->
        obj
    end
  end

  defp substitute_in_rewards(quest, variables) do
    rewards = Map.get(quest, :rewards) || %{}
    updated_rewards = substitute_in_map(rewards, variables)
    Map.put(quest, :rewards, updated_rewards)
  end

  defp substitute_in_journal(quest, variables) do
    journal = Map.get(quest, :journal_entries) || %{}
    updated_journal = substitute_in_map(journal, variables)
    Map.put(quest, :journal_entries, updated_journal)
  end

  defp substitute_in_map(map, variables) when is_map(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      substituted_value =
        cond do
          is_binary(value) -> substitute_string(value, variables)
          is_map(value) -> substitute_in_map(value, variables)
          is_list(value) -> Enum.map(value, &substitute_value(&1, variables))
          true -> value
        end

      Map.put(acc, key, substituted_value)
    end)
  end

  defp substitute_value(value, variables) when is_binary(value) do
    substitute_string(value, variables)
  end

  defp substitute_value(value, _variables), do: value

  # Substitutes ${var_name} patterns in a string with values from variables map.
  # Supports both string and atom keys in variables map.
  defp substitute_string(nil, _variables), do: nil

  defp substitute_string(text, variables) when is_binary(text) do
    # Match ${var_name} pattern
    Regex.replace(~r/\$\{(\w+)\}/, text, fn _full_match, var_name ->
      # Try both string and atom keys
      value =
        Map.get(variables, var_name) ||
          Map.get(variables, String.to_atom(var_name)) ||
          "${#{var_name}}"

      to_string(value)
    end)
  end

  defp substitute_string(value, _variables), do: value
end
