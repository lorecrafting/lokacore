defmodule Loka.Repo.Migrations.FixAuditLogUserReference do
  use Ecto.Migration

  @doc """
  Fix the world_builder_audit_log table's user_id foreign key.

  The original migration referenced :users (which doesn't exist),
  but the actual table is :players. SQLite enforces FK constraints
  on the referenced table's existence, causing "no such table: main.users"
  errors on every insert.

  SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate the table.
  """
  def up do
    # Drop existing indexes first (they reference the old table)
    execute("DROP INDEX IF EXISTS world_builder_audit_log_project_key_index")
    execute("DROP INDEX IF EXISTS world_builder_audit_log_conversation_id_index")
    execute("DROP INDEX IF EXISTS world_builder_audit_log_inserted_at_index")

    # Rename old table
    rename table(:world_builder_audit_log), to: table(:world_builder_audit_log_old)

    # Create new table with correct FK reference
    create table(:world_builder_audit_log) do
      add :project_key, :string
      add :conversation_id, :string
      add :user_id, references(:players, on_delete: :nilify_all)
      add :tool_name, :string, null: false
      add :tool_args, :text, null: false
      add :result_status, :string, null: false
      add :result_detail, :text
      add :llm_response, :text

      timestamps(updated_at: false)
    end

    create index(:world_builder_audit_log, [:project_key])
    create index(:world_builder_audit_log, [:conversation_id])
    create index(:world_builder_audit_log, [:inserted_at])

    # Copy existing data
    execute("""
    INSERT INTO world_builder_audit_log
      (id, project_key, conversation_id, user_id, tool_name, tool_args,
       result_status, result_detail, llm_response, inserted_at)
    SELECT id, project_key, conversation_id, user_id, tool_name, tool_args,
           result_status, result_detail, llm_response, inserted_at
    FROM world_builder_audit_log_old
    """)

    drop table(:world_builder_audit_log_old)
  end

  def down do
    # Drop indexes
    execute("DROP INDEX IF EXISTS world_builder_audit_log_project_key_index")
    execute("DROP INDEX IF EXISTS world_builder_audit_log_conversation_id_index")
    execute("DROP INDEX IF EXISTS world_builder_audit_log_inserted_at_index")

    rename table(:world_builder_audit_log), to: table(:world_builder_audit_log_old)

    create table(:world_builder_audit_log) do
      add :project_key, :string
      add :conversation_id, :string
      add :user_id, references(:users, on_delete: :nilify_all)
      add :tool_name, :string, null: false
      add :tool_args, :text, null: false
      add :result_status, :string, null: false
      add :result_detail, :text
      add :llm_response, :text

      timestamps(updated_at: false)
    end

    create index(:world_builder_audit_log, [:project_key])
    create index(:world_builder_audit_log, [:conversation_id])
    create index(:world_builder_audit_log, [:inserted_at])

    execute("""
    INSERT INTO world_builder_audit_log
      (id, project_key, conversation_id, user_id, tool_name, tool_args,
       result_status, result_detail, llm_response, inserted_at)
    SELECT id, project_key, conversation_id, user_id, tool_name, tool_args,
           result_status, result_detail, llm_response, inserted_at
    FROM world_builder_audit_log_old
    """)

    drop table(:world_builder_audit_log_old)
  end
end
