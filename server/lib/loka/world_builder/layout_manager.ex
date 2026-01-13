defmodule Loka.WorldBuilder.LayoutManager do
  @moduledoc """
  Coordinates automatic layout algorithms for room positioning.

  Provides unified interface to all layout algorithms and preview generation.

  ## Available Algorithms
  - `:force_directed` - Physics-based layout with repulsion/attraction
  - `:circular` - Arrange rooms in circle(s)
  - `:grid` - Snap to grid or arrange in rows/columns
  - `:hierarchical` - Tree layout for quest zones

  ## Usage

      # Apply layout to selected rooms
      LayoutManager.apply_layout(room_keys, :force_directed, %{
        iterations: 50,
        repulsion: 500
      })

      # Generate preview without applying
      LayoutManager.preview_layout(room_keys, :circular, %{radius: 100})
  """

  require Logger

  alias Loka.WorldBuilder.RoomManager
  alias Loka.WorldBuilder.Layout.{ForceDirected, Circular, Grid, Hierarchical}

  @doc """
  Apply a layout algorithm to rooms and save the new positions.

  ## Parameters
  - room_keys: List of room keys/IDs to layout
  - algorithm: Algorithm name (:force_directed, :circular, :grid, :hierarchical)
  - options: Algorithm-specific options

  Returns {:ok, updated_rooms} or {:error, reason}
  """
  def apply_layout(room_keys, algorithm, options \\ %{}) do
    with {:ok, rooms} <- fetch_rooms(room_keys),
         {:ok, exits} <- fetch_exits(room_keys),
         {:ok, positions} <- calculate_layout(rooms, exits, algorithm, options) do
      # Apply new positions to rooms
      updated_rooms =
        Enum.map(rooms, fn room ->
          case Map.get(positions, room.id || room.key) do
            {x, y} ->
              RoomManager.update_room(room.id || room.key, %{x: x, y: y})

            nil ->
              {:ok, room}
          end
        end)
        |> Enum.filter(fn
          {:ok, _} -> true
          _ -> false
        end)
        |> Enum.map(fn {:ok, room} -> room end)

      Logger.info("[LayoutManager] Applied #{algorithm} layout to #{length(updated_rooms)} rooms")
      {:ok, updated_rooms}
    end
  end

  @doc """
  Preview layout positions without applying changes.

  Returns {:ok, %{room_id => {x, y}}} or {:error, reason}
  """
  def preview_layout(room_keys, algorithm, options \\ %{}) do
    with {:ok, rooms} <- fetch_rooms(room_keys),
         {:ok, exits} <- fetch_exits(room_keys) do
      calculate_layout(rooms, exits, algorithm, options)
    end
  end

  # =============================================================================
  # Private - Layout Calculation
  # =============================================================================

  defp calculate_layout(rooms, exits, algorithm, options) do
    case algorithm do
      :force_directed ->
        ForceDirected.layout(rooms, exits, options)

      :circular ->
        Circular.layout(rooms, options)

      :grid ->
        Grid.layout(rooms, options)

      :hierarchical ->
        Hierarchical.layout(rooms, exits, options)

      :snap_to_grid ->
        Grid.snap_to_grid(rooms, options)

      _ ->
        {:error, "Unknown layout algorithm: #{algorithm}"}
    end
  end

  # =============================================================================
  # Private - Data Fetching
  # =============================================================================

  defp fetch_rooms(room_keys) do
    rooms =
      room_keys
      |> Enum.map(&RoomManager.get_room/1)
      |> Enum.filter(fn
        {:ok, _} -> true
        _ -> false
      end)
      |> Enum.map(fn {:ok, room} -> room end)

    if Enum.empty?(rooms) do
      {:error, "No rooms found"}
    else
      {:ok, rooms}
    end
  end

  defp fetch_exits(room_keys) do
    # Collect all exits between selected rooms
    room_keys_set = MapSet.new(room_keys)

    exits =
      room_keys
      |> Enum.flat_map(fn key ->
        case RoomManager.get_room(key) do
          {:ok, room} ->
            (room.exits || [])
            |> Enum.filter(fn exit ->
              # Only include exits to other selected rooms
              MapSet.member?(room_keys_set, exit.to || exit[:to])
            end)
            |> Enum.map(fn exit ->
              %{
                from: room.key || room.id,
                to: exit.to || exit[:to],
                direction: exit.direction || exit[:direction]
              }
            end)

          _ ->
            []
        end
      end)

    {:ok, exits}
  end
end
