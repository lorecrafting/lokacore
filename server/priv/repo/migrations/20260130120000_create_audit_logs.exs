defmodule Loka.Repo.Migrations.CreateAuditLogs do
  use Ecto.Migration

  @moduledoc """
  Creates the audit_logs table for tracking admin actions in World Builder.

  Stores who did what, when, and the before/after state of changes.
  Designed for queryable audit trail and compliance purposes.
  """

  def change do
    create table(:audit_logs, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :player_id, references(:players, on_delete: :nilify_all)

      # Action details
      add :action, :string, null: false
      add :entity_type, :string, null: false
      add :entity_key, :string

      # State snapshots (stored as JSON)
      add :before_state, :map
      add :after_state, :map

      # Additional context
      add :metadata, :map, default: %{}

      # Request info for security audit
      add :ip_address, :string
      add :user_agent, :string

      # Only inserted_at needed - audit logs are immutable
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    # Index for finding logs by admin user
    create index(:audit_logs, [:player_id])

    # Index for finding logs by entity
    create index(:audit_logs, [:entity_type, :entity_key])

    # Index for finding logs by action type
    create index(:audit_logs, [:action])

    # Index for time-based queries (recent logs, date range)
    create index(:audit_logs, [:inserted_at])

    # Composite index for filtered queries (e.g., "all room creates in last week")
    create index(:audit_logs, [:entity_type, :action, :inserted_at])
  end
end
