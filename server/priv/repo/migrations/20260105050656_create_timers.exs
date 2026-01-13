defmodule Loka.Repo.Migrations.CreateTimers do
  use Ecto.Migration

  def change do
    create table(:timers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, on_delete: :delete_all), null: false
      add :timer_type, :string, null: false
      add :duration_ms, :integer, null: false
      add :scheduled_at, :utc_datetime_usec, null: false
      add :completes_at, :utc_datetime_usec, null: false
      add :completed_at, :utc_datetime_usec
      add :delivered, :boolean, default: false, null: false
      add :cancelled, :boolean, default: false, null: false
      add :data, :map, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    # Index for finding player's pending timers
    create index(:timers, [:player_id, :completed_at, :cancelled])

    # Index for finding all pending timers (server startup)
    create index(:timers, [:completed_at, :cancelled, :completes_at])

    # Index for finding undelivered completed timers
    create index(:timers, [:player_id, :delivered, :completed_at])
  end
end
