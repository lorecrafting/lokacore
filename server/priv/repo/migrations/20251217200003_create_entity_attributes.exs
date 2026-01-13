defmodule Loka.Repo.Migrations.CreateEntityAttributes do
  use Ecto.Migration

  def change do
    create table(:entity_attributes) do
      add :entity_id, references(:entities, type: :uuid, on_delete: :delete_all), null: false
      add :key, :string, null: false
      add :category, :string, default: "default"
      add :value, :text, null: false
      add :str_value, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:entity_attributes, [:entity_id, :key, :category])
    create index(:entity_attributes, [:key])
    create index(:entity_attributes, [:category])
  end
end
