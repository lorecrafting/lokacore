defmodule Loka.Repo.Migrations.RestoreMissingTables do
  @moduledoc """
  Restores tables that were dropped but not recreated in the UUID migration.

  The migrate_players_to_uuid migration dropped all tables referencing players
  to recreate them with binary_id FKs, but forgot to recreate: scripts,
  world_builder_audit_log, spark_states, spark_events.
  """
  use Ecto.Migration

  def up do
    # Restore scripts table (used by Script.Executor)
    create table(:scripts) do
      add :name, :string, null: false
      add :description, :text
      add :source, :text, null: false
      add :hook, :string
      add :enabled, :boolean, default: true

      timestamps(type: :utc_datetime)
    end

    create unique_index(:scripts, [:name])
    create index(:scripts, [:hook])
    create index(:scripts, [:enabled])

    # Restore world_builder_audit_log (used by ToolExecutor)
    create table(:world_builder_audit_log) do
      add :conversation_id, :string
      add :user_id, references(:players, type: :binary_id, on_delete: :nilify_all)
      add :tool_name, :string, null: false
      add :tool_args, :text, null: false
      add :result_status, :string, null: false
      add :result_detail, :text
      add :llm_response, :text

      timestamps(updated_at: false)
    end

    create index(:world_builder_audit_log, [:conversation_id])
    create index(:world_builder_audit_log, [:inserted_at])

    # Restore spark_states (used by Spark system)
    create table(:spark_states, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :bond_level, :string, default: "stranger"
      add :bond_points, :integer, default: 0
      add :awakening_stage, :string, default: "dormant"
      add :personality_traits, {:array, :string}, default: []
      add :visual_form, :string, default: "mote"
      add :unlocked_forms, {:array, :string}, default: ["mote"]
      add :revealed_name, :string
      add :verbosity, :string, default: "normal"
      add :last_hint_at, :utc_datetime
      add :suppressed_hints, {:array, :string}, default: []
      add :unlocked_memories, {:array, :string}, default: []
      add :last_seen_at, :utc_datetime

      timestamps()
    end

    create unique_index(:spark_states, [:player_id])
    create index(:spark_states, [:bond_level])

    # Restore spark_events (used by Spark system)
    create table(:spark_events, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false
      add :event_type, :string, null: false
      add :event_key, :string
      add :summary, :string
      add :details, :map, default: %{}
      add :occurred_at, :utc_datetime, null: false
      add :delivered, :boolean, default: false
      add :delivered_at, :utc_datetime

      timestamps()
    end

    create index(:spark_events, [:player_id])
    create index(:spark_events, [:player_id, :delivered])
    create index(:spark_events, [:occurred_at])
    create index(:spark_events, [:event_type])
  end

  def down do
    drop_if_exists table(:spark_events)
    drop_if_exists table(:spark_states)
    drop_if_exists table(:world_builder_audit_log)
    drop_if_exists table(:scripts)
  end
end
