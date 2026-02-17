defmodule Loka.Testing.AIEval.Rubrics.ContentQuality do
  @moduledoc """
  Automated content quality scoring rubric for AI eval scenarios.

  Uses heuristics to evaluate the quality of AI-generated content
  without requiring another LLM call.

  ## Scoring (out of 25 per phase)

  | Check                              | Points |
  |------------------------------------|--------|
  | Descriptions > 20 words            | 0-5    |
  | Descriptions have sensory detail   | 0-5    |
  | NPC short_desc is specific         | 0-5    |
  | Dialogue has 3+ player choices     | 0-5    |
  | Quest journal entries > 10 words   | 0-5    |
  """

  alias Loka.Engine.Entities

  @sensory_keywords ~w(smell scent aroma sound hear echo light shadow glow
    rough smooth cold warm breeze wind dust damp wet dry creak groan
    whisper murmur clatter taste bitter sweet sour rustle hum flicker
    gleam shimmer musty stale)

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
  Score content quality for entities created during a phase.
  Examines all entities that were likely created by the AI.
  """
  @spec score([Loka.Testing.AIEval.Scenario.expectation()]) :: score()
  def score(expectations) do
    # Extract entity keys from expectations
    entity_keys = extract_entity_keys(expectations)

    checks =
      Enum.flat_map(entity_keys, fn {key, type} ->
        case Entities.find_one(key: key) do
          {:error, _} -> []
          {:ok, entity} -> quality_checks(entity, type)
        end
      end)

    # If no checks produced, add a baseline
    checks = if checks == [], do: [empty_check()], else: checks

    total = Enum.sum(Enum.map(checks, & &1.points))
    max = Enum.sum(Enum.map(checks, & &1.max_points))

    %{total: total, max: max, checks: checks}
  end

  # ---------------------------------------------------------------------------
  # Quality Checks per Entity Type
  # ---------------------------------------------------------------------------

  defp quality_checks(entity, :room) do
    desc = entity.extra_desc || entity.short_desc || ""
    word_count = desc |> String.split() |> length()

    [
      description_length_check(entity.key, desc, word_count, 20),
      sensory_detail_check(entity.key, desc)
    ]
  end

  defp quality_checks(entity, :npc) do
    short_desc = entity.short_desc || ""

    [
      npc_desc_specificity_check(entity.key, short_desc)
    ]
  end

  defp quality_checks(entity, :quest) do
    data = (entity.components || %{})["data"] || %{}
    description = data["description"] || entity.extra_desc || ""

    [
      description_length_check(entity.key, description, String.split(description) |> length(), 10)
    ]
  end

  defp quality_checks(entity, :dialogue) do
    data = (entity.components || %{})["data"] || %{}
    nodes = data["nodes"] || %{}

    total_choices =
      nodes
      |> Map.values()
      |> Enum.flat_map(fn node ->
        cond do
          is_map(node) -> Map.get(node, "choices", [])
          true -> []
        end
      end)
      |> length()

    [dialogue_choices_check(entity.key, total_choices)]
  end

  defp quality_checks(entity, _type) do
    desc = entity.extra_desc || entity.short_desc || ""
    word_count = desc |> String.split() |> length()

    [description_length_check(entity.key, desc, word_count, 10)]
  end

  # ---------------------------------------------------------------------------
  # Individual Checks
  # ---------------------------------------------------------------------------

  defp description_length_check(key, _desc, word_count, min_words) do
    passed = word_count >= min_words

    %{
      check: "desc_length(#{key})",
      passed: passed,
      points: if(passed, do: 5, else: min(word_count, 4)),
      max_points: 5,
      detail: "#{word_count} words (need >= #{min_words})"
    }
  end

  defp sensory_detail_check(key, desc) do
    lower_desc = String.downcase(desc)

    sensory_matches =
      Enum.count(@sensory_keywords, fn word ->
        String.contains?(lower_desc, word)
      end)

    passed = sensory_matches >= 2

    %{
      check: "sensory_detail(#{key})",
      passed: passed,
      points: min(sensory_matches * 2, 5),
      max_points: 5,
      detail: "#{sensory_matches} sensory keywords found"
    }
  end

  defp npc_desc_specificity_check(key, short_desc) do
    # Generic descriptions are bad: "An NPC", "A person", etc.
    generic_patterns = ~w(an npc a person someone a character a figure)

    is_generic =
      Enum.any?(generic_patterns, fn pattern ->
        String.downcase(short_desc) == pattern
      end)

    word_count = short_desc |> String.split() |> length()
    passed = not is_generic and word_count >= 3

    %{
      check: "npc_specificity(#{key})",
      passed: passed,
      points: if(passed, do: 5, else: if(word_count >= 2, do: 2, else: 0)),
      max_points: 5,
      detail:
        if(passed,
          do: "Specific: #{String.slice(short_desc, 0..40)}",
          else: "Too generic: #{short_desc}"
        )
    }
  end

  defp dialogue_choices_check(key, total_choices) do
    passed = total_choices >= 3

    %{
      check: "dialogue_choices(#{key})",
      passed: passed,
      points: min(total_choices * 2, 5),
      max_points: 5,
      detail: "#{total_choices} total player choices (need >= 3)"
    }
  end

  defp empty_check do
    %{
      check: "no_content_to_evaluate",
      passed: true,
      points: 0,
      max_points: 0,
      detail: "No entities to evaluate"
    }
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp extract_entity_keys(expectations) do
    Enum.flat_map(expectations, fn
      {:entity_exists, opts} ->
        [{Keyword.fetch!(opts, :key), Keyword.get(opts, :type)}]

      {:quest_validates, key} ->
        [{key, :quest}]

      {:dialogue_has_nodes, key, _opts} ->
        [{key, :dialogue}]

      {:script_validates, key} ->
        [{key, :script}]

      _ ->
        []
    end)
    |> Enum.uniq_by(fn {key, _} -> key end)
  end
end
