defmodule Loka.WorldBuilder.LLM.ContextBuilder do
  @moduledoc """
  Builds context-aware system prompts for Claude.

  Includes current zone, nearby rooms, existing keys, and user selection
  to provide Claude with relevant context for world building tasks.

  ## Usage

      opts = [
        current_zone: zone,
        existing_room_keys: ["room_1", "room_2"],
        nearby_rooms: nearby_rooms,
        current_selection: %{type: :room, key: "room_1", name: "Entrance"}
      ]

      prompt = ContextBuilder.build_system_prompt(opts)
  """

  alias Loka.WorldBuilder.RoomManager

  @doc """
  Builds a context-aware system prompt for Claude.

  ## Options

    * `:current_zone` - Map with zone information (:name, :description)
    * `:existing_room_keys` - List of existing room keys to avoid duplicates
    * `:nearby_rooms` - List of nearby room maps for context
    * `:current_selection` - Map with :type, :key, and optional :name

  ## Returns

  A string containing the full system prompt with dynamic context sections.
  """
  @spec build_system_prompt(keyword()) :: String.t()
  def build_system_prompt(opts \\ []) do
    """
    You are an AI assistant embedded in the Loka World Builder, helping game designers create MUD content.

    ## Your Capabilities

    You can manipulate world content using these tools:
    - create_room: Create new rooms with descriptions
    - update_room: Modify existing room properties
    - create_exit: Connect rooms with directional exits
    - create_npc: Add NPCs to rooms

    ## Guidelines

    1. **Naming Conventions**:
       - Room keys: lowercase_with_underscores (e.g., forest_path_1, dark_cave_entrance)
       - Avoid duplicates - check existing keys before creating

    2. **Descriptions**:
       - 2-4 sentences, vivid but concise
       - Include sensory details (sight, sound, smell)
       - Mention notable features and atmosphere

    3. **Room Connections**:
       - Standard directions: north, south, east, west, up, down
       - Two-way connections preferred (create exits both ways)

    4. **Consistency**:
       - Match the tone and style of existing content
       - Respect zone boundaries and themes

    #{build_current_context(opts)}

    ## Response Format

    Use tool calls to make changes. Explain what you're doing before calling tools.
    """
  end

  defp build_current_context(opts) do
    sections = []

    # Current zone context
    sections =
      if zone = opts[:current_zone] do
        [
          """
          ## Current Zone: #{zone.name || zone[:name]}

          #{zone.description || zone[:description] || ""}
          """
          | sections
        ]
      else
        sections
      end

    # Existing room keys (prevent duplicates)
    sections =
      if room_keys = opts[:existing_room_keys] do
        keys_list = Enum.join(room_keys, ", ")

        [
          """
          ## Existing Room Keys

          These keys are already in use: #{keys_list}

          Make sure to use unique keys when creating new rooms.
          """
          | sections
        ]
      else
        sections
      end

    # Nearby rooms (within 2 exits)
    sections =
      if nearby_rooms = opts[:nearby_rooms] do
        room_descriptions =
          nearby_rooms
          |> Enum.take(5)
          |> Enum.map(fn room ->
            key = room.key || room[:key]
            name = room.name || room[:name] || "Unnamed"
            "- #{key}: #{name}"
          end)
          |> Enum.join("\n")

        [
          """
          ## Nearby Rooms

          #{room_descriptions}
          """
          | sections
        ]
      else
        sections
      end

    # Current selection
    sections =
      if selection = opts[:current_selection] do
        type = selection.type || selection[:type]
        key = selection.key || selection[:key]
        name = selection.name || selection[:name]

        [
          """
          ## Current Selection

          Type: #{type}
          Key: #{key}
          #{if name, do: "Name: #{name}", else: ""}
          """
          | sections
        ]
      else
        sections
      end

    Enum.reverse(sections) |> Enum.join("\n")
  end

  @doc """
  Gets rooms within a certain distance (number of exits) from a starting room.

  ## Parameters

    * `room_key` - Starting room key
    * `max_distance` - Maximum number of exits to traverse (default: 2)

  ## Returns

  List of room maps within the specified distance.
  """
  @spec get_nearby_rooms(String.t(), non_neg_integer()) :: [map()]
  def get_nearby_rooms(room_key, max_distance \\ 2) do
    case RoomManager.get_room(room_key) do
      {:ok, _room} ->
        find_nearby_recursive([room_key], MapSet.new([room_key]), max_distance, 0)

      {:error, _} ->
        []
    end
  end

  defp find_nearby_recursive(_, visited, max_distance, current_distance)
       when current_distance >= max_distance do
    visited |> MapSet.to_list() |> fetch_rooms()
  end

  defp find_nearby_recursive(current_keys, visited, max_distance, current_distance) do
    new_neighbors =
      current_keys
      |> Enum.flat_map(fn key ->
        case RoomManager.get_room(key) do
          {:ok, room} ->
            exits = room.exits || room[:exits] || []
            Enum.map(exits, fn exit -> exit.to || exit[:to] end)

          _ ->
            []
        end
      end)
      |> Enum.reject(&is_nil/1)
      |> Enum.reject(&MapSet.member?(visited, &1))
      |> Enum.uniq()

    new_visited = Enum.reduce(new_neighbors, visited, &MapSet.put(&2, &1))

    find_nearby_recursive(new_neighbors, new_visited, max_distance, current_distance + 1)
  end

  defp fetch_rooms(keys) do
    keys
    |> Enum.map(fn key ->
      case RoomManager.get_room(key) do
        {:ok, room} -> room
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  @doc """
  Gets all existing room keys in the world.

  ## Returns

  List of room key strings, or empty list on error.
  """
  @spec get_existing_keys() :: [String.t()]
  def get_existing_keys do
    case RoomManager.list_rooms() do
      {:ok, rooms} ->
        Enum.map(rooms, fn room -> room.key || room[:key] end)

      {:error, reason} ->
        require Logger
        Logger.warning("[ContextBuilder] Failed to list rooms: #{inspect(reason)}")
        []
    end
  end
end
