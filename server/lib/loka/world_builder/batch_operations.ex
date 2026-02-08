defmodule Loka.WorldBuilder.BatchOperations do
  @moduledoc """
  Batch operations for multiple rooms in the World Builder.

  Supports:
  - Batch move: Move multiple rooms by an offset
  - Batch delete: Delete multiple rooms at once
  - Batch clone: Clone multiple rooms preserving relative positions
  - Batch tag: Add/remove tags from multiple rooms
  """

  require Logger

  alias Loka.WorldBuilder.RoomManager

  @doc """
  Move multiple rooms by an offset.

  ## Parameters
  - room_keys: List of room keys to move
  - offset: Map with :dx, :dy, :dz (optional, defaults to 0)

  Returns {:ok, [room_maps]} or {:error, reason}
  """
  def batch_move(room_keys, offset) when is_list(room_keys) and is_map(offset) do
    dx = Map.get(offset, :dx, 0)
    dy = Map.get(offset, :dy, 0)
    dz = Map.get(offset, :dz, 0)

    Logger.info(
      "[BatchOperations] Moving #{length(room_keys)} rooms by offset (#{dx}, #{dy}, #{dz})"
    )

    results =
      Enum.map(room_keys, fn key ->
        with {:ok, room} <- RoomManager.get_room(key) do
          new_x = room.x + dx
          new_y = room.y + dy
          new_z = room.z + dz

          RoomManager.update_room(key, %{x: new_x, y: new_y, z: new_z})
        end
      end)

    # Check if all operations succeeded
    if Enum.all?(results, &match?({:ok, _}, &1)) do
      rooms = Enum.map(results, fn {:ok, room} -> room end)
      {:ok, rooms}
    else
      errors = Enum.filter(results, &match?({:error, _}, &1))
      {:error, "Some moves failed: #{inspect(errors)}"}
    end
  end

  @doc """
  Delete multiple rooms at once.

  Returns :ok or {:error, reason}
  """
  def batch_delete(room_keys) when is_list(room_keys) do
    Logger.info("[BatchOperations] Deleting #{length(room_keys)} rooms")

    results =
      Enum.map(room_keys, fn key ->
        RoomManager.delete_room(key)
      end)

    # Check if all deletions succeeded
    if Enum.all?(results, &(&1 == :ok)) do
      :ok
    else
      errors = Enum.filter(results, &match?({:error, _}, &1))
      {:error, "Some deletions failed: #{inspect(errors)}"}
    end
  end

  @doc """
  Clone multiple rooms preserving their relative positions.

  ## Parameters
  - room_keys: List of room keys to clone
  - offset: Optional offset for the cloned group (defaults to {5, 5, 0})

  Returns {:ok, [new_room_maps]} or {:error, reason}
  """
  def batch_clone(room_keys, offset \\ %{dx: 5, dy: 5, dz: 0}) when is_list(room_keys) do
    Logger.info("[BatchOperations] Cloning #{length(room_keys)} rooms")

    dx = Map.get(offset, :dx, 5)
    dy = Map.get(offset, :dy, 5)
    dz = Map.get(offset, :dz, 0)

    # Fetch all rooms first
    rooms_result =
      Enum.map(room_keys, fn key ->
        RoomManager.get_room(key)
      end)

    # Check if all rooms were found
    if Enum.all?(rooms_result, &match?({:ok, _}, &1)) do
      rooms = Enum.map(rooms_result, fn {:ok, room} -> room end)

      # Clone each room with offset and new key
      clone_results =
        Enum.map(rooms, fn room ->
          new_key = generate_clone_key(room.key)

          attrs = %{
            key: new_key,
            name: "#{room.name} (copy)",
            description: room.description,
            x: room.x + dx,
            y: room.y + dy,
            z: room.z + dz,
            tags: room.tags
          }

          RoomManager.create_room(attrs)
        end)

      # Check if all clones succeeded
      if Enum.all?(clone_results, &match?({:ok, _}, &1)) do
        new_rooms = Enum.map(clone_results, fn {:ok, room} -> room end)
        {:ok, new_rooms}
      else
        errors = Enum.filter(clone_results, &match?({:error, _}, &1))
        {:error, "Some clones failed: #{inspect(errors)}"}
      end
    else
      {:error, "Some rooms not found"}
    end
  end

  @doc """
  Add tags to multiple rooms.

  Returns {:ok, [room_maps]} or {:error, reason}
  """
  def batch_add_tags(room_keys, tags) when is_list(room_keys) and is_list(tags) do
    Logger.info("[BatchOperations] Adding tags #{inspect(tags)} to #{length(room_keys)} rooms")

    results =
      Enum.map(room_keys, fn key ->
        with {:ok, room} <- RoomManager.get_room(key) do
          current_tags = room.tags || []
          new_tags = Enum.uniq(current_tags ++ tags)
          RoomManager.update_room(key, %{tags: new_tags})
        end
      end)

    if Enum.all?(results, &match?({:ok, _}, &1)) do
      rooms = Enum.map(results, fn {:ok, room} -> room end)
      {:ok, rooms}
    else
      errors = Enum.filter(results, &match?({:error, _}, &1))
      {:error, "Some tag operations failed: #{inspect(errors)}"}
    end
  end

  @doc """
  Remove tags from multiple rooms.

  Returns {:ok, [room_maps]} or {:error, reason}
  """
  def batch_remove_tags(room_keys, tags) when is_list(room_keys) and is_list(tags) do
    Logger.info(
      "[BatchOperations] Removing tags #{inspect(tags)} from #{length(room_keys)} rooms"
    )

    results =
      Enum.map(room_keys, fn key ->
        with {:ok, room} <- RoomManager.get_room(key) do
          current_tags = room.tags || []
          new_tags = Enum.reject(current_tags, &(&1 in tags))
          RoomManager.update_room(key, %{tags: new_tags})
        end
      end)

    if Enum.all?(results, &match?({:ok, _}, &1)) do
      rooms = Enum.map(results, fn {:ok, room} -> room end)
      {:ok, rooms}
    else
      errors = Enum.filter(results, &match?({:error, _}, &1))
      {:error, "Some tag operations failed: #{inspect(errors)}"}
    end
  end

  @doc """
  Duplicate a single room with offset.

  Returns {:ok, new_room_map} or {:error, reason}
  """
  def duplicate_room(key, offset \\ %{dx: 1, dy: 1, dz: 0}) do
    Logger.info("[BatchOperations] Duplicating room: #{key}")

    with {:ok, room} <- RoomManager.get_room(key) do
      new_key = generate_clone_key(key)
      dx = Map.get(offset, :dx, 1)
      dy = Map.get(offset, :dy, 1)
      dz = Map.get(offset, :dz, 0)

      attrs = %{
        key: new_key,
        name: "#{room.name} (copy)",
        description: room.description,
        x: room.x + dx,
        y: room.y + dy,
        z: room.z + dz,
        tags: room.tags,
        zone: Map.get(room, :zone)
      }

      RoomManager.create_room(attrs)
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp generate_clone_key(original_key) do
    # Generate a unique key by appending timestamp
    timestamp = System.os_time(:millisecond)
    suffix = :crypto.hash(:md5, "#{timestamp}") |> Base.encode16() |> String.slice(0..5)
    "#{original_key}_#{String.downcase(suffix)}"
  end
end
