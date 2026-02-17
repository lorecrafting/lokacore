defmodule Loka.Testing.AIEval.Rubrics.Narrative do
  @moduledoc """
  LLM-judged narrative quality rubric.

  Uses a separate Claude API call to evaluate the narrative quality
  of AI-generated content. This is optional and requires ANTHROPIC_API_KEY.

  ## Scoring (out of 25)

  | Check                        | Points |
  |------------------------------|--------|
  | Sensory detail in descriptions | 0-10   |
  | Dialogue subtext               | 0-5    |
  | NPC personality                | 0-5    |
  | Consistent tone                | 0-5    |
  """

  alias Loka.Engine.Entities

  @type score :: %{
          total: non_neg_integer(),
          max: non_neg_integer(),
          checks: [map()]
        }

  @doc """
  Score narrative quality using LLM judgment.
  Returns a placeholder score if no API key is available.
  """
  @spec score([Loka.Testing.AIEval.Scenario.expectation()]) :: score()
  def score(expectations) do
    entity_keys = extract_entity_keys(expectations)
    content = gather_content(entity_keys)

    if content == "" do
      %{
        total: 0,
        max: 25,
        checks: [
          %{
            check: "no_content",
            passed: false,
            points: 0,
            max_points: 25,
            detail: "No content to evaluate"
          }
        ]
      }
    else
      case get_api_key() do
        nil ->
          %{
            total: 0,
            max: 25,
            checks: [
              %{
                check: "no_api_key",
                passed: false,
                points: 0,
                max_points: 25,
                detail: "ANTHROPIC_API_KEY not set, skipping narrative scoring"
              }
            ]
          }

        _key ->
          evaluate_with_llm(content)
      end
    end
  end

  # ---------------------------------------------------------------------------
  # LLM Evaluation
  # ---------------------------------------------------------------------------

  defp evaluate_with_llm(content) do
    prompt = """
    Rate this MUD game content on narrative quality. Score each category 0-10 or 0-5 as indicated.
    Respond ONLY with a JSON object, no other text.

    Categories:
    - sensory_detail (0-10): Does the writing use specific textures, sounds, smells, sights?
    - dialogue_subtext (0-5): Do characters say things that hint at deeper meaning?
    - npc_personality (0-5): Do NPCs have distinct voices and mannerisms?
    - consistent_tone (0-5): Is the overall tone cohesive across all content?

    Content to evaluate:
    #{String.slice(content, 0..3000)}

    Response format: {"sensory_detail": N, "dialogue_subtext": N, "npc_personality": N, "consistent_tone": N}
    """

    case Loka.WorldBuilder.AnthropicClient.chat(
           [%{role: "user", content: prompt}],
           [],
           model: "claude-haiku-4-5-20251001",
           max_tokens: 200
         ) do
      {:ok, response} ->
        parse_narrative_scores(response.text)

      {:error, _reason} ->
        %{
          total: 0,
          max: 25,
          checks: [
            %{
              check: "llm_eval_failed",
              passed: false,
              points: 0,
              max_points: 25,
              detail: "LLM evaluation failed"
            }
          ]
        }
    end
  end

  defp parse_narrative_scores(text) do
    case Jason.decode(text) do
      {:ok, scores} ->
        sensory = Map.get(scores, "sensory_detail", 0) || 0
        dialogue = Map.get(scores, "dialogue_subtext", 0) || 0
        personality = Map.get(scores, "npc_personality", 0) || 0
        tone = Map.get(scores, "consistent_tone", 0) || 0

        checks = [
          %{
            check: "sensory_detail",
            passed: sensory >= 5,
            points: min(sensory, 10),
            max_points: 10,
            detail: "Score: #{sensory}/10"
          },
          %{
            check: "dialogue_subtext",
            passed: dialogue >= 3,
            points: min(dialogue, 5),
            max_points: 5,
            detail: "Score: #{dialogue}/5"
          },
          %{
            check: "npc_personality",
            passed: personality >= 3,
            points: min(personality, 5),
            max_points: 5,
            detail: "Score: #{personality}/5"
          },
          %{
            check: "consistent_tone",
            passed: tone >= 3,
            points: min(tone, 5),
            max_points: 5,
            detail: "Score: #{tone}/5"
          }
        ]

        total = Enum.sum(Enum.map(checks, & &1.points))
        %{total: total, max: 25, checks: checks}

      {:error, _} ->
        %{
          total: 0,
          max: 25,
          checks: [
            %{
              check: "parse_failed",
              passed: false,
              points: 0,
              max_points: 25,
              detail: "Failed to parse LLM response: #{String.slice(text, 0..100)}"
            }
          ]
        }
    end
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp extract_entity_keys(expectations) do
    Enum.flat_map(expectations, fn
      {:entity_exists, opts} -> [Keyword.fetch!(opts, :key)]
      {:quest_validates, key} -> [key]
      {:dialogue_has_nodes, key, _} -> [key]
      _ -> []
    end)
  end

  defp gather_content(keys) do
    keys
    |> Enum.flat_map(fn key ->
      case Entities.find_one(key: key) do
        {:error, _} ->
          []

        {:ok, entity} ->
          desc = entity.extra_desc || entity.short_desc || ""
          data = (entity.components || %{})["data"] || %{}

          parts = ["[#{entity.type}] #{entity.key}: #{desc}"]

          parts =
            if data["nodes"] do
              nodes_text =
                data["nodes"]
                |> Enum.map(fn {id, node} ->
                  text = if is_map(node), do: node["text"] || "", else: ""
                  "  Node #{id}: #{text}"
                end)
                |> Enum.join("\n")

              parts ++ ["Dialogue nodes:\n#{nodes_text}"]
            else
              parts
            end

          parts
      end
    end)
    |> Enum.join("\n\n")
  end

  defp get_api_key do
    System.get_env("ANTHROPIC_API_KEY")
  end
end
