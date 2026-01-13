defmodule Loka.Engine.WorldGraph do
  @moduledoc """
  Spatial operations for room entities using a coordinate system.

  Rooms can have coordinates stored in their components:

      components: %{
        "coordinates" => %{"x" => 5, "y" => 3, "z" => 0}
      }

  This module provides operations for:
  - Getting/setting room coordinates
  - Finding rooms at specific positions
  - Moving rooms
  - Auto-laying out rooms without coordinates using BFS
  - Finding adjacent rooms based on exits

  ## Direction System

  The coordinate system uses:
  - X: West (-) to East (+)
  - Y: North (-) to South (+)
  - Z: Down (-) to Up (+)
  """

  alias Loka.Engine.{Entities, Entity, Directions}
  alias Loka.Engine.Schema.EntitySchema
  import Ecto.Query

  require Logger

  @doc """
  Gets the coordinate offsets for all supported directions.

  Delegates to `Loka.Engine.Directions.offsets/0`.
  """
  defdelegate direction_offsets, to: Directions, as: :offsets

  @doc """
  Gets the offset for a specific direction.

  Delegates to `Loka.Engine.Directions.offset/1`.

  ## Examples

      iex> WorldGraph.direction_offset("north")
      {0, -1, 0}

      iex> WorldGraph.direction_offset("invalid")
      nil
  """
  defdelegate direction_offset(direction), to: Directions, as: :offset

  @doc """
  Gets the opposite direction.

  Delegates to `Loka.Engine.Directions.opposite/1`.

  ## Examples

      iex> WorldGraph.opposite_direction("north")
      "south"
  """
  defdelegate opposite_direction(direction), to: Directions, as: :opposite

  @doc """
  Gets the coordinates for a room entity.

  Returns `{x, y, z}` tuple or `nil` if no coordinates set.

  ## Examples

      iex> WorldGraph.get_coordinates(room_entity)
      {5, 3, 0}
  """
  def get_coordinates(%Entity{components: components}) do
    case Map.get(components, "coordinates") do
      %{"x" => x, "y" => y, "z" => z} -> {x, y, z}
      %{"x" => x, "y" => y} -> {x, y, 0}
      _ -> nil
    end
  end

  def get_coordinates(%EntitySchema{} = schema) do
    get_coordinates(Entities.to_entity(schema))
  end

  def get_coordinates(room_id) when is_binary(room_id) do
    case Entities.get_entity(room_id) do
      nil -> nil
      schema -> get_coordinates(schema)
    end
  end

  @doc """
  Sets coordinates for a room entity.

  ## Examples

      iex> WorldGraph.set_coordinates(room_id, 5, 3, 0)
      {:ok, entity}
  """
  def set_coordinates(room_id, x, y, z \\ 0) when is_binary(room_id) do
    case Entities.get_entity(room_id) do
      nil ->
        {:error, :not_found}

      schema ->
        entity = Entities.to_entity(schema)

        updated_components =
          Map.put(entity.components, "coordinates", %{"x" => x, "y" => y, "z" => z})

        updated_entity = %{entity | components: updated_components}
        Entities.save_entity(updated_entity)
    end
  end

  @doc """
  Sets coordinates for an Entity struct in memory (does not persist).
  """
  def set_coordinates_in_memory(%Entity{} = entity, x, y, z \\ 0) do
    updated_components =
      Map.put(entity.components, "coordinates", %{"x" => x, "y" => y, "z" => z})

    %{entity | components: updated_components}
  end

  @doc """
  Finds a room at the given coordinates.

  Returns the room entity or nil if not found.
  """
  def get_room_at(x, y, z \\ 0) do
    # Query rooms and filter by coordinates in components JSON
    # SQLite JSON extraction
    EntitySchema
    |> where([e], e.type == :room)
    |> where(
      [e],
      fragment(
        "json_extract(?, '$.coordinates.x') = ? AND json_extract(?, '$.coordinates.y') = ? AND COALESCE(json_extract(?, '$.coordinates.z'), 0) = ?",
        e.components,
        ^x,
        e.components,
        ^y,
        e.components,
        ^z
      )
    )
    |> limit(1)
    |> Loka.Repo.one()
    |> case do
      nil -> nil
      schema -> Entities.to_entity(schema)
    end
  end

  @doc """
  Moves a room to new coordinates.

  Returns error if the target position is occupied.
  """
  def move_room(room_id, x, y, z \\ 0) do
    case get_room_at(x, y, z) do
      nil ->
        set_coordinates(room_id, x, y, z)

      existing when existing.id == room_id ->
        {:ok, existing}

      _other ->
        {:error, :position_occupied}
    end
  end

  @doc """
  Gets all rooms adjacent to a room based on its exits.

  Returns a list of `{direction, room_entity}` tuples.
  """
  def get_adjacent_rooms(room_id) when is_binary(room_id) do
    # Get all exits from this room
    exits =
      Entities.get_contents(room_id)
      |> Enum.filter(fn e -> e.type == :exit end)

    Enum.flat_map(exits, fn exit_schema ->
      exit_entity = Entities.to_entity(exit_schema)
      # Exit data may be nested under "exit" key or directly in components
      exit_component = Map.get(exit_entity.components, "exit", exit_entity.components)
      direction = Map.get(exit_component, "direction")
      dest_id = Map.get(exit_component, "destination_id")
      dest_key = Map.get(exit_component, "destination_key")

      destination =
        cond do
          dest_id -> Entities.get_entity(dest_id)
          dest_key -> Entities.get_entity_by_key(dest_key)
          true -> nil
        end

      case destination do
        nil -> []
        schema -> [{direction, Entities.to_entity(schema)}]
      end
    end)
  end

  @doc """
  Auto-layouts rooms starting from a root room using BFS.

  Assigns coordinates based on exit directions. The starting room gets (0, 0, 0).
  Handles collisions by trying adjacent positions.

  ## Options

  - `:persist` - Whether to save coordinates to DB (default: true)
  - `:starting_coords` - Starting coordinates (default: {0, 0, 0})

  Returns `{:ok, count}` with the number of rooms laid out.
  """
  def auto_layout(starting_room_id, opts \\ []) do
    persist = Keyword.get(opts, :persist, true)
    {start_x, start_y, start_z} = Keyword.get(opts, :starting_coords, {0, 0, 0})

    case Entities.get_entity(starting_room_id) do
      nil ->
        {:error, :not_found}

      starting_schema ->
        starting_room = Entities.to_entity(starting_schema)

        # BFS layout
        occupied = MapSet.new()
        assignments = %{}

        {_occupied, assignments} =
          bfs_layout(
            [{starting_room, {start_x, start_y, start_z}}],
            occupied,
            assignments
          )

        # Persist if requested
        if persist do
          Enum.each(assignments, fn {room_id, {x, y, z}} ->
            set_coordinates(room_id, x, y, z)
          end)
        end

        {:ok, map_size(assignments)}
    end
  end

  defp bfs_layout([], occupied, assignments), do: {occupied, assignments}

  defp bfs_layout([{room, coords} | rest], occupied, assignments) do
    if room.id in Map.keys(assignments) do
      # Already processed
      bfs_layout(rest, occupied, assignments)
    else
      # Find a non-occupied position (try original first, then nearby)
      final_coords = find_available_position(coords, occupied)
      {fx, fy, fz} = final_coords

      new_occupied = MapSet.put(occupied, final_coords)
      new_assignments = Map.put(assignments, room.id, final_coords)

      # Get adjacent rooms via exits
      adjacent = get_adjacent_rooms(room.id)

      # Queue adjacent rooms with calculated positions
      new_queue =
        Enum.reduce(adjacent, rest, fn {direction, adj_room}, queue ->
          if adj_room.id in Map.keys(new_assignments) do
            queue
          else
            case direction_offset(direction) do
              nil ->
                queue

              {dx, dy, dz} ->
                adj_coords = {fx + dx, fy + dy, fz + dz}
                queue ++ [{adj_room, adj_coords}]
            end
          end
        end)

      bfs_layout(new_queue, new_occupied, new_assignments)
    end
  end

  defp find_available_position(coords, occupied) do
    if MapSet.member?(occupied, coords) do
      # Try spiral search for nearby position
      find_spiral_position(coords, occupied, 1)
    else
      coords
    end
  end

  defp find_spiral_position({x, y, z}, _occupied, radius) when radius > 10 do
    # Give up after radius 10, just offset on x
    {x + radius, y, z}
  end

  defp find_spiral_position({x, y, z}, occupied, radius) do
    # Check positions in a square around the point
    candidates =
      for dx <- -radius..radius,
          dy <- -radius..radius,
          abs(dx) == radius or abs(dy) == radius do
        {x + dx, y + dy, z}
      end

    case Enum.find(candidates, fn pos -> not MapSet.member?(occupied, pos) end) do
      nil -> find_spiral_position({x, y, z}, occupied, radius + 1)
      pos -> pos
    end
  end

  @doc """
  Gets all rooms with coordinates.

  Returns a list of `{room_entity, {x, y, z}}` tuples.
  """
  def list_rooms_with_coordinates do
    EntitySchema
    |> where([e], e.type == :room)
    |> where([e], fragment("json_extract(?, '$.coordinates') IS NOT NULL", e.components))
    |> Loka.Repo.all()
    |> Enum.map(fn schema ->
      entity = Entities.to_entity(schema)
      coords = get_coordinates(entity)
      {entity, coords}
    end)
  end

  @doc """
  Gets rooms within a bounding box.

  Useful for rendering a viewport of the map.
  """
  def get_rooms_in_bounds(min_x, min_y, max_x, max_y, z \\ 0) do
    EntitySchema
    |> where([e], e.type == :room)
    |> where(
      [e],
      fragment(
        "json_extract(?, '$.coordinates.x') >= ? AND json_extract(?, '$.coordinates.x') <= ? AND json_extract(?, '$.coordinates.y') >= ? AND json_extract(?, '$.coordinates.y') <= ? AND COALESCE(json_extract(?, '$.coordinates.z'), 0) = ?",
        e.components,
        ^min_x,
        e.components,
        ^max_x,
        e.components,
        ^min_y,
        e.components,
        ^max_y,
        e.components,
        ^z
      )
    )
    |> Loka.Repo.all()
    |> Enum.map(&Entities.to_entity/1)
  end

  @doc """
  Infers direction from relative positions of two rooms.

  Delegates to `Loka.Engine.Directions.infer_from_coords/2`.

  ## Examples

      iex> WorldGraph.infer_direction({0, 0, 0}, {1, 0, 0})
      "east"
  """
  defdelegate infer_direction(from_coords, to_coords), to: Directions, as: :infer_from_coords
end
