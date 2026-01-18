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
    case get_room_entity(room_id) do
      {:ok, {:registry, entity}} ->
        {:ok, enrich_room_for_frontend(entity)}

      {:ok, {:db, entity_schema}} ->
        entity = Entities.to_entity(entity_schema)
        {:ok, enrich_room_for_frontend_from_entity(entity)}

      {:error, :not_a_room} ->
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

    # Build exits component if provided
    exits = Map.get(attrs, :exits, %{})
    # Convert atom keys to string keys for exits
    exits = for {k, v} <- exits, into: %{}, do: {to_string(k), v}

    components = if map_size(exits) > 0, do: %{"exits" => exits}, else: %{}

    # Build keyword list for Spawner.create_room
    create_attrs = [
      key: Map.get(attrs, :key),
      name: Map.get(attrs, :name, Map.get(attrs, :key, "New Room")),
      description: Map.get(attrs, :description, "A room in the world"),
      x: Map.get(attrs, :x, 0),
      y: Map.get(attrs, :y, 0),
      z: Map.get(attrs, :z, 0),
      tags: Map.get(attrs, :tags, []),
      components: components
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
    case get_room_entity(room_id) do
      {:ok, {:registry, _entity}} ->
        # Room is in Registry (YAML prototype) - use EntityServer
        updates = prepare_updates(attrs)

        case EntityServer.update(room_id, updates) do
          {:ok, _} ->
            Logger.info("[RoomManager] Updated room (registry): #{room_id}")
            get_room(room_id)

          {:error, reason} ->
            Logger.error("[RoomManager] Update failed: #{inspect(reason)}")
            {:error, "Failed to update room: #{inspect(reason)}"}
        end

      {:ok, {:db, entity_schema}} ->
        # Room is in DB - use Entities.update_entity directly
        updates = prepare_db_updates(attrs)

        case Entities.update_entity(entity_schema, updates) do
          {:ok, updated_schema} ->
            Logger.info("[RoomManager] Updated room (db): #{room_id}")
            entity = Entities.to_entity(updated_schema)
            {:ok, enrich_room_for_frontend_from_entity(entity)}

          {:error, reason} ->
            Logger.error("[RoomManager] Update failed: #{inspect(reason)}")
            {:error, "Failed to update room: #{inspect(reason)}"}
        end

      {:error, :not_a_room} ->
        {:error, :not_a_room}

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc """
  Deletes a room by ID or key.

  Returns :ok or {:error, reason}
  """
  def delete_room(room_id) when is_binary(room_id) do
    case get_room_entity(room_id) do
      {:ok, {:registry, entity}} ->
        # Room is in Registry - use Spawner.despawn
        case Spawner.despawn(room_id) do
          :ok ->
            Logger.info("[RoomManager] Deleted room (registry): #{room_id}")
            {:ok, enrich_room_for_frontend(entity)}

          {:error, reason} ->
            Logger.error("[RoomManager] Delete failed: #{inspect(reason)}")
            {:error, reason}
        end

      {:ok, {:db, entity_schema}} ->
        # Room is in DB - use Entities.delete_entity
        entity = Entities.to_entity(entity_schema)
        room_map = enrich_room_for_frontend_from_entity(entity)

        case Entities.delete_entity(entity_schema) do
          {:ok, _} ->
            Logger.info("[RoomManager] Deleted room (db): #{room_id}")
            {:ok, room_map}

          {:error, reason} ->
            Logger.error("[RoomManager] Delete failed: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, :not_a_room} ->
        {:error, :not_a_room}

      {:error, :not_found} ->
        {:error, :not_found}
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

    # Extract spawns (NPCs and items that spawn in this room)
    spawns = get_room_spawns(room)

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
      exits: get_room_exits(room),
      spawns: spawns
    }
  end

  # Enrich an Entity struct (from Spawner.create_room) for frontend
  defp enrich_room_for_frontend_from_entity(%Entity{} = room) do
    # Extract coordinates from components
    coords = Map.get(room.components, "coordinates", %{})
    x = Map.get(coords, "x", 0)
    y = Map.get(coords, "y", 0)
    z = Map.get(coords, "z", 0)

    # Extract spawns from components
    spawns = Map.get(room.components, "spawns", [])
    spawns = categorize_spawns(spawns)

    %{
      id: room.id,
      key: room.key,
      name: room.short_desc || room.key,
      description: room.extra_desc || "",
      x: x,
      y: y,
      z: z,
      tags: room.tags || [],
      exits: get_exits_from_entity(room),
      spawns: spawns
    }
  end

  defp get_room_exits(room) when is_struct(room, TypedObject) do
    # For TypedObject rooms, exits are in room.data (from YAML)
    # Try both atom and string keys since YAML parsing may vary
    exits =
      case {Map.get(room.data, :exits), Map.get(room.data, "exits")} do
        {nil, nil} -> %{}
        {nil, exits} -> exits
        {exits, nil} -> exits
        {atom_exits, string_exits} -> Map.merge(atom_exits, string_exits)
      end

    # Normalize keys to strings for frontend
    for {k, v} <- exits, into: %{}, do: {to_string(k), v}
  end

  defp get_exits_from_entity(%Entity{} = room) do
    # Get exits from components first
    component_exits = Map.get(room.components, "exits", %{})

    if map_size(component_exits) > 0 do
      component_exits
    else
      # Fallback: get exits from the TypedObject prototype
      case Registry.get(room.key) do
        {:ok, prototype} when is_struct(prototype, TypedObject) ->
          get_room_exits(prototype)

        _ ->
          %{}
      end
    end
  end

  # Extract spawns from TypedObject room
  defp get_room_spawns(room) when is_struct(room, TypedObject) do
    spawns = Map.get(room.data, "spawns", []) ++ Map.get(room.data, :spawns, [])
    categorize_spawns(spawns)
  end

  # Categorize spawns into NPCs and items
  defp categorize_spawns(spawns) when is_list(spawns) do
    {npcs, items} =
      Enum.reduce(spawns, {[], []}, fn spawn, {npc_acc, item_acc} ->
        prototype = Map.get(spawn, "prototype") || Map.get(spawn, :prototype)

        if prototype do
          # Try to determine type from prototype name or lookup
          case determine_spawn_type(prototype) do
            :npc -> {[prototype | npc_acc], item_acc}
            :item -> {npc_acc, [prototype | item_acc]}
            _ -> {npc_acc, item_acc}
          end
        else
          {npc_acc, item_acc}
        end
      end)

    %{npcs: Enum.reverse(npcs), items: Enum.reverse(items)}
  end

  defp categorize_spawns(_), do: %{npcs: [], items: []}

  # Determine spawn type by looking up the prototype
  defp determine_spawn_type(prototype_key) do
    case Registry.get(prototype_key) do
      {:ok, %TypedObject{subtype: :npc}} ->
        :npc

      {:ok, %TypedObject{subtype: :item}} ->
        :item

      _ ->
        # Fallback: guess from common naming patterns
        cond do
          String.contains?(prototype_key, [
            "_ghost",
            "_spirit",
            "_monk",
            "_elder",
            "_guard",
            "_merchant",
            "_npc"
          ]) ->
            :npc

          String.contains?(prototype_key, [
            "_key",
            "_sword",
            "_scroll",
            "_potion",
            "_item",
            "_treasure"
          ]) ->
            :item

          # Default to NPC since most spawns are NPCs
          true ->
            :npc
        end
    end
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

  @doc false
  # Gets a room entity from either Registry (YAML) or Database.
  # Returns {:ok, {:registry, TypedObject}} or {:ok, {:db, EntitySchema}} or {:error, reason}
  defp get_room_entity(room_id) when is_binary(room_id) do
    # First try Registry (YAML prototypes)
    case Registry.get(room_id) do
      {:ok, entity} when entity.subtype == :room ->
        {:ok, {:registry, entity}}

      {:ok, _entity} ->
        {:error, :not_a_room}

      {:error, :not_found} ->
        # Not in Registry, try Database
        get_room_from_db(room_id)
    end
  end

  defp get_room_from_db(room_id) do
    # Try by ID first, then by key
    case Entities.get_entity(room_id) do
      %{type: :room} = schema ->
        {:ok, {:db, schema}}

      %{} ->
        {:error, :not_a_room}

      nil ->
        # Try by key
        case Entities.get_entity_by_key(room_id) do
          %{type: :room} = schema ->
            {:ok, {:db, schema}}

          %{} ->
            {:error, :not_a_room}

          nil ->
            {:error, :not_found}
        end
    end
  end

  # Prepare updates for DB entities (EntitySchema format)
  defp prepare_db_updates(attrs) when is_map(attrs) do
    attrs = ensure_atom_keys(attrs)

    # Map WorldBuilder fields to EntitySchema fields
    updates = %{}

    updates =
      if Map.has_key?(attrs, :name),
        do: Map.put(updates, :short_desc, attrs[:name]),
        else: updates

    updates =
      if Map.has_key?(attrs, :description),
        do: Map.put(updates, :extra_desc, attrs[:description]),
        else: updates

    updates =
      if Map.has_key?(attrs, :tags), do: Map.put(updates, :tags, attrs[:tags]), else: updates

    # Handle coordinates - store in components
    updates =
      if Map.has_key?(attrs, :x) || Map.has_key?(attrs, :y) || Map.has_key?(attrs, :z) do
        coords = %{
          "x" => Map.get(attrs, :x, 0),
          "y" => Map.get(attrs, :y, 0),
          "z" => Map.get(attrs, :z, 0)
        }

        existing_components = Map.get(updates, :components, %{})
        Map.put(updates, :components, Map.put(existing_components, "coordinates", coords))
      else
        updates
      end

    # Handle exits if provided
    updates =
      if Map.has_key?(attrs, :exits) do
        existing_components = Map.get(updates, :components, %{})
        Map.put(updates, :components, Map.put(existing_components, "exits", attrs[:exits]))
      else
        updates
      end

    updates
  end
end
