defmodule Exmud.Repo.Migrations.AddIsAdminToPlayers do
  use Ecto.Migration

  def change do
    alter table(:players) do
      add :is_admin, :boolean, default: false, null: false
    end
  end
end
