defmodule Loka.Repo.Migrations.AddGuestFieldsToPlayers do
  use Ecto.Migration

  def change do
    alter table(:players) do
      add :device_id, :string
      add :name, :string
    end

    # Make email nullable for guest accounts
    execute "UPDATE players SET device_id = 'legacy-' || id WHERE device_id IS NULL",
            "SELECT 1"

    create unique_index(:players, [:device_id])
  end
end
