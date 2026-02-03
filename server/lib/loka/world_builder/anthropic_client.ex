defmodule Loka.WorldBuilder.AnthropicClient do
  @moduledoc """
  Server-side Anthropic API client for the World Builder.

  Provides streaming chat completions with tool use support.
  Used by the LiveView chat component.
  """

  require Logger

  @api_url "https://api.anthropic.com/v1/messages"
  @api_version "2023-06-01"

  # Configurable via application config:
  # config :loka, Loka.WorldBuilder.AnthropicClient,
  #   default_model: "claude-sonnet-4-20250514",
  #   default_max_tokens: 4096,
  #   timeout: 120_000

  defp config(key, default) do
    Application.get_env(:loka, __MODULE__, [])
    |> Keyword.get(key, default)
  end

  defp default_model, do: config(:default_model, "claude-sonnet-4-20250514")
  defp default_max_tokens, do: config(:default_max_tokens, 4096)
  defp default_timeout, do: config(:timeout, 120_000)

  @doc """
  Send a message to Claude and stream the response.

  ## Parameters
    - messages: List of message maps with role and content
    - tools: List of tool definitions (optional)
    - opts: Options including:
      - :model - Model to use (default: claude-sonnet-4-20250514)
      - :max_tokens - Max tokens (default: 4096)
      - :system - System prompt
      - :on_text - Callback for text deltas: fn text -> ... end
      - :on_tool_use - Callback for tool calls: fn tool_name, tool_input -> ... end
      - :on_done - Callback when complete: fn response -> ... end
      - :on_error - Callback for errors: fn error -> ... end

  ## Returns
    - {:ok, response} on success
    - {:error, reason} on failure
  """
  def chat(messages, tools \\ [], opts \\ []) do
    api_key = get_api_key()

    if is_nil(api_key) do
      {:error, "ANTHROPIC_API_KEY not configured"}
    else
      do_chat(messages, tools, opts, api_key)
    end
  end

  @doc """
  Send a message and stream responses to a LiveView process.

  ## Parameters
    - lv_pid: LiveView process to send events to
    - messages: List of message maps
    - tools: List of tool definitions
    - opts: Additional options

  Events sent to LiveView:
    - {:anthropic_text_delta, text}
    - {:anthropic_tool_use, tool_name, tool_id, input}
    - {:anthropic_done, response}
    - {:anthropic_error, reason}
  """
  def stream_to_liveview(lv_pid, messages, tools \\ [], opts \\ []) do
    opts =
      opts
      |> Keyword.put(:on_text, fn text ->
        send(lv_pid, {:anthropic_text_delta, text})
      end)
      |> Keyword.put(:on_tool_use, fn tool_name, tool_id, input ->
        send(lv_pid, {:anthropic_tool_use, tool_name, tool_id, input})
      end)
      |> Keyword.put(:on_done, fn response ->
        send(lv_pid, {:anthropic_done, response})
      end)
      |> Keyword.put(:on_error, fn error ->
        send(lv_pid, {:anthropic_error, error})
      end)

    # Run in a separate process to not block LiveView
    Task.start(fn ->
      chat(messages, tools, opts)
    end)
  end

  defp do_chat(messages, tools, opts, api_key) do
    model = Keyword.get(opts, :model, default_model())
    max_tokens = Keyword.get(opts, :max_tokens, default_max_tokens())
    system = Keyword.get(opts, :system)

    body =
      %{
        model: model,
        max_tokens: max_tokens,
        messages: format_messages(messages),
        stream: true
      }
      |> maybe_add_system(system)
      |> maybe_add_tools(tools)

    headers = [
      {"Content-Type", "application/json"},
      {"x-api-key", api_key},
      {"anthropic-version", @api_version}
    ]

    Logger.info("[AnthropicClient] Starting chat with model: #{model}")

    case stream_request(@api_url, headers, body, opts) do
      {:ok, response} ->
        Logger.info("[AnthropicClient] Chat completed successfully")
        {:ok, response}

      {:error, reason} = error ->
        Logger.error("[AnthropicClient] Chat failed: #{inspect(reason)}")
        if on_error = opts[:on_error], do: on_error.(reason)
        error
    end
  end

  defp format_messages(messages) do
    Enum.map(messages, fn msg ->
      %{
        role: msg[:role] || msg["role"],
        content: msg[:content] || msg["content"]
      }
    end)
  end

  defp maybe_add_system(body, nil), do: body
  defp maybe_add_system(body, system), do: Map.put(body, :system, system)

  defp maybe_add_tools(body, []), do: body

  defp maybe_add_tools(body, tools) do
    formatted_tools =
      Enum.map(tools, fn tool ->
        %{
          name: tool[:name] || tool["name"],
          description: tool[:description] || tool["description"],
          input_schema: tool[:input_schema] || tool[:inputSchema] || tool["input_schema"]
        }
      end)

    Map.put(body, :tools, formatted_tools)
  end

  defp stream_request(url, headers, body, opts) do
    # Use Req for streaming HTTP with callback function
    on_text = opts[:on_text]
    on_tool_use = opts[:on_tool_use]
    on_done = opts[:on_done]

    # Accumulate response state
    initial_state = %{
      text: "",
      tool_uses: [],
      current_tool: nil,
      stop_reason: nil,
      buffer: ""
    }

    # Use into: with a callback function for proper Req 0.5.x streaming
    stream_fn = fn {:data, data}, {req, resp} ->
      # Process SSE data and update state
      state = Process.get(:anthropic_stream_state, initial_state)
      new_state = process_sse_data(data, state, on_text, on_tool_use)
      Process.put(:anthropic_stream_state, new_state)
      {:cont, {req, resp}}
    end

    # Initialize state in process dictionary
    Process.put(:anthropic_stream_state, initial_state)

    request =
      Req.new(
        url: url,
        method: :post,
        headers: headers,
        json: body,
        receive_timeout: default_timeout(),
        into: stream_fn
      )

    case Req.request(request) do
      {:ok, %Req.Response{status: 200}} ->
        # Get final state and clean up
        final_state = Process.get(:anthropic_stream_state, initial_state)
        Process.delete(:anthropic_stream_state)

        response = %{
          text: final_state.text,
          tool_uses: final_state.tool_uses,
          stop_reason: final_state.stop_reason
        }

        if on_done, do: on_done.(response)
        {:ok, response}

      {:ok, %Req.Response{status: status, body: body}} ->
        Process.delete(:anthropic_stream_state)
        {:error, "API error: #{status} - #{inspect(body)}"}

      {:error, reason} ->
        Process.delete(:anthropic_stream_state)
        {:error, "Request failed: #{inspect(reason)}"}
    end
  end

  defp process_sse_data(data, state, on_text, on_tool_use) do
    data
    |> String.split("\n")
    |> Enum.reduce(state, fn line, acc ->
      process_sse_line(line, acc, on_text, on_tool_use)
    end)
  end

  defp process_sse_line("data: " <> json_data, state, on_text, on_tool_use) do
    case Jason.decode(json_data) do
      {:ok, event} ->
        process_event(event, state, on_text, on_tool_use)

      {:error, _} ->
        state
    end
  end

  defp process_sse_line(_, state, _, _), do: state

  defp process_event(%{"type" => "content_block_start", "content_block" => block}, state, _, _) do
    case block do
      %{"type" => "tool_use", "id" => id, "name" => name} ->
        %{state | current_tool: %{id: id, name: name, input: ""}}

      _ ->
        state
    end
  end

  defp process_event(%{"type" => "content_block_delta", "delta" => delta}, state, on_text, _) do
    case delta do
      %{"type" => "text_delta", "text" => text} ->
        if on_text, do: on_text.(text)
        %{state | text: state.text <> text}

      %{"type" => "input_json_delta", "partial_json" => json} ->
        if state.current_tool do
          current = state.current_tool
          %{state | current_tool: %{current | input: current.input <> json}}
        else
          state
        end

      _ ->
        state
    end
  end

  defp process_event(%{"type" => "content_block_stop"}, state, _, on_tool_use) do
    if state.current_tool do
      tool = state.current_tool

      input =
        case Jason.decode(tool.input) do
          {:ok, parsed} -> parsed
          {:error, _} -> %{}
        end

      if on_tool_use, do: on_tool_use.(tool.name, tool.id, input)

      tool_use = %{
        id: tool.id,
        name: tool.name,
        input: input
      }

      %{state | tool_uses: state.tool_uses ++ [tool_use], current_tool: nil}
    else
      state
    end
  end

  defp process_event(
         %{"type" => "message_delta", "delta" => %{"stop_reason" => reason}},
         state,
         _,
         _
       ) do
    %{state | stop_reason: reason}
  end

  defp process_event(_, state, _, _), do: state

  defp get_api_key do
    Application.get_env(:loka, :anthropic_api_key) ||
      System.get_env("ANTHROPIC_API_KEY")
  end

  @doc """
  Get tool definitions in Anthropic API format.
  """
  def get_tools do
    alias Loka.WorldBuilder.MCP.Tools

    Tools.tools()
    |> Enum.map(fn tool ->
      %{
        name: tool.name,
        description: String.trim(tool.description),
        input_schema: tool.inputSchema
      }
    end)
  end
end
