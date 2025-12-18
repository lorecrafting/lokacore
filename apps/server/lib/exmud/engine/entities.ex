defmodule Exmud.Engine.Entities do
  @moduledoc """
  Context for managing entities in the database.

  Provides CRUD operations for entities and their attributes, following
  the Evennia-style persistence pattern with serialized complex data and
  EAV attributes.
  """

  import Ecto.Query
  alias Exmud.Repo
  alias Exmud.Engine.Entity
  alias Exmud.Engine.Schema.{EntitySchema, EntityAttribute}

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
  """
  def get_entity_by_key(key) when is_binary(key) do
    Repo.get_by(EntitySchema, key: key)
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
  """
  def update_entity(%EntitySchema{} = entity, attrs) do
    entity
    |> EntitySchema.changeset(normalize_attrs(attrs))
    |> Repo.update()
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
  Counts all entities.
  """
  def count_all do
    Repo.aggregate(EntitySchema, :count)
  end

  # =============================================================================
  # Query Helpers
  # =============================================================================

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
