defmodule Loka.Engine.Schema.EntityTagSchema do
  @moduledoc """
  Ecto schema for entity tags (join table).

  Tags provide lightweight classification for entities, stored in a separate
  table for efficient querying. Examples: "hostile", "auto_start", "quest_giver".
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false

  schema "entity_tags" do
    field :entity_id, :binary_id
    field :tag, :string
  end

  def changeset(tag_record, attrs) do
    tag_record
    |> cast(attrs, [:entity_id, :tag])
    |> validate_required([:entity_id, :tag])
    |> unique_constraint([:entity_id, :tag])
    |> foreign_key_constraint(:entity_id)
  end
end
