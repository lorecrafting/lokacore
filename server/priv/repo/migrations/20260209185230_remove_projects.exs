defmodule Loka.Repo.Migrations.RemoveProjects do
  use Ecto.Migration

  def up do
    # Drop project_documents table
    drop table(:project_documents)

    # Recreate audit log without project_key column (SQLite can't ALTER DROP COLUMN)
    execute("DROP INDEX IF EXISTS world_builder_audit_log_project_key_index")
    execute("DROP INDEX IF EXISTS world_builder_audit_log_conversation_id_index")
    execute("DROP INDEX IF EXISTS world_builder_audit_log_inserted_at_index")

    rename table(:world_builder_audit_log), to: table(:world_builder_audit_log_old)

    create table(:world_builder_audit_log) do
      add :conversation_id, :string
      add :user_id, references(:players, on_delete: :nilify_all)
      add :tool_name, :string, null: false
      add :tool_args, :text, null: false
      add :result_status, :string, null: false
      add :result_detail, :text
      add :llm_response, :text

      timestamps(updated_at: false)
    end

    create index(:world_builder_audit_log, [:conversation_id])
    create index(:world_builder_audit_log, [:inserted_at])

    execute("""
    INSERT INTO world_builder_audit_log
      (id, conversation_id, user_id, tool_name, tool_args,
       result_status, result_detail, llm_response, inserted_at)
    SELECT id, conversation_id, user_id, tool_name, tool_args,
           result_status, result_detail, llm_response, inserted_at
    FROM world_builder_audit_log_old
    """)

    drop table(:world_builder_audit_log_old)
  end

  def down do
    # Recreate audit log with project_key column
    execute("DROP INDEX IF EXISTS world_builder_audit_log_conversation_id_index")
    execute("DROP INDEX IF EXISTS world_builder_audit_log_inserted_at_index")

    rename table(:world_builder_audit_log), to: table(:world_builder_audit_log_old)

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

    execute("""
    INSERT INTO world_builder_audit_log
      (id, project_key, conversation_id, user_id, tool_name, tool_args,
       result_status, result_detail, llm_response, inserted_at)
    SELECT id, NULL, conversation_id, user_id, tool_name, tool_args,
           result_status, result_detail, llm_response, inserted_at
    FROM world_builder_audit_log_old
    """)

    drop table(:world_builder_audit_log_old)

    # Recreate project_documents table
    create table(:project_documents) do
      add :project_key, :string, null: false
      add :filename, :string, null: false
      add :content, :text, null: false
      add :doc_type, :string, null: false, default: "design"
      add :version, :integer, null: false, default: 1

      timestamps()
    end

    create unique_index(:project_documents, [:project_key, :filename])
    create index(:project_documents, [:project_key])
    create index(:project_documents, [:doc_type])
  end
end
