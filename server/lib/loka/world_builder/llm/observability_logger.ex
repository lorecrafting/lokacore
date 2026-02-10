defmodule Loka.WorldBuilder.LLM.ObservabilityLogger do
  @moduledoc """
  Logs LLM tool calls to JSON Lines files for debugging and observability.

  Log files are stored in `priv/llm_logs/{date}_llm_log.jsonl` with daily rotation.
  """
  use GenServer
  require Logger

  # =============================================================================
  # Public API
  # =============================================================================

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Log a tool call execution.
  """
  def log_tool_call(session_id, tool_name, input, result) do
    GenServer.cast(
      __MODULE__,
      {:log, session_id, :tool_call,
       %{
         tool_name: tool_name,
         input: sanitize_for_json(input),
         result: sanitize_for_json(result)
       }}
    )
  end

  @doc """
  Generate a unique session ID for tracking a conversation.
  """
  def generate_session_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    ensure_log_dir()
    {:ok, %{current_file: nil, current_date: nil}}
  end

  @impl true
  def handle_cast({:log, session_id, type, data}, state) do
    state = ensure_current_file(state)

    entry = %{
      ts: DateTime.to_iso8601(DateTime.utc_now()),
      session_id: session_id,
      type: type,
      data: data
    }

    case Jason.encode(entry) do
      {:ok, json} ->
        line = json <> "\n"

        case File.write(state.current_file, line, [:append]) do
          :ok ->
            :ok

          {:error, reason} ->
            Logger.warning("[ObservabilityLogger] Failed to write log: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning("[ObservabilityLogger] Failed to encode log entry: #{inspect(reason)}")
    end

    {:noreply, state}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp ensure_log_dir do
    path = log_dir_path()
    File.mkdir_p!(path)
  end

  defp log_dir_path do
    Path.join([:code.priv_dir(:loka), "llm_logs"])
  end

  defp ensure_current_file(state) do
    today = Date.utc_today()

    if state.current_date != today do
      filename = "#{Date.to_string(today)}_llm_log.jsonl"
      path = Path.join(log_dir_path(), filename)
      %{state | current_file: path, current_date: today}
    else
      state
    end
  end

  # Sanitize data for JSON encoding (convert atoms, structs, etc.)
  defp sanitize_for_json(data) when is_map(data) do
    data
    |> Map.new(fn {k, v} ->
      key = if is_atom(k), do: Atom.to_string(k), else: k
      {key, sanitize_for_json(v)}
    end)
  end

  defp sanitize_for_json(data) when is_list(data) do
    Enum.map(data, &sanitize_for_json/1)
  end

  defp sanitize_for_json(data) when is_tuple(data) do
    data |> Tuple.to_list() |> sanitize_for_json()
  end

  defp sanitize_for_json(data) when is_atom(data), do: Atom.to_string(data)

  defp sanitize_for_json(data) when is_struct(data),
    do: Map.from_struct(data) |> sanitize_for_json()

  defp sanitize_for_json(data) when is_pid(data), do: inspect(data)
  defp sanitize_for_json(data) when is_reference(data), do: inspect(data)
  defp sanitize_for_json(data) when is_function(data), do: "#Function"
  defp sanitize_for_json(data), do: data
end
