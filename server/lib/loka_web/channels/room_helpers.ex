defmodule LokaWeb.Channels.RoomHelpers do
  @moduledoc """
  Room loading and player lookup helpers for GameChannel.

  Provides functions for:
  - Loading a player's current room
  - Getting other players in a room
  - Building minimap graph for navigation display
  """

  alias Loka.Framework.World.RoomLoader
  alias Loka.Engine.{Entities, Entity, EntityRegistry, EntityServer, WorldGraph}

  # ETS table for minimap cache
  @minimap_cache_table :loka_minimap_cache

  @doc """
  Initialize the minimap cache ETS table.
  Called from application.ex on startup.
  """
  def init_minimap_cache do
    :ets.new(@minimap_cache_table, [:set, :public, :named_table])
  end

  @doc """
  Clear all minimap cache entries.
  Called when world data is reimported.
  """
  def clear_minimap_cache do
    :ets.delete_all_objects(@minimap_cache_table)
  rescue
    ArgumentError -> :ok
  end

  @doc """
  V1 compat: Loads room from game_state.current_room_id.
  Returns {room, game_state}. Used by builder commands (cleaned up in Phase 6).
  """
  def load_player_room(game_state) do
    room_id = Map.get(game_state, :current_room_id) || Map.get(game_state, :location_id)

    case try_load_room(room_id) do
      {:ok, room} ->
        activate_room_entity(room.id)
        {room, game_state}

      {:error, :not_found} ->
        starting_room_id = RoomLoader.get_starting_room_id()

        case try_load_room(starting_room_id) do
          {:ok, room} ->
            activate_room_entity(room.id)
            {room, game_state}

          {:error, :not_found} ->
            {RoomLoader.empty_room(), game_state}
        end
    end
  end

  @doc """
  V2: Loads room from character entity's location_id.
  Returns {room, updated_character}.
  """
  def load_room_for_character(%Entity{} = character) do
    case try_load_room(character.location_id) do
      {:ok, room} ->
        character = ensure_character_location(character, room.id)
        activate_room_entity(room.id)
        {room, character}

      {:error, :not_found} ->
        starting_room_id = RoomLoader.get_starting_room_id()

        case try_load_room(starting_room_id) do
          {:ok, room} ->
            character = force_character_location(character, room.id)
            activate_room_entity(room.id)
            {room, character}

          {:error, :not_found} ->
            {RoomLoader.empty_room(), character}
        end
    end
  end

  @doc """
  Loads other player characters in a room (excluding the given player).
  """
  def load_other_players(nil, _player_id), do: []

  def load_other_players(room_id, player_id) do
    Entities.find_all(type: :character, location_id: room_id)
    |> Enum.reject(fn char -> char.account_id == player_id end)
    |> Enum.map(fn char ->
      %{id: char.id, name: char.short_desc || char.key, account_id: char.account_id}
    end)
  end

  @doc """
  Activates a room entity via EntityRegistry (on-demand process management).
  """
  def activate_room_entity(nil), do: :ok

  def activate_room_entity(room_id) do
    case EntityRegistry.get_or_start(room_id) do
      {:ok, pid} ->
        EntityServer.touch(pid)
        :ok

      {:error, _reason} ->
        :ok
    end
  end

  # Private helpers

  defp try_load_room(nil), do: {:error, :not_found}
  defp try_load_room(room_id), do: RoomLoader.load_room_for_display(room_id)

  # Ensure character entity has location set
  defp ensure_character_location(character, room_id) do
    if is_nil(character.location_id) and not is_nil(room_id) do
      force_character_location(character, room_id)
    else
      character
    end
  end

  defp force_character_location(character, room_id) do
    case Entities.update(character.id, %{location_id: room_id}) do
      {:ok, updated} -> updated
      _ -> %{character | location_id: room_id}
    end
  end

  # =============================================================================
  # Minimap
  # =============================================================================

  @doc """
  Builds a minimap graph showing rooms up to 2 hops from the current room.

  Returns a map with:
  - `:nodes` - List of `%{id: room_id, x: x, y: y, current: boolean}`
  - `:edges` - List of `%{from: room_id, to: room_id, direction: string}`

  Coordinates are relative to the current room (which is at 0,0).
  Uses ETS cache to avoid recomputing the same minimap multiple times.
  """
  def build_minimap_graph(nil), do: %{nodes: [], edges: []}

  def build_minimap_graph(room_id) do
    case :ets.lookup(@minimap_cache_table, room_id) do
      [{^room_id, cached_graph}] ->
        cached_graph

      [] ->
        graph = compute_minimap_graph(room_id)
        :ets.insert(@minimap_cache_table, {room_id, graph})
        graph
    end
  rescue
    ArgumentError ->
      compute_minimap_graph(room_id)
  end

  defp compute_minimap_graph(room_id) do
    # Direction to relative coordinate offset (cardinal directions only)
    direction_offsets = %{
      "north" => {0, -1},
      "south" => {0, 1},
      "east" => {1, 0},
      "west" => {-1, 0}
    }

    cardinal_directions = MapSet.new(["north", "south", "east", "west"])

    # Start with current room at origin
    nodes = %{room_id => %{id: room_id, x: 0, y: 0, current: true}}
    edges = []

    # Get 1-hop adjacent rooms
    adjacent_1 = WorldGraph.get_adjacent_rooms(room_id)

    # Add 1-hop rooms and edges (only cardinal directions)
    {nodes, edges} =
      Enum.reduce(adjacent_1, {nodes, edges}, fn {direction, adj_room}, {n, e} ->
        if MapSet.member?(cardinal_directions, direction) do
          {dx, dy} = Map.get(direction_offsets, direction)

          n =
            Map.put_new(n, adj_room.id, %{
              id: adj_room.id,
              x: dx,
              y: dy,
              current: false
            })

          e = [%{from: room_id, to: adj_room.id, direction: direction} | e]
          {n, e}
        else
          {n, e}
        end
      end)

    # Get 2-hop rooms (adjacent to each 1-hop room, cardinal directions only)
    {nodes, edges} =
      adjacent_1
      |> Enum.filter(fn {dir, _} -> MapSet.member?(cardinal_directions, dir) end)
      |> Enum.reduce({nodes, edges}, fn {dir1, adj1_room}, {n, e} ->
        {dx1, dy1} = Map.get(direction_offsets, dir1)
        adjacent_2 = WorldGraph.get_adjacent_rooms(adj1_room.id)

        adjacent_2
        |> Enum.filter(fn {dir2, _} -> MapSet.member?(cardinal_directions, dir2) end)
        |> Enum.reduce({n, e}, fn {dir2, adj2_room}, {n2, e2} ->
          if adj2_room.id == room_id do
            {n2, e2}
          else
            {dx2, dy2} = Map.get(direction_offsets, dir2)
            final_x = dx1 + dx2
            final_y = dy1 + dy2

            n2 =
              Map.put_new(n2, adj2_room.id, %{
                id: adj2_room.id,
                x: final_x,
                y: final_y,
                current: false
              })

            edge = %{from: adj1_room.id, to: adj2_room.id, direction: dir2}

            if Enum.any?(e2, fn ex -> ex.from == edge.from and ex.to == edge.to end) do
              {n2, e2}
            else
              {n2, [edge | e2]}
            end
          end
        end)
      end)

    # Filter edges to only include orthogonal connections
    node_map = Map.new(Map.values(nodes), fn node -> {node.id, node} end)

    edges =
      Enum.filter(edges, fn edge ->
        from_node = Map.get(node_map, edge.from)
        to_node = Map.get(node_map, edge.to)

        if from_node && to_node do
          dx = abs(to_node.x - from_node.x)
          dy = abs(to_node.y - from_node.y)
          (dx == 0 && dy > 0) || (dy == 0 && dx > 0)
        else
          false
        end
      end)

    %{nodes: Map.values(nodes), edges: edges}
  end
end
