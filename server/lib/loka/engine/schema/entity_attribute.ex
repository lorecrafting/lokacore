defmodule Loka.Engine.Schema.EntityAttribute do
  @moduledoc """
  Ecto schema for entity attributes using the EAV (Entity-Attribute-Value) pattern.

  This allows storing arbitrary key-value data on entities without modifying the schema. Attributes can be categorized
  for organizational purposes.

  ## Example

      # Store a persistent attribute
      Entities.set_attribute(entity_id, "health", %{current: 100, max: 100})

      # Store in a category
      Entities.set_attribute(entity_id, "strength", 18, "stats")

      # Retrieve
      Entities.get_attribute(entity_id, "health")
      # => %{current: 100, max: 100}
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Loka.Engine.Schema.EntitySchema

  schema "entity_attributes" do
    field :key, :string
    field :category, :string, default: "default"
    field :value, Loka.Ecto.Json
    field :str_value, :string

    belongs_to :entity, EntitySchema, type: :binary_id

    timestamps(type: :utc_datetime)
  end

  @required_fields [:entity_id, :key, :value]
  @optional_fields [:category, :str_value]

  @doc """
  Creates a changeset for attribute creation or update.
  """
  def changeset(attribute, attrs) do
    attribute
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> unique_constraint([:entity_id, :key, :category])
    |> foreign_key_constraint(:entity_id)
    |> compute_str_value()
  end

  # Compute a searchable string representation of the value
  defp compute_str_value(changeset) do
    case get_change(changeset, :value) do
      nil -> changeset
      value -> put_change(changeset, :str_value, to_searchable_string(value))
    end
  end

  defp to_searchable_string(value) when is_binary(value), do: String.slice(value, 0, 255)
  defp to_searchable_string(value) when is_number(value), do: to_string(value)
  defp to_searchable_string(value) when is_atom(value), do: to_string(value)
  defp to_searchable_string(value) when is_boolean(value), do: to_string(value)
  defp to_searchable_string(_), do: nil
end
