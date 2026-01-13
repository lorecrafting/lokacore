defmodule Loka.WorldBuilder.Analysis.Reachability do
  @moduledoc """
  Analyzes room reachability from starting room.

  Performs BFS to find all reachable rooms.
  """

  def find_unreachable_rooms(rooms, start_room_key) do
    all_rooms = MapSet.new(rooms, & &1.key)
    reachable = find_reachable(start_room_key, rooms)
    MapSet.difference(all_rooms, reachable) |> MapSet.to_list()
  end

  def find_reachable(start, rooms) do
    room_map = Map.new(rooms, &{&1.key, &1})
    bfs([start], MapSet.new([start]), room_map)
  end

  defp bfs([], visited, _room_map), do: visited

  defp bfs([current | rest], visited, room_map) do
    room = Map.get(room_map, current)
    neighbors = if room && room.exits, do: Enum.map(room.exits, & &1.to), else: []
    new_neighbors = Enum.filter(neighbors, &(!MapSet.member?(visited, &1)))
    new_visited = Enum.reduce(new_neighbors, visited, &MapSet.put(&2, &1))
    bfs(rest ++ new_neighbors, new_visited, room_map)
  end
end
