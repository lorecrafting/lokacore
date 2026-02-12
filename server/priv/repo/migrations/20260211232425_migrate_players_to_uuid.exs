defmodule Loka.Repo.Migrations.MigratePlayersToUuid do
  @moduledoc """
  Migrates players and players_tokens tables to UUID primary keys.

  Pre-production migration: drops and recreates tables (no data to preserve).
  Also updates the entities.account_id FK to reference the new binary_id PK.
  """
  use Ecto.Migration

  def up do
    # Drop ALL dependent tables first (FK ordering)
    # Every table that references players (directly or transitively) must be dropped
    drop_if_exists table(:entity_log)
    drop_if_exists table(:entity_tags)
    drop_if_exists table(:entities)
    drop_if_exists table(:player_game_states)
    drop_if_exists table(:timers)
    drop_if_exists table(:audit_logs)
    drop_if_exists table(:world_builder_audit_log)
    drop_if_exists table(:spark_events)
    drop_if_exists table(:spark_states)
    drop_if_exists table(:scripts)
    drop_if_exists table(:typed_objects)
    drop_if_exists table(:entity_attributes)
    drop_if_exists table(:players_tokens)
    drop_if_exists table(:players)

    # Recreate players with binary_id PK
    create table(:players, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :email, :string, null: false, collate: :nocase
      add :hashed_password, :string
      add :confirmed_at, :utc_datetime
      add :is_admin, :boolean, default: false
      add :device_id, :string
      add :name, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:players, [:email])
    create unique_index(:players, [:device_id], where: "device_id IS NOT NULL")

    # Recreate players_tokens with binary_id PK and FK
    create table(:players_tokens, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :token, :binary, null: false, size: 32
      add :context, :string, null: false
      add :sent_to, :string
      add :authenticated_at, :utc_datetime

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:players_tokens, [:player_id])
    create unique_index(:players_tokens, [:context, :token])

    # Recreate player_game_states with binary_id FK (temporary, removed in Phase 4.3)
    create table(:player_game_states, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :character_name, :string
      add :gender, :string
      add :background, :string
      add :inventory, :text, default: nil
      add :equipment, :text, default: nil
      add :quests, :text, default: nil
      add :flags, :text, default: nil
      add :stats, :text, default: nil
      add :health, :text, default: nil
      add :resources, :text, default: nil
      add :skills, :text, default: nil
      add :current_room_id, :binary_id
      add :settings, :text
      add :schema_version, :integer, default: 1
      timestamps(type: :utc_datetime)
    end

    create unique_index(:player_game_states, [:player_id])
    create index(:player_game_states, [:current_room_id])

    # Recreate timers with binary_id FK
    create table(:timers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
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

    create index(:timers, [:player_id, :completed_at, :cancelled])
    create index(:timers, [:completed_at, :cancelled, :completes_at])
    create index(:timers, [:player_id, :delivered, :completed_at])

    # Recreate audit_logs with binary_id FK
    create table(:audit_logs, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :nilify_all)
      add :action, :string, null: false
      add :entity_type, :string, null: false
      add :entity_key, :string
      add :before_state, :map
      add :after_state, :map
      add :metadata, :map, default: %{}
      add :ip_address, :string
      add :user_agent, :string
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:audit_logs, [:player_id])
    create index(:audit_logs, [:entity_type, :entity_key])
    create index(:audit_logs, [:action])
    create index(:audit_logs, [:inserted_at])
    create index(:audit_logs, [:entity_type, :action, :inserted_at])

    # Recreate entities with binary_id account_id FK
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
      add :account_id, references(:players, type: :binary_id, on_delete: :nilify_all)
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

    create table(:entity_log) do
      add :entity_id, references(:entities, type: :binary_id, on_delete: :delete_all)
      add :action, :string, null: false
      add :changes, :text
      add :source, :string
      timestamps(type: :utc_datetime, updated_at: false)
    end

    # Entity indexes
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
    drop_if_exists table(:player_game_states)
    drop_if_exists table(:players_tokens)
    drop_if_exists table(:players)

    # Recreate original tables with integer PKs
    create table(:players) do
      add :email, :string, null: false, collate: :nocase
      add :hashed_password, :string
      add :confirmed_at, :utc_datetime
      add :is_admin, :boolean, default: false
      add :device_id, :string
      add :name, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:players, [:email])

    create table(:players_tokens) do
      add :player_id, references(:players, on_delete: :delete_all), null: false
      add :token, :binary, null: false, size: 32
      add :context, :string, null: false
      add :sent_to, :string
      add :authenticated_at, :utc_datetime

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:players_tokens, [:player_id])
    create unique_index(:players_tokens, [:context, :token])

    # Recreate player_game_states with integer FK
    create table(:player_game_states, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, on_delete: :delete_all), null: false
      add :inventory, :text, default: nil
      add :equipment, :text, default: nil
      add :quests, :text, default: nil
      add :flags, :text, default: nil
      add :stats, :text, default: nil
      add :health, :text, default: nil
      add :current_room_id, :binary_id
      timestamps(type: :utc_datetime)
    end

    create unique_index(:player_game_states, [:player_id])
    create index(:player_game_states, [:current_room_id])

    # Recreate entities with integer account_id
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

    create table(:entity_log) do
      add :entity_id, references(:entities, type: :binary_id, on_delete: :delete_all)
      add :action, :string, null: false
      add :changes, :text
      add :source, :string
      timestamps(type: :utc_datetime, updated_at: false)
    end

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
end
