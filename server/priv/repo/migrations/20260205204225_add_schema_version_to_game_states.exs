defmodule Loka.Repo.Migrations.AddSchemaVersionToGameStates do
  use Ecto.Migration

  def change do
    alter table(:player_game_states) do
      add :schema_version, :integer, default: 0, null: false
    end
  end
end
