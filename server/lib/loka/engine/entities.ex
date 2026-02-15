defmodule Loka.Engine.Entities do
  @moduledoc """
  Unified API for entity persistence (V2).

  All game objects are entities stored in a single `entities` table.
  Tags are in the `entity_tags` join table.

  ## V2 API

      # Single-result reads
      find_one(uuid_string)
      find_one(key: k, type: t)
      find_one(account_id: id)

      # Multi-result reads
      find_all(type: :npc)
      find_all(location_id: room_id)
      find_all(location_id: id, type: :npc)
      find_all(tags: ["hostile"])

      # Convenience
      find(id_or_opts)

      # Batch
      find_many(ids)
      find_many(keys, type)

      # Writes
      save(entity)
      save_batch(entities)
      delete(id)
      update(id, changes_map)

      # Tags
      add_tag(entity_id, tag)
      remove_tag(entity_id, tag)
      get_tags(entity_id)
  """

  require Logger

  import Ecto.Query
  alias Loka.Repo
  alias Loka.Engine.Entity
  alias Loka.Engine.Schema.{EntitySchema, EntityTagSchema}

  # =============================================================================
  # V2 Read API
  # =============================================================================

  @doc """
  Finds a single entity. Returns `{:ok, entity}` or `{:error, :not_found}`.

  ## Examples

      find_one("uuid-string")
      find_one(key: "goblin", type: :npc)
      find_one(account_id: 42)
  """
  def find_one(id) when is_binary(id) do
    # Validate UUID format
    case Ecto.UUID.cast(id) do
      {:ok, _} ->
        case Repo.get(EntitySchema, id) |> maybe_preload_tags() do
          nil -> {:error, :not_found}
          schema -> {:ok, EntitySchema.to_entity(schema)}
        end

      :error ->
        raise ArgumentError, "find_one/1 with string requires a valid UUID, got: #{inspect(id)}"
    end
  end

  def find_one(opts) when is_list(opts) do
    cond do
      opts[:key] && opts[:type] ->
        EntitySchema
        |> where([e], e.key == ^opts[:key] and e.type == ^opts[:type])
        |> limit(1)
        |> Repo.one()
        |> maybe_preload_tags()
        |> case do
          nil -> {:error, :not_found}
          schema -> {:ok, EntitySchema.to_entity(schema)}
        end

      opts[:account_id] ->
        EntitySchema
        |> where([e], e.account_id == ^opts[:account_id])
        |> limit(1)
        |> Repo.one()
        |> maybe_preload_tags()
        |> case do
          nil -> {:error, :not_found}
          schema -> {:ok, EntitySchema.to_entity(schema)}
        end

      opts[:key] ->
        EntitySchema
        |> where([e], e.key == ^opts[:key])
        |> limit(1)
        |> Repo.one()
        |> maybe_preload_tags()
        |> case do
          nil -> {:error, :not_found}
          schema -> {:ok, EntitySchema.to_entity(schema)}
        end

      true ->
        raise ArgumentError, "find_one/1 requires UUID string, or key+type, or account_id"
    end
  end

  @doc """
  Finds multiple entities. Returns a list (may be empty).

  ## Examples

      find_all(type: :npc)
      find_all(location_id: room_id)
      find_all(location_id: room_id, type: :npc)
      find_all(tags: ["hostile"])
      find_all(is_prototype: true, type: :npc)
  """
  def find_all(opts) when is_list(opts) do
    EntitySchema
    |> apply_filters(opts)
    |> Repo.all()
    |> Repo.preload(:tags)
    |> Enum.map(&EntitySchema.to_entity/1)
  end

  @doc """
  Convenience dispatcher — routes to `find_one` or `find_all`.

  - String arg → `find_one(id)`
  - Keyword with `:key` + `:type` → `find_one(key: k, type: t)`
  - Keyword with `:type` only → `find_all(type: t)`
  - Keyword with `:location_id` → `find_all(location_id: id)`
  """
  def find(id) when is_binary(id), do: find_one(id)

  def find(opts) when is_list(opts) do
    cond do
      opts[:key] && opts[:type] -> find_one(opts)
      opts[:account_id] -> find_one(opts)
      true -> find_all(opts)
    end
  end

  @doc """
  Batch-fetches entities by IDs.

      find_many(["uuid1", "uuid2"])
  """
  def find_many(ids) when is_list(ids) do
    EntitySchema
    |> where([e], e.id in ^ids)
    |> Repo.all()
    |> Repo.preload(:tags)
    |> Enum.map(&EntitySchema.to_entity/1)
  end

  @doc """
  Batch-fetches entities by keys and type.

      find_many(["goblin", "orc"], :npc)
  """
  def find_many(keys, type) when is_list(keys) and is_atom(type) do
    EntitySchema
    |> where([e], e.key in ^keys and e.type == ^type)
    |> Repo.all()
    |> Repo.preload(:tags)
    |> Enum.map(&EntitySchema.to_entity/1)
  end

  # =============================================================================
  # V2 Write API
  # =============================================================================

  @doc """
  Saves an entity (insert or update with optimistic locking via version).

  Returns `{:ok, entity}` or `{:error, reason}`.
  """
  def save(%Entity{} = entity) do
    case Repo.get(EntitySchema, entity.id) do
      nil ->
        # Insert — set id on struct directly (not through changeset)
        attrs = EntitySchema.from_entity(entity)

        case %EntitySchema{id: entity.id} |> EntitySchema.changeset(attrs) |> Repo.insert() do
          {:ok, schema} ->
            sync_tags(schema.id, entity.tags || [])
            schema = Repo.preload(schema, :tags, force: true)
            {:ok, EntitySchema.to_entity(schema)}

          {:error, changeset} ->
            {:error, changeset}
        end

      existing ->
        # Optimistic lock check
        if existing.version != entity.version do
          {:error, :version_conflict}
        else
          attrs = EntitySchema.from_entity(entity) |> Map.put(:version, entity.version + 1)

          case existing |> EntitySchema.changeset(attrs) |> Repo.update() do
            {:ok, schema} ->
              sync_tags(schema.id, entity.tags || [])
              schema = Repo.preload(schema, :tags, force: true)
              {:ok, EntitySchema.to_entity(schema)}

            {:error, changeset} ->
              {:error, changeset}
          end
        end
    end
  end

  @doc """
  Bulk-inserts entities. For seeding and batch operations only.
  """
  def save_batch(entities) when is_list(entities) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    entries =
      Enum.map(entities, fn entity ->
        EntitySchema.from_entity(entity)
        |> Map.drop([:tags])
        |> Map.put(:id, entity.id)
        |> Map.put(:inserted_at, now)
        |> Map.put(:updated_at, now)
      end)

    Repo.insert_all(EntitySchema, entries)
  end

  @doc """
  Deletes an entity by ID.
  """
  def delete(id) when is_binary(id) do
    case Repo.get(EntitySchema, id) do
      nil -> {:error, :not_found}
      schema -> Repo.delete(schema)
    end
  end

  def delete(%Entity{id: id}), do: delete(id)

  @doc """
  Partial update — applies a changes map to an existing entity.
  """
  def update(id, changes) when is_binary(id) and is_map(changes) do
    case Repo.get(EntitySchema, id) do
      nil ->
        {:error, :not_found}

      schema ->
        case schema |> EntitySchema.changeset(changes) |> Repo.update() do
          {:ok, schema} ->
            schema = Repo.preload(schema, :tags)
            {:ok, EntitySchema.to_entity(schema)}

          {:error, changeset} ->
            {:error, changeset}
        end
    end
  end

  # =============================================================================
  # Tag Operations
  # =============================================================================

  @doc "Adds a tag to an entity. No-op if already present."
  def add_tag(entity_id, tag) when is_binary(entity_id) and is_binary(tag) do
    %EntityTagSchema{}
    |> EntityTagSchema.changeset(%{entity_id: entity_id, tag: tag})
    |> Repo.insert(on_conflict: :nothing)
  end

  @doc "Removes a tag from an entity."
  def remove_tag(entity_id, tag) when is_binary(entity_id) and is_binary(tag) do
    EntityTagSchema
    |> where([t], t.entity_id == ^entity_id and t.tag == ^tag)
    |> Repo.delete_all()

    :ok
  end

  @doc "Gets all tags for an entity."
  def get_tags(entity_id) when is_binary(entity_id) do
    EntityTagSchema
    |> where([t], t.entity_id == ^entity_id)
    |> select([t], t.tag)
    |> Repo.all()
  end

  # =============================================================================
  # V1 Backward Compatibility (used by ~44 files, will be migrated in Phases 4-6)
  # =============================================================================

  @doc "V1 compat — lists entities with optional type/location filters."
  def list_entities(opts \\ []) do
    EntitySchema
    |> filter_by_type(opts[:type])
    |> filter_by_location(opts[:location_id])
    |> preload_associations(opts[:preload] || [])
    |> Repo.all()
    |> Repo.preload(:tags)
  end

  @doc "V1 compat — gets entity schema by ID."
  def get_entity(id) when is_binary(id), do: Repo.get(EntitySchema, id)
  def get_entity(_), do: nil

  @doc "V1 compat — gets entity schema by ID, raises if not found."
  def get_entity!(id), do: Repo.get!(EntitySchema, id)

  @doc "V1 compat — gets entity schema by key (first match)."
  def get_entity_by_key(key) when is_binary(key), do: Repo.get_by(EntitySchema, key: key)

  @doc "V1 compat — gets all entity schemas with the given key."
  def get_all_by_key(key) when is_binary(key) do
    EntitySchema |> where([e], e.key == ^key) |> Repo.all()
  end

  @doc "V1 compat — creates entity from attrs map."
  def create_entity(attrs) do
    tags = attrs[:tags] || attrs["tags"] || []

    result =
      %EntitySchema{}
      |> EntitySchema.changeset(normalize_attrs(attrs))
      |> Repo.insert()

    case result do
      {:ok, schema} when tags != [] ->
        for tag <- tags, do: add_tag(schema.id, to_string(tag))
        {:ok, Repo.preload(schema, :tags, force: true)}

      other ->
        other
    end
  end

  @doc "V1 compat — updates entity schema."
  def update_entity(%EntitySchema{} = entity, attrs) do
    entity
    |> EntitySchema.changeset(normalize_attrs(attrs))
    |> Repo.update()
  end

  def update_entity(entity_id, attrs) when is_binary(entity_id) do
    case get_entity(entity_id) do
      nil -> {:error, :not_found}
      entity -> update_entity(entity, attrs)
    end
  end

  @doc "V1 compat — deletes entity schema."
  def delete_entity(%EntitySchema{} = entity), do: Repo.delete(entity)

  @doc "V1 compat — returns changeset."
  def change_entity(%EntitySchema{} = entity, attrs \\ %{}) do
    EntitySchema.changeset(entity, normalize_attrs(attrs))
  end

  @doc "V1 compat — converts schema to Entity struct."
  def to_entity(%Entity{} = entity), do: entity
  def to_entity(%EntitySchema{} = schema), do: EntitySchema.to_entity(schema)
  def to_entity(nil), do: nil

  @doc "V1 compat — saves Entity struct to DB."
  def save_entity(%Entity{id: nil} = entity) do
    entity |> EntitySchema.from_entity() |> create_entity()
  end

  def save_entity(%Entity{id: id} = entity) do
    case get_entity(id) do
      nil ->
        entity |> EntitySchema.from_entity() |> Map.put(:id, id) |> create_entity()

      schema ->
        update_entity(schema, EntitySchema.from_entity(entity))
    end
  end

  @doc "V1 compat — lists entities by type."
  def list_by_type(type), do: list_entities(type: type)

  @doc "V1 compat — lists rooms."
  def list_rooms, do: list_entities(type: :room, preload: [:contents])

  @doc "V1 compat — gets room with contents."
  def get_room(id) do
    EntitySchema
    |> where([e], e.id == ^id and e.type == :room)
    |> preload([:contents])
    |> Repo.one()
  end

  @doc "V1 compat — gets entities at a location."
  def get_contents(location_id) do
    EntitySchema |> where([e], e.location_id == ^location_id) |> Repo.all()
  end

  @doc "V1 compat — gets entities at multiple locations."
  def get_contents_batch([]), do: %{}

  def get_contents_batch(location_ids) when is_list(location_ids) do
    EntitySchema
    |> where([e], e.location_id in ^location_ids)
    |> Repo.all()
    |> Enum.group_by(& &1.location_id)
    |> then(fn grouped ->
      Enum.reduce(location_ids, grouped, fn id, acc -> Map.put_new(acc, id, []) end)
    end)
  end

  @doc "V1 compat — batch fetch by IDs."
  def get_all_by_ids([]), do: []

  def get_all_by_ids(ids) when is_list(ids) do
    EntitySchema |> where([e], e.id in ^ids) |> Repo.all()
  end

  @doc "V1 compat — count by type."
  def count_by_type(type) do
    EntitySchema |> where([e], e.type == ^type) |> Repo.aggregate(:count)
  end

  @doc "V1 compat — count by key."
  def count_by_key(key) when is_binary(key) do
    EntitySchema |> where([e], e.key == ^key) |> Repo.aggregate(:count)
  end

  @doc "V1 compat — count at location."
  def count_by_location(location_id) when is_binary(location_id) do
    EntitySchema |> where([e], e.location_id == ^location_id) |> Repo.aggregate(:count)
  end

  def count_by_location(nil), do: 0

  @doc "V1 compat — count by key in room."
  def count_by_key_in_room(key, room_id) when is_binary(key) and is_binary(room_id) do
    EntitySchema
    |> where([e], e.key == ^key and e.location_id == ^room_id)
    |> Repo.aggregate(:count)
  end

  @doc "V1 compat — count all."
  def count_all, do: Repo.aggregate(EntitySchema, :count)

  @doc "V1 compat — find by prototype_key in column."
  def find_by_prototype_key(prototype_key) do
    EntitySchema
    |> where([e], e.prototype_key == ^prototype_key)
    |> limit(1)
    |> Repo.one()
  end

  @doc "V1 compat — delete all entities."
  def delete_all do
    {count, _} = Repo.delete_all(EntitySchema)
    count
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp apply_filters(query, opts) do
    query
    |> filter_by_type(opts[:type])
    |> filter_by_location(opts[:location_id])
    |> filter_by_prototype(opts[:is_prototype])
    |> filter_by_prototype_key(opts[:prototype_key])
    |> filter_by_tags(opts[:tags])
  end

  defp filter_by_type(query, nil), do: query
  defp filter_by_type(query, types) when is_list(types), do: where(query, [e], e.type in ^types)
  defp filter_by_type(query, type), do: where(query, [e], e.type == ^type)

  defp filter_by_location(query, nil), do: query
  defp filter_by_location(query, id), do: where(query, [e], e.location_id == ^id)

  defp filter_by_prototype(query, nil), do: query
  defp filter_by_prototype(query, val), do: where(query, [e], e.is_prototype == ^val)

  defp filter_by_prototype_key(query, nil), do: query
  defp filter_by_prototype_key(query, key), do: where(query, [e], e.prototype_key == ^key)

  defp filter_by_tags(query, nil), do: query

  defp filter_by_tags(query, tags) when is_list(tags) do
    Enum.reduce(tags, query, fn tag, q ->
      where(
        q,
        [e],
        fragment("EXISTS (SELECT 1 FROM entity_tags WHERE entity_id = ? AND tag = ?)", e.id, ^tag)
      )
    end)
  end

  defp preload_associations(query, []), do: query
  defp preload_associations(query, assocs), do: preload(query, ^assocs)

  defp maybe_preload_tags(nil), do: nil
  defp maybe_preload_tags(schema), do: Repo.preload(schema, :tags)

  defp sync_tags(entity_id, tags) when is_list(tags) do
    for tag <- tags, is_binary(tag) do
      add_tag(entity_id, tag)
    end
  end

  defp sync_tags(_entity_id, _), do: :ok

  defp normalize_attrs(attrs) when is_map(attrs) do
    attrs
    |> Enum.map(fn
      {key, value} when is_atom(key) -> {key, value}
      {key, value} when is_binary(key) -> {String.to_existing_atom(key), value}
    end)
    |> Map.new()
  rescue
    ArgumentError -> attrs
  end
end
