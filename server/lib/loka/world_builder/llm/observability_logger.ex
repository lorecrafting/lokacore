defmodule Loka.WorldBuilder.LLM.ObservabilityLogger do
  @moduledoc """
  Logs LLM requests, responses, and tool calls to JSON Lines files
  for debugging and observability.

  Log files are stored in priv/llm_logs/ with daily rotation.
  Format: JSONL (one JSON object per line)

  ## Log Entry Types

  - `request` - LLM API request initiated
  - `response` - LLM API response received
  - `tool_call` - Tool execution started/completed
  - `error` - Error during LLM interaction
  - `context` - Context data sent to LLM

  ## Usage

      # Log an LLM request
      ObservabilityLogger.log_request(session_id, %{
        model: "claude-sonnet",
        messages_count: 5,
        tools_count: 10
      })

      # Log a tool call
      ObservabilityLogger.log_tool_call(session_id, "create_room", %{key: "tavern"}, %{success: true})

  ## Log File Location

  Log files are written to `priv/llm_logs/{date}_llm_log.jsonl`
  Claude Code can read these files to analyze LLM behavior and suggest improvements.
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
  Log an LLM request being initiated.

  ## Example
      ObservabilityLogger.log_request("sess_abc", %{
        model: "claude-sonnet",
        messages_count: 5,
        tools_count: 20,
        system_prompt_length: 1500
      })
  """
  def log_request(session_id, request_data) do
    GenServer.cast(__MODULE__, {:log, session_id, :request, request_data})
  end

  @doc """
  Log an LLM response received.

  ## Example
      ObservabilityLogger.log_response("sess_abc", %{
        status: 200,
        duration_ms: 1234,
        success: true,
        tokens_used: %{input: 500, output: 100}
      })
  """
  def log_response(session_id, response_data) do
    GenServer.cast(__MODULE__, {:log, session_id, :response, response_data})
  end

  @doc """
  Log a tool call execution.

  ## Example
      ObservabilityLogger.log_tool_call("sess_abc", "create_room",
        %{key: "tavern", name: "The Rusty Tankard"},
        %{success: true, duration_ms: 50}
      )
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
  Log context data sent to LLM.

  ## Example
      ObservabilityLogger.log_context("sess_abc", %{
        rooms_count: 30,
        selected_room: "tavern",
        validation_errors: 2
      })
  """
  def log_context(session_id, context_data) do
    GenServer.cast(__MODULE__, {:log, session_id, :context, context_data})
  end

  @doc """
  Log an error during LLM interaction.
  """
  def log_error(session_id, error_data) do
    GenServer.cast(__MODULE__, {:log, session_id, :error, error_data})
  end

  @doc """
  Get the current log file path.
  """
  def current_log_path do
    GenServer.call(__MODULE__, :get_log_path)
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

  @impl true
  def handle_call(:get_log_path, _from, state) do
    state = ensure_current_file(state)
    {:reply, state.current_file, state}
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
