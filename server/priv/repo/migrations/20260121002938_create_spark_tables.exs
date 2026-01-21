defmodule Loka.Repo.Migrations.CreateSparkTables do
  use Ecto.Migration

  def change do
    # Main Spark state table - one per player
    create table(:spark_states, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false

      # Bond progression
      add :bond_level, :string, default: "stranger"
      add :bond_points, :integer, default: 0

      # Awakening (story progression)
      add :awakening_stage, :string, default: "dormant"

      # Personality (set at character creation)
      add :personality_traits, {:array, :string}, default: []

      # Visual form (starts as mote, others unlocked)
      add :visual_form, :string, default: "mote"
      add :unlocked_forms, {:array, :string}, default: ["mote"]

      # Name (revealed through bond progression)
      add :revealed_name, :string

      # Preferences
      add :verbosity, :string, default: "normal"
      add :last_hint_at, :utc_datetime
      add :suppressed_hints, {:array, :string}, default: []

      # Unlocked lore/memories (keys to content)
      add :unlocked_memories, {:array, :string}, default: []

      # Session tracking for "while you were away"
      add :last_seen_at, :utc_datetime

      timestamps()
    end

    create unique_index(:spark_states, [:player_id])
    create index(:spark_states, [:bond_level])

    # Events table for "while you were away" tracking
    create table(:spark_events, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, type: :binary_id, on_delete: :delete_all), null: false

      # Event classification
      add :event_type, :string, null: false
      add :event_key, :string
      add :summary, :string

      # Flexible event data
      add :details, :map, default: %{}

      # Timing
      add :occurred_at, :utc_datetime, null: false

      # Delivery tracking
      add :delivered, :boolean, default: false
      add :delivered_at, :utc_datetime

      timestamps()
    end

    create index(:spark_events, [:player_id])
    create index(:spark_events, [:player_id, :delivered])
    create index(:spark_events, [:occurred_at])
    create index(:spark_events, [:event_type])
  end
end
