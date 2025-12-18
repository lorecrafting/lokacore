defmodule Exmud.Repo.Migrations.CreateScripts do
  use Ecto.Migration

  def change do
    create table(:scripts) do
      add :name, :string, null: false
      add :description, :text
      add :source, :text, null: false
      add :hook, :string
      add :enabled, :boolean, default: true

      timestamps(type: :utc_datetime)
    end

    create unique_index(:scripts, [:name])
    create index(:scripts, [:hook])
    create index(:scripts, [:enabled])
  end
end
