defmodule Loka.Testing.Content.StorylineValidator do
  @moduledoc """
  Validates storyline definitions for integrity.

  Ensures storylines are properly structured and reference valid content:
  - All quests in acts exist
  - All side quests exist
  - Starting room exists
  - Act dependencies form valid DAG (no cycles)
  - Required act references are valid

  ## Usage

      {:ok, results} = StorylineValidator.validate()

  ## Result Structure

      %{
        storylines_checked: 2,
        errors: [
          {:missing_quest, "monastery_arc", "unknown_quest"},
          {:invalid_act_dependency, "monastery_arc", "act_2", "nonexistent_act"}
        ],
        warnings: [
          {:no_side_quests, "tutorial_arc"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.Entities
  alias Loka.Content

  @type validation_result :: %{
          storylines_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:missing_quest, String.t(), String.t()}
          | {:missing_starting_room, String.t(), String.t()}
          | {:invalid_act_dependency, String.t(), String.t(), String.t()}
          | {:circular_dependency, String.t(), [String.t()]}
          | {:duplicate_act_id, String.t(), String.t()}
          | {:empty_act, String.t(), String.t()}

  @type warning ::
          {:no_side_quests, String.t()}
          | {:no_description, String.t()}
          | {:no_starting_room, String.t()}
          | {:single_act, String.t()}

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates all storyline definitions.

  Returns `{:ok, results}` with validation results.
  """
  @spec validate() :: {:ok, validation_result()}
  def validate do
    storylines = load_storylines()

    {errors, warnings} =
      Enum.reduce(storylines, {[], []}, fn storyline, {errs, warns} ->
        {storyline_errors, storyline_warnings} = validate_storyline(storyline)
        {errs ++ storyline_errors, warns ++ storyline_warnings}
      end)

    results = %{
      storylines_checked: length(storylines),
      errors: errors,
      warnings: warnings
    }

    Logger.info(
      "StorylineValidator: Checked #{results.storylines_checked} storylines, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
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
      "=== Storyline Validation Report ===",
      "",
      "Storylines checked: #{results.storylines_checked}",
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
  # Private - Loading
  # =============================================================================

  defp load_storylines do
    path = Path.join(:code.priv_dir(:loka), "world/storylines")

    if File.dir?(path) do
      path
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".yml"))
      |> Enum.map(fn file ->
        file_path = Path.join(path, file)
        content = YamlElixir.read_from_file!(file_path)
        Map.put(content, "file", file)
      end)
    else
      []
    end
  rescue
    _ -> []
  end

  # =============================================================================
  # Private - Validation
  # =============================================================================

  defp validate_storyline(storyline) do
    storyline_key = storyline["key"] || storyline["file"] || "unknown"
    errors = []
    warnings = []

    # Validate starting room
    starting_room = storyline["starting_room"]

    {room_errors, room_warnings} = validate_starting_room(storyline_key, starting_room)
    errors = errors ++ room_errors
    warnings = warnings ++ room_warnings

    # Validate acts
    acts = storyline["acts"] || []
    {act_errors, act_warnings} = validate_acts(storyline_key, acts)
    errors = errors ++ act_errors
    warnings = warnings ++ act_warnings

    # Validate side quests
    side_quests = storyline["side_quests"] || []

    warnings =
      if Enum.empty?(side_quests) do
        [{:no_side_quests, storyline_key} | warnings]
      else
        warnings
      end

    {side_errors, _} = validate_quest_references(storyline_key, side_quests)
    errors = errors ++ side_errors

    # Warn if single act
    warnings =
      if length(acts) == 1 do
        [{:single_act, storyline_key} | warnings]
      else
        warnings
      end

    # Check for missing description
    warnings =
      if is_nil(storyline["description"]) or storyline["description"] == "" do
        [{:no_description, storyline_key} | warnings]
      else
        warnings
      end

    {errors, warnings}
  end

  defp validate_starting_room(storyline_key, nil) do
    {[], [{:no_starting_room, storyline_key}]}
  end

  defp validate_starting_room(storyline_key, room_key) do
    case Entities.find_one(key: room_key) do
      {:ok, proto} ->
        if proto.type == :room do
          {[], []}
        else
          {[{:missing_starting_room, storyline_key, room_key}], []}
        end

      {:error, :not_found} ->
        {[{:missing_starting_room, storyline_key, room_key}], []}
    end
  end

  defp validate_acts(storyline_key, acts) do
    # Collect all act IDs
    act_ids = Enum.map(acts, & &1["id"])

    # Check for duplicates
    duplicate_errors =
      act_ids
      |> Enum.frequencies()
      |> Enum.filter(fn {_id, count} -> count > 1 end)
      |> Enum.map(fn {id, _} -> {:duplicate_act_id, storyline_key, id} end)

    # Validate each act
    {act_errors, act_warnings} =
      Enum.reduce(acts, {[], []}, fn act, {errs, warns} ->
        {e, w} = validate_act(storyline_key, act, act_ids)
        {errs ++ e, warns ++ w}
      end)

    # Check for circular dependencies
    cycle_errors = check_circular_dependencies(storyline_key, acts)

    {duplicate_errors ++ act_errors ++ cycle_errors, act_warnings}
  end

  defp validate_act(storyline_key, act, all_act_ids) do
    act_id = act["id"] || "unknown"
    errors = []
    warnings = []

    # Check act has quests
    quests = act["quests"] || []

    errors =
      if Enum.empty?(quests) do
        [{:empty_act, storyline_key, act_id} | errors]
      else
        errors
      end

    # Validate quest references
    {quest_errors, _} = validate_quest_references(storyline_key, quests)
    errors = errors ++ quest_errors

    # Validate requires references
    requires = act["requires"] || []

    invalid_deps =
      Enum.reject(requires, &(&1 in all_act_ids))
      |> Enum.map(&{:invalid_act_dependency, storyline_key, act_id, &1})

    errors = errors ++ invalid_deps

    {errors, warnings}
  end

  defp validate_quest_references(storyline_key, quest_ids) do
    errors =
      Enum.reduce(quest_ids, [], fn quest_id, acc ->
        case Content.Quest.definition(quest_id) do
          nil ->
            [{:missing_quest, storyline_key, quest_id} | acc]

          _quest ->
            acc
        end
      end)

    {errors, []}
  end

  defp check_circular_dependencies(storyline_key, acts) do
    # Build dependency graph
    graph =
      Enum.reduce(acts, %{}, fn act, acc ->
        act_id = act["id"]
        requires = act["requires"] || []
        Map.put(acc, act_id, requires)
      end)

    # Check each act for cycles using DFS
    act_ids = Map.keys(graph)

    cycles =
      Enum.reduce(act_ids, [], fn act_id, acc ->
        case detect_cycle(graph, act_id, [act_id], MapSet.new()) do
          {:cycle, path} ->
            [{:circular_dependency, storyline_key, Enum.reverse(path)} | acc]

          :no_cycle ->
            acc
        end
      end)

    # Deduplicate cycles (same cycle may be detected from different starting points)
    cycles
    |> Enum.uniq_by(fn {:circular_dependency, _, path} -> Enum.sort(path) end)
  end

  defp detect_cycle(graph, current, path, visited) do
    deps = Map.get(graph, current, [])

    Enum.reduce_while(deps, :no_cycle, fn dep, _acc ->
      cond do
        dep in path ->
          {:halt, {:cycle, [dep | path]}}

        dep in visited ->
          {:cont, :no_cycle}

        true ->
          case detect_cycle(graph, dep, [dep | path], MapSet.put(visited, current)) do
            {:cycle, _} = cycle -> {:halt, cycle}
            :no_cycle -> {:cont, :no_cycle}
          end
      end
    end)
  end

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:missing_quest, storyline, quest}) do
    "  - Storyline '#{storyline}': Quest '#{quest}' not found"
  end

  defp format_error({:missing_starting_room, storyline, room}) do
    "  - Storyline '#{storyline}': Starting room '#{room}' not found"
  end

  defp format_error({:invalid_act_dependency, storyline, act, dep}) do
    "  - Storyline '#{storyline}': Act '#{act}' requires unknown act '#{dep}'"
  end

  defp format_error({:circular_dependency, storyline, path}) do
    "  - Storyline '#{storyline}': Circular dependency detected: #{Enum.join(path, " -> ")}"
  end

  defp format_error({:duplicate_act_id, storyline, act_id}) do
    "  - Storyline '#{storyline}': Duplicate act ID '#{act_id}'"
  end

  defp format_error({:empty_act, storyline, act_id}) do
    "  - Storyline '#{storyline}': Act '#{act_id}' has no quests"
  end

  defp format_warning({:no_side_quests, storyline}) do
    "  - Storyline '#{storyline}': Has no side quests defined"
  end

  defp format_warning({:no_description, storyline}) do
    "  - Storyline '#{storyline}': Has no description"
  end

  defp format_warning({:no_starting_room, storyline}) do
    "  - Storyline '#{storyline}': Has no starting room defined"
  end

  defp format_warning({:single_act, storyline}) do
    "  - Storyline '#{storyline}': Only has one act"
  end
end
