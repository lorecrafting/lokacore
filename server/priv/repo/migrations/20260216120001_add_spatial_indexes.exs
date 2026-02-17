defmodule Loka.Repo.Migrations.AddSpatialIndexes do
  use Ecto.Migration

  def up do
    # SQLite supports expression indexes via json_extract.
    # This avoids full table scans for spatial queries.
    execute """
    CREATE INDEX entities_room_coordinates
    ON entities(
      json_extract(components, '$.coordinates.x'),
      json_extract(components, '$.coordinates.y'),
      COALESCE(json_extract(components, '$.coordinates.z'), 0)
    )
    WHERE type = 'room'
      AND json_extract(components, '$.coordinates.x') IS NOT NULL
    """
  end

  def down do
    execute "DROP INDEX IF EXISTS entities_room_coordinates"
  end
end
