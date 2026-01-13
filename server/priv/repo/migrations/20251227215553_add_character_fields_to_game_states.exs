defmodule Loka.Repo.Migrations.AddCharacterFieldsToGameStates do
  use Ecto.Migration

  def change do
    alter table(:player_game_states) do
      add :character_name, :string
      add :gender, :string
      add :background, :string
    end

    # Index for looking up by character name (useful for social features)
    create index(:player_game_states, [:character_name])
  end
end
