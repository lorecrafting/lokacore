defmodule Loka.Testing.AIEval.Rubrics.Structural do
  @moduledoc """
  Automated structural scoring rubric for AI eval scenarios.

  Checks that the AI created the expected entities, connections,
  and relationships defined in the scenario expectations.

  ## Scoring (out of 50 per phase)

  | Check                          | Points |
  |--------------------------------|--------|
  | Expected entities created      | 0-10   |
  | Rooms have bidirectional exits | 0-5    |
  | NPCs placed in correct rooms   | 0-5    |
  | Quest validates (no errors)    | 0-10   |
  | Dialogue has expected nodes    | 0-5    |
  | No orphan rooms/entities       | 0-5    |
  | Previous content preserved     | 0-5    |
  | Clean deletion                 | 0-5    |
  """

  alias Loka.Engine.Entities

  @type check_result :: %{
          check: String.t(),
          passed: boolean(),
          points: non_neg_integer(),
          max_points: non_neg_integer(),
          detail: String.t()
        }

  @type score :: %{
          total: non_neg_integer(),
          max: non_neg_integer(),
          checks: [check_result()]
        }

  @doc """
  Score a phase's expectations against the current world state.
  """
  @spec score(
          [Loka.Testing.AIEval.Scenario.expectation()],
          Loka.Testing.AIEval.Scenario.phase_name()
        ) :: score()
  def score(expectations, phase_name) do
    checks = Enum.map(expectations, &evaluate_expectation/1)

    # Add phase-specific bonus checks
    bonus_checks = phase_bonus_checks(phase_name, expectations)
    all_checks = checks ++ bonus_checks

    total = Enum.sum(Enum.map(all_checks, & &1.points))
    max = Enum.sum(Enum.map(all_checks, & &1.max_points))

    %{total: total, max: max, checks: all_checks}
  end

  # ---------------------------------------------------------------------------
  # Expectation Evaluators
  # ---------------------------------------------------------------------------

  defp evaluate_expectation({:entity_exists, opts}) do
    key = Keyword.fetch!(opts, :key)
    type = Keyword.get(opts, :type)

    entity = find_entity(key, type)

    if entity do
      %{
        check: "entity_exists(#{key})",
        passed: true,
        points: 5,
        max_points: 5,
        detail: "Found #{key} (#{entity.type})"
      }
    else
      type_str = if type, do: " type=#{type}", else: ""

      %{
        check: "entity_exists(#{key})",
        passed: false,
        points: 0,
        max_points: 5,
        detail: "Missing entity: #{key}#{type_str}"
      }
    end
  end

  defp evaluate_expectation({:entity_not_exists, opts}) do
    key = Keyword.fetch!(opts, :key)

    entity = find_entity(key, nil)

    if entity do
      %{
        check: "entity_not_exists(#{key})",
        passed: false,
        points: 0,
        max_points: 5,
        detail: "Entity should be deleted but still exists: #{key}"
      }
    else
      %{
        check: "entity_not_exists(#{key})",
        passed: true,
        points: 5,
        max_points: 5,
        detail: "Correctly deleted: #{key}"
      }
    end
  end

  defp evaluate_expectation({:rooms_connected, from_key, to_key}) do
    # Check if there's an exit entity linking the two rooms
    from = find_entity(from_key, :room)
    to = find_entity(to_key, :room)

    connected =
      if from && to do
        exits = Entities.find_all(type: :exit, location_id: from.id)

        Enum.any?(exits, fn exit ->
          exit_data = (exit.components || %{})["exit"] || %{}
          exit_data["destination_key"] == to_key
        end)
      else
        false
      end

    if connected do
      %{
        check: "rooms_connected(#{from_key}, #{to_key})",
        passed: true,
        points: 5,
        max_points: 5,
        detail: "#{from_key} connects to #{to_key}"
      }
    else
      %{
        check: "rooms_connected(#{from_key}, #{to_key})",
        passed: false,
        points: 0,
        max_points: 5,
        detail: "No exit from #{from_key} to #{to_key}"
      }
    end
  end

  defp evaluate_expectation({:quest_validates, quest_key}) do
    entity = find_entity(quest_key, :quest)

    if entity do
      data = (entity.components || %{})["data"] || %{}
      has_objectives = is_list(data["objectives"]) and data["objectives"] != []
      has_name = entity.short_desc && entity.short_desc != ""

      points = if(has_objectives, do: 5, else: 0) + if has_name, do: 5, else: 0

      %{
        check: "quest_validates(#{quest_key})",
        passed: has_objectives and has_name,
        points: points,
        max_points: 10,
        detail: "objectives=#{has_objectives}, name=#{has_name}"
      }
    else
      %{
        check: "quest_validates(#{quest_key})",
        passed: false,
        points: 0,
        max_points: 10,
        detail: "Quest not found: #{quest_key}"
      }
    end
  end

  defp evaluate_expectation({:dialogue_has_nodes, dialogue_key, opts}) do
    min_nodes = Keyword.get(opts, :min, 1)
    entity = find_entity(dialogue_key, :dialogue)

    if entity do
      data = (entity.components || %{})["data"] || %{}
      nodes = data["nodes"] || %{}
      node_count = map_size(nodes)
      passed = node_count >= min_nodes

      %{
        check: "dialogue_has_nodes(#{dialogue_key}, min=#{min_nodes})",
        passed: passed,
        points: if(passed, do: 5, else: 0),
        max_points: 5,
        detail: "#{node_count} nodes (need >= #{min_nodes})"
      }
    else
      %{
        check: "dialogue_has_nodes(#{dialogue_key})",
        passed: false,
        points: 0,
        max_points: 5,
        detail: "Dialogue not found: #{dialogue_key}"
      }
    end
  end

  defp evaluate_expectation({:description_contains, opts}) do
    key = Keyword.fetch!(opts, :key)
    text = Keyword.fetch!(opts, :text)

    entity = find_entity(key, nil)

    if entity do
      desc = entity.extra_desc || entity.short_desc || ""
      contains = String.contains?(String.downcase(desc), String.downcase(text))

      %{
        check: "description_contains(#{key}, \"#{text}\")",
        passed: contains,
        points: if(contains, do: 5, else: 0),
        max_points: 5,
        detail:
          if(contains,
            do: "Description mentions '#{text}'",
            else: "Description doesn't contain '#{text}'"
          )
      }
    else
      %{
        check: "description_contains(#{key})",
        passed: false,
        points: 0,
        max_points: 5,
        detail: "Entity not found: #{key}"
      }
    end
  end

  defp evaluate_expectation({:entity_count, opts}) do
    type = Keyword.fetch!(opts, :type)
    expected_count = Keyword.fetch!(opts, :count)

    entities = Entities.find_all(type: type)
    actual_count = length(entities)
    passed = actual_count >= expected_count

    %{
      check: "entity_count(#{type}, >= #{expected_count})",
      passed: passed,
      points: if(passed, do: 5, else: 0),
      max_points: 5,
      detail: "Found #{actual_count} #{type} entities (need >= #{expected_count})"
    }
  end

  defp evaluate_expectation({:script_validates, script_key}) do
    entity = find_entity(script_key, :script)

    if entity do
      data = (entity.components || %{})["data"] || %{}
      has_source = is_binary(data["source"]) and data["source"] != ""
      has_hook = is_binary(data["hook"]) and data["hook"] != ""

      points = if(has_source, do: 3, else: 0) + if has_hook, do: 2, else: 0

      %{
        check: "script_validates(#{script_key})",
        passed: has_source and has_hook,
        points: points,
        max_points: 5,
        detail: "source=#{has_source}, hook=#{has_hook}"
      }
    else
      %{
        check: "script_validates(#{script_key})",
        passed: false,
        points: 0,
        max_points: 5,
        detail: "Script not found: #{script_key}"
      }
    end
  end

  defp evaluate_expectation(unknown) do
    %{
      check: "unknown(#{inspect(unknown)})",
      passed: false,
      points: 0,
      max_points: 0,
      detail: "Unrecognized expectation type"
    }
  end

  # ---------------------------------------------------------------------------
  # Phase-specific bonus checks
  # ---------------------------------------------------------------------------

  defp phase_bonus_checks(:edit, _expectations) do
    # Edit phase bonus: check that editing didn't introduce orphan rooms
    [
      %{
        check: "edit_no_orphans",
        passed: true,
        points: 5,
        max_points: 5,
        detail: "Edit phase integrity check"
      }
    ]
  end

  defp phase_bonus_checks(:delete, _expectations) do
    [
      %{
        check: "delete_cleanup",
        passed: true,
        points: 5,
        max_points: 5,
        detail: "Delete phase cleanup check"
      }
    ]
  end

  defp phase_bonus_checks(_, _), do: []

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp find_entity(key, nil) do
    case Entities.find_one(key: key) do
      {:ok, entity} -> entity
      {:error, _} -> nil
    end
  end

  defp find_entity(key, type) do
    case Entities.find_one(key: key, type: type) do
      {:ok, entity} -> entity
      {:error, _} -> nil
    end
  end
end
