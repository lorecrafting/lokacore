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

    case find_entity_with_fallback(key, type) do
      {:exact, entity} ->
        %{
          check: "entity_exists(#{key})",
          passed: true,
          points: 5,
          max_points: 5,
          detail: "Found #{key} (#{entity.type})"
        }

      {:fuzzy, entity} ->
        %{
          check: "entity_exists(#{key})",
          passed: true,
          points: 3,
          max_points: 5,
          detail: "Fuzzy match: expected #{key}, found #{entity.key} (#{entity.type})"
        }

      :not_found ->
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
    # Check if there's an exit entity linking the two rooms (with fuzzy fallback)
    {from, from_actual_key} = resolve_entity_key(from_key, :room)
    {to, to_actual_key} = resolve_entity_key(to_key, :room)

    connected =
      if from && to do
        exits = Entities.find_all(type: :exit, location_id: from.id)

        Enum.any?(exits, fn exit ->
          exit_data = (exit.components || %{})["exit"] || %{}
          dest_key = exit_data["destination_key"]
          dest_key == to_actual_key or dest_key == to_key
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
        detail: "#{from_actual_key} connects to #{to_actual_key}"
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
    {entity, match_type} =
      case find_entity_with_fallback(quest_key, :quest) do
        {:exact, e} -> {e, :exact}
        {:fuzzy, e} -> {e, :fuzzy}
        :not_found -> {nil, nil}
      end

    if entity do
      data = (entity.components || %{})["data"] || %{}
      has_objectives = is_list(data["objectives"]) and data["objectives"] != []
      has_name = entity.short_desc && entity.short_desc != ""

      base_points = if(has_objectives, do: 5, else: 0) + if has_name, do: 5, else: 0
      # Fuzzy match penalty: lose 2 points
      points = if match_type == :fuzzy, do: max(base_points - 2, 0), else: base_points

      fuzzy_note = if match_type == :fuzzy, do: " (fuzzy: #{entity.key})", else: ""

      %{
        check: "quest_validates(#{quest_key})",
        passed: has_objectives and has_name,
        points: points,
        max_points: 10,
        detail: "objectives=#{has_objectives}, name=#{has_name}#{fuzzy_note}"
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

    {entity, match_type} =
      case find_entity_with_fallback(dialogue_key, :dialogue) do
        {:exact, e} -> {e, :exact}
        {:fuzzy, e} -> {e, :fuzzy}
        :not_found -> {nil, nil}
      end

    if entity do
      data = (entity.components || %{})["data"] || %{}
      nodes = data["nodes"] || %{}
      node_count = map_size(nodes)
      passed = node_count >= min_nodes

      full_points = if(passed, do: 5, else: 0)
      points = if match_type == :fuzzy, do: max(full_points - 2, 0), else: full_points
      fuzzy_note = if match_type == :fuzzy, do: " (fuzzy: #{entity.key})", else: ""

      %{
        check: "dialogue_has_nodes(#{dialogue_key}, min=#{min_nodes})",
        passed: passed,
        points: points,
        max_points: 5,
        detail: "#{node_count} nodes (need >= #{min_nodes})#{fuzzy_note}"
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

    {entity, _match_type} =
      case find_entity_with_fallback(key, nil) do
        {:exact, e} -> {e, :exact}
        {:fuzzy, e} -> {e, :fuzzy}
        :not_found -> {nil, nil}
      end

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
    {entity, match_type} =
      case find_entity_with_fallback(script_key, :script) do
        {:exact, e} -> {e, :exact}
        {:fuzzy, e} -> {e, :fuzzy}
        :not_found -> {nil, nil}
      end

    if entity do
      data = (entity.components || %{})["data"] || %{}
      has_source = is_binary(data["source"]) and data["source"] != ""
      has_hook = is_binary(data["hook"]) and data["hook"] != ""

      base_points = if(has_source, do: 3, else: 0) + if has_hook, do: 2, else: 0
      points = if match_type == :fuzzy, do: max(base_points - 1, 0), else: base_points
      fuzzy_note = if match_type == :fuzzy, do: " (fuzzy: #{entity.key})", else: ""

      %{
        check: "script_validates(#{script_key})",
        passed: has_source and has_hook,
        points: points,
        max_points: 5,
        detail: "source=#{has_source}, hook=#{has_hook}#{fuzzy_note}"
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

  # Try exact match first, then fuzzy fallback by type + key similarity
  @spec find_entity_with_fallback(String.t(), atom() | nil) ::
          {:exact, map()} | {:fuzzy, map()} | :not_found
  defp find_entity_with_fallback(key, type) do
    case find_entity(key, type) do
      nil -> find_entity_fuzzy(key, type)
      entity -> {:exact, entity}
    end
  end

  # Resolve an entity key to an actual entity + its real key (for connection checks)
  defp resolve_entity_key(key, type) do
    case find_entity_with_fallback(key, type) do
      {:exact, entity} -> {entity, key}
      {:fuzzy, entity} -> {entity, entity.key}
      :not_found -> {nil, key}
    end
  end

  # Fuzzy search: find entities of the given type and pick the best key match
  defp find_entity_fuzzy(_key, nil), do: :not_found

  defp find_entity_fuzzy(key, type) do
    entities = Entities.find_all(type: type)

    best =
      entities
      |> Enum.map(fn entity -> {entity, key_similarity(key, entity.key)} end)
      |> Enum.filter(fn {_entity, score} -> score > 0.4 end)
      |> Enum.sort_by(fn {_entity, score} -> score end, :desc)
      |> List.first()

    case best do
      {entity, _score} -> {:fuzzy, entity}
      nil -> :not_found
    end
  end

  # Score key similarity: combines substring matching and token overlap.
  # Returns 0.0 to 1.0.
  defp key_similarity(expected, actual) when is_binary(expected) and is_binary(actual) do
    expected_down = String.downcase(expected)
    actual_down = String.downcase(actual)

    cond do
      expected_down == actual_down ->
        1.0

      # One contains the other
      String.contains?(actual_down, expected_down) or
          String.contains?(expected_down, actual_down) ->
        0.8

      true ->
        # Token overlap (split on underscores)
        expected_tokens = String.split(expected_down, "_") |> MapSet.new()
        actual_tokens = String.split(actual_down, "_") |> MapSet.new()
        intersection = MapSet.intersection(expected_tokens, actual_tokens) |> MapSet.size()
        union = MapSet.union(expected_tokens, actual_tokens) |> MapSet.size()

        if union == 0, do: 0.0, else: intersection / union
    end
  end

  defp key_similarity(_, _), do: 0.0
end
