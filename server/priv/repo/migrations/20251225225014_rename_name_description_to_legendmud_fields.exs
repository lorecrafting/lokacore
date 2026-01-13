defmodule Loka.Repo.Migrations.RenameNameDescriptionToLegendmudFields do
  use Ecto.Migration

  def change do
    # Rename columns to match LegendMUD-style description fields
    rename table(:entities), :name, to: :short_desc
    rename table(:entities), :description, to: :extra_desc
  end
end
