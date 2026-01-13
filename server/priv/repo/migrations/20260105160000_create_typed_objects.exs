defmodule Loka.Repo.Migrations.CreateTypedObjects do
  @moduledoc """
  Create the typed_objects table - unified storage for all game content.

  TypedObjects are the universal foundation for:
  - Entities (IC): NPCs, rooms, items, exits - have location, GenServer
  - Content (OOC): Quests, dialogues, scripts, zones - definitions only
  """
  use Ecto.Migration

  def change do
    create table(:typed_objects, primary_key: false) do
      add :id, :binary_id, primary_key: true

      # Identity
      add :key, :string, null: false
      add :type, :string, null: false
      add :subtype, :string
      add :parent_key, :string
      add :is_prototype, :boolean, default: true
      add :prototype_key, :string

      # Display
      add :name, :string
      add :description, :text
      add :extra_description, :text
      add :keywords, {:array, :string}, default: []

      # Flexible storage (JSON in SQLite)
      add :attributes, :map, default: %{}
      add :tags, {:array, :string}, default: []
      add :locks, :map, default: %{}
      add :data, :map, default: %{}
      add :metadata, :map, default: %{}

      # Entity-specific (IC only)
      add :location_id, :binary_id
      add :contents, {:array, :binary_id}, default: []
      add :components, :map, default: %{}
      add :behaviors, {:array, :string}, default: []
      add :scripts, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    # Primary indexes
    create unique_index(:typed_objects, [:key], where: "is_prototype = true")
    create index(:typed_objects, [:type])
    create index(:typed_objects, [:type, :subtype])
    create index(:typed_objects, [:location_id])
    create index(:typed_objects, [:is_prototype])
    create index(:typed_objects, [:prototype_key])
    create index(:typed_objects, [:parent_key])
  end
end
