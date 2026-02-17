defmodule Loka.WorldBuilder.ToolExecutor.Rooms do
  @moduledoc false

  alias Loka.WorldBuilder.RoomManager

  def execute_create_room(input) do
    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      x: input["x"] || 0,
      y: input["y"] || 0,
      z: input["z"] || 0,
      tags: input["tags"] || []
    }

    case RoomManager.create_room(attrs) do
      {:ok, room} ->
        {:ok,
         %{
           success: true,
           message: "Created room '#{room.name}' (#{room.key})",
           room: %{
             key: room.key,
             name: room.name,
             description: room.description,
             x: room.x,
             y: room.y,
             z: room.z
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create room: #{inspect(reason)}"}
    end
  end

  def execute_update_room(input) do
    room_key = input["room_key"]

    updates =
      input
      |> Map.take(["name", "description", "x", "y", "z", "tags"])
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    case RoomManager.update_room(room_key, updates) do
      {:ok, room} ->
        {:ok,
         %{
           success: true,
           message: "Updated room '#{room.name}'",
           room: %{
             key: room.key,
             name: room.name,
             description: room.description,
             x: room.x,
             y: room.y,
             z: room.z
           }
         }}

      {:error, reason} ->
        {:error, "Failed to update room: #{inspect(reason)}"}
    end
  end

  def execute_delete_room(input) do
    room_key = input["room_key"]

    case RoomManager.delete_room(room_key) do
      {:ok, _deleted_room} ->
        {:ok,
         %{
           success: true,
           message: "Deleted room '#{room_key}'"
         }}

      {:error, reason} ->
        {:error, "Failed to delete room: #{inspect(reason)}"}
    end
  end

  def execute_create_exit(input) do
    from_room = input["from_room"]
    direction = input["direction"]
    to_room = input["to_room"]

    case RoomManager.add_exit(from_room, direction, to_room) do
      {:ok, _room} ->
        {:ok,
         %{
           success: true,
           message: "Created exit from #{from_room} #{direction} to #{to_room}"
         }}

      {:error, reason} ->
        {:error, "Failed to create exit: #{inspect(reason)}"}
    end
  end

  def execute_remove_exit(input) do
    from_room = input["from_room"]
    direction = input["direction"]

    case RoomManager.remove_exit(from_room, direction) do
      {:ok, _room} ->
        {:ok,
         %{
           success: true,
           message: "Removed exit from #{from_room} #{direction}"
         }}

      {:error, reason} ->
        {:error, "Failed to remove exit: #{inspect(reason)}"}
    end
  end

  def execute_get_room_info(input) do
    room_key = input["room_key"]

    case RoomManager.get_room(room_key) do
      {:ok, room} ->
        {:ok,
         %{
           success: true,
           room: %{
             key: room.key,
             name: room.name,
             description: room.description,
             x: room.x,
             y: room.y,
             z: room.z,
             exits: room.exits || %{},
             tags: room.tags || []
           }
         }}

      {:error, reason} ->
        {:error, "Room not found: #{inspect(reason)}"}
    end
  end

  def execute_list_rooms(input) do
    filter_tag = input["filter_tag"]
    rooms = RoomManager.list_rooms()

    filtered_rooms =
      if filter_tag do
        Enum.filter(rooms, fn r -> filter_tag in (r.tags || []) end)
      else
        rooms
      end

    room_list =
      Enum.map(filtered_rooms, fn r ->
        %{
          key: r.key,
          name: r.name,
          x: r.x,
          y: r.y,
          z: r.z,
          exit_count: r.exits |> Map.keys() |> length()
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(room_list)} rooms",
       rooms: room_list
     }}
  end

  def execute_batch_create_rooms(input) do
    rooms = input["rooms"] || []

    results =
      Enum.map(rooms, fn room_input ->
        execute_create_room(room_input)
      end)

    successful = Enum.count(results, fn r -> match?({:ok, _}, r) end)
    failed = Enum.count(results, fn r -> match?({:error, _}, r) end)

    if failed > 0 do
      errors = Enum.filter(results, fn r -> match?({:error, _}, r) end)
      {:error, "Created #{successful} rooms, #{failed} failed. Errors: #{inspect(errors)}"}
    else
      {:ok,
       %{
         success: true,
         message: "Created #{successful} rooms"
       }}
    end
  end
end
