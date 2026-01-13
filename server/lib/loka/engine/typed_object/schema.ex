defmodule Loka.Engine.TypedObject.Schema do
  @moduledoc """
  Ecto schema for TypedObject database storage.

  This schema maps TypedObjects to the `typed_objects` table for persistence.
  Most TypedObjects are loaded from YAML and cached in ETS, but this schema
  enables:
  - Storing runtime entity instances
  - Database-backed content management
  - Player-created content persistence
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Loka.Engine.TypedObject

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "typed_objects" do
    # Identity
    field :key, :string
    field :type, :string
    field :subtype, :string
    field :parent_key, :string
    field :is_prototype, :boolean, default: true
    field :prototype_key, :string

    # Display
    field :name, :string
    field :description, :string
    field :extra_description, :string
    field :keywords, {:array, :string}, default: []

    # Flexible storage
    field :attributes, :map, default: %{}
    field :tags, {:array, :string}, default: []
    field :locks, :map, default: %{}
    field :data, :map, default: %{}
    field :metadata, :map, default: %{}

    # Entity-specific (IC only)
    field :location_id, :binary_id
    field :contents, {:array, :binary_id}, default: []
    field :components, :map, default: %{}
    field :behaviors, {:array, :string}, default: []
    field :scripts, :map, default: %{}

    timestamps(type: :utc_datetime)
  end

  @required_fields [:key, :type]
  @optional_fields [
    :subtype,
    :parent_key,
    :is_prototype,
    :prototype_key,
    :name,
    :description,
    :extra_description,
    :keywords,
    :attributes,
    :tags,
    :locks,
    :data,
    :metadata,
    :location_id,
    :contents,
    :components,
    :behaviors,
    :scripts
  ]

  @doc """
  Creates a changeset for inserting/updating a TypedObject.
  """
  def changeset(schema \\ %__MODULE__{}, attrs) do
    schema
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:type, TypedObject.valid_types() |> Enum.map(&to_string/1))
    |> validate_key_format()
    |> unique_constraint(:key, name: :typed_objects_key_index)
  end

  @doc """
  Creates a changeset for creating a new prototype.
  """
  def prototype_changeset(attrs) do
    %__MODULE__{}
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> put_change(:is_prototype, true)
    |> validate_inclusion(:type, TypedObject.valid_types() |> Enum.map(&to_string/1))
    |> validate_key_format()
    |> unique_constraint(:key, name: :typed_objects_key_index)
  end

  @doc """
  Creates a changeset for creating an entity instance from a prototype.
  """
  def instance_changeset(prototype_key, attrs) do
    %__MODULE__{}
    |> cast(attrs, @optional_fields)
    |> put_change(:is_prototype, false)
    |> put_change(:prototype_key, prototype_key)
    |> put_change(:type, "entity")
    |> generate_instance_key(prototype_key)
  end

  @doc """
  Converts a schema struct to a TypedObject struct.
  """
  @spec to_typed_object(%__MODULE__{}) :: {:ok, TypedObject.t()} | {:error, term()}
  def to_typed_object(%__MODULE__{} = schema) do
    TypedObject.new(%{
      id: schema.id,
      key: schema.key,
      type: String.to_existing_atom(schema.type),
      subtype: if(schema.subtype, do: String.to_existing_atom(schema.subtype)),
      parent_key: schema.parent_key,
      is_prototype: schema.is_prototype,
      prototype_key: schema.prototype_key,
      name: schema.name,
      description: schema.description,
      extra_description: schema.extra_description,
      keywords: schema.keywords || [],
      attributes: schema.attributes || %{},
      tags: schema.tags || [],
      locks: schema.locks || %{},
      data: schema.data || %{},
      metadata: schema.metadata || %{},
      location_id: schema.location_id,
      contents: schema.contents || [],
      components: schema.components || %{},
      behaviors: normalize_behaviors(schema.behaviors || []),
      scripts: schema.scripts || %{}
    })
  end

  @doc """
  Converts a TypedObject struct to a map suitable for changeset.
  """
  @spec from_typed_object(TypedObject.t()) :: map()
  def from_typed_object(%TypedObject{} = typed_object) do
    %{
      id: typed_object.id,
      key: typed_object.key,
      type: to_string(typed_object.type),
      subtype: if(typed_object.subtype, do: to_string(typed_object.subtype)),
      parent_key: typed_object.parent_key,
      is_prototype: typed_object.is_prototype,
      prototype_key: typed_object.prototype_key,
      name: typed_object.name,
      description: typed_object.description,
      extra_description: typed_object.extra_description,
      keywords: typed_object.keywords,
      attributes: typed_object.attributes,
      tags: typed_object.tags,
      locks: typed_object.locks,
      data: typed_object.data,
      metadata: typed_object.metadata,
      location_id: typed_object.location_id,
      contents: typed_object.contents,
      components: typed_object.components,
      behaviors: Enum.map(typed_object.behaviors, &to_string/1),
      scripts: typed_object.scripts
    }
  end

  # Private helpers

  defp validate_key_format(changeset) do
    validate_change(changeset, :key, fn :key, key ->
      if Regex.match?(~r/^[a-zA-Z][a-zA-Z0-9_-]*$/, key) do
        []
      else
        [key: "must be a valid identifier (alphanumeric, underscore, hyphen)"]
      end
    end)
  end

  defp generate_instance_key(changeset, prototype_key) do
    short_id = UUID.uuid4() |> String.split("-") |> List.first()
    put_change(changeset, :key, "#{prototype_key}_#{short_id}")
  end

  defp normalize_behaviors(behaviors) when is_list(behaviors) do
    Enum.map(behaviors, fn
      b when is_binary(b) ->
        module_string = if String.starts_with?(b, "Elixir."), do: b, else: "Elixir.#{b}"

        try do
          String.to_existing_atom(module_string)
        rescue
          ArgumentError -> b
        end

      b when is_atom(b) ->
        b
    end)
  end
end
