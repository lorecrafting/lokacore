defmodule Loka.Repo.Migrations.AddResourcesAndSkillsToGameStates do
  use Ecto.Migration

  def change do
    alter table(:player_game_states) do
      add :resources, :text, default: "{}"
      add :skills, :text, default: "{}"
    end
  end
end
