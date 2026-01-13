defmodule Loka.Engine.Entities do
  @moduledoc """
  Context for managing entities in the database.

  Provides CRUD operations for entities and their attributes, following
  the Evennia-style persistence pattern with serialized complex data and
  EAV attributes.
  """

  import Ecto.Query
  alias Loka.Repo
  alias Loka.Engine.Entity
  alias Loka.Engine.Schema.{EntitySchema, EntityAttribute}

  # =============================================================================
  # Entity CRUD
  # =============================================================================

  @doc """
  Lists all entities, with optional filtering.

  ## Options
    - `:type` - Filter by entity type (atom or list of atoms)
    - `:location_id` - Filter by location
    - `:preload` - Preload associations (default: [])
  """
  def list_entities(opts \\ []) do
    EntitySchema
    |> filter_by_type(opts[:type])
    |> filter_by_location(opts[:location_id])
    |> preload_associations(opts[:preload] || [])
    |> Repo.all()
  end

  @doc """
  Gets a single entity by ID.
  """
  def get_entity(id) when is_binary(id) do
    Repo.get(EntitySchema, id)
  end

  def get_entity(_), do: nil

  @doc """
  Gets a single entity by ID, raises if not found.
  """
  def get_entity!(id) do
    Repo.get!(EntitySchema, id)
  end

  @doc """
  Gets a single entity by key.

  Note: Since keys are now prototype keys (not unique), this returns the first match.
  Use `get_all_by_key/1` when you need all instances of a prototype.
  """
  def get_entity_by_key(key) when is_binary(key) do
    Repo.get_by(EntitySchema, key: key)
  end

  @doc """
  Gets all entities with the given key (prototype key).

  Since entity keys now match prototype keys and are not unique,
  multiple entities may share the same key. This returns all of them.

  ## Examples

      # Get all goblins in the world
      goblins = Entities.get_all_by_key("goblin_warrior")

      # Get all instances of a specific item type
      swords = Entities.get_all_by_key("iron_sword")
  """
  def get_all_by_key(key) when is_binary(key) do
    EntitySchema
    |> where([e], e.key == ^key)
    |> Repo.all()
  end

  @doc """
  Creates a new entity.
  """
  def create_entity(attrs) do
    %EntitySchema{}
    |> EntitySchema.changeset(normalize_attrs(attrs))
    |> Repo.insert()
  end

  @doc """
  Updates an existing entity.
  Accepts either an EntitySchema struct or an entity ID string.
  """
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

  @doc """
  Deletes an entity.
  """
  def delete_entity(%EntitySchema{} = entity) do
    Repo.delete(entity)
  end

  @doc """
  Returns a changeset for tracking entity changes.
  """
  def change_entity(%EntitySchema{} = entity, attrs \\ %{}) do
    EntitySchema.changeset(entity, normalize_attrs(attrs))
  end

  # =============================================================================
  # Attribute Operations (EAV Pattern)
  # =============================================================================

  @doc """
  Gets an attribute value for an entity.

  ## Examples

      iex> get_attribute("entity-uuid", "health")
      %{current: 100, max: 100}

      iex> get_attribute("entity-uuid", "strength", "stats")
      18
  """
  def get_attribute(entity_id, key, category \\ "default") do
    EntityAttribute
    |> where([a], a.entity_id == ^entity_id and a.key == ^key and a.category == ^category)
    |> Repo.one()
    |> case do
      nil -> nil
      attr -> attr.value
    end
  end

  @doc """
  Gets all attributes for an entity, optionally filtered by category.
  """
  def get_attributes(entity_id, category \\ nil) do
    EntityAttribute
    |> where([a], a.entity_id == ^entity_id)
    |> filter_by_category(category)
    |> Repo.all()
    |> Map.new(fn attr -> {attr.key, attr.value} end)
  end

  @doc """
  Sets an attribute on an entity. Creates or updates as needed.
  """
  def set_attribute(entity_id, key, value, category \\ "default") do
    attrs = %{entity_id: entity_id, key: key, value: value, category: category}

    case Repo.get_by(EntityAttribute, entity_id: entity_id, key: key, category: category) do
      nil ->
        %EntityAttribute{}
        |> EntityAttribute.changeset(attrs)
        |> Repo.insert()

      existing ->
        existing
        |> EntityAttribute.changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Deletes an attribute from an entity.
  """
  def delete_attribute(entity_id, key, category \\ "default") do
    EntityAttribute
    |> where([a], a.entity_id == ^entity_id and a.key == ^key and a.category == ^category)
    |> Repo.delete_all()
  end

  @doc """
  Deletes all attributes for an entity.
  """
  def clear_attributes(entity_id) do
    EntityAttribute
    |> where([a], a.entity_id == ^entity_id)
    |> Repo.delete_all()
  end

  # =============================================================================
  # Entity Conversion
  # =============================================================================

  @doc """
  Converts an EntitySchema to an Entity struct for in-memory use.
  """
  def to_entity(%EntitySchema{} = schema) do
    EntitySchema.to_entity(schema)
  end

  def to_entity(nil), do: nil

  @doc """
  Saves an Entity struct to the database.
  """
  def save_entity(%Entity{id: nil} = entity) do
    entity
    |> EntitySchema.from_entity()
    |> create_entity()
  end

  def save_entity(%Entity{id: id} = entity) do
    case get_entity(id) do
      nil ->
        entity
        |> EntitySchema.from_entity()
        |> Map.put(:id, id)
        |> create_entity()

      schema ->
        update_entity(schema, EntitySchema.from_entity(entity))
    end
  end

  # =============================================================================
  # Statistics
  # =============================================================================

  @doc """
  Counts entities by type.
  """
  def count_by_type(type) do
    EntitySchema
    |> where([e], e.type == ^type)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts entities by key (prototype key).

  Used by the zone reset system to enforce max spawn counts.

  ## Examples

      # Check how many goblins exist in the world
      count = Entities.count_by_key("goblin_warrior")
  """
  def count_by_key(key) when is_binary(key) do
    EntitySchema
    |> where([e], e.key == ^key)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts entities in a specific location.

  Uses SQL COUNT aggregate for efficiency instead of loading all entities.

  ## Examples

      # Count entities in a room
      count = Entities.count_by_location("room-uuid")
  """
  def count_by_location(location_id) when is_binary(location_id) do
    EntitySchema
    |> where([e], e.location_id == ^location_id)
    |> Repo.aggregate(:count)
  end

  def count_by_location(nil), do: 0

  @doc """
  Gets multiple entities by their IDs in a single query.

  ## Examples

      # Batch fetch entities
      entities = Entities.get_all_by_ids(["uuid1", "uuid2", "uuid3"])
  """
  def get_all_by_ids([]), do: []

  def get_all_by_ids(ids) when is_list(ids) do
    EntitySchema
    |> where([e], e.id in ^ids)
    |> Repo.all()
  end

  @doc """
  Counts entities by key in a specific room.

  ## Examples

      # Check how many goblins are in a specific room
      count = Entities.count_by_key_in_room("goblin_warrior", room_id)
  """
  def count_by_key_in_room(key, room_id) when is_binary(key) and is_binary(room_id) do
    EntitySchema
    |> where([e], e.key == ^key and e.location_id == ^room_id)
    |> Repo.aggregate(:count)
  end

  @doc """
  Counts all entities.
  """
  def count_all do
    Repo.aggregate(EntitySchema, :count)
  end

  # =============================================================================
  # Query Helpers
  # =============================================================================

  @doc """
  Lists all entities of a given type.
  """
  def list_by_type(type) do
    list_entities(type: type)
  end

  @doc """
  Lists rooms with their contents preloaded.
  """
  def list_rooms do
    list_entities(type: :room, preload: [:contents])
  end

  @doc """
  Gets a room with its exits and contents.
  """
  def get_room(id) do
    EntitySchema
    |> where([e], e.id == ^id and e.type == :room)
    |> preload([:contents])
    |> Repo.one()
  end

  @doc """
  Gets entities at a specific location.
  """
  def get_contents(location_id) do
    EntitySchema
    |> where([e], e.location_id == ^location_id)
    |> Repo.all()
  end

  @doc """
  Gets entities at multiple locations in a single query.

  Returns a map of location_id => list of entities.

  ## Examples

      # Batch fetch contents for multiple rooms
      contents_by_room = Entities.get_contents_batch(["room1", "room2", "room3"])
      # => %{"room1" => [entity1, entity2], "room2" => [entity3], "room3" => []}
  """
  def get_contents_batch([]), do: %{}

  def get_contents_batch(location_ids) when is_list(location_ids) do
    EntitySchema
    |> where([e], e.location_id in ^location_ids)
    |> Repo.all()
    |> Enum.group_by(& &1.location_id)
    |> then(fn grouped ->
      # Ensure all requested location_ids have entries (even if empty)
      Enum.reduce(location_ids, grouped, fn id, acc ->
        Map.put_new(acc, id, [])
      end)
    end)
  end

  @doc """
  Finds an entity by its prototype key in metadata.
  """
  def find_by_prototype_key(prototype_key) do
    # Search in metadata JSONB field for prototype_key
    EntitySchema
    |> where([e], fragment("json_extract(?, '$.prototype_key') = ?", e.metadata, ^prototype_key))
    |> limit(1)
    |> Repo.one()
  end

  @doc """
  Deletes all entities in the database.

  Returns the count of deleted entities.
  """
  def delete_all do
    {count, _} = Repo.delete_all(EntitySchema)
    count
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp filter_by_type(query, nil), do: query

  defp filter_by_type(query, types) when is_list(types) do
    where(query, [e], e.type in ^types)
  end

  defp filter_by_type(query, type) do
    where(query, [e], e.type == ^type)
  end

  defp filter_by_location(query, nil), do: query

  defp filter_by_location(query, location_id) do
    where(query, [e], e.location_id == ^location_id)
  end

  defp filter_by_category(query, nil), do: query

  defp filter_by_category(query, category) do
    where(query, [a], a.category == ^category)
  end

  defp preload_associations(query, []), do: query

  defp preload_associations(query, associations) do
    preload(query, ^associations)
  end

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
