defmodule Loka.Repo.Migrations.RemoveOrphanedBasePrototypes do
  use Ecto.Migration

  @orphaned_keys ~w(base_container base_herb base_item base_npc base_room base_weapon)

  def up do
    for key <- @orphaned_keys do
      execute("DELETE FROM entities WHERE key = '#{key}' AND is_prototype = 1")
    end
  end

  def down do
    # These were orphaned prototypes with no YAML source — nothing to restore
    :ok
  end
end
