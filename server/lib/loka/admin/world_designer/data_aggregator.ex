defmodule Loka.Admin.WorldDesigner.DataAggregator do
  @moduledoc """
  Aggregates data from all sources for the World Designer admin tool.

  Combines:
  - Room prototypes and spawned entities
  - Quest definitions and objectives
  - Storyline structures and acts
  - NPC locations and quest involvement
  - Validation results

  This module provides the data layer for the World Designer visualization.
  """

  alias Loka.Engine.{PrototypeLoader, Entities, Directions}
  alias Loka.Framework.Quest.QuestRegistry
  alias Loka.Framework.Storyline.StorylineRegistry

  @type room_data :: %{
          key: String.t(),
          name: String.t(),
          coordinates: {integer(), integer(), integer()},
          exits: map(),
          npcs: [npc_data()],
          items: [item_data()],
          quest_markers: [quest_marker()],
          validation_warnings: [String.t()]
        }

  @type npc_data :: %{
          key: String.t(),
          name: String.t(),
          gives_quests: [String.t()],
          turn_in_for: [String.t()],
          objective_for: [String.t()]
        }

  @type item_data :: %{
          key: String.t(),
          name: String.t(),
          objective_for: [String.t()]
        }

  @type quest_marker :: %{
          type: :giver | :objective | :turn_in,
          quest_id: String.t(),
          details: map()
        }

  @type quest_data :: %{
          id: String.t(),
          name: String.t(),
          type: String.t(),
          giver: String.t() | nil,
          giver_room: String.t() | nil,
          objectives: [objective_data()],
          rewards: map(),
          prerequisites: [String.t()],
          unlocks: [String.t()],
          storyline: String.t() | nil,
          act: String.t() | nil,
          validation_warnings: [String.t()]
        }

  @type objective_data :: %{
          id: String.t(),
          type: atom(),
          description: String.t(),
          target_id: String.t() | nil,
          target_count: integer(),
          room: String.t() | nil
        }

  @type storyline_data :: %{
          key: String.t(),
          name: String.t(),
          acts: [act_data()],
          side_quests: [String.t()]
        }

  @type act_data :: %{
          id: String.t(),
          name: String.t(),
          quests: [String.t()],
          requires: [String.t()]
        }

  @doc """
  Aggregates all data needed for the World Designer.
  Returns a comprehensive map of rooms, quests, storylines, and validations.
  """
  @spec aggregate_all() :: %{
          rooms: [room_data()],
          quests: [quest_data()],
          storylines: [storyline_data()],
          stats: map()
        }
  def aggregate_all do
    rooms = aggregate_rooms()
    quests = aggregate_quests()
    storylines = aggregate_storylines()

    # Build quest-to-room mappings
    quest_room_map = build_quest_room_map(quests, rooms)

    # Enrich quests with room information
    quests = enrich_quests_with_rooms(quests, quest_room_map)

    # Enrich rooms with quest markers
    rooms = enrich_rooms_with_quest_markers(rooms, quests)

    %{
      rooms: rooms,
      quests: quests,
      storylines: storylines,
      stats: %{
        room_count: length(rooms),
        quest_count: length(quests),
        storyline_count: length(storylines),
        npc_count: count_npcs(rooms),
        warning_count: count_warnings(rooms, quests)
      }
    }
  end

  @doc """
  Aggregates room data from prototypes and spawned entities.
  Calculates coordinates using BFS from exit connections.
  """
  @spec aggregate_rooms() :: [room_data()]
  def aggregate_rooms do
    # Get all room prototypes
    prototypes =
      PrototypeLoader.all()
      |> Enum.filter(&(&1.type == :room))

    # Get spawned rooms with coordinates (if any)
    spawned_rooms = Entities.list_entities(type: :room)
    spawned_map = Map.new(spawned_rooms, fn r -> {r.key, r} end)

    # Calculate layout using BFS from exits
    coordinate_map = calculate_room_layout(prototypes)

    Enum.map(prototypes, fn proto ->
      spawned = Map.get(spawned_map, proto.key)
      # Use calculated coordinates, fall back to stored/default
      coordinates =
        Map.get(coordinate_map, proto.key) || get_coordinates(proto, spawned)

      exits = get_exits(proto)
      spawns = get_spawns(proto)

      %{
        key: proto.key,
        name: proto.short_desc || proto.key,
        description: proto.long_desc,
        coordinates: coordinates,
        exits: exits,
        npcs: filter_spawns(spawns, :npc),
        items: filter_spawns(spawns, :item),
        quest_markers: [],
        validation_warnings: validate_room(proto, exits, spawns)
      }
    end)
  end

  # Calculate room coordinates using BFS from exit connections
  defp calculate_room_layout(prototypes) do
    proto_map = Map.new(prototypes, fn p -> {p.key, p} end)

    # Find starting room (monastery_gate or first room with exits)
    starting_key =
      cond do
        Map.has_key?(proto_map, "monastery_gate") -> "monastery_gate"
        Map.has_key?(proto_map, "main_courtyard") -> "main_courtyard"
        true -> prototypes |> Enum.find(&(map_size(get_exits(&1)) > 0)) |> then(& &1.key)
      end

    if starting_key do
      bfs_layout_prototypes([{starting_key, {0, 0, 0}}], proto_map, MapSet.new(), %{})
    else
      %{}
    end
  end

  defp bfs_layout_prototypes([], _proto_map, _visited, coords), do: coords

  defp bfs_layout_prototypes([{room_key, {x, y, z}} | rest], proto_map, visited, coords) do
    if MapSet.member?(visited, room_key) do
      bfs_layout_prototypes(rest, proto_map, visited, coords)
    else
      # Mark visited and assign coordinates
      visited = MapSet.put(visited, room_key)

      # Handle collision - find free spot if occupied
      final_coords = find_free_position({x, y, z}, coords)
      coords = Map.put(coords, room_key, final_coords)

      # Get exits and queue neighbors
      proto = Map.get(proto_map, room_key)
      exits = if proto, do: get_exits(proto), else: %{}

      {fx, fy, fz} = final_coords

      new_queue =
        Enum.reduce(exits, rest, fn {direction, dest_key}, queue ->
          if MapSet.member?(visited, dest_key) or not Map.has_key?(proto_map, dest_key) do
            queue
          else
            case Directions.offset(direction) do
              nil -> queue
              {dx, dy, dz} -> queue ++ [{dest_key, {fx + dx, fy + dy, fz + dz}}]
            end
          end
        end)

      bfs_layout_prototypes(new_queue, proto_map, visited, coords)
    end
  end

  defp find_free_position(coords, existing_coords) do
    occupied = MapSet.new(Map.values(existing_coords))

    if MapSet.member?(occupied, coords) do
      # Spiral search for free position
      find_spiral_position(coords, occupied, 1)
    else
      coords
    end
  end

  defp find_spiral_position({x, y, z}, _occupied, radius) when radius > 10 do
    {x + radius, y, z}
  end

  defp find_spiral_position({x, y, z}, occupied, radius) do
    # Only use cardinal directions (no diagonals) for position search
    # This ensures rooms stay aligned on a grid without diagonal connections
    candidates =
      [
        {x, y - radius, z},
        {x + radius, y, z},
        {x, y + radius, z},
        {x - radius, y, z}
      ] ++
        if radius > 1 do
          # For larger radii, also check intermediate cardinal positions
          for r <- 1..(radius - 1),
              pos <- [
                {x, y - r, z},
                {x + r, y, z},
                {x, y + r, z},
                {x - r, y, z}
              ],
              do: pos
        else
          []
        end

    case Enum.find(candidates, fn pos -> not MapSet.member?(occupied, pos) end) do
      nil -> find_spiral_position({x, y, z}, occupied, radius + 1)
      pos -> pos
    end
  end

  @doc """
  Aggregates quest data from the QuestRegistry.
  """
  @spec aggregate_quests() :: [quest_data()]
  def aggregate_quests do
    quests = QuestRegistry.all()

    # Build unlock map (which quests unlock which)
    unlock_map = build_unlock_map(quests)

    Enum.map(quests, fn quest ->
      objectives = format_objectives(quest.objectives || [])

      %{
        id: quest.id,
        name: quest.name,
        type: to_string(quest.type || "side"),
        description: quest.description,
        giver: quest.giver,
        giver_room: nil,
        objectives: objectives,
        rewards: format_rewards(quest),
        prerequisites: get_prerequisites(quest),
        unlocks: Map.get(unlock_map, quest.id, []),
        storyline: nil,
        act: nil,
        validation_warnings: validate_quest(quest)
      }
    end)
  end

  @doc """
  Aggregates storyline data from the StorylineRegistry.
  """
  @spec aggregate_storylines() :: [storyline_data()]
  def aggregate_storylines do
    storylines = StorylineRegistry.all()

    Enum.map(storylines, fn storyline ->
      %{
        key: storyline.key,
        name: storyline.name,
        description: storyline.description,
        starting_room: storyline.starting_room,
        acts: format_acts(storyline.acts || []),
        side_quests: storyline.side_quests || []
      }
    end)
  end

  # =============================================================================
  # Private Helper Functions
  # =============================================================================

  defp get_coordinates(proto, spawned) do
    # Try to get coordinates from spawned entity first, then prototype
    coords =
      cond do
        spawned && spawned.components[:coordinates] ->
          spawned.components[:coordinates]

        proto.components && proto.components[:coordinates] ->
          proto.components[:coordinates]

        true ->
          nil
      end

    case coords do
      %{x: x, y: y, z: z} -> {x, y, z}
      %{"x" => x, "y" => y, "z" => z} -> {x, y, z}
      _ -> {0, 0, 0}
    end
  end

  defp get_exits(proto) do
    case proto.exits do
      exits when is_map(exits) -> exits
      _ -> %{}
    end
  end

  defp get_spawns(proto) do
    case proto do
      %{spawns: spawns} when is_list(spawns) -> spawns
      _ -> []
    end
  end

  defp filter_spawns(spawns, type) do
    spawns
    |> Enum.filter(fn spawn ->
      proto_key = spawn[:prototype] || spawn["prototype"]

      if proto_key do
        case PrototypeLoader.get(proto_key) do
          {:ok, proto} -> proto.type == type
          _ -> false
        end
      else
        false
      end
    end)
    |> Enum.map(fn spawn ->
      proto_key = spawn[:prototype] || spawn["prototype"]

      case PrototypeLoader.get(proto_key) do
        {:ok, proto} ->
          %{
            key: proto.key,
            name: proto.short_desc || proto.key,
            gives_quests: [],
            turn_in_for: [],
            objective_for: []
          }

        _ ->
          %{key: proto_key, name: proto_key, gives_quests: [], turn_in_for: [], objective_for: []}
      end
    end)
  end

  defp format_objectives(objectives) do
    Enum.map(objectives, fn obj ->
      %{
        id: obj.id,
        type: obj.type,
        description: obj.description || "",
        target_id: obj.target_id,
        target_count: obj.target_count || 1,
        room: Map.get(obj, :location_hint)
      }
    end)
  end

  defp format_rewards(quest) do
    rewards = quest.rewards || %{}

    %{
      xp: rewards[:xp] || rewards["xp"] || 0,
      gold: rewards[:gold] || rewards["gold"] || 0,
      items: rewards[:items] || rewards["items"] || []
    }
  end

  defp format_acts(acts) do
    Enum.map(acts, fn act ->
      %{
        id: act.id,
        name: act.name,
        description: act.description,
        quests: act.quests || [],
        requires: act.requires || []
      }
    end)
  end

  defp get_prerequisites(quest) do
    # Quest is a struct, access fields directly with dot notation
    cond do
      quest.requires_quest -> [quest.requires_quest]
      quest.requires -> List.wrap(quest.requires)
      true -> []
    end
  rescue
    # Handle missing field gracefully
    KeyError -> []
  end

  defp build_unlock_map(quests) do
    # For each quest, find what it unlocks
    Enum.reduce(quests, %{}, fn quest, acc ->
      prereqs = get_prerequisites(quest)

      Enum.reduce(prereqs, acc, fn prereq_id, acc2 ->
        Map.update(acc2, prereq_id, [quest.id], fn existing -> [quest.id | existing] end)
      end)
    end)
  end

  defp build_quest_room_map(quests, rooms) do
    # Map NPC keys to rooms they're in
    npc_room_map =
      Enum.reduce(rooms, %{}, fn room, acc ->
        Enum.reduce(room.npcs, acc, fn npc, acc2 ->
          Map.put(acc2, npc.key, room.key)
        end)
      end)

    # Map quest givers to rooms
    Enum.reduce(quests, %{}, fn quest, acc ->
      if quest.giver do
        room = Map.get(npc_room_map, quest.giver)
        Map.put(acc, quest.id, %{giver_room: room})
      else
        acc
      end
    end)
  end

  defp enrich_quests_with_rooms(quests, quest_room_map) do
    # Also get storyline information
    storylines = StorylineRegistry.all()
    quest_storyline_map = build_quest_storyline_map(storylines)

    Enum.map(quests, fn quest ->
      room_info = Map.get(quest_room_map, quest.id, %{})
      storyline_info = Map.get(quest_storyline_map, quest.id, %{})

      quest
      |> Map.put(:giver_room, room_info[:giver_room])
      |> Map.put(:storyline, storyline_info[:storyline])
      |> Map.put(:act, storyline_info[:act])
    end)
  end

  defp build_quest_storyline_map(storylines) do
    Enum.reduce(storylines, %{}, fn storyline, acc ->
      # Map act quests
      acc =
        Enum.reduce(storyline.acts || [], acc, fn act, acc2 ->
          Enum.reduce(act.quests || [], acc2, fn quest_id, acc3 ->
            Map.put(acc3, quest_id, %{storyline: storyline.key, act: act.id})
          end)
        end)

      # Map side quests
      Enum.reduce(storyline.side_quests || [], acc, fn quest_id, acc2 ->
        Map.put(acc2, quest_id, %{storyline: storyline.key, act: "side"})
      end)
    end)
  end

  defp enrich_rooms_with_quest_markers(rooms, quests) do
    # Build room -> quest markers map
    room_markers = build_room_markers(quests)

    Enum.map(rooms, fn room ->
      markers = Map.get(room_markers, room.key, [])

      # Also mark NPCs with their quest involvement
      npcs =
        Enum.map(room.npcs, fn npc ->
          gives = quests_given_by(quests, npc.key)
          turn_ins = turn_ins_for(quests, npc.key)
          objectives = objectives_involving(quests, npc.key)

          %{npc | gives_quests: gives, turn_in_for: turn_ins, objective_for: objectives}
        end)

      %{room | quest_markers: markers, npcs: npcs}
    end)
  end

  defp build_room_markers(quests) do
    Enum.reduce(quests, %{}, fn quest, acc ->
      # Add giver marker
      acc =
        if quest.giver_room do
          marker = %{type: :giver, quest_id: quest.id, details: %{npc: quest.giver}}
          Map.update(acc, quest.giver_room, [marker], &[marker | &1])
        else
          acc
        end

      # Add objective markers
      Enum.reduce(quest.objectives, acc, fn obj, acc2 ->
        if obj.room do
          marker = %{
            type: :objective,
            quest_id: quest.id,
            details: %{objective_id: obj.id, type: obj.type}
          }

          Map.update(acc2, obj.room, [marker], &[marker | &1])
        else
          acc2
        end
      end)
    end)
  end

  defp quests_given_by(quests, npc_key) do
    quests
    |> Enum.filter(&(&1.giver == npc_key))
    |> Enum.map(& &1.id)
  end

  defp turn_ins_for(_quests, _npc_key) do
    # Quest turn-ins are defined in NPC dialogue trees via complete_quest actions.
    # Implementing this would require loading and parsing dialogue YAML files.
    # For now, return empty - quest giver info from quest.giver is sufficient.
    []
  end

  defp objectives_involving(quests, npc_key) do
    quests
    |> Enum.flat_map(fn quest ->
      quest.objectives
      |> Enum.filter(&(&1.target_id == npc_key))
      |> Enum.map(fn _ -> quest.id end)
    end)
    |> Enum.uniq()
  end

  # =============================================================================
  # Validation Functions
  # =============================================================================

  defp validate_room(proto, exits, _spawns) do
    warnings = []

    # Check for orphaned room (no exits)
    warnings =
      if map_size(exits) == 0 do
        ["Room has no exits (orphaned)" | warnings]
      else
        warnings
      end

    # Check for missing description
    warnings =
      if is_nil(proto.long_desc) or proto.long_desc == "" do
        ["Room has no description" | warnings]
      else
        warnings
      end

    warnings
  end

  defp validate_quest(quest) do
    warnings = []

    # Check for missing giver
    warnings =
      if is_nil(quest.giver) or quest.giver == "" do
        ["Quest has no giver NPC" | warnings]
      else
        warnings
      end

    # Check that giver NPC exists
    warnings =
      if quest.giver do
        case PrototypeLoader.get(quest.giver) do
          {:ok, _} -> warnings
          _ -> ["Giver NPC '#{quest.giver}' not found in prototypes" | warnings]
        end
      else
        warnings
      end

    # Check for empty objectives
    warnings =
      if is_nil(quest.objectives) or length(quest.objectives || []) == 0 do
        ["Quest has no objectives" | warnings]
      else
        warnings
      end

    warnings
  end

  defp count_npcs(rooms) do
    Enum.sum(Enum.map(rooms, fn r -> length(r.npcs) end))
  end

  defp count_warnings(rooms, quests) do
    room_warnings = Enum.sum(Enum.map(rooms, fn r -> length(r.validation_warnings) end))
    quest_warnings = Enum.sum(Enum.map(quests, fn q -> length(q.validation_warnings) end))
    room_warnings + quest_warnings
  end
end
