defmodule Loka.WorldBuilder.RoomManager do
  @moduledoc """
  Room CRUD operations for the World Builder.

  Manages room creation, editing, and deletion using Entity as the underlying data structure.
  All operations persist to the entity database (V2 single source of truth).
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}

  @doc """
  Lists all rooms in the world.

  Returns a list of room maps suitable for the World Builder UI.
  """
  def list_rooms do
    Entities.find_all(type: :room, is_prototype: true)
    |> Enum.map(&enrich_room_for_frontend_from_entity/1)
  end

  @doc """
  Gets a room by ID or key.

  Returns {:ok, room_map} or {:error, :not_found}
  """
  def get_room(room_id) when is_binary(room_id) do
    case get_room_entity(room_id) do
      {:ok, entity} ->
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

    # Prevent duplicate room keys — rooms are prototypes and should be unique
    if key && match?({:ok, _}, Entities.find_one(key: key, type: :room)) do
      {:error, "Room '#{key}' already exists."}
    else
      do_create_room(attrs, key)
    end
  end

  defp do_create_room(attrs, key) do
    name = Map.get(attrs, :name, Map.get(attrs, :key, "New Room"))
    description = Map.get(attrs, :description, "A room in the world")
    exits = Map.get(attrs, :exits, %{})
    tags = Map.get(attrs, :tags, [])

    x = Map.get(attrs, :x, 0)
    y = Map.get(attrs, :y, 0)
    z = Map.get(attrs, :z, 0)

    room_entity =
      Entity.new(
        type: :room,
        key: key,
        short_desc: name,
        extra_desc: description,
        is_prototype: true,
        tags: tags,
        components:
          %{
            "coordinates" => %{"x" => x, "y" => y, "z" => z}
          }
          |> then(fn c ->
            if exits != %{} do
              string_exits = Map.new(exits, fn {k, v} -> {to_string(k), v} end)
              Map.put(c, "exits", string_exits)
            else
              c
            end
          end),
        metadata: %{"draft" => true}
      )

    case Entities.save(room_entity) do
      {:ok, schema} ->
        saved = Entities.to_entity(schema)
        for tag <- tags, do: Entities.add_tag(saved.id, tag)
        saved = %{saved | tags: tags}

        Logger.info("[RoomManager] Created room: #{key}")
        {:ok, enrich_room_for_frontend_from_entity(saved)}

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
      {:ok, entity} ->
        attrs = ensure_atom_keys(attrs)

        case Entities.get_entity_by_key(entity.key) do
          %{type: :room} = schema ->
            db_updates = prepare_db_updates(attrs)

            case Entities.update_entity(schema, db_updates) do
              {:ok, _} ->
                Logger.info("[RoomManager] Updated room: #{room_id}")
                get_room(room_id)

              {:error, reason} ->
                Logger.error("[RoomManager] Update failed: #{inspect(reason)}")
                {:error, "Failed to update room: #{inspect(reason)}"}
            end

          _ ->
            {:error, "Room entity not found in DB"}
        end

      {:error, :not_a_room} ->
        {:error, :not_a_room}

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc """
  Deletes a room by ID or key.

  Returns {:ok, room_map} or {:error, reason}
  """
  def delete_room(room_id) when is_binary(room_id) do
    case get_room_entity(room_id) do
      {:ok, entity} ->
        room_map = enrich_room_for_frontend_from_entity(entity)

        # Clean up exit entities associated with this room
        cleanup_exit_entities(entity.key, room_map)

        # Delete the DB entity
        case Entities.get_entity_by_key(entity.key) do
          %{type: :room} = schema ->
            Entities.delete_entity(schema)

          _ ->
            :ok
        end

        Logger.info("[RoomManager] Deleted room: #{room_id}")
        {:ok, room_map}

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

      case update_room(from_key, %{exits: exits}) do
        {:ok, _} = result ->
          case spawn_exit_entity(from_key, direction, to_key) do
            :ok -> result
            {:error, reason} -> {:error, "Exit saved but entity spawn failed: #{reason}"}
          end

        error ->
          error
      end
    end
  end

  @doc """
  Removes an exit from a room.

  Returns {:ok, room_map} or {:error, reason}
  """
  def remove_exit(from_key, direction) do
    with {:ok, room} <- get_room(from_key) do
      exits = Map.delete(room.exits, direction)

      case update_room(from_key, %{exits: exits}) do
        {:ok, _} = result ->
          despawn_exit_entity(from_key, direction)
          result

        error ->
          error
      end
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp spawn_exit_entity(from_key, direction, to_key) do
    with %{type: :room} = from_schema <- Entities.get_entity_by_key(from_key),
         %{type: :room} = to_schema <- Entities.get_entity_by_key(to_key) do
      from_room = Entities.to_entity(from_schema)
      to_room = Entities.to_entity(to_schema)
      exit_key = "exit_#{from_key}_#{direction}"

      # Don't duplicate if exit already exists
      case Entities.get_entity_by_key(exit_key) do
        nil ->
          exit_entity = %Entity{
            id: UUID.uuid4(),
            type: :exit,
            key: exit_key,
            short_desc: String.capitalize(direction),
            long_desc: "An exit leading #{direction}.",
            extra_desc: "An exit leading #{direction}.",
            keywords: [direction],
            location_id: from_room.id,
            components: %{
              "exit" => %{
                "direction" => direction,
                "destination_id" => to_room.id,
                "destination_key" => to_key
              }
            },
            metadata: %{
              "draft" => true,
              created_at: DateTime.utc_now(),
              updated_at: DateTime.utc_now()
            }
          }

          case Entities.save_entity(exit_entity) do
            {:ok, _} ->
              :ok

            {:error, reason} ->
              Logger.warning("[RoomManager] Failed to spawn exit: #{inspect(reason)}")
              {:error, inspect(reason)}
          end

        _ ->
          :ok
      end
    else
      _ ->
        Logger.warning("[RoomManager] Could not find rooms for exit: #{from_key} -> #{to_key}")

        {:error, "source or destination room not found in DB"}
    end
  end

  defp despawn_exit_entity(from_key, direction) do
    exit_key = "exit_#{from_key}_#{direction}"

    case Entities.get_entity_by_key(exit_key) do
      %{} = schema -> Entities.delete_entity(schema)
      nil -> :ok
    end
  end

  # Clean up all exit entities associated with a deleted room
  defp cleanup_exit_entities(room_key, room_map) do
    # Delete exit entities FROM this room (exit_<room_key>_<direction>)
    exits = room_map[:exits] || %{}

    Enum.each(exits, fn {direction, _dest} ->
      despawn_exit_entity(room_key, direction)
    end)

    # Delete exit entities in OTHER rooms that point TO this room
    Entities.list_by_type(:exit)
    |> Enum.filter(fn exit_schema ->
      exit_entity = Entities.to_entity(exit_schema)
      dest_key = get_in(exit_entity.components, ["exit", "destination_key"])
      dest_key == room_key
    end)
    |> Enum.each(fn exit_schema ->
      Entities.delete_entity(exit_schema)
    end)
  end

  # Enrich an Entity struct for frontend
  defp enrich_room_for_frontend_from_entity(%Entity{} = room) do
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
      description: String.trim_trailing(room.extra_desc || ""),
      x: x,
      y: y,
      z: z,
      tags: room.tags || [],
      exits: get_exits_from_entity(room),
      spawns: spawns
    }
  end

  defp get_exits_from_entity(%Entity{} = room) do
    Map.get(room.components, "exits", %{})
  end

  # Categorize spawns into NPCs and items
  defp categorize_spawns(spawns) when is_list(spawns) do
    {npcs, items} =
      Enum.reduce(spawns, {[], []}, fn spawn, {npc_acc, item_acc} ->
        prototype = Map.get(spawn, "prototype") || Map.get(spawn, :prototype)

        if prototype do
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

  defp determine_spawn_type(prototype_key) do
    case Entities.find_one(key: prototype_key) do
      {:ok, %Entity{type: :npc}} ->
        :npc

      {:ok, %Entity{type: :item}} ->
        :item

      _ ->
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
      attrs
  end

  @doc false
  defp get_room_entity(room_id) when is_binary(room_id) do
    # Try by key first
    case Entities.find_one(key: room_id, type: :room) do
      {:ok, entity} ->
        {:ok, entity}

      {:error, :not_found} ->
        # Try by UUID
        case Entities.get_entity(room_id) do
          %{type: :room} = schema ->
            {:ok, Entities.to_entity(schema)}

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
