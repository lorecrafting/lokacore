defmodule Loka.Repo.Migrations.AddUniqueConstraintToCharacterName do
  use Ecto.Migration

  def change do
    # Drop the existing non-unique index
    drop_if_exists index(:player_game_states, [:character_name])

    # Create a unique index (case-insensitive via lowercased name)
    # This allows "Kira" and prevents another player from using "kira" or "KIRA"
    create unique_index(:player_game_states, ["lower(character_name)"],
             name: :player_game_states_character_name_unique_index,
             where: "character_name IS NOT NULL"
           )
  end
end
