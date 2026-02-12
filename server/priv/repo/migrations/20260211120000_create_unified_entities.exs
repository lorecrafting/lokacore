defmodule Loka.Repo.Migrations.CreateUnifiedEntities do
  use Ecto.Migration

  def up do
    # Drop old tables (pre-production: no data to preserve)
    drop_if_exists table(:entity_attributes)
    drop_if_exists table(:player_game_states)
    drop_if_exists table(:entities)

    create table(:entities, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :type, :string, null: false
      add :key, :string
      add :prototype_key, :string
      add :is_prototype, :boolean, default: false
      add :version, :integer, default: 1
      add :short_desc, :string
      add :long_desc, :string
      add :extra_desc, :text
      add :keywords, :text, default: "[]"
      add :primary_keyword, :string
      add :mood, :string
      add :location_id, references(:entities, type: :binary_id, on_delete: :nilify_all)
      add :account_id, references(:players, on_delete: :nilify_all)
      add :components, :text, default: "{}"
      add :behaviors, :text, default: "[]"
      add :scripts, :text, default: "{}"
      add :metadata, :text, default: "{}"
      timestamps(type: :utc_datetime)
    end

    create table(:entity_tags, primary_key: false) do
      add :entity_id, references(:entities, type: :binary_id, on_delete: :delete_all), null: false

      add :tag, :string, null: false
    end

    # Audit log
    create table(:entity_log) do
      add :entity_id, references(:entities, type: :binary_id, on_delete: :delete_all)
      add :action, :string, null: false
      add :changes, :text
      add :source, :string
      timestamps(type: :utc_datetime, updated_at: false)
    end

    # Indexes
    create index(:entities, [:type])
    create index(:entities, [:key])
    create index(:entities, [:location_id])
    create index(:entities, [:location_id, :type])
    create index(:entities, [:account_id])
    create index(:entities, [:prototype_key])
    create index(:entities, [:is_prototype])

    create unique_index(:entities, [:key, :type],
             where: "is_prototype = 1",
             name: :entities_prototype_unique
           )

    create index(:entity_tags, [:tag])
    create index(:entity_tags, [:entity_id])
    create unique_index(:entity_tags, [:entity_id, :tag])

    create index(:entity_log, [:entity_id])
    create index(:entity_log, [:action])
  end

  def down do
    drop_if_exists table(:entity_log)
    drop_if_exists table(:entity_tags)
    drop_if_exists table(:entities)
  end
end
