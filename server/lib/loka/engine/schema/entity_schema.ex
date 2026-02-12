defmodule Loka.Engine.Schema.EntitySchema do
  @moduledoc """
  Ecto schema for persisting entities to the database (V2).

  Uses a hybrid storage pattern:
  - Core fields (id, type, key, short_desc, long_desc, extra_desc) are direct columns
  - Complex data (components, behaviors, scripts, metadata) are JSON text columns
  - Tags are in the entity_tags join table (not a column)
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

  alias Loka.Engine.Entity
  alias Loka.Engine.Constants.EntityTypes
  alias Loka.Engine.Schema.EntityTagSchema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @entity_types EntityTypes.all()

  schema "entities" do
    field :type, Ecto.Enum, values: @entity_types
    field :key, :string
    field :prototype_key, :string
    field :is_prototype, :boolean, default: false
    field :version, :integer, default: 1

    # LegendMUD-style description fields
    field :short_desc, :string
    field :long_desc, :string
    field :extra_desc, :string
    field :keywords, Loka.Ecto.Json, default: []
    field :primary_keyword, :string
    field :mood, :string

    field :location_id, :binary_id
    field :account_id, :integer

    # Serialized complex data (stored as JSON)
    field :components, Loka.Ecto.Json, default: %{}
    field :behaviors, Loka.Ecto.Json, default: []
    field :scripts, Loka.Ecto.Json, default: %{}
    field :metadata, Loka.Ecto.Json, default: %{}

    # Relationships
    has_many :tags, EntityTagSchema, foreign_key: :entity_id
    belongs_to :location, __MODULE__, define_field: false
    has_many :contents, __MODULE__, foreign_key: :location_id

    timestamps(type: :utc_datetime)
  end

  @required_fields [:type]
  @optional_fields [
    :key,
    :prototype_key,
    :is_prototype,
    :version,
    :short_desc,
    :long_desc,
    :extra_desc,
    :keywords,
    :primary_keyword,
    :mood,
    :location_id,
    :account_id,
    :components,
    :behaviors,
    :scripts,
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
    |> foreign_key_constraint(:location_id)
  end

  @doc """
  Converts the schema to an Entity struct for in-memory use.

  Tags must be loaded separately (they're in entity_tags join table).
  """
  def to_entity(%__MODULE__{} = schema) do
    %Entity{
      id: schema.id,
      type: schema.type,
      key: schema.key,
      prototype_key: schema.prototype_key,
      is_prototype: schema.is_prototype || false,
      version: schema.version || 1,
      short_desc: schema.short_desc,
      long_desc: schema.long_desc,
      extra_desc: schema.extra_desc,
      keywords: schema.keywords || [],
      primary_keyword: schema.primary_keyword,
      mood: schema.mood,
      location_id: schema.location_id,
      account_id: schema.account_id,
      components: schema.components || %{},
      behaviors: schema.behaviors || [],
      tags: extract_tags(schema),
      scripts: schema.scripts || %{},
      metadata:
        Map.merge(
          schema.metadata || %{},
          %{
            "inserted_at" => schema.inserted_at,
            "updated_at" => schema.updated_at
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
      prototype_key: entity.prototype_key,
      is_prototype: entity.is_prototype,
      version: entity.version,
      short_desc: entity.short_desc,
      long_desc: entity.long_desc,
      extra_desc: entity.extra_desc,
      keywords: entity.keywords,
      primary_keyword: entity.primary_keyword,
      mood: entity.mood,
      location_id: entity.location_id,
      account_id: entity.account_id,
      components: entity.components,
      behaviors: entity.behaviors,
      scripts: entity.scripts,
      metadata: entity.metadata
    }
  end

  defp extract_tags(%__MODULE__{tags: %Ecto.Association.NotLoaded{}}), do: []

  defp extract_tags(%__MODULE__{tags: tags}) when is_list(tags) do
    Enum.map(tags, & &1.tag)
  end
end
