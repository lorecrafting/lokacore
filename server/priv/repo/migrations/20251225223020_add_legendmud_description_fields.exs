defmodule Loka.Repo.Migrations.AddLegendmudDescriptionFields do
  @moduledoc """
  Add LegendMUD-style description fields to entities.

  Field mapping:
  - `name` column: Already exists, stores short_desc (action/speech name)
  - `description` column: Already exists, stores extra_desc (examine text)
  - `long_desc`: NEW - room display sentence with verb
  - `keywords`: NEW - array of targeting words
  - `mood`: NEW - current mood affecting display
  """
  use Ecto.Migration

  def change do
    alter table(:entities) do
      # Room display sentence (e.g., "A young monk waits anxiously here.")
      add :long_desc, :string, size: 500

      # Words that can be used to target the entity
      add :keywords, {:array, :string}, default: []

      # Current mood affecting display (e.g., "anxious", "cheerful")
      add :mood, :string, size: 50
    end
  end
end
