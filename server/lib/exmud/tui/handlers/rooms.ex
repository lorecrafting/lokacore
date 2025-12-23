defmodule Exmud.Tui.Handlers.Rooms do
  @moduledoc """
  RPC handlers for room-specific operations.

  Provides room listing with coordinates, room creation, and exit management.
  """

  alias Exmud.Engine.{Entities, Spawner}
  alias Exmud.Tui.Server

  @doc """
  Handles room RPC methods.
  """
  def handle("list", params) do
    limit = Map.get(params, "limit", 100)
    offset = Map.get(params, "offset", 0)

    rooms =
      Entities.list_rooms()
      |> Enum.drop(offset)
      |> Enum.take(limit)
      |> Enum.map(&serialize_room/1)

    {:ok, %{rooms: rooms, total: length(rooms)}}
  end

  def handle("list_with_coords", params) do
    limit = Map.get(params, "limit", 100)
    offset = Map.get(params, "offset", 0)

    rooms =
      Entities.list_rooms()
      |> Enum.drop(offset)
      |> Enum.take(limit)
      |> Enum.map(&serialize_room_with_coords/1)

    {:ok, %{rooms: rooms, total: length(rooms)}}
  end

  def handle("get", %{"id" => id}) do
    case Entities.get_room(id) do
      nil -> {:error, {:not_found, "Room not found: #{id}"}}
      room -> {:ok, serialize_room_with_coords(room)}
    end
  end

  def handle("get", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("create", %{"name" => name} = params) do
    # Spawner.create_room expects a keyword list
    attrs = [
      name: name,
      description: Map.get(params, "description", ""),
      x: Map.get(params, "x", 0),
      y: Map.get(params, "y", 0),
      z: Map.get(params, "z", 0),
      key: Map.get(params, "key"),
      tags: Map.get(params, "tags", [])
    ]

    case Spawner.create_room(attrs) do
      {:ok, room} ->
        broadcast_change("created", room)
        {:ok, serialize_room_with_coords(room)}

      {:error, reason} ->
        {:error, {:create_failed, inspect(reason)}}
    end
  end

  def handle("create", _params) do
    {:error, {:invalid_params, "Missing name parameter"}}
  end

  def handle("update", %{"id" => id} = params) do
    case Entities.get_room(id) do
      nil ->
        {:error, {:not_found, "Room not found: #{id}"}}

      room ->
        attrs = Map.take(params, ["name", "description", "tags"])
        attrs = for {k, v} <- attrs, into: %{}, do: {String.to_existing_atom(k), v}

        # Handle coordinate updates via components
        attrs =
          if Map.has_key?(params, "x") or Map.has_key?(params, "y") or Map.has_key?(params, "z") do
            coords = get_coordinates(room)

            new_coords = %{
              "x" => Map.get(params, "x", coords.x),
              "y" => Map.get(params, "y", coords.y),
              "z" => Map.get(params, "z", coords.z)
            }

            components = Map.put(room.components || %{}, "coordinates", new_coords)
            Map.put(attrs, :components, components)
          else
            attrs
          end

        case Entities.update_entity(room, attrs) do
          {:ok, updated} ->
            broadcast_change("updated", updated)
            {:ok, serialize_room_with_coords(updated)}

          {:error, changeset} ->
            {:error, {:validation_error, format_errors(changeset)}}
        end
    end
  end

  def handle("update", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("contents", %{"id" => id}) do
    case Entities.get_room(id) do
      nil ->
        {:error, {:not_found, "Room not found: #{id}"}}

      _room ->
        contents = Entities.get_contents(id)

        entities =
          Enum.map(contents, fn entity ->
            %{
              id: entity.id,
              type: to_string(entity.type),
              key: entity.key,
              name: entity.name
            }
          end)

        {:ok, %{entities: entities, total: length(entities)}}
    end
  end

  def handle("contents", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("contents_detailed", %{"id" => id}) do
    case Entities.get_room(id) do
      nil ->
        {:error, {:not_found, "Room not found: #{id}"}}

      _room ->
        contents = Entities.get_contents(id)

        # Group entities by type
        grouped =
          contents
          |> Enum.group_by(& &1.type)

        npcs = Map.get(grouped, :npc, []) |> Enum.map(&serialize_full_entity/1)
        items = Map.get(grouped, :item, []) |> Enum.map(&serialize_full_entity/1)
        exits = Map.get(grouped, :exit, []) |> Enum.map(&serialize_full_exit/1)
        characters = Map.get(grouped, :character, []) |> Enum.map(&serialize_full_entity/1)

        {:ok,
         %{
           room_id: id,
           npcs: npcs,
           items: items,
           exits: exits,
           characters: characters,
           total: length(contents)
         }}
    end
  end

  def handle("contents_detailed", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle(
        "connect",
        %{"source_id" => source_id, "destination_id" => dest_id, "direction" => direction} =
          params
      ) do
    create_return = Map.get(params, "create_return", false)

    attrs = [
      direction: direction,
      source_id: source_id,
      destination_id: dest_id,
      create_return: create_return
    ]

    case Spawner.create_exit(attrs) do
      {:ok, exits} when is_list(exits) ->
        # Bidirectional exits created
        broadcast_change("created", Enum.at(exits, 0))
        broadcast_change("created", Enum.at(exits, 1))
        {:ok, %{exits: Enum.map(exits, &serialize_exit/1)}}

      {:ok, exit} ->
        broadcast_change("created", exit)
        {:ok, %{exit: serialize_exit(exit)}}

      {:error, :direction_required} ->
        {:error, {:invalid_params, "Missing direction parameter"}}

      {:error, :source_id_required} ->
        {:error, {:invalid_params, "Missing source_id parameter"}}

      {:error, :destination_id_required} ->
        {:error, {:invalid_params, "Missing destination_id parameter"}}

      {:error, {:exit_exists, msg}} ->
        {:error, {:exit_exists, msg}}

      {:error, reason} ->
        {:error, {:create_failed, inspect(reason)}}
    end
  end

  def handle("connect", _params) do
    {:error, {:invalid_params, "Missing source_id, destination_id, or direction parameter"}}
  end

  def handle("spawn_from_template", %{"template_key" => template_key} = params) do
    opts = [
      x: Map.get(params, "x", 0),
      y: Map.get(params, "y", 0),
      z: Map.get(params, "z", 0)
    ]

    # Add optional overrides
    opts = if Map.has_key?(params, "name"), do: Keyword.put(opts, :name, params["name"]), else: opts
    opts = if Map.has_key?(params, "key"), do: Keyword.put(opts, :key, params["key"]), else: opts

    case Spawner.spawn_from_template(template_key, opts) do
      {:ok, room} ->
        broadcast_change("created", room)
        {:ok, serialize_room_with_coords(room)}

      {:error, :not_found} ->
        {:error, {:not_found, "Template not found: #{template_key}"}}

      {:error, {:not_a_template, msg}} ->
        {:error, {:invalid_params, msg}}

      {:error, reason} ->
        {:error, {:create_failed, inspect(reason)}}
    end
  end

  def handle("spawn_from_template", _params) do
    {:error, {:invalid_params, "Missing template_key parameter"}}
  end

  def handle(action, _params) do
    {:error, {:method_not_found, "Unknown rooms action: #{action}"}}
  end

  # Private

  defp serialize_room(room) do
    %{
      id: room.id,
      key: room.key,
      name: room.name,
      description: room.description
    }
  end

  defp serialize_exit(exit) do
    exit_data = get_in(exit.components, ["exit"]) || %{}

    %{
      id: exit.id,
      key: exit.key,
      name: exit.name,
      direction: Map.get(exit_data, "direction"),
      destination_id: Map.get(exit_data, "destination_id"),
      destination_key: Map.get(exit_data, "destination_key"),
      source_id: exit.location_id
    }
  end

  defp serialize_full_entity(entity) do
    %{
      id: entity.id,
      type: to_string(entity.type),
      key: entity.key,
      name: entity.name,
      description: entity.description || "",
      components: entity.components || %{},
      tags: entity.tags || [],
      location_id: entity.location_id
    }
  end

  defp serialize_full_exit(exit) do
    exit_data = get_in(exit.components, ["exit"]) || exit.components || %{}
    dest_id = Map.get(exit_data, "destination_id")

    # Get destination room info if available
    {dest_name, dest_key} =
      case dest_id && Entities.get_entity(dest_id) do
        nil -> {nil, nil}
        dest_room -> {dest_room.name, dest_room.key}
      end

    %{
      id: exit.id,
      type: "exit",
      key: exit.key,
      name: exit.name,
      description: exit.description || "",
      direction: Map.get(exit_data, "direction"),
      destination_id: dest_id,
      destination_name: dest_name,
      destination_key: dest_key,
      components: exit.components || %{},
      tags: exit.tags || []
    }
  end

  defp serialize_room_with_coords(room) do
    coords = get_coordinates(room)
    exits = get_room_exits(room.id)

    %{
      id: room.id,
      key: room.key,
      name: room.name,
      description: room.description,
      x: coords.x,
      y: coords.y,
      z: coords.z,
      tags: room.tags || [],
      exits: exits
    }
  end

  defp get_room_exits(room_id) do
    Entities.get_contents(room_id)
    |> Enum.filter(fn e -> e.type == :exit end)
    |> Enum.map(fn exit ->
      exit_data = get_in(exit.components, ["exit"]) || exit.components || %{}
      dest_id = Map.get(exit_data, "destination_id")

      # Get destination room coordinates if available
      {dest_x, dest_y, dest_z} =
        case dest_id && Entities.get_entity(dest_id) do
          nil -> {0, 0, 0}
          dest_room ->
            dest_coords = get_coordinates(dest_room)
            {dest_coords.x, dest_coords.y, dest_coords.z}
        end

      %{
        direction: Map.get(exit_data, "direction"),
        destination_id: dest_id,
        dest_x: dest_x,
        dest_y: dest_y,
        dest_z: dest_z
      }
    end)
  end

  defp get_coordinates(room) do
    coords = get_in(room.components, ["coordinates"]) || %{}

    %{
      x: Map.get(coords, "x", 0),
      y: Map.get(coords, "y", 0),
      z: Map.get(coords, "z", 0)
    }
  end

  defp broadcast_change(action, entity) do
    Server.broadcast(%{
      method: "entity.changed",
      params: %{
        action: action,
        type: to_string(entity.type),
        id: entity.id,
        room_id: entity.location_id
      }
    })
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end
end
