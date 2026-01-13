defmodule Loka.WorldBuilder.RoomManager do
  @moduledoc """
  Room CRUD operations for the World Builder.

  Manages room creation, editing, and deletion using TypedObject as the underlying data structure.
  All operations validate data and persist to the database via EntityServer.
  """

  require Logger

  alias Loka.Engine.{TypedObject, Spawner, EntityServer, Entity, Entities}
  alias Loka.Engine.TypedObject.Registry

  @doc """
  Lists all rooms in the world.

  Returns a list of room maps suitable for the World Builder UI.
  Combines YAML-loaded prototypes with database-backed dynamic rooms.
  """
  def list_rooms do
    # Get rooms from TypedObject registry (YAML prototypes)
    prototype_rooms =
      Registry.list_by_type(:entity, :room)
      |> Enum.map(&enrich_room_for_frontend/1)

    # Get rooms from database (dynamically created rooms)
    db_room_schemas = Entities.list_rooms()

    db_rooms =
      db_room_schemas
      |> Enum.map(&Entities.to_entity/1)
      |> Enum.map(&enrich_room_for_frontend_from_entity/1)

    # Combine and dedupe by key (DB rooms take precedence)
    db_keys = MapSet.new(db_rooms, & &1.key)

    prototype_rooms_filtered =
      Enum.reject(prototype_rooms, fn room -> MapSet.member?(db_keys, room.key) end)

    prototype_rooms_filtered ++ db_rooms
  end

  @doc """
  Gets a room by ID or key.

  Returns {:ok, room_map} or {:error, :not_found}
  """
  def get_room(room_id) when is_binary(room_id) do
    case Registry.get(room_id) do
      {:ok, entity} when entity.subtype == :room ->
        {:ok, enrich_room_for_frontend(entity)}

      {:ok, _entity} ->
        {:error, :not_a_room}

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc """
  Creates a new room.

  ## Parameters
  - attrs: Map with :key, :name, :description, :x, :y, :z, :exits (optional)

  Returns {:ok, room_map} or {:error, reason}
  """
  def create_room(attrs) when is_map(attrs) do
    attrs = ensure_atom_keys(attrs)

    # Build keyword list for Spawner.create_room
    create_attrs = [
      key: Map.get(attrs, :key),
      name: Map.get(attrs, :name, Map.get(attrs, :key, "New Room")),
      description: Map.get(attrs, :description, "A room in the world"),
      x: Map.get(attrs, :x, 0),
      y: Map.get(attrs, :y, 0),
      z: Map.get(attrs, :z, 0),
      tags: Map.get(attrs, :tags, [])
    ]

    case Spawner.create_room(create_attrs) do
      {:ok, room_entity} ->
        Logger.info("[RoomManager] Created room: #{room_entity.key} (#{room_entity.id})")
        {:ok, enrich_room_for_frontend_from_entity(room_entity)}

      {:error, reason} ->
        Logger.error("[RoomManager] Failed to create room: #{inspect(reason)}")
        {:error, "Failed to create room: #{inspect(reason)}"}
    end
  end

  @doc """
  Updates an existing room.

  ## Parameters
  - room_id: Room ID or key to update
  - attrs: Map of fields to update

  Returns {:ok, room_map} or {:error, reason}
  """
  def update_room(room_id, attrs) when is_binary(room_id) and is_map(attrs) do
    with {:ok, entity} <- Registry.get(room_id),
         :ok <- validate_room_entity(entity) do
      # Prepare updates with coordinates in attributes
      updates = prepare_updates(attrs)

      case EntityServer.update(room_id, updates) do
        {:ok, _} ->
          Logger.info("[RoomManager] Updated room: #{room_id}")
          get_room(room_id)

        {:error, reason} ->
          Logger.error("[RoomManager] Update failed: #{inspect(reason)}")
          {:error, "Failed to update room: #{inspect(reason)}"}
      end
    else
      {:error, :not_found} ->
        {:error, :room_not_found}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Deletes a room by ID or key.

  Returns :ok or {:error, reason}
  """
  def delete_room(room_id) when is_binary(room_id) do
    with {:ok, entity} <- Registry.get(room_id),
         :ok <- validate_room_entity(entity) do
      case Spawner.despawn(room_id) do
        :ok ->
          Logger.info("[RoomManager] Deleted room: #{room_id}")
          :ok

        {:error, reason} ->
          Logger.error("[RoomManager] Delete failed: #{inspect(reason)}")
          {:error, reason}
      end
    else
      {:error, :not_found} ->
        {:error, :room_not_found}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Adds an exit from one room to another.

  ## Parameters
  - from_key: Source room key
  - direction: Exit direction (e.g., "north", "south")
  - to_key: Destination room key

  Returns {:ok, room_map} or {:error, reason}
  """
  def add_exit(from_key, direction, to_key) do
    with {:ok, room} <- get_room(from_key),
         {:ok, _destination} <- get_room(to_key) do
      exits = Map.put(room.exits, direction, to_key)
      update_room(from_key, %{exits: exits})
    end
  end

  @doc """
  Removes an exit from a room.

  Returns {:ok, room_map} or {:error, reason}
  """
  def remove_exit(from_key, direction) do
    with {:ok, room} <- get_room(from_key) do
      exits = Map.delete(room.exits, direction)
      update_room(from_key, %{exits: exits})
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp enrich_room_for_frontend(room) when is_struct(room, TypedObject) do
    # Extract coordinates from attributes for frontend
    x = TypedObject.get_attribute(room, :x, 0)
    y = TypedObject.get_attribute(room, :y, 0)
    z = TypedObject.get_attribute(room, :z, 0)

    # Return a map structure optimized for frontend rendering
    %{
      id: room.id,
      key: room.key,
      name: room.name || room.key,
      description: room.description || "",
      x: x,
      y: y,
      z: z,
      tags: room.tags || [],
      exits: get_room_exits(room)
    }
  end

  # Enrich an Entity struct (from Spawner.create_room) for frontend
  defp enrich_room_for_frontend_from_entity(%Entity{} = room) do
    # Extract coordinates from components
    coords = Map.get(room.components, "coordinates", %{})
    x = Map.get(coords, "x", 0)
    y = Map.get(coords, "y", 0)
    z = Map.get(coords, "z", 0)

    %{
      id: room.id,
      key: room.key,
      name: room.short_desc || room.key,
      description: room.extra_desc || "",
      x: x,
      y: y,
      z: z,
      tags: room.tags || [],
      exits: get_exits_from_entity(room)
    }
  end

  defp get_room_exits(room) do
    # Extract exit information from room components
    Map.get(room.components, "exits", %{})
  end

  defp get_exits_from_entity(_room) do
    # For newly created rooms, exits are stored as separate Entity structs
    # This will be populated by list_rooms which queries the database
    %{}
  end

  defp ensure_atom_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
      {k, v} when is_atom(k) -> {k, v}
    end)
  rescue
    ArgumentError ->
      # If atom doesn't exist, return original
      attrs
  end

  defp ensure_coordinates(attrs) do
    x = Map.get(attrs, :x, 0)
    y = Map.get(attrs, :y, 0)
    z = Map.get(attrs, :z, 0)

    # Store coordinates in attributes map for TypedObject
    current_attrs = Map.get(attrs, :attributes, %{})

    updated_attrs =
      current_attrs
      |> Map.put("x", x)
      |> Map.put("y", y)
      |> Map.put("z", z)

    Map.put(attrs, :attributes, updated_attrs)
  end

  defp prepare_updates(attrs) when is_map(attrs) do
    # Convert coordinates to attributes if provided
    attrs = ensure_atom_keys(attrs)

    if Map.has_key?(attrs, :x) || Map.has_key?(attrs, :y) || Map.has_key?(attrs, :z) do
      ensure_coordinates(attrs)
    else
      attrs
    end
  end

  defp validate_room_entity(%TypedObject{type: :entity, subtype: :room}), do: :ok
  defp validate_room_entity(_), do: {:error, :not_a_room}
end
