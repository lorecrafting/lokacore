defmodule Loka.Testing.TestData do
  @moduledoc """
  Shared test data infrastructure for both bot testing and E2E (Playwright) testing.

  This module provides:
  - World graph export (room connections)
  - Quest definitions export
  - NPC location tracking
  - Pathfinding between rooms

  ## Usage

  ### Export all test data to JSON (for Playwright):

      Loka.Testing.TestData.export_all()
      # Writes to test/e2e/data/

  ### Get pathfinding data:

      TestData.find_path("monastery_gate", "temple")
      # => {:ok, ["north", "east"]}

  ### Get quest definitions:

      TestData.get_quest("main_sleeping_master")
      # => %{id: "main_sleeping_master", giver: "abbot_jampa", objectives: [...]}

  ## Data Files

  Exported JSON files in `test/e2e/data/`:

  - `world-graph.json` - Room connections (direction -> destination)
  - `quests.json` - Quest definitions with objectives
  - `npcs.json` - NPC keys and their spawn locations
  - `items.json` - Item keys and spawn locations
  """

  alias Loka.Engine.Constants.WorldPaths

  @data_dir "test/e2e/data"

  # =============================================================================
  # Export Functions (for Playwright)
  # =============================================================================

  @doc """
  Exports all test data to JSON files in test/e2e/data/.

  Creates:
  - world-graph.json
  - quests.json
  - npcs.json
  - items.json
  """
  def export_all do
    File.mkdir_p!(@data_dir)

    [
      export_world_graph(),
      export_quests(),
      export_npcs(),
      export_items()
    ]
  end

  @doc """
  Exports world graph (room connections) to JSON.
  """
  def export_world_graph do
    graph = build_world_graph()
    json = Jason.encode!(graph, pretty: true)
    path = Path.join(@data_dir, "world-graph.json")
    File.write!(path, json)
    {:ok, path}
  end

  @doc """
  Exports quest definitions to JSON.
  """
  def export_quests do
    quests = load_all_quests()
    json = Jason.encode!(quests, pretty: true)
    path = Path.join(@data_dir, "quests.json")
    File.write!(path, json)
    {:ok, path}
  end

  @doc """
  Exports NPC data (key -> spawn room) to JSON.
  """
  def export_npcs do
    npcs = build_npc_locations()
    json = Jason.encode!(npcs, pretty: true)
    path = Path.join(@data_dir, "npcs.json")
    File.write!(path, json)
    {:ok, path}
  end

  @doc """
  Exports item data (key -> spawn room) to JSON.
  """
  def export_items do
    items = build_item_locations()
    json = Jason.encode!(items, pretty: true)
    path = Path.join(@data_dir, "items.json")
    File.write!(path, json)
    {:ok, path}
  end

  # =============================================================================
  # Data Access Functions (for Bot and Playwright)
  # =============================================================================

  @doc """
  Builds a map of room_key -> %{direction -> destination_room_key}.

  This is the same graph structure used by the StorylineRunner bot.
  Uses prototype definitions (YAML files) as the source of truth for exits.
  """
  def build_world_graph do
    alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

    # Get all room prototypes
    room_prototypes = TypedObjectLoader.list_by_type(:entity, :room)

    Enum.reduce(room_prototypes, %{}, fn proto, acc ->
      # Exits are stored in the data map on TypedObject structs
      exits = proto.data["exits"] || %{}

      # Only include rooms with exits
      if map_size(exits) > 0 do
        Map.put(acc, proto.key, exits)
      else
        # Still include room but with empty exits
        Map.put(acc, proto.key, %{})
      end
    end)
  end

  @doc """
  Finds the shortest path between two rooms using BFS.

  Returns {:ok, [directions]} or {:error, :no_path}.
  """
  def find_path(from_key, to_key) when from_key == to_key, do: {:ok, []}

  def find_path(from_key, to_key) do
    graph = build_world_graph()
    bfs_find_path(graph, from_key, to_key)
  end

  @doc """
  Finds the shortest path using a pre-built graph.
  """
  def find_path_with_graph(_graph, from_key, to_key) when from_key == to_key, do: {:ok, []}

  def find_path_with_graph(graph, from_key, to_key) do
    bfs_find_path(graph, from_key, to_key)
  end

  @doc """
  Loads all quest definitions from YAML files.

  Returns a list of maps with quest data.
  """
  def load_all_quests do
    quest_dir = WorldPaths.quests_dir()

    if File.dir?(quest_dir) do
      quest_dir
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".yml"))
      |> Enum.map(fn file ->
        path = Path.join(quest_dir, file)
        {:ok, content} = YamlElixir.read_from_file(path)
        normalize_quest(content)
      end)
    else
      []
    end
  end

  @doc """
  Gets a specific quest by ID.
  """
  def get_quest(quest_id) do
    Enum.find(load_all_quests(), fn q -> q["id"] == quest_id end)
  end

  @doc """
  Loads a storyline definition.
  """
  def load_storyline(storyline_id) do
    path = Path.join(WorldPaths.storylines_dir(), "#{storyline_id}.yml")

    if File.exists?(path) do
      {:ok, content} = YamlElixir.read_from_file(path)
      {:ok, content}
    else
      {:error, :not_found}
    end
  end

  @doc """
  Gets the quest order for a storyline.
  """
  def get_quest_order(storyline_id) do
    case load_storyline(storyline_id) do
      {:ok, storyline} ->
        main_quests =
          storyline["acts"]
          |> Enum.flat_map(fn act -> act["quests"] || [] end)

        side_quests = storyline["side_quests"] || []

        {:ok, %{main: main_quests, side: side_quests}}

      error ->
        error
    end
  end

  @doc """
  Builds a map of NPC key -> %{room: room_key, primary_keyword: keyword}.
  Uses prototype definitions (YAML files) as the source of truth.

  The primary_keyword is what's displayed as clickable text in the UI.
  """
  def build_npc_locations do
    alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

    # Get all room prototypes and extract spawns
    room_prototypes = TypedObjectLoader.list_by_type(:entity, :room)

    Enum.reduce(room_prototypes, %{}, fn proto, acc ->
      spawns = proto.data["spawns"] || []

      Enum.reduce(spawns, acc, fn spawn_def, inner_acc ->
        npc_key = spawn_def["prototype"] || spawn_def[:prototype]

        if npc_key do
          # Check if this is an NPC type
          case TypedObjectLoader.get(npc_key) do
            {:ok, %{subtype: :npc} = npc_proto} ->
              Map.put(inner_acc, npc_key, %{
                room: proto.key,
                primary_keyword: get_in(npc_proto.data, ["primary_keyword"])
              })

            _ ->
              inner_acc
          end
        else
          inner_acc
        end
      end)
    end)
  end

  @doc """
  Finds which room an NPC with the given key is in.
  Returns just the room key for backwards compatibility.
  """
  def find_npc_room(npc_key) do
    npc_locations = build_npc_locations()

    case Map.get(npc_locations, npc_key) do
      %{room: room} -> room
      nil -> nil
    end
  end

  @doc """
  Gets NPC info including room and primary_keyword.
  """
  def get_npc_info(npc_key) do
    npc_locations = build_npc_locations()
    Map.get(npc_locations, npc_key)
  end

  @doc """
  Builds a map of item key -> %{rooms: [room_keys], primary_keyword: keyword}.
  Uses prototype definitions (YAML files) as the source of truth.

  The primary_keyword is what's displayed as clickable text in the UI.
  """
  def build_item_locations do
    alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

    # Get all room prototypes and extract item spawns
    room_prototypes = TypedObjectLoader.list_by_type(:entity, :room)

    Enum.reduce(room_prototypes, %{}, fn proto, acc ->
      spawns = proto.data["spawns"] || []

      Enum.reduce(spawns, acc, fn spawn_def, inner_acc ->
        item_key = spawn_def["prototype"] || spawn_def[:prototype]

        if item_key do
          # Check if this is an item type
          case TypedObjectLoader.get(item_key) do
            {:ok, %{subtype: :item} = item_proto} ->
              existing = Map.get(inner_acc, item_key, %{rooms: [], primary_keyword: nil})
              rooms = [proto.key | existing.rooms] |> Enum.uniq()

              Map.put(inner_acc, item_key, %{
                rooms: rooms,
                primary_keyword: get_in(item_proto.data, ["primary_keyword"])
              })

            _ ->
              inner_acc
          end
        else
          inner_acc
        end
      end)
    end)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp normalize_quest(quest_map) do
    objectives =
      (quest_map["objectives"] || [])
      |> Enum.map(fn obj ->
        %{
          "id" => obj["id"],
          "type" => obj["type"],
          "target_id" => obj["target_id"],
          "description" => obj["description"],
          "dialogue_topic" => obj["dialogue_topic"],
          "target_count" => obj["target_count"] || 1
        }
      end)

    %{
      "id" => quest_map["id"],
      "name" => quest_map["name"],
      "description" => quest_map["description"],
      "giver" => quest_map["giver"],
      "type" => quest_map["type"],
      "act" => quest_map["act"],
      "level_requirement" => quest_map["level_requirement"] || 1,
      "objectives" => objectives,
      "rewards" => quest_map["rewards"] || %{}
    }
  end

  defp bfs_find_path(graph, from_key, to_key) do
    queue = :queue.from_list([{from_key, []}])
    visited = MapSet.new([from_key])
    do_bfs(graph, to_key, queue, visited)
  end

  defp do_bfs(_graph, _target, {[], []}, _visited), do: {:error, :no_path}

  defp do_bfs(graph, target, queue, visited) do
    case :queue.out(queue) do
      {:empty, _} ->
        {:error, :no_path}

      {{:value, {current, path}}, rest_queue} ->
        neighbors = Map.get(graph, current, %{})

        # Check if any neighbor is the target
        case Enum.find(neighbors, fn {_dir, dest} -> dest == target end) do
          {direction, _} ->
            {:ok, Enum.reverse([direction | path])}

          nil ->
            # Add unvisited neighbors to queue
            {new_queue, new_visited} =
              Enum.reduce(neighbors, {rest_queue, visited}, fn {dir, dest}, {q, v} ->
                if MapSet.member?(v, dest) do
                  {q, v}
                else
                  {:queue.in({dest, [dir | path]}, q), MapSet.put(v, dest)}
                end
              end)

            do_bfs(graph, target, new_queue, new_visited)
        end
    end
  end
end
