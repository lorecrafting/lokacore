defmodule Loka.Repo.Migrations.MakeEmailNullableAgain do
  use Ecto.Migration

  @doc """
  The UUID migration (20260211232425) recreated the players table with
  `email TEXT NOT NULL`, undoing the earlier nullable migration. SQLite
  doesn't support ALTER COLUMN, so we recreate the table.
  """
  def up do
    execute("""
    CREATE TABLE players_new (
      "id" TEXT PRIMARY KEY,
      "email" TEXT COLLATE NOCASE,
      "hashed_password" TEXT,
      "confirmed_at" TEXT,
      "is_admin" INTEGER DEFAULT false,
      "device_id" TEXT,
      "name" TEXT,
      "inserted_at" TEXT NOT NULL,
      "updated_at" TEXT NOT NULL
    )
    """)

    execute("""
    INSERT INTO players_new (id, email, hashed_password, confirmed_at, is_admin, device_id, name, inserted_at, updated_at)
    SELECT id, email, hashed_password, confirmed_at, is_admin, device_id, name, inserted_at, updated_at FROM players
    """)

    execute("DROP TABLE players")
    execute("ALTER TABLE players_new RENAME TO players")

    execute("CREATE UNIQUE INDEX players_email_index ON players (email) WHERE email IS NOT NULL")

    execute(
      "CREATE UNIQUE INDEX players_device_id_index ON players (device_id) WHERE device_id IS NOT NULL"
    )
  end

  def down do
    execute("""
    CREATE TABLE players_new (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL COLLATE NOCASE,
      "hashed_password" TEXT,
      "confirmed_at" TEXT,
      "is_admin" INTEGER DEFAULT false,
      "device_id" TEXT,
      "name" TEXT,
      "inserted_at" TEXT NOT NULL,
      "updated_at" TEXT NOT NULL
    )
    """)

    execute("""
    INSERT INTO players_new (id, email, hashed_password, confirmed_at, is_admin, device_id, name, inserted_at, updated_at)
    SELECT id, email, hashed_password, confirmed_at, is_admin, device_id, name, inserted_at, updated_at FROM players
    WHERE email IS NOT NULL
    """)

    execute("DROP TABLE players")
    execute("ALTER TABLE players_new RENAME TO players")

    execute("CREATE UNIQUE INDEX players_email_index ON players (email)")

    execute(
      "CREATE UNIQUE INDEX players_device_id_index ON players (device_id) WHERE device_id IS NOT NULL"
    )
  end
end
