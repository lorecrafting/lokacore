defmodule Loka.Repo.Migrations.CreateEntities do
  use Ecto.Migration

  def change do
    create table(:entities, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :type, :string, null: false
      add :key, :string, null: false
      add :name, :string
      add :description, :text
      add :location_id, references(:entities, type: :uuid, on_delete: :nilify_all)

      # Serialized complex data (JSON text for queryability)
      add :components, :text
      add :behaviors, :text
      add :tags, {:array, :string}, default: []
      add :locks, :text
      add :scripts, :text
      add :metadata, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:entities, [:key])
    create index(:entities, [:type])
    create index(:entities, [:location_id])
  end
end
