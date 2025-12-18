defmodule Exmud.Engine.Schema.EntitySchema do
  @moduledoc """
  Ecto schema for persisting entities to the database.

  Uses Evennia-style storage pattern:
  - Core fields (id, type, key, name, description) are direct columns
  - Complex data (components, behaviors, locks, scripts) are serialized using Erlang terms
  - Flexible attributes use the EntityAttribute EAV table
  - Contents are derived from entities where location_id = this entity's id
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Exmud.Engine.Schema.EntityAttribute
  alias Exmud.Engine.Entity

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @entity_types [:room, :character, :npc, :item, :exit]

  schema "entities" do
    field :type, Ecto.Enum, values: @entity_types
    field :key, :string
    field :name, :string
    field :description, :string
    field :location_id, :binary_id

    # Serialized complex data
    field :components, Exmud.Ecto.Term, default: %{}
    field :behaviors, Exmud.Ecto.Term, default: []
    field :tags, {:array, :string}, default: []
    field :locks, Exmud.Ecto.Term, default: %{}
    field :scripts, Exmud.Ecto.Term, default: %{}
    field :metadata, Exmud.Ecto.Term, default: %{}

    # Relationships
    has_many :attributes, EntityAttribute, foreign_key: :entity_id
    belongs_to :location, __MODULE__, define_field: false
    has_many :contents, __MODULE__, foreign_key: :location_id

    timestamps(type: :utc_datetime)
  end

  @required_fields [:type, :key]
  @optional_fields [:name, :description, :location_id, :components, :behaviors, :tags, :locks, :scripts, :metadata]

  @doc """
  Creates a changeset for entity creation or update.
  """
  def changeset(entity, attrs) do
    entity
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:type, @entity_types)
    |> unique_constraint(:key)
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
      name: schema.name,
      description: schema.description,
      location_id: schema.location_id,
      contents: extract_content_ids(schema),
      components: schema.components || %{},
      behaviors: schema.behaviors || [],
      attributes: extract_attributes(schema),
      tags: schema.tags || [],
      scripts: schema.scripts || %{},
      locks: schema.locks || %{},
      metadata: Map.merge(
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
      name: entity.name,
      description: entity.description,
      location_id: entity.location_id,
      components: entity.components,
      behaviors: entity.behaviors,
      tags: entity.tags,
      locks: entity.locks,
      scripts: entity.scripts,
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
