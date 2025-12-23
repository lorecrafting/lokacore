defmodule Exmud.Engine.Spawner do
  @moduledoc """
  Create entities from prototype templates.

  The Spawner bridges prototypes (templates) and entities (database records). It:
  - Creates new entities from prototype definitions
  - Persists entities to the database
  - Handles location placement
  - Supports overrides for customization

  ## Usage

      # Spawn a goblin at a location
      {:ok, entity} = Spawner.spawn("goblin_warrior", location_id: room_id)

      # Spawn with overrides
      {:ok, entity} = Spawner.spawn("goblin_warrior",
        location_id: room_id,
        name: "Goblin Champion",
        components: %{"combatant" => %{"level" => 5}}
      )

      # Spawn an entire room with its contents
      {:ok, room, spawned} = Spawner.spawn_room("forest_clearing")
  """

  alias Exmud.Engine.{Prototype, PrototypeLoader, Entities, Entity, Hooks}
  alias Exmud.Engine.Schema.EntitySchema

  require Logger

  @doc """
  Spawns an entity from a prototype.

  ## Options

  - `:location_id` - Place entity at this location
  - `:name` - Override the prototype's name
  - `:description` - Override the prototype's description
  - `:components` - Deep-merge with prototype components
  - `:attributes` - Deep-merge with prototype attributes
  - `:tags` - Append to prototype tags

  ## Examples

      {:ok, entity} = Spawner.spawn("goblin_warrior")
      {:ok, entity} = Spawner.spawn("goblin_warrior", location_id: room_id)
      {:ok, entity} = Spawner.spawn("goblin_warrior", name: "Elite Goblin")
  """
  @spec spawn(String.t(), keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def spawn(prototype_key, opts \\ []) do
    with {:ok, prototype} <- PrototypeLoader.get(prototype_key) do
      overrides = build_overrides(prototype, opts)
      entity = Prototype.to_entity(prototype, overrides)

      # Generate unique entity key to avoid collisions
      entity = ensure_unique_key(entity)

      case Entities.save_entity(entity) do
        {:ok, schema} ->
          saved_entity = Entities.to_entity(schema)
          Logger.debug("Spawned entity #{saved_entity.id} from prototype #{prototype_key}")
          {:ok, saved_entity}

        {:error, changeset} ->
          {:error, {:save_failed, changeset}}
      end
    end
  end

  @doc """
  Convenience function to spawn an entity at a specific location.

  ## Examples

      {:ok, entity} = Spawner.spawn_at("goblin_warrior", room_id)
      {:ok, entity} = Spawner.spawn_at("goblin_warrior", room_id, name: "Boss Goblin")
  """
  @spec spawn_at(String.t(), String.t(), keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def spawn_at(prototype_key, location_id, opts \\ []) do
    opts = Keyword.put(opts, :location_id, location_id)
    spawn(prototype_key, opts)
  end

  @doc """
  Spawns a room and all its contents (exits and spawned entities).

  Rooms can define exits and spawns in their prototype:

      # room prototype
      exits:
        north: "other_room"      # Creates an exit to another room
      spawns:
        - prototype: goblin      # Spawns a goblin in this room
        - prototype: torch
          name: "Flickering Torch"

  Returns `{:ok, room_entity, spawned_entities}` where `spawned_entities` is a
  list of all entities created (exits, NPCs, items).

  ## Options

  - `:link_exits` - Whether to link exits to their destinations (default: false)
  - `:spawn_destinations` - Whether to spawn destination rooms for exits (default: false)

  ## Examples

      {:ok, room, spawned} = Spawner.spawn_room("town_square")
  """
  @spec spawn_room(String.t(), keyword()) :: {:ok, Entity.t(), [Entity.t()]} | {:error, term()}
  def spawn_room(room_prototype_key, opts \\ []) do
    with {:ok, prototype} <- PrototypeLoader.get(room_prototype_key),
         :ok <- validate_room_prototype(prototype) do
      overrides = build_overrides(prototype, opts)
      room_entity = Prototype.to_entity(prototype, overrides)
      # Rooms keep their prototype key (unique per room type)
      # Don't call ensure_unique_key for rooms

      case Entities.save_entity(room_entity) do
        {:ok, room_schema} ->
          room = Entities.to_entity(room_schema)
          spawned = spawn_room_contents(room, prototype, opts)
          Logger.info("Spawned room #{room.id} (#{room.key}) with #{length(spawned)} entities")
          {:ok, room, spawned}

        {:error, changeset} ->
          {:error, {:save_failed, changeset}}
      end
    end
  end

  @doc """
  Despawns (deletes) an entity from the database.

  Accepts an entity ID string, Entity struct, or EntitySchema struct.

  ## Examples

      :ok = Spawner.despawn(entity_id)
      :ok = Spawner.despawn(entity_struct)
      {:error, :not_found} = Spawner.despawn("nonexistent-id")
  """
  @spec despawn(String.t() | Entity.t() | EntitySchema.t()) :: :ok | {:error, term()}
  def despawn(entity_id) when is_binary(entity_id) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:error, :not_found}

      schema ->
        case Entities.delete_entity(schema) do
          {:ok, _} ->
            Logger.debug("Despawned entity #{entity_id}")
            :ok

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  def despawn(%Entity{id: id}), do: despawn(id)
  def despawn(%EntitySchema{id: id}), do: despawn(id)

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp build_overrides(prototype, opts) do
    overrides =
      opts
      |> Keyword.take([:name, :description, :location_id, :components, :attributes, :tags])
      |> Map.new()

    # Deep merge components and attributes with prototype values
    overrides
    |> maybe_deep_merge(:components, prototype.components, Map.get(overrides, :components))
    |> maybe_deep_merge(:attributes, prototype.attributes, Map.get(overrides, :attributes))
  end

  defp maybe_deep_merge(overrides, _field, _base, nil), do: overrides

  defp maybe_deep_merge(overrides, field, base, additions)
       when is_map(base) and is_map(additions) do
    Map.put(overrides, field, deep_merge(base, additions))
  end

  defp maybe_deep_merge(overrides, _field, _base, _additions), do: overrides

  defp deep_merge(base, override) when is_map(base) and is_map(override) do
    Map.merge(base, override, fn
      _key, base_val, override_val when is_map(base_val) and is_map(override_val) ->
        deep_merge(base_val, override_val)

      _key, _base_val, override_val ->
        override_val
    end)
  end

  defp deep_merge(_base, override), do: override

  defp ensure_unique_key(%Entity{key: key} = entity) do
    # Generate a unique key by appending a short UUID suffix
    # This ensures multiple spawns from the same prototype don't collide
    short_id = entity.id |> String.split("-") |> List.first()
    %{entity | key: "#{key}_#{short_id}"}
  end

  defp validate_room_prototype(%Prototype{type: :room}), do: :ok

  defp validate_room_prototype(%Prototype{type: type}) do
    {:error, {:invalid_type, "spawn_room requires a room prototype, got: #{type}"}}
  end

  defp spawn_room_contents(room, prototype, opts) do
    exits = spawn_exits(room, prototype.exits, opts)
    spawns = spawn_entities(room, prototype.spawns, opts)
    exits ++ spawns
  end

  defp spawn_exits(_room, exits, _opts) when exits == %{} or is_nil(exits), do: []

  defp spawn_exits(room, exits, _opts) when is_map(exits) do
    Enum.flat_map(exits, fn {direction, destination} ->
      case spawn_exit(room, direction, destination) do
        {:ok, exit_entity} ->
          [exit_entity]

        {:error, reason} ->
          Logger.warning("Failed to spawn exit #{direction}: #{inspect(reason)}")
          []
      end
    end)
  end

  defp spawn_exit(room, direction, destination) when is_binary(destination) do
    direction_str = to_string(direction)

    # Check if there's an exit prototype, otherwise create inline
    exit_key = "exit_#{room.key}_#{direction_str}"

    exit_entity = %Entity{
      id: UUID.uuid4(),
      type: :exit,
      key: exit_key,
      name: String.capitalize(direction_str),
      description: "An exit leading #{direction_str}.",
      location_id: room.id,
      # Store exit data in components (which are properly persisted as JSON)
      components: %{
        "exit" => %{
          "direction" => direction_str,
          "destination_key" => destination
        }
      },
      behaviors: [],
      attributes: %{},
      tags: ["exit"],
      scripts: %{},
      locks: %{},
      metadata: %{
        created_at: DateTime.utc_now(),
        updated_at: DateTime.utc_now()
      }
    }

    case Entities.save_entity(exit_entity) do
      {:ok, schema} ->
        exit = Entities.to_entity(schema)
        Hooks.run(:at_entity_creation, [exit, %{created_by: "spawner"}])
        {:ok, exit}

      {:error, changeset} ->
        {:error, {:save_failed, changeset}}
    end
  end

  defp spawn_exit(room, direction, %{} = exit_config) do
    # Exit defined as a map with more configuration
    direction_str = to_string(direction)
    exit_key = Map.get(exit_config, "key", "exit_#{room.key}_#{direction_str}")
    destination = Map.get(exit_config, "destination", Map.get(exit_config, "destination_key"))

    # Merge exit data into components
    base_components = %{
      "exit" => %{
        "direction" => direction_str,
        "destination_key" => destination
      }
    }

    components = deep_merge(base_components, Map.get(exit_config, "components", %{}))

    exit_entity = %Entity{
      id: UUID.uuid4(),
      type: :exit,
      key: exit_key,
      name: Map.get(exit_config, "name", String.capitalize(direction_str)),
      description: Map.get(exit_config, "description", "An exit leading #{direction_str}."),
      location_id: room.id,
      components: components,
      behaviors: [],
      attributes: %{},
      tags: ["exit"] ++ Map.get(exit_config, "tags", []),
      scripts: %{},
      locks: Map.get(exit_config, "locks", %{}),
      metadata: %{
        created_at: DateTime.utc_now(),
        updated_at: DateTime.utc_now()
      }
    }

    case Entities.save_entity(exit_entity) do
      {:ok, schema} ->
        exit = Entities.to_entity(schema)
        Hooks.run(:at_entity_creation, [exit, %{created_by: "spawner"}])
        {:ok, exit}

      {:error, changeset} ->
        {:error, {:save_failed, changeset}}
    end
  end

  defp spawn_entities(_room, spawns, _opts) when spawns == [] or is_nil(spawns), do: []

  defp spawn_entities(room, spawns, _opts) when is_list(spawns) do
    Enum.flat_map(spawns, fn spawn_config ->
      case spawn_entity_from_config(room, spawn_config) do
        {:ok, entity} ->
          [entity]

        {:error, reason} ->
          Logger.warning("Failed to spawn entity: #{inspect(reason)}")
          []
      end
    end)
  end

  defp spawn_entity_from_config(room, %{"prototype" => prototype_key} = config) do
    overrides =
      config
      |> Map.drop(["prototype"])
      |> Map.put("location_id", room.id)

    # Convert string keys to atom keys for overrides
    overrides =
      Map.new(overrides, fn
        {"name", v} -> {:name, v}
        {"description", v} -> {:description, v}
        {"location_id", v} -> {:location_id, v}
        {"components", v} -> {:components, v}
        {"attributes", v} -> {:attributes, v}
        {"tags", v} -> {:tags, v}
        {k, v} -> {k, v}
      end)

    spawn(prototype_key, Map.to_list(overrides))
  end

  defp spawn_entity_from_config(room, %{prototype: _} = config) do
    # Handle atom keys by converting to string keys
    string_config = Map.new(config, fn {k, v} -> {to_string(k), v} end)
    spawn_entity_from_config(room, string_config)
  end

  defp spawn_entity_from_config(_room, config) do
    {:error, {:invalid_spawn_config, "spawn config must have a 'prototype' key", config}}
  end

  # =============================================================================
  # Template Spawning
  # =============================================================================

  @doc """
  Spawns an entity from a template prototype.

  Templates (prototypes with `is_template: true`) are designed for multiple
  instantiation, unlike regular prototypes which are singletons. Each spawn
  from a template gets a unique key.

  This is useful for creating reusable room patterns (corridors, cells,
  guard rooms) that can be placed multiple times in the map editor.

  ## Options

  - `:key` - Custom key for the instance (auto-generated if not provided)
  - `:name` - Override the template's name
  - `:description` - Override the template's description
  - `:x`, `:y`, `:z` - Coordinates for room templates (default: 0, 0, 0)
  - `:tags` - Additional tags to merge with template tags
  - `:components` - Additional components to merge with template components
  - `:location_id` - Location for non-room entities

  ## Examples

      # Spawn from a room template
      {:ok, room} = Spawner.spawn_from_template("stone_corridor", x: 5, y: 3)

      # Spawn with custom name
      {:ok, room} = Spawner.spawn_from_template("prison_cell",
        name: "Cell Block A - Cell 1",
        x: 10, y: 5
      )

      # Spawn NPC template at location
      {:ok, npc} = Spawner.spawn_from_template("dungeon_guard",
        location_id: room.id,
        name: "Elite Guard"
      )
  """
  @spec spawn_from_template(String.t(), keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def spawn_from_template(template_key, opts \\ []) do
    with {:ok, template} <- PrototypeLoader.get(template_key),
         :ok <- validate_is_template(template) do
      # Generate unique instance key
      instance_key = Keyword.get(opts, :key) || generate_template_instance_key(template_key)

      case template.type do
        :room ->
          spawn_room_from_template(template, instance_key, opts)

        _other_type ->
          spawn_entity_from_template(template, instance_key, opts)
      end
    end
  end

  defp validate_is_template(%Prototype{} = proto) do
    if Prototype.template?(proto) do
      :ok
    else
      {:error, {:not_a_template, "#{proto.key} is not marked as a template (is_template: true)"}}
    end
  end

  defp generate_template_instance_key(template_key) do
    short_id = UUID.uuid4() |> String.split("-") |> List.first()
    "#{template_key}_#{short_id}"
  end

  defp spawn_room_from_template(template, instance_key, opts) do
    # Use create_room with template values + overrides
    room_attrs = [
      key: instance_key,
      name: Keyword.get(opts, :name, template.name),
      description: Keyword.get(opts, :description, template.description),
      x: Keyword.get(opts, :x, 0),
      y: Keyword.get(opts, :y, 0),
      z: Keyword.get(opts, :z, 0),
      tags: merge_tags(template.tags, Keyword.get(opts, :tags, [])),
      components: merge_components(template.components, Keyword.get(opts, :components, %{}))
    ]

    case create_room(room_attrs) do
      {:ok, room} ->
        # Update metadata to track template origin
        room = %{room | metadata: Map.put(room.metadata, :template_key, template.key)}
        Logger.debug("Spawned room from template #{template.key} as #{instance_key}")
        {:ok, room}

      error ->
        error
    end
  end

  defp spawn_entity_from_template(template, instance_key, opts) do
    # For non-room entities, use spawn with key override
    spawn_opts = [
      name: Keyword.get(opts, :name, template.name),
      description: Keyword.get(opts, :description, template.description),
      location_id: Keyword.get(opts, :location_id),
      tags: Keyword.get(opts, :tags, []),
      components: Keyword.get(opts, :components, %{})
    ]

    # Create entity directly instead of using spawn (which would re-fetch prototype)
    overrides = build_overrides(template, spawn_opts)
    entity = Prototype.to_entity(template, overrides)
    entity = %{entity | key: instance_key}

    case Entities.save_entity(entity) do
      {:ok, schema} ->
        saved_entity = Entities.to_entity(schema)
        Logger.debug("Spawned entity from template #{template.key} as #{instance_key}")
        {:ok, saved_entity}

      {:error, changeset} ->
        {:error, {:save_failed, changeset}}
    end
  end

  defp merge_tags(template_tags, override_tags) do
    (template_tags ++ override_tags) |> Enum.uniq()
  end

  defp merge_components(template_components, override_components) do
    deep_merge(template_components, override_components)
  end

  # =============================================================================
  # Direct Entity Creation (without prototypes)
  # =============================================================================

  @doc """
  Creates a room entity directly without a prototype.

  This is the primary creation method for the TUI map editor, allowing rooms
  to be created on-the-fly without YAML files.

  ## Options

  - `:key` - Room key (auto-generated from name if not provided)
  - `:name` - Room name (required)
  - `:description` - Room description (default: "")
  - `:x`, `:y`, `:z` - Coordinates (default: 0, 0, 0)
  - `:tags` - List of tags (default: [])
  - `:components` - Additional components to merge (default: %{})

  ## Examples

      {:ok, room} = Spawner.create_room(name: "Dark Cave", x: 5, y: 3)
      {:ok, room} = Spawner.create_room(name: "Tower", key: "tower_base", z: 1)
  """
  @spec create_room(keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def create_room(attrs) do
    name = Keyword.get(attrs, :name)

    if is_nil(name) or name == "" do
      {:error, :name_required}
    else
      key = Keyword.get(attrs, :key) || generate_unique_key(name)
      description = Keyword.get(attrs, :description, "")
      x = Keyword.get(attrs, :x, 0)
      y = Keyword.get(attrs, :y, 0)
      z = Keyword.get(attrs, :z, 0)
      tags = Keyword.get(attrs, :tags, [])
      extra_components = Keyword.get(attrs, :components, %{})

      coordinates = %{"x" => x, "y" => y, "z" => z}
      components = Map.merge(%{"coordinates" => coordinates}, extra_components)

      room = %Entity{
        id: UUID.uuid4(),
        type: :room,
        key: key,
        name: name,
        description: description,
        location_id: nil,
        contents: [],
        components: components,
        behaviors: [],
        attributes: %{},
        tags: tags,
        scripts: %{},
        locks: %{},
        metadata: %{
          created_at: DateTime.utc_now(),
          updated_at: DateTime.utc_now(),
          created_by: "editor"
        }
      }

      case Entities.save_entity(room) do
        {:ok, schema} ->
          Logger.info("Created room #{key} at (#{x}, #{y}, #{z})")
          {:ok, Entities.to_entity(schema)}

        {:error, changeset} ->
          {:error, {:save_failed, changeset}}
      end
    end
  end

  @doc """
  Creates an exit entity between two rooms.

  ## Options

  - `:direction` - Direction of exit (e.g., "north", "up") (required)
  - `:source_id` - ID of the source room (required)
  - `:destination_id` - ID of the destination room (required)
  - `:name` - Exit name (default: capitalized direction)
  - `:description` - Exit description (default: "An exit leading {direction}.")
  - `:create_return` - Whether to create return exit (default: false)

  ## Examples

      {:ok, exit} = Spawner.create_exit(
        direction: "north",
        source_id: room_a.id,
        destination_id: room_b.id
      )

      # Create bidirectional exits
      {:ok, exits} = Spawner.create_exit(
        direction: "north",
        source_id: room_a.id,
        destination_id: room_b.id,
        create_return: true
      )
  """
  @spec create_exit(keyword()) :: {:ok, Entity.t() | [Entity.t()]} | {:error, term()}
  def create_exit(attrs) do
    direction = Keyword.get(attrs, :direction)
    source_id = Keyword.get(attrs, :source_id)
    dest_id = Keyword.get(attrs, :destination_id)

    cond do
      is_nil(direction) -> {:error, :direction_required}
      is_nil(source_id) -> {:error, :source_id_required}
      is_nil(dest_id) -> {:error, :destination_id_required}
      true -> do_create_exit(attrs)
    end
  end

  defp do_create_exit(attrs) do
    direction = to_string(Keyword.get(attrs, :direction))
    source_id = Keyword.get(attrs, :source_id)
    dest_id = Keyword.get(attrs, :destination_id)
    create_return = Keyword.get(attrs, :create_return, false)

    # Check if exit already exists in this direction from source
    if exit_exists?(source_id, direction) do
      {:error, {:exit_exists, "Exit already exists: #{direction} from this room"}}
    else
      do_create_exit_unchecked(attrs, direction, source_id, dest_id, create_return)
    end
  end

  defp do_create_exit_unchecked(attrs, direction, source_id, dest_id, create_return) do
    # Get destination room for key reference
    dest_room = Entities.get_entity(dest_id)
    dest_key = if dest_room, do: Entities.to_entity(dest_room).key, else: nil

    source_room = Entities.get_entity(source_id)
    source_key = if source_room, do: Entities.to_entity(source_room).key, else: nil

    exit_key = "exit_#{source_key || source_id}_#{direction}"

    exit_entity = %Entity{
      id: UUID.uuid4(),
      type: :exit,
      key: exit_key,
      name: Keyword.get(attrs, :name, String.capitalize(direction)),
      description: Keyword.get(attrs, :description, "An exit leading #{direction}."),
      location_id: source_id,
      contents: [],
      components: %{
        "exit" => %{
          "direction" => direction,
          "destination_key" => dest_key,
          "destination_id" => dest_id
        }
      },
      behaviors: [],
      attributes: %{},
      tags: ["exit"],
      scripts: %{},
      locks: Keyword.get(attrs, :locks, %{}),
      metadata: %{
        created_at: DateTime.utc_now(),
        updated_at: DateTime.utc_now(),
        created_by: "editor"
      }
    }

    case Entities.save_entity(exit_entity) do
      {:ok, schema} ->
        exit = Entities.to_entity(schema)
        Logger.info("Created exit #{exit_key} -> #{dest_key || dest_id}")

        # Trigger hooks for exit creation (for auto-layout)
        Hooks.run(:at_entity_creation, [exit, %{created_by: "spawner"}])

        if create_return do
          # Create return exit
          return_direction = get_opposite_direction(direction)

          case create_exit(
                 direction: return_direction,
                 source_id: dest_id,
                 destination_id: source_id,
                 create_return: false
               ) do
            {:ok, return_exit} ->
              {:ok, [exit, return_exit]}

            {:error, reason} ->
              Logger.warning("Failed to create return exit: #{inspect(reason)}")
              {:ok, exit}
          end
        else
          {:ok, exit}
        end

      {:error, changeset} ->
        {:error, {:save_failed, changeset}}
    end
  end

  defp get_opposite_direction(direction) do
    case String.downcase(to_string(direction)) do
      "north" -> "south"
      "south" -> "north"
      "east" -> "west"
      "west" -> "east"
      "up" -> "down"
      "down" -> "up"
      "northeast" -> "southwest"
      "northwest" -> "southeast"
      "southeast" -> "northwest"
      "southwest" -> "northeast"
      other -> other
    end
  end

  defp exit_exists?(source_id, direction) do
    direction = String.downcase(to_string(direction))

    Entities.get_contents(source_id)
    |> Enum.any?(fn entity ->
      entity.type == :exit &&
        get_exit_direction(entity) == direction
    end)
  end

  defp get_exit_direction(exit_entity) do
    # Exit data may be nested under "exit" key or directly in components
    components = exit_entity.components || %{}
    exit_data = Map.get(components, "exit", components)
    Map.get(exit_data, "direction", "") |> String.downcase()
  end

  defp generate_unique_key(name) when is_binary(name) do
    slug =
      name
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/, "_")
      |> String.trim("_")

    short_id = UUID.uuid4() |> String.split("-") |> List.first()
    "#{slug}_#{short_id}"
  end
end
