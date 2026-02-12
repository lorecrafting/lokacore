defmodule Loka.Engine.Schema.EntityLogSchema do
  @moduledoc """
  Ecto schema for the entity audit log.

  Records changes to entities for debugging and auditing purposes.
  Each entry captures what changed, who/what triggered it, and when.
  """

  use Ecto.Schema
  import Ecto.Changeset

  schema "entity_log" do
    field :entity_id, :binary_id
    field :action, :string
    field :changes, Loka.Ecto.Json
    field :source, :string

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(log, attrs) do
    log
    |> cast(attrs, [:entity_id, :action, :changes, :source])
    |> validate_required([:action])
    |> foreign_key_constraint(:entity_id)
  end
end
