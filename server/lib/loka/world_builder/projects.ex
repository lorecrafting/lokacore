defmodule Loka.WorldBuilder.Projects do
  @moduledoc """
  Context module for World Builder project operations.

  Projects are workspaces for building game worlds, containing:
  - Design documents (world concept, characters, locations)
  - Planning files (build status, session logs)
  - Notes and research
  """

  import Ecto.Query
  alias Loka.Repo
  alias Loka.WorldBuilder.ProjectDocument

  # ============================================================================
  # Project Operations
  # ============================================================================

  @doc """
  List all unique project keys.
  """
  def list_projects do
    ProjectDocument
    |> select([d], d.project_key)
    |> distinct(true)
    |> order_by([d], d.project_key)
    |> Repo.all()
  end

  @doc """
  Get project overview including all documents and stats.
  """
  def get_project(project_key) do
    docs = list_docs(project_key)

    if Enum.empty?(docs) do
      {:error, :not_found}
    else
      {:ok,
       %{
         key: project_key,
         documents: docs,
         stats: %{
           design_docs: Enum.count(docs, &(&1.doc_type == "design")),
           planning_docs: Enum.count(docs, &(&1.doc_type == "planning")),
           notes: Enum.count(docs, &(&1.doc_type == "notes")),
           total_docs: length(docs)
         }
       }}
    end
  end

  @doc """
  Create a new project with initial context document.
  """
  def create_project(key, name, description \\ "") do
    content = """
    # #{name}

    #{description}

    ## Project Status

    - Created: #{Date.utc_today()}
    - Status: In Design

    ## Documents

    Use the World Builder LLM to create design documents for this world.
    """

    create_doc(key, "README.md", content, "planning")
  end

  @doc """
  Delete a project and all its documents.
  """
  def delete_project(project_key) do
    {count, _} =
      ProjectDocument
      |> where([d], d.project_key == ^project_key)
      |> Repo.delete_all()

    if count > 0 do
      {:ok, count}
    else
      {:error, :not_found}
    end
  end

  # ============================================================================
  # Document Operations
  # ============================================================================

  @doc """
  List all documents in a project, optionally filtered by type.
  """
  def list_docs(project_key, doc_type \\ nil) do
    query =
      ProjectDocument
      |> where([d], d.project_key == ^project_key)
      |> order_by([d], [d.doc_type, d.filename])

    query =
      if doc_type do
        where(query, [d], d.doc_type == ^doc_type)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Get a specific document by project and filename.
  """
  def get_doc(project_key, filename) do
    case Repo.get_by(ProjectDocument, project_key: project_key, filename: filename) do
      nil -> {:error, :not_found}
      doc -> {:ok, doc}
    end
  end

  @doc """
  Create or update a document.

  If the document exists, updates it and increments version.
  If not, creates a new document.
  """
  def write_doc(project_key, filename, content, doc_type \\ "design") do
    case get_doc(project_key, filename) do
      {:ok, existing} ->
        update_doc(existing, %{content: content, doc_type: doc_type})

      {:error, :not_found} ->
        create_doc(project_key, filename, content, doc_type)
    end
  end

  @doc """
  Create a new document.
  """
  def create_doc(project_key, filename, content, doc_type \\ "design") do
    %ProjectDocument{}
    |> ProjectDocument.changeset(%{
      project_key: project_key,
      filename: filename,
      content: content,
      doc_type: doc_type
    })
    |> Repo.insert()
  end

  @doc """
  Update an existing document.
  """
  def update_doc(%ProjectDocument{} = doc, attrs) do
    doc
    |> ProjectDocument.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Delete a document.
  """
  def delete_doc(project_key, filename) do
    case get_doc(project_key, filename) do
      {:ok, doc} -> Repo.delete(doc)
      error -> error
    end
  end

  # ============================================================================
  # Query Helpers
  # ============================================================================

  @doc """
  Search documents by content.
  """
  def search_docs(project_key, search_term) do
    search_pattern = "%#{search_term}%"

    ProjectDocument
    |> where([d], d.project_key == ^project_key)
    |> where([d], ilike(d.content, ^search_pattern) or ilike(d.filename, ^search_pattern))
    |> order_by([d], d.filename)
    |> Repo.all()
  end

  @doc """
  Get document history (all versions of a document).
  Note: Current implementation only stores latest version.
  Future: Could add version history table.
  """
  def get_doc_versions(project_key, filename) do
    case get_doc(project_key, filename) do
      {:ok, doc} -> {:ok, [doc]}
      error -> error
    end
  end

  # ============================================================================
  # Export/Import
  # ============================================================================

  @doc """
  Export all project documents as a map for JSON/file export.
  """
  def export_project(project_key) do
    case get_project(project_key) do
      {:ok, project} ->
        docs =
          Enum.map(project.documents, fn doc ->
            %{
              filename: doc.filename,
              content: doc.content,
              doc_type: doc.doc_type,
              version: doc.version,
              updated_at: doc.updated_at
            }
          end)

        {:ok, %{key: project_key, documents: docs, exported_at: DateTime.utc_now()}}

      error ->
        error
    end
  end

  @doc """
  Import project documents from exported data.
  """
  def import_project(project_key, documents) when is_list(documents) do
    Repo.transaction(fn ->
      Enum.map(documents, fn doc ->
        case write_doc(
               project_key,
               doc["filename"] || doc[:filename],
               doc["content"] || doc[:content],
               doc["doc_type"] || doc[:doc_type] || "design"
             ) do
          {:ok, saved} -> saved
          {:error, changeset} -> Repo.rollback(changeset)
        end
      end)
    end)
  end
end
