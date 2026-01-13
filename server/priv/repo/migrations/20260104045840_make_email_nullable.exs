defmodule Loka.Repo.Migrations.MakeEmailNullable do
  use Ecto.Migration

  def change do
    # SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
    # This is a one-way migration since we're removing a constraint

    execute """
            CREATE TABLE players_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT,
              hashed_password TEXT,
              confirmed_at TEXT,
              is_admin INTEGER DEFAULT 0 NOT NULL,
              device_id TEXT,
              name TEXT,
              inserted_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """,
            "DROP TABLE players_new"

    execute """
            INSERT INTO players_new (id, email, hashed_password, confirmed_at, is_admin, device_id, name, inserted_at, updated_at)
            SELECT id, email, hashed_password, confirmed_at, is_admin, device_id, name, inserted_at, updated_at FROM players
            """,
            "SELECT 1"

    execute "DROP TABLE players", "SELECT 1"

    execute "ALTER TABLE players_new RENAME TO players", "SELECT 1"

    # Recreate indexes
    create unique_index(:players, [:email], where: "email IS NOT NULL")
    create unique_index(:players, [:device_id], where: "device_id IS NOT NULL")
  end
end
