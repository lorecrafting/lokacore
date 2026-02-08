defmodule Loka.Engine.Schema.EntitySchema do
  @moduledoc """
  Ecto schema for persisting entities to the database.

  Uses a hybrid storage pattern:
  - Core fields (id, type, key, short_desc, long_desc, extra_desc) are direct columns
  - Complex data (components, behaviors, locks, scripts) are serialized using Erlang terms
  - Flexible attributes use the EntityAttribute EAV table
  - Contents are derived from entities where location_id = this entity's id

  ## Description Fields (LegendMUD Style)

  - `short_desc` - Action/speech identifier (~40 chars, e.g., "Novice Pema")
  - `long_desc` - Room display sentence with verb (<=79 chars)
  - `extra_desc` - Detailed prose for examination
  - `keywords` - Words for targeting/referencing the entity
  - `primary_keyword` - Single keyword for touch/click UI (e.g., "monk")
  - `mood` - Current mood affecting display
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Loka.Engine.Schema.EntityAttribute
  alias Loka.Engine.Entity
  alias Loka.Engine.Constants.EntityTypes

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @entity_types EntityTypes.all()

  schema "entities" do
    field :type, Ecto.Enum, values: @entity_types
    field :key, :string

    # TypedObject inheritance fields
    field :parent_key, :string
    field :prototype_key, :string
    field :is_prototype, :boolean, default: false

    # LegendMUD-style description fields
    # (TypedObject uses name/description/extra_description which map to these)
    field :short_desc, :string
    field :long_desc, :string
    field :extra_desc, :string
    field :keywords, {:array, :string}, default: []
    field :primary_keyword, :string
    field :mood, :string

    field :location_id, :binary_id

    # Serialized complex data (stored as JSON for queryability)
    field :components, Loka.Ecto.Json, default: %{}
    field :behaviors, Loka.Ecto.Json, default: []
    field :tags, {:array, :string}, default: []
    field :locks, Loka.Ecto.Json, default: %{}
    field :scripts, Loka.Ecto.Json, default: %{}
    field :data, Loka.Ecto.Json, default: %{}
    field :metadata, Loka.Ecto.Json, default: %{}

    # Relationships
    has_many :attributes, EntityAttribute, foreign_key: :entity_id
    belongs_to :location, __MODULE__, define_field: false
    has_many :contents, __MODULE__, foreign_key: :location_id

    timestamps(type: :utc_datetime)
  end

  @required_fields [:type, :key]
  @optional_fields [
    :parent_key,
    :prototype_key,
    :is_prototype,
    :short_desc,
    :long_desc,
    :extra_desc,
    :keywords,
    :primary_keyword,
    :mood,
    :location_id,
    :components,
    :behaviors,
    :tags,
    :locks,
    :scripts,
    :data,
    :metadata
  ]

  # Input validation limits
  @max_key_length 100
  @max_short_desc_length 200
  @max_long_desc_length 500
  @max_extra_desc_length 10_000

  @doc """
  Creates a changeset for entity creation or update.
  """
  def changeset(entity, attrs) do
    entity
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:type, @entity_types)
    |> validate_length(:key, max: @max_key_length)
    |> validate_length(:short_desc, max: @max_short_desc_length)
    |> validate_length(:long_desc, max: @max_long_desc_length)
    |> validate_length(:extra_desc, max: @max_extra_desc_length)
    # Note: key is not unique - multiple instances of the same prototype share keys
    # Use id (UUID) for instance-specific lookups
    |> foreign_key_constraint(:location_id)
  end

  @doc """
  Converts the schema to an Entity struct for in-memory use.
  """
  def to_entity(%__MODULE__{} = schema) do
    %Entity{
      id: schema.id,
      type: schema.type,
      key: schema.key,
      # TypedObject inheritance fields
      parent_key: schema.parent_key,
      prototype_key: schema.prototype_key,
      is_prototype: schema.is_prototype || false,
      short_desc: schema.short_desc,
      long_desc: schema.long_desc,
      extra_desc: schema.extra_desc,
      keywords: schema.keywords || [],
      primary_keyword: schema.primary_keyword,
      mood: schema.mood,
      location_id: schema.location_id,
      contents: extract_content_ids(schema),
      components: schema.components || %{},
      behaviors: schema.behaviors || [],
      attributes: extract_attributes(schema),
      tags: schema.tags || [],
      scripts: schema.scripts || %{},
      locks: schema.locks || %{},
      data: schema.data || %{},
      metadata:
        Map.merge(
          schema.metadata || %{},
          %{
            inserted_at: schema.inserted_at,
            updated_at: schema.updated_at
          }
        )
    }
  end

  @doc """
  Converts an Entity struct to changeset attrs for persistence.

  """
  def from_entity(%Entity{} = entity) do
    %{
      type: entity.type,
      key: entity.key,
      parent_key: entity.parent_key,
      prototype_key: entity.prototype_key,
      is_prototype: entity.is_prototype,
      short_desc: entity.short_desc,
      long_desc: entity.long_desc,
      extra_desc: entity.extra_desc,
      keywords: entity.keywords,
      primary_keyword: entity.primary_keyword,
      mood: entity.mood,
      location_id: entity.location_id,
      components: entity.components,
      behaviors: entity.behaviors,
      tags: entity.tags,
      locks: entity.locks,
      scripts: entity.scripts,
      data: entity.data,
      metadata: entity.metadata
    }
  end

  defp extract_content_ids(%__MODULE__{contents: %Ecto.Association.NotLoaded{}}), do: []

  defp extract_content_ids(%__MODULE__{contents: contents}) when is_list(contents) do
    Enum.map(contents, & &1.id)
  end

  defp extract_attributes(%__MODULE__{attributes: %Ecto.Association.NotLoaded{}}), do: %{}

  defp extract_attributes(%__MODULE__{attributes: attrs}) when is_list(attrs) do
    attrs
    |> Enum.group_by(& &1.category)
    |> Enum.map(fn {category, attrs} ->
      {category, Map.new(attrs, fn a -> {a.key, a.value} end)}
    end)
    |> Map.new()
  end
end
