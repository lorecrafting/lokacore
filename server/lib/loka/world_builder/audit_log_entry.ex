defmodule Loka.WorldBuilder.AuditLogEntry do
  @moduledoc """
  Schema for World Builder audit log entries.

  Every LLM tool call is logged for debugging and auditing purposes.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @valid_statuses ~w(success error pending)

  schema "world_builder_audit_log" do
    field :project_key, :string
    field :conversation_id, :string
    field :tool_name, :string
    field :tool_args, :string
    field :result_status, :string
    field :result_detail, :string
    field :llm_response, :string
    field :user_id, :integer

    timestamps(updated_at: false)
  end

  @doc """
  Changeset for creating an audit log entry.
  """
  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :project_key,
      :conversation_id,
      :user_id,
      :tool_name,
      :tool_args,
      :result_status,
      :result_detail,
      :llm_response
    ])
    |> validate_required([:tool_name, :tool_args, :result_status])
    |> validate_inclusion(:result_status, @valid_statuses)
    |> encode_tool_args()
  end

  # Ensure tool_args is JSON encoded if passed as map
  defp encode_tool_args(changeset) do
    case get_change(changeset, :tool_args) do
      args when is_map(args) ->
        put_change(changeset, :tool_args, Jason.encode!(args))

      _ ->
        changeset
    end
  end
end
