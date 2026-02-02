defmodule Loka.Repo.Migrations.CreateWorldBuilderProjects do
  use Ecto.Migration

  def change do
    # Project documents table - stores design docs, planning files, notes
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

    # Audit log table - tracks every LLM action
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
  end
end
