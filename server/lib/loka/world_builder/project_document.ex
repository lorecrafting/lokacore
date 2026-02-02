defmodule Loka.WorldBuilder.ProjectDocument do
  @moduledoc """
  Schema for project documents stored in the database.

  Documents can be:
  - design: World concept, characters, locations, narrative structure
  - planning: Build status, session logs, decisions
  - notes: Freeform notes, ideas, research
  """
  use Ecto.Schema
  import Ecto.Changeset

  @type doc_type :: :design | :planning | :notes
  @valid_doc_types ~w(design planning notes)

  schema "project_documents" do
    field :project_key, :string
    field :filename, :string
    field :content, :string
    field :doc_type, :string, default: "design"
    field :version, :integer, default: 1

    timestamps()
  end

  @doc """
  Changeset for creating a new document.
  """
  def changeset(document, attrs) do
    document
    |> cast(attrs, [:project_key, :filename, :content, :doc_type, :version])
    |> validate_required([:project_key, :filename, :content])
    |> validate_inclusion(:doc_type, @valid_doc_types)
    |> validate_project_key()
    |> validate_filename()
    |> validate_content_size()
    |> unique_constraint([:project_key, :filename])
  end

  @doc """
  Changeset for updating document content.
  Increments version automatically.
  """
  def update_changeset(document, attrs) do
    document
    |> cast(attrs, [:content, :doc_type])
    |> validate_inclusion(:doc_type, @valid_doc_types)
    |> validate_content_size()
    |> increment_version()
  end

  # Validation helpers

  defp validate_project_key(changeset) do
    validate_format(changeset, :project_key, ~r/^[a-z][a-z0-9_-]*$/,
      message:
        "must start with letter and contain only lowercase letters, numbers, dashes, underscores"
    )
  end

  defp validate_filename(changeset) do
    validate_format(changeset, :filename, ~r/^[A-Za-z0-9_-]+\.(md|yml|yaml)$/,
      message: "must be alphanumeric with .md, .yml, or .yaml extension"
    )
  end

  defp validate_content_size(changeset) do
    validate_length(changeset, :content,
      max: 500_000,
      message: "content too large (max 500KB)"
    )
  end

  defp increment_version(changeset) do
    case get_field(changeset, :version) do
      nil -> put_change(changeset, :version, 1)
      v -> put_change(changeset, :version, v + 1)
    end
  end
end
