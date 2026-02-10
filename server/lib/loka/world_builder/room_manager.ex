defmodule Loka.WorldBuilder.RoomManager do
  @moduledoc """
  Room CRUD operations for the World Builder.

  Manages room creation, editing, and deletion using TypedObject as the underlying data structure.
  All operations persist to YAML files in priv/world/prototypes/rooms/ following the YAML-only
  architecture documented in docs/proposals/builder-content-layer.md.
  """

  require Logger

  alias Loka.Engine.{TypedObject, Spawner, Entity, Entities}
  alias Loka.Engine.TypedObject.Registry
  alias Loka.Engine.TypedObject.Loader

  @rooms_dir Path.join([:code.priv_dir(:loka), "world", "drafts", "prototypes", "rooms"])

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

    key = Map.get(attrs, :key)
    name = Map.get(attrs, :name, Map.get(attrs, :key, "New Room"))
    description = Map.get(attrs, :description, "A room in the world")
    exits = Map.get(attrs, :exits, %{})
    tags = Map.get(attrs, :tags, [])

    # Extract coordinates for attributes
    x = Map.get(attrs, :x, 0)
    y = Map.get(attrs, :y, 0)
    z = Map.get(attrs, :z, 0)

    # Build room data for YAML
    room_data = %{
      key: key,
      name: name,
      description: description,
      exits: exits,
      tags: tags,
      attributes: %{x: x, y: y, z: z}
    }

    # Save to YAML file
    case save_room_yaml(room_data) do
      :ok ->
        # Reload to get the room into the registry
        case Registry.get(key) do
          {:ok, room} ->
            Logger.info("[RoomManager] Created room: #{key}")
            {:ok, enrich_room_for_frontend(room)}

          {:error, _} ->
            # Room created but not yet in registry - build a response
            Logger.info("[RoomManager] Created room: #{key} (pending reload)")

            {:ok,
             %{
               id: key,
               key: key,
               name: name,
               description: description,
               x: x,
               y: y,
               z: z,
               tags: tags,
               exits: exits,
               spawns: %{npcs: [], items: []}
             }}
        end

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
      {:ok, {:registry, entity}} ->
        # Room is in Registry (YAML prototype) - update YAML file
        attrs = ensure_atom_keys(attrs)

        # Build updated room data from existing + new attrs
        existing_exits = get_room_exits(entity)
        existing_tags = entity.tags || []

        # Get existing coordinates from attributes or data
        existing_x =
          TypedObject.get_attribute(entity, :x) || TypedObject.get_data(entity, :x) || 0

        existing_y =
          TypedObject.get_attribute(entity, :y) || TypedObject.get_data(entity, :y) || 0

        existing_z =
          TypedObject.get_attribute(entity, :z) || TypedObject.get_data(entity, :z) || 0

        # Merge existing attributes with coordinate updates
        existing_attrs = entity.attributes || %{}

        updated_attrs =
          existing_attrs
          |> Map.put(:x, Map.get(attrs, :x, existing_x))
          |> Map.put(:y, Map.get(attrs, :y, existing_y))
          |> Map.put(:z, Map.get(attrs, :z, existing_z))

        room_data = %{
          key: entity.key,
          name: Map.get(attrs, :name, entity.name || entity.key),
          description: Map.get(attrs, :description, entity.description || ""),
          exits: Map.get(attrs, :exits, existing_exits),
          tags: Map.get(attrs, :tags, existing_tags),
          spawns: get_spawns_list(entity),
          components: get_components(entity),
          attributes: updated_attrs
        }

        case save_room_yaml(room_data) do
          :ok ->
            Logger.info("[RoomManager] Updated room (YAML): #{room_id}")
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
        # Room is in Registry - despawn and delete YAML file
        room_map = enrich_room_for_frontend(entity)

        # First delete the YAML file
        file_path = Path.join(@rooms_dir, "#{entity.key}.yml")

        file_result =
          if File.exists?(file_path) do
            File.rm(file_path)
          else
            :ok
          end

        # Then remove from registry
        despawn_result = Spawner.despawn(room_id)

        case {file_result, despawn_result} do
          {:ok, :ok} ->
            # Remove from registry to reflect deletion
            Loader.remove(entity.key)
            Logger.info("[RoomManager] Deleted room (registry + YAML): #{room_id}")
            {:ok, room_map}

          {:ok, {:error, :not_found}} ->
            # Room wasn't spawned but YAML was deleted
            Loader.remove(entity.key)
            Logger.info("[RoomManager] Deleted room (YAML only): #{room_id}")
            {:ok, room_map}

          {{:error, reason}, _} ->
            Logger.error("[RoomManager] Delete YAML failed: #{inspect(reason)}")
            {:error, reason}

          {_, {:error, reason}} ->
            Logger.error("[RoomManager] Despawn failed: #{inspect(reason)}")
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
    # Extract coordinates from attributes or data (YAML top-level fields go to data)
    x = TypedObject.get_attribute(room, :x) || TypedObject.get_data(room, :x) || 0
    y = TypedObject.get_attribute(room, :y) || TypedObject.get_data(room, :y) || 0
    z = TypedObject.get_attribute(room, :z) || TypedObject.get_data(room, :z) || 0

    # Extract spawns (NPCs and items that spawn in this room)
    spawns = get_room_spawns(room)

    # Return a map structure optimized for frontend rendering
    # Use key as id for YAML rooms since they don't have a separate id
    %{
      id: room.id || room.key,
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

  # =============================================================================
  # YAML Persistence
  # =============================================================================

  defp save_room_yaml(room_data) do
    with :ok <- validate_safe_key(room_data.key) do
      ensure_rooms_dir()

      file_path = Path.join(@rooms_dir, "#{room_data.key}.yml")
      yaml_content = build_room_yaml(room_data)

      case File.write(file_path, yaml_content) do
        :ok ->
          # Reload to update registry
          Loader.reload_file(file_path)
          :ok

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp build_room_yaml(room_data) do
    key = room_data.key
    name = room_data.name || key
    description = room_data.description || ""
    exits = room_data[:exits] || %{}
    tags = room_data[:tags] || []
    spawns = room_data[:spawns] || []
    components = room_data[:components] || %{}
    attributes = room_data[:attributes] || %{}

    # Build YAML content
    yaml = """
    key: #{key}
    parent: base_room
    type: room
    short_desc: "#{escape_yaml_string(name)}"
    long_desc: "#{escape_yaml_string(description)}"
    extra_desc: |
    #{indent_multiline(description, 2)}
    keywords: []
    """

    # Add exits if any
    yaml =
      if map_size(exits) > 0 do
        exits_yaml =
          exits
          |> Enum.map(fn {dir, dest} -> "  #{dir}: #{dest}" end)
          |> Enum.join("\n")

        yaml <> "exits:\n" <> exits_yaml <> "\n"
      else
        yaml <> "exits: {}\n"
      end

    # Add spawns if any
    yaml =
      if length(spawns) > 0 do
        spawns_yaml =
          spawns
          |> Enum.map(fn spawn ->
            prototype = spawn["prototype"] || spawn[:prototype] || spawn
            "  - prototype: #{prototype}"
          end)
          |> Enum.join("\n")

        yaml <> "spawns:\n" <> spawns_yaml <> "\n"
      else
        yaml
      end

    # Add tags
    yaml =
      if length(tags) > 0 do
        tags_yaml = tags |> Enum.map(&"  - #{&1}") |> Enum.join("\n")
        yaml <> "tags:\n" <> tags_yaml <> "\n"
      else
        yaml <> "tags: []\n"
      end

    # Add components if any (preserve ambient_messages, etc.)
    yaml =
      if map_size(components) > 0 do
        yaml <> "components:\n" <> build_components_yaml(components, 2)
      else
        yaml
      end

    # Add attributes if any (coordinates, room effects, etc.)
    yaml =
      if map_size(attributes) > 0 do
        yaml <> "attributes:\n" <> build_attributes_yaml(attributes, 2)
      else
        yaml
      end

    yaml
  end

  defp build_attributes_yaml(attributes, indent) when is_map(attributes) do
    prefix = String.duplicate(" ", indent)

    attributes
    |> Enum.map(fn {key, value} ->
      key_str = if is_atom(key), do: Atom.to_string(key), else: key

      if is_map(value) do
        "#{prefix}#{key_str}:\n#{build_yaml_value(value, indent + 2)}"
      else
        "#{prefix}#{key_str}: #{format_inline_value(value)}\n"
      end
    end)
    |> Enum.join("")
  end

  defp build_components_yaml(components, indent) when is_map(components) do
    prefix = String.duplicate(" ", indent)

    components
    |> Enum.map(fn {key, value} ->
      "#{prefix}#{key}:\n#{build_yaml_value(value, indent + 2)}"
    end)
    |> Enum.join("")
  end

  defp build_yaml_value(value, indent) when is_map(value) do
    prefix = String.duplicate(" ", indent)

    value
    |> Enum.map(fn {k, v} ->
      if is_list(v) do
        "#{prefix}#{k}:\n#{build_yaml_list(v, indent + 2)}"
      else
        "#{prefix}#{k}: #{format_inline_value(v)}\n"
      end
    end)
    |> Enum.join("")
  end

  defp build_yaml_value(value, indent) when is_list(value) do
    build_yaml_list(value, indent)
  end

  defp build_yaml_value(value, indent) do
    prefix = String.duplicate(" ", indent)
    "#{prefix}#{format_inline_value(value)}\n"
  end

  defp build_yaml_list(items, indent) when is_list(items) do
    prefix = String.duplicate(" ", indent)

    items
    |> Enum.map(fn item ->
      if is_binary(item) do
        "#{prefix}- \"#{escape_yaml_string(item)}\"\n"
      else
        "#{prefix}- #{format_inline_value(item)}\n"
      end
    end)
    |> Enum.join("")
  end

  defp format_inline_value(value) when is_binary(value), do: "\"#{escape_yaml_string(value)}\""
  defp format_inline_value(value) when is_integer(value), do: Integer.to_string(value)
  defp format_inline_value(value) when is_float(value), do: Float.to_string(value)
  defp format_inline_value(value) when is_boolean(value), do: Atom.to_string(value)
  defp format_inline_value(value) when is_nil(value), do: "null"
  defp format_inline_value(value) when is_atom(value), do: Atom.to_string(value)
  defp format_inline_value(value), do: inspect(value)

  defp escape_yaml_string(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp escape_yaml_string(_), do: ""

  defp indent_multiline(text, spaces) when is_binary(text) do
    prefix = String.duplicate(" ", spaces)

    text
    |> String.trim()
    |> String.split("\n")
    |> Enum.map(fn line ->
      trimmed = String.trim(line)
      if trimmed == "", do: "", else: "#{prefix}#{trimmed}"
    end)
    |> Enum.join("\n")
    |> String.trim_trailing()
  end

  defp indent_multiline(_, _), do: ""

  defp validate_safe_key(key) when is_binary(key) do
    # Prevent path traversal attacks
    if String.contains?(key, [".", "/", "\\"]) do
      {:error, "Invalid key: contains illegal characters"}
    else
      :ok
    end
  end

  defp validate_safe_key(_), do: {:error, "Invalid key: must be a string"}

  defp ensure_rooms_dir do
    unless File.exists?(@rooms_dir) do
      File.mkdir_p!(@rooms_dir)
    end
  end

  # Extract spawns list from TypedObject
  defp get_spawns_list(room) when is_struct(room, TypedObject) do
    Map.get(room.data, "spawns", []) ++ Map.get(room.data, :spawns, [])
  end

  # Extract components from TypedObject (preserving ambient_messages, etc.)
  defp get_components(room) when is_struct(room, TypedObject) do
    # Get from data.components or direct components
    data_components = Map.get(room.data, "components", %{}) |> ensure_map()
    atom_components = Map.get(room.data, :components, %{}) |> ensure_map()
    Map.merge(data_components, atom_components)
  end

  defp ensure_map(val) when is_map(val), do: val
  defp ensure_map(_), do: %{}
end
