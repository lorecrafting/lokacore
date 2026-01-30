defmodule Loka.WorldBuilder.LLM.ContextBuilder do
  @moduledoc """
  Builds context-aware system prompts for Claude.

  Includes current zone, nearby rooms, existing keys, NPCs, quests, and user selection
  to provide Claude with relevant context for world building tasks.

  ## Usage

      opts = [
        current_zone: zone,
        existing_room_keys: ["room_1", "room_2"],
        nearby_rooms: nearby_rooms,
        npcs: npcs_list,
        quests: quests_list,
        current_selection: %{type: :room, key: "room_1", name: "Entrance"}
      ]

      prompt = ContextBuilder.build_system_prompt(opts)
  """

  alias Loka.WorldBuilder.{RoomManager, EntityManager, QuestManager}
  alias Loka.Content.Zone

  @doc """
  Builds a context-aware system prompt for Claude.

  ## Options

    * `:current_zone` - Map with zone information (:name, :description)
    * `:existing_room_keys` - List of existing room keys to avoid duplicates
    * `:nearby_rooms` - List of nearby room maps for context
    * `:npcs` - List of NPC maps in the current area
    * `:quests` - List of quest maps relevant to current context
    * `:items` - List of item maps in the current area
    * `:current_selection` - Map with :type, :key, and optional :name

  ## Returns

  A string containing the full system prompt with dynamic context sections.
  """
  @spec build_system_prompt(keyword()) :: String.t()
  def build_system_prompt(opts \\ []) do
    """
    You are an AI assistant embedded in the Loka World Builder, helping game designers create MUD content.

    ## Your Capabilities

    ### Room Tools
    - create_room: Create new rooms with descriptions, coordinates, and zone assignment
    - update_room: Modify existing room properties
    - delete_room: Remove a room from the world
    - create_exit: Connect rooms with directional exits
    - remove_exit: Remove an exit from a room
    - get_room_info: Get detailed information about a room
    - list_rooms: List all rooms, optionally filtered by tag

    ### Entity Tools
    - create_npc: Add NPCs to rooms with level, attributes, and behaviors
    - create_item: Add items to rooms with type and properties
    - list_npcs: List all NPCs, optionally filtered by room or tag
    - list_items: List all items, optionally filtered by room or tag

    ### Quest Tools
    - create_quest: Create quest definitions with objectives, rewards, and prerequisites
    - update_quest: Modify existing quest properties
    - list_quests: List all quests, optionally filtered by type or tag

    ### Dialogue Tools
    - create_dialogue: Create dialogue trees for NPCs
    - get_dialogue: Get a dialogue definition

    ### Zone Tools
    - get_zone_info: Get detailed information about a zone
    - list_zones: List all zones

    ## Loka Content Guidelines

    ### Naming Conventions
    - Keys: lowercase_with_underscores (e.g., forest_path_1, village_elder, dragon_hunt)
    - Avoid duplicates - check existing keys before creating
    - Use descriptive prefixes: npc_, item_, quest_ if clarity needed

    ### Room Descriptions
    - 2-4 sentences, vivid but concise
    - Include sensory details (sight, sound, smell)
    - Mention notable features, exits, and atmosphere
    - Use second person ("You see...") for immersion

    ### NPC Design
    - Give NPCs personality through description and dialogue
    - Set appropriate level for the zone
    - Add behaviors for interactivity (shopkeeper, quest_giver, patrol)
    - Define keywords for targeting (e.g., ["guard", "soldier"])

    ### Quest Structure
    - Objectives: kill, collect, reach_room, talk_to
    - Rewards: xp, gold, items
    - Set appropriate prerequisites
    - Chain quests logically (prerequisite references)

    ### Room Connections
    - Standard directions: north, south, east, west, up, down
    - Special directions: enter, leave, climb, descend
    - Two-way connections preferred (create exits both ways)
    - Consider logical geography

    ### Consistency
    - Match the tone and style of existing content
    - Respect zone boundaries and themes
    - NPCs should fit their location (guards at gates, merchants in markets)
    - Quests should make narrative sense

    #{build_current_context(opts)}

    ## Response Format

    Use tool calls to make changes. Explain your reasoning briefly before calling tools.
    When creating connected content (rooms + NPCs + quests), create them in logical order:
    1. Create rooms first
    2. Add exits to connect them
    3. Place NPCs in rooms
    4. Create quests referencing NPCs and rooms
    """
  end

  defp build_current_context(opts) do
    sections = []

    # Current zone context with details
    sections =
      if zone = opts[:current_zone] do
        zone_name = zone.name || zone[:name]
        zone_desc = zone.description || zone[:description] || ""
        level_range = zone[:level_range] || zone.level_range

        level_info =
          if level_range do
            min = level_range[:min] || level_range["min"]
            max = level_range[:max] || level_range["max"]
            "Level Range: #{min}-#{max}"
          else
            ""
          end

        [
          """
          ## Current Zone: #{zone_name}

          #{zone_desc}
          #{level_info}
          """
          | sections
        ]
      else
        sections
      end

    # Existing room keys (prevent duplicates)
    sections =
      if room_keys = opts[:existing_room_keys] do
        keys_list = room_keys |> Enum.take(50) |> Enum.join(", ")
        count = length(room_keys)

        [
          """
          ## Existing Room Keys (#{count} total)

          #{keys_list}#{if count > 50, do: "... and #{count - 50} more", else: ""}

          Make sure to use unique keys when creating new rooms.
          """
          | sections
        ]
      else
        sections
      end

    # Nearby rooms with more detail
    sections =
      if nearby_rooms = opts[:nearby_rooms] do
        room_descriptions =
          nearby_rooms
          |> Enum.take(8)
          |> Enum.map(fn room ->
            key = room.key || room[:key]
            name = room.name || room[:name] || "Unnamed"
            exits = room.exits || room[:exits] || %{}
            exit_dirs = exits |> Map.keys() |> Enum.join(", ")
            "- #{key}: #{name} (exits: #{exit_dirs})"
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

    # NPCs in context
    sections =
      if npcs = opts[:npcs] do
        npc_list =
          npcs
          |> Enum.take(10)
          |> Enum.map(fn npc ->
            key = npc.key || npc[:key]
            name = npc.name || npc[:name] || "Unnamed"

            level =
              npc.level || npc[:level] || get_in(npc, [:components, "npc_data", "level"]) || "?"

            room = npc.parent_key || npc[:parent_key] || "unknown"
            "- #{key}: #{name} (level #{level}, in #{room})"
          end)
          |> Enum.join("\n")

        if npc_list != "" do
          [
            """
            ## NPCs in Area

            #{npc_list}
            """
            | sections
          ]
        else
          sections
        end
      else
        sections
      end

    # Quests in context
    sections =
      if quests = opts[:quests] do
        quest_list =
          quests
          |> Enum.take(10)
          |> Enum.map(fn quest ->
            key = quest.key || quest[:key]
            name = quest.name || quest[:name] || "Unnamed"
            quest_type = get_quest_type(quest) || "side"
            giver = get_quest_giver(quest) || "unknown"
            "- #{key}: #{name} (#{quest_type}, from #{giver})"
          end)
          |> Enum.join("\n")

        if quest_list != "" do
          [
            """
            ## Quests

            #{quest_list}
            """
            | sections
          ]
        else
          sections
        end
      else
        sections
      end

    # Items in context
    sections =
      if items = opts[:items] do
        item_list =
          items
          |> Enum.take(10)
          |> Enum.map(fn item ->
            key = item.key || item[:key]
            name = item.name || item[:name] || "Unnamed"
            item_type = get_item_type(item) || "misc"
            "- #{key}: #{name} (#{item_type})"
          end)
          |> Enum.join("\n")

        if item_list != "" do
          [
            """
            ## Items

            #{item_list}
            """
            | sections
          ]
        else
          sections
        end
      else
        sections
      end

    # Current selection with full details
    sections =
      if selection = opts[:current_selection] do
        type = selection.type || selection[:type]
        key = selection.key || selection[:key]
        name = selection.name || selection[:name]
        desc = selection.description || selection[:description]

        detail_section =
          case type do
            :room ->
              exits = selection.exits || selection[:exits] || %{}
              exit_list = exits |> Map.keys() |> Enum.join(", ")
              "Exits: #{exit_list}"

            :npc ->
              level = selection.level || selection[:level] || "?"
              "Level: #{level}"

            :quest ->
              quest_type = get_quest_type(selection) || "side"
              "Type: #{quest_type}"

            _ ->
              ""
          end

        [
          """
          ## Current Selection

          Type: #{type}
          Key: #{key}
          #{if name, do: "Name: #{name}", else: ""}
          #{if desc, do: "Description: #{desc}", else: ""}
          #{detail_section}
          """
          | sections
        ]
      else
        sections
      end

    Enum.reverse(sections) |> Enum.join("\n")
  end

  # Helper to extract quest type from various formats
  defp get_quest_type(quest) do
    quest[:quest_type] ||
      quest.quest_type ||
      get_in(quest, [:data, "quest_type"]) ||
      get_in(quest, [:data, :quest_type])
  end

  # Helper to extract quest giver from various formats
  defp get_quest_giver(quest) do
    quest[:giver_key] ||
      quest.giver_key ||
      get_in(quest, [:data, "giver_key"]) ||
      get_in(quest, [:data, :giver_key])
  end

  # Helper to extract item type from various formats
  defp get_item_type(item) do
    item[:item_type] ||
      item.item_type ||
      get_in(item, [:components, "item", "item_type"]) ||
      get_in(item, [:components, :item, :item_type])
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
    rooms = RoomManager.list_rooms()
    Enum.map(rooms, fn room -> room.key || room[:key] end)
  end

  @doc """
  Gets all NPCs, optionally filtered by zone or room.

  ## Options

    * `:zone` - Filter to NPCs in rooms belonging to this zone
    * `:room` - Filter to NPCs in this specific room

  ## Returns

  List of NPC maps.
  """
  @spec get_npcs(keyword()) :: [map()]
  def get_npcs(opts \\ []) do
    npcs = EntityManager.list_entities(:npc)

    cond do
      room_key = opts[:room] ->
        Enum.filter(npcs, fn npc ->
          (npc.parent_key || npc[:parent_key]) == room_key
        end)

      _zone_key = opts[:zone] ->
        # TODO: Filter by zone membership
        npcs

      true ->
        npcs
    end
  end

  @doc """
  Gets all quests, optionally filtered by type or giver.

  ## Options

    * `:type` - Filter to quests of this type (main, side, daily)
    * `:giver` - Filter to quests given by this NPC

  ## Returns

  List of quest maps.
  """
  @spec get_quests(keyword()) :: [map()]
  def get_quests(opts \\ []) do
    quests = QuestManager.list_quests()

    cond do
      type = opts[:type] ->
        Enum.filter(quests, fn quest -> get_quest_type(quest) == type end)

      giver = opts[:giver] ->
        Enum.filter(quests, fn quest -> get_quest_giver(quest) == giver end)

      true ->
        quests
    end
  end

  @doc """
  Gets all items, optionally filtered by room or type.

  ## Options

    * `:room` - Filter to items in this specific room
    * `:type` - Filter to items of this type (weapon, armor, misc)

  ## Returns

  List of item maps.
  """
  @spec get_items(keyword()) :: [map()]
  def get_items(opts \\ []) do
    items = EntityManager.list_entities(:item)

    cond do
      room_key = opts[:room] ->
        Enum.filter(items, fn item ->
          (item.parent_key || item[:parent_key]) == room_key
        end)

      type = opts[:type] ->
        Enum.filter(items, fn item -> get_item_type(item) == type end)

      true ->
        items
    end
  end

  @doc """
  Gets all zones.

  ## Returns

  List of zone maps.
  """
  @spec get_zones() :: [map()]
  def get_zones do
    Zone.all()
  end

  @doc """
  Builds a comprehensive context for a given room and its surroundings.

  This is a convenience function that fetches all relevant data for a room context.

  ## Parameters

    * `room_key` - The room to build context around
    * `zone` - Optional zone map for additional context

  ## Returns

  Keyword list suitable for passing to `build_system_prompt/1`.
  """
  @spec build_room_context(String.t(), map() | nil) :: keyword()
  def build_room_context(room_key, zone \\ nil) do
    nearby_rooms = get_nearby_rooms(room_key, 2)
    nearby_keys = Enum.map(nearby_rooms, fn r -> r.key || r[:key] end)

    # Get NPCs in nearby rooms
    npcs =
      nearby_keys
      |> Enum.flat_map(fn key -> get_npcs(room: key) end)
      |> Enum.uniq_by(fn npc -> npc.key || npc[:key] end)

    # Get items in nearby rooms
    items =
      nearby_keys
      |> Enum.flat_map(fn key -> get_items(room: key) end)
      |> Enum.uniq_by(fn item -> item.key || item[:key] end)

    # Get quests from NPCs in the area
    npc_keys = Enum.map(npcs, fn npc -> npc.key || npc[:key] end)

    quests =
      npc_keys
      |> Enum.flat_map(fn key -> get_quests(giver: key) end)
      |> Enum.uniq_by(fn quest -> quest.key || quest[:key] end)

    [
      current_zone: zone,
      existing_room_keys: get_existing_keys(),
      nearby_rooms: nearby_rooms,
      npcs: npcs,
      items: items,
      quests: quests
    ]
  end
end
