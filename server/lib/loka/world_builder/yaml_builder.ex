defmodule Loka.WorldBuilder.YamlBuilder do
  @moduledoc """
  Shared YAML generation functions for world builder content types.

  Used by both `ToolExecutor` (AI tool calls) and `BuilderCommands.*` (terminal commands)
  to produce consistent, valid YAML files.
  """

  alias Loka.Engine.Entities

  @doc """
  Escape a string for safe inclusion in double-quoted YAML values.
  """
  def escape_yaml(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  def escape_yaml(_), do: ""

  @doc """
  Build YAML content for a zone definition.

  ## Options
    - `:rooms` - list of room keys (default `[]`)
    - `:reset_mode` - zone reset mode (default `"empty"`)
    - `:lifespan_minutes` - lifespan in minutes (default `0`)
    - `:resets` - list of reset entries (default `nil`, omitted)
  """
  def build_zone_yaml(key, name, opts \\ []) do
    rooms = Keyword.get(opts, :rooms, [])
    reset_mode = Keyword.get(opts, :reset_mode, "empty")
    lifespan = Keyword.get(opts, :lifespan_minutes, 0)
    resets = Keyword.get(opts, :resets, nil)

    rooms_yaml = format_yaml_string_list(rooms)

    resets_line =
      if resets do
        "\n  resets: #{format_yaml_string_list(resets)}"
      else
        ""
      end

    """
    key: #{key}
    type: zone
    name: "#{escape_yaml(to_string(name))}"
    data:
      lifespan_minutes: #{lifespan}
      reset_mode: #{reset_mode}
      rooms: #{rooms_yaml}#{resets_line}
    """
  end

  @doc """
  Build YAML content for a cutscene definition.
  """
  def build_cutscene_yaml(key, name, _trigger, scenes) do
    sequence_yaml =
      scenes
      |> Enum.map(fn scene ->
        text = scene["text"] || ""
        delay = scene["delay"] || 2000
        class = scene["class"] || "cutscene"
        "    - text: \"#{escape_yaml(text)}\"\n      delay: #{delay}\n      class: #{class}"
      end)
      |> Enum.join("\n")

    """
    key: #{key}
    type: cutscene
    name: "#{escape_yaml(name)}"
    description: "#{escape_yaml(name)}"

    sequence:
    #{sequence_yaml}
    """
  end

  @doc """
  Build YAML content for a storyline definition.
  """
  def build_storyline_yaml(key, name, main_quests, side_quests) do
    main_yaml = format_yaml_string_list(main_quests)
    side_yaml = format_yaml_string_list(side_quests)

    """
    key: #{key}
    type: storyline
    name: "#{escape_yaml(name)}"
    data:
      main_quests: #{main_yaml}
      side_quests: #{side_yaml}
    """
  end

  @doc """
  Build YAML content for a script definition.
  """
  def build_script_yaml(key, name, hook, source, opts \\ []) do
    timeout_ms = Keyword.get(opts, :timeout_ms, 5000)

    """
    key: #{key}
    type: script
    name: "#{escape_yaml(name)}"
    data:
      hook: #{hook}
      source: |
    #{indent_source(source)}
      timeout_ms: #{timeout_ms}
    """
  end

  @doc """
  Format a list of strings as a YAML list. Returns `"[]"` for empty lists.
  """
  def format_yaml_string_list([]), do: "[]"

  def format_yaml_string_list(items) do
    "\n" <> Enum.map_join(items, "\n", fn i -> "      - #{i}" end)
  end

  @doc """
  Indent source code for inclusion in a YAML `source: |` block.
  Each line gets 4 spaces of indentation.
  """
  def indent_source(source) when is_binary(source) do
    source
    |> String.split("\n")
    |> Enum.map(fn line -> "    #{line}" end)
    |> Enum.join("\n")
  end

  def indent_source(_), do: "    continue.()"

  @doc """
  Validate that referenced content exists. Returns `{:ok, warnings}` where
  warnings is a list of strings describing missing references.

  Content may be created in any order, so missing references are warnings,
  not errors.

  ## Types
    - `:storyline` — checks main_quests/side_quests exist as quest keys
    - `:zone` — checks room keys exist
    - `:cutscene` — checks dialogue scene speakers exist as prototypes
  """
  def validate_references(:storyline, %{main_quests: main, side_quests: side}) do
    quest_warnings =
      (main ++ side)
      |> Enum.filter(fn key ->
        match?({:error, :not_found}, Loka.Content.Quest.get(key))
      end)
      |> Enum.map(fn key -> "Quest '#{key}' not found (may not be created yet)" end)

    {:ok, quest_warnings}
  end

  def validate_references(:zone, %{rooms: rooms}) do
    room_warnings =
      rooms
      |> Enum.filter(fn key ->
        match?({:error, _}, Entities.find_one(key: key))
      end)
      |> Enum.map(fn key -> "Room '#{key}' not found (may not be created yet)" end)

    {:ok, room_warnings}
  end

  def validate_references(:cutscene, %{sequence: sequence}) do
    speaker_warnings =
      sequence
      |> Enum.filter(fn line -> (line["class"] || "") |> String.contains?("dialogue") end)
      |> Enum.flat_map(fn line ->
        text = line["text"] || ""

        case String.split(text, ":", parts: 2) do
          [speaker, _] ->
            speaker = String.trim(speaker)

            if match?({:error, _}, Entities.find_one(key: String.downcase(speaker))) do
              ["Speaker '#{speaker}' not found (may not be created yet)"]
            else
              []
            end

          _ ->
            []
        end
      end)

    {:ok, speaker_warnings}
  end

  def validate_references(:cutscene, _params), do: {:ok, []}

  def validate_references(_type, _params), do: {:ok, []}
end
