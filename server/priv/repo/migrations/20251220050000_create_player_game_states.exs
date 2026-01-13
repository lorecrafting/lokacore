defmodule Loka.Repo.Migrations.CreatePlayerGameStates do
  use Ecto.Migration

  def change do
    create table(:player_game_states, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, on_delete: :delete_all), null: false

      # Game state stored as JSON text for queryability
      add :inventory, :text, default: nil
      add :equipment, :text, default: nil
      add :quests, :text, default: nil
      add :flags, :text, default: nil
      add :stats, :text, default: nil
      add :health, :text, default: nil

      # Current location reference
      add :current_room_id, :binary_id

      timestamps(type: :utc_datetime)
    end

    create unique_index(:player_game_states, [:player_id])
    create index(:player_game_states, [:current_room_id])
  end
end
