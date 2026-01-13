defmodule Loka.Repo.Migrations.RemoveUniqueKeyConstraint do
  use Ecto.Migration

  @doc """
  Removes the unique constraint on entity keys and backfills prototype keys.

  This migration transitions from:
    - key = "hungry_ghost_abc123" (unique per instance)

  To:
    - key = "hungry_ghost" (prototype key, shared by instances)
    - id (UUID) provides instance uniqueness

  Benefits:
    - Quest objectives can match entity.key directly
    - No need for prototype_key metadata workarounds
    - Cleaner mental model: key = "what it is", id = "which one"
  """

  def up do
    # 1. Drop the unique constraint on key
    drop_if_exists index(:entities, [:key], name: :entities_key_index)

    # 2. Backfill: strip suffixes from keys using prototype_key metadata
    # For entities that have prototype_key in metadata, use that as the new key
    execute """
    UPDATE entities
    SET key = json_extract(metadata, '$.prototype_key')
    WHERE json_extract(metadata, '$.prototype_key') IS NOT NULL
      AND key != json_extract(metadata, '$.prototype_key')
    """

    # 3. Add non-unique index on key for efficient type-based lookups
    create index(:entities, [:key])
  end

  def down do
    # Remove the non-unique index
    drop_if_exists index(:entities, [:key])

    # Restore unique suffixes to keys (using first 8 chars of UUID)
    execute """
    UPDATE entities
    SET key = key || '_' || substr(replace(id, '-', ''), 1, 8)
    WHERE type IN ('npc', 'item')
    """

    # Recreate unique constraint
    create unique_index(:entities, [:key], name: :entities_key_index)
  end
end
