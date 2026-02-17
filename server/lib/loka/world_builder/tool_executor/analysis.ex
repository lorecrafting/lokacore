defmodule Loka.WorldBuilder.ToolExecutor.Analysis do
  @moduledoc false

  alias Loka.WorldBuilder.ValidationManager
  alias Loka.Engine.Entities

  @guide_topics %{
    "world_design_process" => "world_design_process.md",
    "narrative_style" => "narrative_style.md",
    "story_structure" => "story_structure.md",
    "weaving_patterns" => "weaving_patterns.md",
    "entity_patterns" => "entity_patterns.md",
    "dialogue_patterns" => "dialogue_patterns.md",
    "quest_patterns" => "quest_patterns.md",
    "npc_behaviors" => "npc_behaviors.md"
  }

  def execute_read_guide(input) do
    topic = input["topic"]

    case Map.get(@guide_topics, topic) do
      nil ->
        available = Map.keys(@guide_topics) |> Enum.join(", ")
        {:error, "Unknown topic '#{topic}'. Available: #{available}"}

      filename ->
        guide_path =
          Path.join([:code.priv_dir(:loka), "world_builder", "guides", filename])

        case File.read(guide_path) do
          {:ok, content} ->
            {:ok,
             %{
               success: true,
               topic: topic,
               content: content
             }}

          {:error, reason} ->
            {:error, "Failed to read guide: #{inspect(reason)}"}
        end
    end
  end

  def execute_validate_world(_input) do
    results = ValidationManager.validate_all()

    summary = %{
      total_errors: results.total_errors,
      total_warnings: results.total_warnings,
      rooms: %{
        errors: length(results.rooms.errors),
        warnings: length(results.rooms.warnings),
        valid: results.rooms.valid
      }
    }

    details = %{
      room_errors:
        results.rooms.errors
        |> Enum.flat_map(fn r -> Enum.map(r.errors, &"#{r.room_key}: #{&1}") end)
        |> Enum.take(20),
      room_warnings:
        results.rooms.warnings
        |> Enum.flat_map(fn r -> Enum.map(r.warnings, &"#{r.room_key}: #{&1}") end)
        |> Enum.take(20),
      quest_errors: Map.get(results.quests, :errors, []) |> Enum.map(&inspect/1) |> Enum.take(10),
      quest_warnings:
        Map.get(results.quests, :warnings, []) |> Enum.map(&inspect/1) |> Enum.take(10),
      cutscene_errors:
        Map.get(results.cutscenes, :errors, []) |> Enum.map(&inspect/1) |> Enum.take(10),
      cutscene_warnings:
        Map.get(results.cutscenes, :warnings, []) |> Enum.map(&inspect/1) |> Enum.take(10)
    }

    if results.total_errors == 0 and results.total_warnings == 0 do
      {:ok, %{success: true, message: "All content validates successfully!", summary: summary}}
    else
      {:ok,
       %{
         success: true,
         message: "Found #{results.total_errors} errors and #{results.total_warnings} warnings",
         summary: summary,
         details: details
       }}
    end
  end

  def execute_search_content(input) do
    query = input["query"] || ""
    type_filter = input["type"]

    if String.trim(query) == "" do
      {:error, "Search query cannot be empty"}
    else
      query_lower = String.downcase(query)

      all_objects = Entities.find_all(is_prototype: true)

      matches =
        all_objects
        |> maybe_filter_by_type(type_filter)
        |> Enum.filter(fn obj ->
          searchable = build_searchable_text(obj)
          String.contains?(String.downcase(searchable), query_lower)
        end)
        |> Enum.take(20)
        |> Enum.map(fn obj ->
          %{
            key: obj.key,
            type: obj.type,
            subtype: obj.type,
            name: obj.short_desc || obj.key,
            snippet: build_snippet(obj, query_lower)
          }
        end)

      {:ok,
       %{
         success: true,
         message: "Found #{length(matches)} results for \"#{query}\"",
         results: matches
       }}
    end
  end

  defp maybe_filter_by_type(objects, nil), do: objects

  defp maybe_filter_by_type(objects, type_string) do
    type_atom = String.to_atom(type_string)
    Enum.filter(objects, fn obj -> obj.type == type_atom end)
  end

  defp build_searchable_text(obj) do
    data = (obj.components || %{})["data"] || %{}

    parts = [
      obj.key,
      obj.short_desc || "",
      obj.extra_desc || "",
      data["zone"] || ""
    ]

    Enum.join(parts, " ")
  end

  defp build_snippet(obj, query_lower) do
    text = build_searchable_text(obj)
    text_lower = String.downcase(text)

    # Find match position using grapheme-safe string operations
    case string_find_index(text_lower, query_lower) do
      nil ->
        String.slice(text, 0, 100)

      pos ->
        start = max(0, pos - 40)
        String.slice(text, start, 100)
    end
  end

  defp string_find_index(haystack, needle) do
    case String.split(haystack, needle, parts: 2) do
      [before, _] -> String.length(before)
      _ -> nil
    end
  end
end
