defmodule Loka.Repo.Migrations.AddTypedObjectFieldsToEntities do
  @moduledoc """
  Add TypedObject-compatible fields to the entities table.

  This migration adds support for:
  - `parent_key` - Prototype inheritance
  - `prototype_key` - Source prototype for spawned instances
  - `is_prototype` - Flag for template vs instance
  - `data` - Generic type-specific storage (JSON)

  Display fields (name, description, extra_description) are NOT added as columns
  because they map directly to existing fields (short_desc, long_desc, extra_desc).
  The Entity struct provides transparent access to both naming conventions.
  """

  use Ecto.Migration

  def change do
    alter table(:entities) do
      # Prototype inheritance
      add :parent_key, :string

      # For spawned instances - track which prototype they came from
      add :prototype_key, :string

      # Flag to distinguish prototypes (templates) from instances
      add :is_prototype, :boolean, default: false

      # Generic data storage for type-specific fields
      add :data, :map, default: %{}
    end

    # Index for prototype lookups
    create index(:entities, [:prototype_key])

    # Index for parent inheritance chain traversal
    create index(:entities, [:parent_key])
  end
end
