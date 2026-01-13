defmodule Loka.WorldBuilder.LLM.ConsistencyChecker do
  @moduledoc """
  Content consistency validation and template learning.

  Checks new content against existing patterns and learns from user examples.

  ## Consistency Checks

  For rooms:
  - Naming pattern matching
  - Description length comparison
  - Duplicate key detection

  For NPCs:
  - (Not yet implemented)

  ## Template Learning

  Use `learn_from_examples/1` to extract patterns from existing content
  that can guide bulk generation.
  """

  alias Loka.WorldBuilder.RoomManager

  # Type for content data - can be a map or struct with these keys
  @type content_data :: %{
          optional(:key) => String.t(),
          optional(:description) => String.t(),
          optional(:name) => String.t(),
          optional(atom()) => any()
        }

  @doc """
  Analyzes new content for consistency with existing content.

  ## Parameters

    * `content_type` - Type of content (:room, :npc, etc.)
    * `content_data` - Map with content fields
    * `opts` - Options including `:zone_key` for zone-specific checks

  ## Returns

    * `{:ok, []}` - No warnings
    * `{:warning, [String.t()]}` - List of warning messages
  """
  @spec check_consistency(atom(), content_data(), keyword()) ::
          {:ok, []} | {:warning, [String.t()]}
  def check_consistency(content_type, content_data, opts \\ []) do
    warnings =
      case content_type do
        :room -> check_room_consistency(content_data, [], opts)
        :npc -> check_npc_consistency(content_data, [], opts)
        _ -> []
      end

    if length(warnings) > 0,
      do: {:warning, warnings},
      else: {:ok, []}
  end

  defp check_room_consistency(room_data, warnings, opts) do
    zone_key = opts[:zone_key]

    warnings =
      if zone_key do
        case get_zone_rooms(zone_key) do
          {:ok, [_ | _] = existing_rooms} ->
            check_naming_pattern(room_data, existing_rooms, warnings) ++
              check_description_style(room_data, existing_rooms, warnings)

          _ ->
            warnings
        end
      else
        warnings
      end

    # Check for duplicate keys
    room_key = get_field(room_data, :key)

    case RoomManager.get_room(room_key) do
      {:ok, _} ->
        ["Room key '#{room_key}' already exists. Consider using a unique key." | warnings]

      _ ->
        warnings
    end
  end

  defp check_npc_consistency(npc_data, warnings, _opts) do
    # NOT YET IMPLEMENTED: NPC consistency checks need:
    # - Naming pattern analysis for NPCs
    # - Dialogue tree validation
    # - Level/stats range checking
    # - Zone-appropriate NPC type validation

    npc_key = get_field(npc_data, :key) || "unnamed NPC"
    warning_msg = "NPC consistency checks not yet implemented for #{npc_key}"

    [warning_msg | warnings]
  end

  defp check_naming_pattern(new_room, existing_rooms, warnings) do
    # Extract naming patterns from existing rooms
    patterns = extract_naming_patterns(existing_rooms)

    if length(patterns) > 0 do
      new_key = get_field(new_room, :key) || ""

      matches_pattern? =
        Enum.any?(patterns, fn pattern ->
          Regex.match?(pattern, new_key)
        end)

      if matches_pattern? do
        warnings
      else
        pattern_examples =
          existing_rooms
          |> Enum.take(3)
          |> Enum.map(&get_field(&1, :key))
          |> Enum.join(", ")

        [
          "Naming pattern mismatch. Existing rooms use pattern like: #{pattern_examples}"
          | warnings
        ]
      end
    else
      warnings
    end
  end

  defp check_description_style(new_room, existing_rooms, warnings) do
    # Analyze description length and complexity
    avg_length = calculate_avg_description_length(existing_rooms)
    new_description = get_field(new_room, :description) || ""
    new_length = String.length(new_description)

    if avg_length > 0 && (new_length < avg_length * 0.5 || new_length > avg_length * 2.0) do
      [
        "Description length differs significantly from zone average (#{round(avg_length)} chars)"
        | warnings
      ]
    else
      warnings
    end
  end

  @doc """
  Learns patterns from example rooms selected by user.

  ## Parameters

    * `room_keys` - List of room keys to learn from

  ## Returns

    * `{:ok, template}` - Template map with extracted patterns
    * `{:error, :no_valid_rooms}` - No valid rooms found
  """
  @spec learn_from_examples([String.t()]) :: {:ok, map()} | {:error, :no_valid_rooms}
  def learn_from_examples(room_keys) do
    rooms =
      room_keys
      |> Enum.map(fn key ->
        case RoomManager.get_room(key) do
          {:ok, room} -> room
          _ -> nil
        end
      end)
      |> Enum.reject(&is_nil/1)

    if length(rooms) == 0 do
      {:error, :no_valid_rooms}
    else
      template = %{
        naming_pattern: extract_naming_pattern_template(rooms),
        avg_description_length: calculate_avg_description_length(rooms),
        description_style: analyze_description_style(rooms),
        common_attributes: extract_common_attributes(rooms),
        examples: Enum.take(rooms, 3)
      }

      {:ok, template}
    end
  end

  # Private Helpers

  # Unified field access that works with both maps and structs
  defp get_field(data, key) when is_map(data) do
    Map.get(data, key) || Map.get(data, to_string(key))
  end

  defp get_zone_rooms(zone_key) do
    case RoomManager.list_rooms() do
      {:ok, rooms} ->
        zone_rooms =
          Enum.filter(rooms, fn room ->
            get_field(room, :zone) == zone_key
          end)

        {:ok, zone_rooms}

      error ->
        error
    end
  end

  defp extract_naming_patterns(rooms) do
    # Simple pattern: extract prefix before underscore and number
    rooms
    |> Enum.map(fn room ->
      key = get_field(room, :key) || ""

      case Regex.run(~r/^([a-z_]+)_?\d*$/, key) do
        [_, prefix] ->
          # SECURITY: Escape the prefix to prevent regex injection
          escaped_prefix = Regex.escape(prefix)
          Regex.compile!("^#{escaped_prefix}_?\\d*$")

        _ ->
          nil
      end
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq_by(&Regex.source/1)
  end

  defp extract_naming_pattern_template(rooms) do
    keys = Enum.map(rooms, &get_field(&1, :key))
    # Find common prefix
    if length(keys) > 0 do
      common_prefix = find_common_prefix(keys)
      "#{common_prefix}_N"
    else
      "room_N"
    end
  end

  defp find_common_prefix(strings) do
    valid_strings = Enum.reject(strings, &is_nil/1)
    if length(valid_strings) == 0, do: "", else: find_common_prefix_recursive(valid_strings)
  end

  defp find_common_prefix_recursive([first | rest]) when is_binary(first) do
    first_chars = String.graphemes(first)

    prefix =
      Enum.reduce_while(first_chars, [], fn char, acc ->
        candidate = Enum.join(acc ++ [char], "")

        if Enum.all?(rest, fn s -> is_binary(s) && String.starts_with?(s, candidate) end) do
          {:cont, acc ++ [char]}
        else
          {:halt, acc}
        end
      end)

    Enum.join(prefix, "")
  end

  defp find_common_prefix_recursive(_), do: ""

  defp calculate_avg_description_length(rooms) do
    if length(rooms) == 0 do
      0
    else
      total =
        rooms
        |> Enum.map(fn room ->
          desc = get_field(room, :description) || ""
          String.length(desc)
        end)
        |> Enum.sum()

      div(total, length(rooms))
    end
  end

  defp analyze_description_style(rooms) do
    # Simple analysis: count sentences, detect common patterns
    sample_descriptions =
      rooms
      |> Enum.take(5)
      |> Enum.map(&get_field(&1, :description))
      |> Enum.reject(&is_nil/1)

    avg_sentences =
      sample_descriptions
      |> Enum.map(&count_sentences/1)
      |> Enum.sum()
      |> then(&div(&1, max(length(sample_descriptions), 1)))

    %{
      avg_sentences: avg_sentences,
      tone: detect_tone(sample_descriptions)
    }
  end

  defp count_sentences(text) when is_binary(text) do
    text
    |> String.split(~r/[.!?]+/)
    |> Enum.reject(&(&1 == ""))
    |> length()
  end

  defp count_sentences(_), do: 0

  defp detect_tone(descriptions) do
    # Very simple tone detection based on word choice
    all_text =
      descriptions
      |> Enum.filter(&is_binary/1)
      |> Enum.join(" ")
      |> String.downcase()

    cond do
      String.contains?(all_text, ["dark", "shadowy", "ominous", "forbidding"]) -> "dark"
      String.contains?(all_text, ["bright", "cheerful", "sunny", "pleasant"]) -> "light"
      String.contains?(all_text, ["ancient", "stone", "castle", "knight"]) -> "medieval"
      true -> "neutral"
    end
  end

  defp extract_common_attributes(rooms) do
    # Find attributes that appear in most rooms
    all_attrs =
      rooms
      |> Enum.flat_map(fn room ->
        room
        |> Map.keys()
        |> Enum.reject(&(&1 in [:id, :key, :name, :description, :x, :y, :zone, :__struct__]))
      end)
      |> Enum.frequencies()

    all_attrs
    |> Enum.filter(fn {_attr, count} -> count >= length(rooms) / 2 end)
    |> Enum.map(fn {attr, _} -> attr end)
  end
end
