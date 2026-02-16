defmodule Loka.Engine.Spawner do
  @moduledoc """
  Create entities from prototype templates.

  The Spawner bridges prototypes (templates) and entities (database records). It:
  - Creates new entities from prototype definitions
  - Persists entities to the database
  - Handles location placement
  - Supports overrides for customization

  ## Submodules

  - `Spawner.Editor` - Direct entity creation for admin dashboard
  - `Spawner.Templates` - Template-based spawning for reusable patterns

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

      # Direct creation (admin dashboard)
      {:ok, room} = Spawner.create_room(name: "Dark Cave", x: 5, y: 3)
  """

  alias Loka.Engine.{Entities, Entity, Hooks}
  alias Loka.Engine.Schema.EntitySchema
  alias Loka.Utils.MapHelpers

  require Logger

  # Delegate direct creation to Editor submodule
  defdelegate create_room(attrs), to: Loka.Engine.Spawner.Editor
  defdelegate create_exit(attrs), to: Loka.Engine.Spawner.Editor

  # Delegate template spawning to Templates submodule
  defdelegate spawn_from_template(template_key, opts \\ []),
    to: Loka.Engine.Spawner.Templates,
    as: :spawn

  @doc """
  Spawns an entity from a prototype.

  ## Options

  - `:location_id` - Place entity at this location
  - `:short_desc` - Override the prototype's short description (action/speech name)
  - `:long_desc` - Override the prototype's long description (room display)
  - `:extra_desc` - Override the prototype's extra description (examine text)
  - `:keywords` - Override the prototype's keywords
  - `:mood` - Override the prototype's mood
  - `:components` - Deep-merge with prototype components
  - `:tags` - Append to prototype tags

  ## Examples

      {:ok, entity} = Spawner.spawn("goblin_warrior")
      {:ok, entity} = Spawner.spawn("goblin_warrior", location_id: room_id)
      {:ok, entity} = Spawner.spawn("goblin_warrior", short_desc: "Elite Goblin")
  """
  @spec spawn(String.t(), keyword()) :: {:ok, Entity.t()} | {:error, term()}
  def spawn(prototype_key, opts \\ []) do
    with {:ok, prototype} <- Entities.find_one(key: prototype_key) do
      overrides = build_overrides(prototype, opts)
      entity = prototype_to_entity(prototype, overrides)

      # Entity key = prototype key (UUID provides instance uniqueness)
      # No suffix needed - multiple instances share the same key

      case Entities.save_entity(entity) do
        {:ok, schema} ->
          saved_entity = Entities.to_entity(schema)

          # Persist tags to entity_tags table
          for tag <- entity.tags || [] do
            Entities.add_tag(saved_entity.id, tag)
          end

          saved_entity = %{saved_entity | tags: entity.tags || []}

          # Run creation hook - Framework modules can register handlers
          # (e.g., container initialization, combat stats setup)
          Hooks.run(:at_entity_creation, [saved_entity, %{created_by: "spawner"}])

          Logger.debug(
            "Spawned #{Entity.display_ref(saved_entity)} from prototype #{prototype_key}"
          )

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
    with {:ok, prototype} <- Entities.find_one(key: room_prototype_key),
         :ok <- validate_room_prototype(prototype) do
      overrides = build_overrides(prototype, opts)
      room_entity = prototype_to_entity(prototype, overrides)

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

  # Create a new entity instance from a prototype entity, applying overrides.
  defp prototype_to_entity(%Entity{} = prototype, overrides) do
    now = DateTime.utc_now()

    base_metadata =
      Map.merge(prototype.metadata || %{}, %{
        created_at: now,
        updated_at: now,
        prototype_key: prototype.key
      })

    # Tag entities spawned from draft prototypes for [DRAFT] display
    metadata =
      if Entity.draft?(prototype) do
        Map.put(base_metadata, "draft", true)
      else
        base_metadata
      end

    entity = %Entity{
      prototype
      | id: UUID.uuid4(),
        is_prototype: false,
        prototype_key: prototype.key,
        metadata: metadata
    }

    # Apply overrides
    entity
    |> maybe_apply_override(:short_desc, overrides)
    |> maybe_apply_override(:long_desc, overrides)
    |> maybe_apply_override(:extra_desc, overrides)
    |> maybe_apply_override(:keywords, overrides)
    |> maybe_apply_override(:mood, overrides)
    |> maybe_apply_override(:location_id, overrides)
    |> maybe_apply_override(:components, overrides)
    |> maybe_apply_override(:tags, overrides)
  end

  defp maybe_apply_override(entity, field, overrides) do
    case Map.get(overrides, field) do
      nil -> entity
      value -> Map.put(entity, field, value)
    end
  end

  defp build_overrides(prototype, opts) do
    overrides =
      opts
      |> Keyword.take([
        :short_desc,
        :long_desc,
        :extra_desc,
        :keywords,
        :mood,
        :location_id,
        :components,
        :tags
      ])
      |> Map.new()

    # Deep merge components with prototype values
    overrides
    |> maybe_deep_merge(:components, prototype.components, Map.get(overrides, :components))
  end

  defp maybe_deep_merge(overrides, _field, _base, nil), do: overrides

  defp maybe_deep_merge(overrides, field, base, additions)
       when is_map(base) and is_map(additions) do
    Map.put(overrides, field, MapHelpers.deep_merge(base, additions))
  end

  defp maybe_deep_merge(overrides, _field, _base, _additions), do: overrides

  defp validate_room_prototype(%Entity{type: :room}), do: :ok

  defp validate_room_prototype(%Entity{type: type}) do
    {:error, {:invalid_type, "spawn_room requires a room prototype, got: #{type}"}}
  end

  defp spawn_room_contents(room, prototype, opts) do
    # V2: exits and spawns are stored directly in components (not nested under "data")
    exits = prototype.components["exits"]
    spawns = prototype.components["spawns"]
    spawn_exits(room, exits, opts) ++ spawn_entities(room, spawns, opts)
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
      short_desc: String.capitalize(direction_str),
      long_desc: "An exit leading #{direction_str}.",
      extra_desc: "An exit leading #{direction_str}.",
      keywords: [direction_str],
      location_id: room.id,
      # Store exit data in components (which are properly persisted as JSON)
      components: %{
        "exit" => %{
          "direction" => direction_str,
          "destination_key" => destination
        }
      },
      traits: [],
      tags: ["exit"],
      scripts: %{},
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

    components = MapHelpers.deep_merge(base_components, Map.get(exit_config, "components", %{}))

    # Merge locks from config into components
    exit_locks = Map.get(exit_config, "locks", %{})

    components =
      if exit_locks != %{} do
        Map.put(components, "locks", exit_locks)
      else
        components
      end

    exit_entity = %Entity{
      id: UUID.uuid4(),
      type: :exit,
      key: exit_key,
      short_desc: Map.get(exit_config, "short_desc", String.capitalize(direction_str)),
      long_desc: Map.get(exit_config, "long_desc", "An exit leading #{direction_str}."),
      extra_desc: Map.get(exit_config, "extra_desc", "An exit leading #{direction_str}."),
      keywords: Map.get(exit_config, "keywords", [direction_str]),
      location_id: room.id,
      components: components,
      traits: [],
      tags: ["exit"] ++ Map.get(exit_config, "tags", []),
      scripts: %{},
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
        {"short_desc", v} -> {:short_desc, v}
        {"long_desc", v} -> {:long_desc, v}
        {"extra_desc", v} -> {:extra_desc, v}
        {"keywords", v} -> {:keywords, v}
        {"mood", v} -> {:mood, v}
        {"location_id", v} -> {:location_id, v}
        {"components", v} -> {:components, v}
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
end
