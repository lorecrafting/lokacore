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
  @spec find_one(String.t() | keyword()) :: {:ok, Entity.t()} | {:error, :not_found}
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
  @spec find_all(keyword()) :: [Entity.t()]
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
  @spec find(String.t() | keyword()) :: {:ok, Entity.t()} | {:error, :not_found} | [Entity.t()]
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
  @spec find_many([String.t()]) :: [Entity.t()]
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
  @spec find_many([String.t()], atom()) :: [Entity.t()]
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
  @spec save(Entity.t()) :: {:ok, Entity.t()} | {:error, term()}
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
  @spec save_batch([Entity.t()]) :: {non_neg_integer(), nil | [term()]}
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
  Deletes an entity by ID. Also deletes contained entities (exits, items, NPCs)
  to prevent orphans with NULL location_id.
  """
  @spec delete(String.t() | Entity.t()) :: {:ok, EntitySchema.t()} | {:error, term()}
  def delete(id) when is_binary(id) do
    case Repo.get(EntitySchema, id) do
      nil ->
        {:error, :not_found}

      schema ->
        # Delete contained entities first to prevent orphans
        EntitySchema
        |> where([e], e.location_id == ^id)
        |> Repo.delete_all()

        Repo.delete(schema)
    end
  end

  def delete(%Entity{id: id}), do: delete(id)

  @doc """
  Partial update — applies a changes map to an existing entity.
  """
  @spec update(String.t(), map()) :: {:ok, Entity.t()} | {:error, term()}
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

  @doc "Adds a tag to an entity. Idempotent — no-op if already present."
  @spec add_tag(String.t(), String.t()) ::
          {:ok, EntityTagSchema.t()} | {:error, Ecto.Changeset.t()}
  def add_tag(entity_id, tag) when is_binary(entity_id) and is_binary(tag) do
    %EntityTagSchema{}
    |> EntityTagSchema.changeset(%{entity_id: entity_id, tag: tag})
    |> Repo.insert(on_conflict: :nothing)
  end

  @doc "Removes a tag from an entity."
  @spec remove_tag(String.t(), String.t()) :: :ok
  def remove_tag(entity_id, tag) when is_binary(entity_id) and is_binary(tag) do
    EntityTagSchema
    |> where([t], t.entity_id == ^entity_id and t.tag == ^tag)
    |> Repo.delete_all()

    :ok
  end

  @doc "Gets all tags for an entity."
  @spec get_tags(String.t()) :: [String.t()]
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
  @spec list_entities(keyword()) :: [EntitySchema.t()]
  def list_entities(opts \\ []) do
    EntitySchema
    |> filter_by_type(opts[:type])
    |> filter_by_location(opts[:location_id])
    |> preload_associations(opts[:preload] || [])
    |> Repo.all()
    |> Repo.preload(:tags)
  end

  @doc "V1 compat — gets entity schema by ID."
  @spec get_entity(String.t() | nil) :: EntitySchema.t() | nil
  def get_entity(id) when is_binary(id) do
    case Repo.get(EntitySchema, id) do
      nil -> nil
      schema -> Repo.preload(schema, :tags)
    end
  end

  def get_entity(_), do: nil

  @doc "V1 compat — gets entity schema by ID, raises if not found."
  @spec get_entity!(String.t()) :: EntitySchema.t()
  def get_entity!(id), do: Repo.get!(EntitySchema, id) |> Repo.preload(:tags)

  @doc "V1 compat — gets entity schema by key (first match)."
  @spec get_entity_by_key(String.t()) :: EntitySchema.t() | nil
  def get_entity_by_key(key) when is_binary(key) do
    case Repo.get_by(EntitySchema, key: key) do
      nil -> nil
      schema -> Repo.preload(schema, :tags)
    end
  end

  @doc "V1 compat — gets all entity schemas with the given key."
  @spec get_all_by_key(String.t()) :: [EntitySchema.t()]
  def get_all_by_key(key) when is_binary(key) do
    EntitySchema |> where([e], e.key == ^key) |> Repo.all()
  end

  @doc "V1 compat — creates entity from attrs map."
  @spec create_entity(map()) :: {:ok, EntitySchema.t()} | {:error, Ecto.Changeset.t()}
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
  @spec update_entity(EntitySchema.t() | String.t(), map()) ::
          {:ok, EntitySchema.t()} | {:error, term()}
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
  @spec delete_entity(EntitySchema.t()) :: {:ok, EntitySchema.t()} | {:error, Ecto.Changeset.t()}
  def delete_entity(%EntitySchema{} = entity), do: Repo.delete(entity)

  @doc "V1 compat — returns changeset."
  @spec change_entity(EntitySchema.t(), map()) :: Ecto.Changeset.t()
  def change_entity(%EntitySchema{} = entity, attrs \\ %{}) do
    EntitySchema.changeset(entity, normalize_attrs(attrs))
  end

  @doc "V1 compat — converts schema to Entity struct."
  @spec to_entity(Entity.t() | EntitySchema.t() | nil) :: Entity.t() | nil
  def to_entity(%Entity{} = entity), do: entity
  def to_entity(%EntitySchema{} = schema), do: EntitySchema.to_entity(schema)
  def to_entity(nil), do: nil

  @doc "V1 compat — saves Entity struct to DB."
  @spec save_entity(Entity.t()) :: {:ok, EntitySchema.t()} | {:error, term()}
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
  @spec list_by_type(atom()) :: [EntitySchema.t()]
  def list_by_type(type), do: list_entities(type: type)

  @doc "V1 compat — lists rooms."
  @spec list_rooms() :: [EntitySchema.t()]
  def list_rooms, do: list_entities(type: :room, preload: [:contents])

  @doc "V1 compat — gets room with contents."
  @spec get_room(String.t()) :: EntitySchema.t() | nil
  def get_room(id) do
    EntitySchema
    |> where([e], e.id == ^id and e.type == :room)
    |> preload([:contents])
    |> Repo.one()
  end

  @doc "V1 compat — gets entities at a location. Optional :type filter."
  @spec get_contents(String.t(), keyword()) :: [EntitySchema.t()]
  def get_contents(location_id, opts \\ []) do
    query = EntitySchema |> where([e], e.location_id == ^location_id)

    query =
      case opts[:type] do
        nil -> query
        type -> where(query, [e], e.type == ^type)
      end

    Repo.all(query)
  end

  @doc "V1 compat — gets entities at multiple locations."
  @spec get_contents_batch([String.t()]) :: %{String.t() => [EntitySchema.t()]}
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
  @spec get_all_by_ids([String.t()]) :: [EntitySchema.t()]
  def get_all_by_ids([]), do: []

  def get_all_by_ids(ids) when is_list(ids) do
    EntitySchema |> where([e], e.id in ^ids) |> Repo.all()
  end

  @doc "V1 compat — count by type."
  @spec count_by_type(atom()) :: non_neg_integer()
  def count_by_type(type) do
    EntitySchema |> where([e], e.type == ^type) |> Repo.aggregate(:count)
  end

  @doc "V1 compat — count by key."
  @spec count_by_key(String.t()) :: non_neg_integer()
  def count_by_key(key) when is_binary(key) do
    EntitySchema |> where([e], e.key == ^key) |> Repo.aggregate(:count)
  end

  @doc "V1 compat — count at location."
  @spec count_by_location(String.t() | nil) :: non_neg_integer()
  def count_by_location(location_id) when is_binary(location_id) do
    EntitySchema |> where([e], e.location_id == ^location_id) |> Repo.aggregate(:count)
  end

  def count_by_location(nil), do: 0

  @doc "V1 compat — count by key in room."
  @spec count_by_key_in_room(String.t(), String.t()) :: non_neg_integer()
  def count_by_key_in_room(key, room_id) when is_binary(key) and is_binary(room_id) do
    EntitySchema
    |> where([e], e.key == ^key and e.location_id == ^room_id)
    |> Repo.aggregate(:count)
  end

  @doc "V1 compat — count all."
  @spec count_all() :: non_neg_integer()
  def count_all, do: Repo.aggregate(EntitySchema, :count)

  @doc "V1 compat — find by prototype_key in column."
  @spec find_by_prototype_key(String.t()) :: EntitySchema.t() | nil
  def find_by_prototype_key(prototype_key) do
    EntitySchema
    |> where([e], e.prototype_key == ^prototype_key)
    |> limit(1)
    |> Repo.one()
  end

  @doc "V1 compat — delete all entities."
  @spec delete_all() :: non_neg_integer()
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
    |> filter_by_limit(opts[:limit])
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

  defp filter_by_limit(query, nil), do: query
  defp filter_by_limit(query, n) when is_integer(n), do: limit(query, ^n)

  defp preload_associations(query, []), do: query
  defp preload_associations(query, assocs), do: preload(query, ^assocs)

  defp maybe_preload_tags(nil), do: nil
  defp maybe_preload_tags(schema), do: Repo.preload(schema, :tags)

  defp sync_tags(entity_id, tags) when is_list(tags) do
    new_tags = Enum.filter(tags, &is_binary/1)

    # Delete tags that are no longer in the new list (one query)
    EntityTagSchema
    |> where([t], t.entity_id == ^entity_id and t.tag not in ^new_tags)
    |> Repo.delete_all()

    # Bulk insert new tags, ignoring duplicates (one query)
    if new_tags != [] do
      rows = Enum.map(new_tags, fn tag -> %{entity_id: entity_id, tag: tag} end)
      Repo.insert_all(EntityTagSchema, rows, on_conflict: :nothing)
    end

    :ok
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
