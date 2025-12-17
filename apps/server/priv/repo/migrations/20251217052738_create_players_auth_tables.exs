defmodule Exmud.Repo.Migrations.CreatePlayersAuthTables do
  use Ecto.Migration

  def change do
    create table(:players) do
      add :email, :string, null: false, collate: :nocase
      add :hashed_password, :string
      add :confirmed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:players, [:email])

    create table(:players_tokens) do
      add :player_id, references(:players, on_delete: :delete_all), null: false
      add :token, :binary, null: false, size: 32
      add :context, :string, null: false
      add :sent_to, :string
      add :authenticated_at, :utc_datetime

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:players_tokens, [:player_id])
    create unique_index(:players_tokens, [:context, :token])
  end
end
