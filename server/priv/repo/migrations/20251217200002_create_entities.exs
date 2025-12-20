defmodule Exmud.Repo.Migrations.CreateEntities do
  use Ecto.Migration

  def change do
    create table(:entities, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :type, :string, null: false
      add :key, :string, null: false
      add :name, :string
      add :description, :text
      add :location_id, references(:entities, type: :uuid, on_delete: :nilify_all)

      # Serialized complex data (Erlang term binary)
      add :components, :binary
      add :behaviors, :binary
      add :tags, {:array, :string}, default: []
      add :locks, :binary
      add :scripts, :binary
      add :metadata, :binary

      timestamps(type: :utc_datetime)
    end

    create unique_index(:entities, [:key])
    create index(:entities, [:type])
    create index(:entities, [:location_id])
  end
end
