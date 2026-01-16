defmodule Loka.WorldBuilder.ToolExecutor do
  @moduledoc """
  Executes LLM tool calls in the World Builder.

  Handles tool calls from Claude by:
  1. Validating tool parameters
  2. Executing via appropriate Manager
  3. Returning results for display and Claude continuation
  """
  require Logger

  alias Loka.WorldBuilder.{RoomManager, EntityManager, QuestManager}

  @doc """
  Execute a tool call and return the result.

  ## Parameters
    - tool_name: Name of the tool (string)
    - input: Tool input parameters (map)

  ## Returns
    - {:ok, result} on success
    - {:error, reason} on failure
  """
  def execute(tool_name, input) when is_binary(tool_name) and is_map(input) do
    Logger.info("[ToolExecutor] Executing tool: #{tool_name}")

    case tool_name do
      "create_room" -> execute_create_room(input)
      "update_room" -> execute_update_room(input)
      "delete_room" -> execute_delete_room(input)
      "create_exit" -> execute_create_exit(input)
      "remove_exit" -> execute_remove_exit(input)
      "create_npc" -> execute_create_npc(input)
      "create_item" -> execute_create_item(input)
      "get_room_info" -> execute_get_room_info(input)
      "list_rooms" -> execute_list_rooms(input)
      "batch_create_rooms" -> execute_batch_create_rooms(input)
      _ -> {:error, "Unknown tool: #{tool_name}"}
    end
  end

  def execute(tool_name, _input) do
    {:error, "Invalid tool call: #{inspect(tool_name)}"}
  end

  # =============================================================================
  # Room Tools
  # =============================================================================

  defp execute_create_room(input) do
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

  defp execute_update_room(input) do
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

  defp execute_delete_room(input) do
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

  defp execute_create_exit(input) do
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

  defp execute_remove_exit(input) do
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

  # =============================================================================
  # Entity Tools
  # =============================================================================

  defp execute_create_npc(input) do
    level = input["level"] || 1

    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      level: level,
      tags: input["tags"] || [],
      parent_key: input["room_key"]
    }

    case EntityManager.create_entity(:npc, attrs) do
      {:ok, npc} ->
        # Level is stored in components, extract it safely
        npc_level = get_in(npc.components, ["npc_data", "level"]) || level

        {:ok,
         %{
           success: true,
           message: "Created NPC '#{npc.name}' (#{npc.key})",
           npc: %{
             key: npc.key,
             name: npc.name,
             description: npc.description,
             level: npc_level
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create NPC: #{inspect(reason)}"}
    end
  end

  defp execute_create_item(input) do
    item_type = input["item_type"] || "misc"

    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      item_type: item_type,
      tags: input["tags"] || [],
      parent_key: input["room_key"]
    }

    case EntityManager.create_entity(:item, attrs) do
      {:ok, item} ->
        # Item type is stored in components, extract it safely
        stored_item_type = get_in(item.components, ["item", "item_type"]) || item_type

        {:ok,
         %{
           success: true,
           message: "Created item '#{item.name}' (#{item.key})",
           item: %{
             key: item.key,
             name: item.name,
             description: item.description,
             item_type: stored_item_type
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create item: #{inspect(reason)}"}
    end
  end

  # =============================================================================
  # Query Tools
  # =============================================================================

  defp execute_get_room_info(input) do
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

  defp execute_list_rooms(input) do
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

  defp execute_batch_create_rooms(input) do
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

  # =============================================================================
  # Result Formatting
  # =============================================================================

  @doc """
  Format a tool result for display in the chat UI.
  """
  def format_result({:ok, result}) do
    %{
      status: "success",
      message: result[:message] || "Operation completed",
      data: Map.drop(result, [:success, :message])
    }
  end

  def format_result({:error, reason}) when is_binary(reason) do
    %{
      status: "error",
      message: reason,
      data: nil
    }
  end

  def format_result({:error, reason}) do
    %{
      status: "error",
      message: inspect(reason),
      data: nil
    }
  end
end
