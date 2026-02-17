defmodule Loka.Repo.Migrations.DropPlayerGameStates do
  use Ecto.Migration

  def up do
    drop_if_exists table(:player_game_states)
  end

  def down do
    create table(:player_game_states, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, :binary_id, null: false
      add :character_name, :string
      add :gender, :string
      add :background, :string
      add :inventory, :text, default: "[]"
      add :equipment, :text, default: "{}"
      add :quests, :text, default: "{}"
      add :flags, :text, default: "{}"
      add :stats, :text, default: "{}"
      add :health, :text, default: "{}"
      add :resources, :text, default: "{}"
      add :skills, :text, default: "{}"
      add :settings, :text, default: "{}"
      add :current_room_id, :binary_id
      add :schema_version, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create unique_index(:player_game_states, [:player_id])

    create unique_index(:player_game_states, [:character_name],
             name: :player_game_states_character_name_unique_index
           )
  end
end
