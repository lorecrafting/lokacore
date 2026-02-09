defmodule Loka.WorldBuilder.AuditLog do
  @moduledoc """
  Context module for World Builder audit logging.

  Automatically logs every LLM tool call for debugging and auditing.
  """

  import Ecto.Query
  alias Loka.Repo
  alias Loka.WorldBuilder.AuditLogEntry

  @doc """
  Log a tool call.
  """
  def log_tool_call(attrs) do
    %AuditLogEntry{}
    |> AuditLogEntry.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Log a successful tool call.
  """
  def log_success(conversation_id, tool_name, tool_args, result_detail \\ nil) do
    log_tool_call(%{
      conversation_id: conversation_id,
      tool_name: tool_name,
      tool_args: encode_args(tool_args),
      result_status: "success",
      result_detail: result_detail
    })
  end

  @doc """
  Log a failed tool call.
  """
  def log_error(conversation_id, tool_name, tool_args, error_message) do
    log_tool_call(%{
      conversation_id: conversation_id,
      tool_name: tool_name,
      tool_args: encode_args(tool_args),
      result_status: "error",
      result_detail: error_message
    })
  end

  @doc """
  Get all log entries for a conversation.
  """
  def list_by_conversation(conversation_id) do
    AuditLogEntry
    |> where([e], e.conversation_id == ^conversation_id)
    |> order_by([e], e.inserted_at)
    |> Repo.all()
  end

  @doc """
  Get recent log entries.
  """
  def list_recent(limit \\ 50) do
    AuditLogEntry
    |> order_by([e], desc: e.inserted_at)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc """
  Get entries with errors.
  """
  def list_errors(opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    AuditLogEntry
    |> where([e], e.result_status == "error")
    |> order_by([e], desc: e.inserted_at)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc """
  Export conversation as transcript.
  """
  def export_conversation(conversation_id) do
    entries = list_by_conversation(conversation_id)

    transcript =
      Enum.map(entries, fn entry ->
        %{
          timestamp: entry.inserted_at,
          tool: entry.tool_name,
          args: Jason.decode!(entry.tool_args),
          status: entry.result_status,
          result: entry.result_detail,
          llm_response: entry.llm_response
        }
      end)

    %{
      conversation_id: conversation_id,
      entries: transcript,
      exported_at: DateTime.utc_now()
    }
  end

  @doc """
  Clean up old entries (older than days).
  """
  def cleanup_old_entries(days \\ 30) do
    cutoff = DateTime.add(DateTime.utc_now(), -days * 24 * 60 * 60, :second)

    {count, _} =
      AuditLogEntry
      |> where([e], e.inserted_at < ^cutoff)
      |> Repo.delete_all()

    {:ok, count}
  end

  # Private helpers

  defp encode_args(args) when is_map(args), do: Jason.encode!(args)
  defp encode_args(args) when is_binary(args), do: args
  defp encode_args(args), do: inspect(args)
end
