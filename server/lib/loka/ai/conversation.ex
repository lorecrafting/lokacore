defmodule Loka.AI.Conversation do
  @moduledoc """
  Generic AI conversation engine.

  Manages message history, streams responses via AnthropicClient, and runs
  tool-use loops. Transport-agnostic: sends events to a caller PID.

  ## Events sent to caller_pid

  - `{:ai_text_delta, text}` — streaming text chunk
  - `{:ai_tool_use, name, id, input, result}` — tool executed (verbose mode)
  - `{:ai_done}` — response complete (no more tool calls)
  - `{:ai_error, reason}` — error occurred

  ## Verbosity modes

  - `:verbose` — sends `{:ai_tool_use, ...}` events to caller
  - `:conversational` — executes tools silently, only text deltas and done

  ## Usage

      config = %{
        tools: MCP.Tools.tools(),
        system_prompt_fn: &AIContext.builder_prompt/1,
        tool_executor_fn: &ToolExecutor.execute/3,
        verbosity: :verbose,
        caller_pid: self(),
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096
      }

      state = Conversation.new(config)
      state = Conversation.send_message(state, "Create a tavern room", %{})
  """

  require Logger

  alias Loka.WorldBuilder.AnthropicClient

  @type config :: %{
          tools: [map()],
          system_prompt_fn: (map() -> String.t()),
          tool_executor_fn: (String.t(), map(), keyword() -> {:ok, any()} | {:error, any()}),
          verbosity: :verbose | :conversational,
          caller_pid: pid(),
          model: String.t(),
          max_tokens: pos_integer()
        }

  @max_tool_iterations 10

  @type state :: %{
          messages: [map()],
          pending_tool_results: [map()],
          streaming: boolean(),
          tool_iterations: non_neg_integer(),
          config: config()
        }

  @doc """
  Create a new conversation state with the given config.
  """
  @spec new(config()) :: state()
  def new(config) do
    %{
      messages: [],
      pending_tool_results: [],
      streaming: false,
      tool_iterations: 0,
      config: config
    }
  end

  @doc """
  Send a user message and start streaming the AI response.
  """
  @spec send_message(state(), String.t(), map()) :: state()
  def send_message(state, user_message, context \\ %{}) do
    user_msg = %{role: "user", content: user_message}
    messages = state.messages ++ [user_msg]

    state = %{
      state
      | messages: messages,
        streaming: true,
        pending_tool_results: [],
        tool_iterations: 0
    }

    start_streaming(state, context)
  end

  @doc """
  Resend the current conversation to the AI (for retry after transient errors).
  Re-triggers streaming with existing messages without adding new ones.
  """
  @spec resend(state(), map()) :: state()
  def resend(state, context \\ %{}) do
    state = %{state | streaming: true}
    start_streaming(state, context)
  end

  @doc """
  Handle a text delta from the streaming response.
  """
  @spec handle_text_delta(state(), String.t()) :: state()
  def handle_text_delta(state, text) do
    send(state.config.caller_pid, {:ai_text_delta, text})
    state
  end

  @doc """
  Handle a tool use from the streaming response.
  Executes the tool and stores the result for continuation.
  """
  @spec handle_tool_use(state(), String.t(), String.t(), map()) :: state()
  def handle_tool_use(state, tool_name, tool_id, input) do
    config = state.config

    # Execute the tool
    result =
      try do
        case config.tool_executor_fn.(tool_name, input, []) do
          {:ok, data} -> %{success: true, data: data}
          {:error, reason} -> %{success: false, error: reason}
        end
      rescue
        e -> %{success: false, error: "Tool crashed: #{Exception.message(e)}"}
      end

    # Notify caller in verbose mode
    if config.verbosity == :verbose do
      send(config.caller_pid, {:ai_tool_use, tool_name, tool_id, input, result})
    end

    # Store pending tool result
    tool_result = %{
      tool_use_id: tool_id,
      tool_name: tool_name,
      input: input,
      result: result
    }

    %{state | pending_tool_results: state.pending_tool_results ++ [tool_result]}
  end

  @doc """
  Handle completion of a streaming response.
  If there are pending tool results, continues the conversation loop.
  If no pending tools, finalizes and sends :ai_done.
  """
  @spec handle_done(state(), map()) :: state()
  def handle_done(state, response) do
    # Add assistant message to history
    assistant_msg = %{
      role: "assistant",
      content: response.text,
      tool_uses: response.tool_uses
    }

    messages = state.messages ++ [assistant_msg]
    pending = state.pending_tool_results

    state = %{state | messages: messages, streaming: false, pending_tool_results: []}

    cond do
      pending == [] ->
        # Final response — no more tool calls
        send(state.config.caller_pid, {:ai_done})
        %{state | tool_iterations: 0}

      state.tool_iterations >= @max_tool_iterations ->
        Logger.warning(
          "[Conversation] Max tool iterations (#{@max_tool_iterations}) reached, stopping"
        )

        send(state.config.caller_pid, {:ai_done})
        %{state | tool_iterations: 0}

      true ->
        # Continue with tool results
        continue_with_tool_results(%{state | tool_iterations: state.tool_iterations + 1}, pending)
    end
  end

  @doc """
  Handle an error from the streaming response.
  """
  @spec handle_error(state(), any()) :: state()
  def handle_error(state, error) do
    send(state.config.caller_pid, {:ai_error, format_error(error)})
    %{state | streaming: false}
  end

  @doc """
  Clear conversation history.
  """
  @spec clear_history(state()) :: state()
  def clear_history(state) do
    %{state | messages: [], pending_tool_results: [], streaming: false}
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp start_streaming(state, context) do
    config = state.config
    caller = config.caller_pid

    # Build system prompt
    system = config.system_prompt_fn.(context)

    # Get tools in API format
    tools = format_tools(config.tools)

    # Format messages for API
    api_messages = format_messages_for_api(state.messages)

    # Start streaming via AnthropicClient
    on_error = fn error -> send(caller, {:ai_error, format_error(error)}) end

    Task.start(fn ->
      case AnthropicClient.chat(
             api_messages,
             tools,
             system: system,
             model: config.model,
             max_tokens: config.max_tokens,
             on_text: fn text -> send(caller, {:ai_text_delta, text}) end,
             on_tool_use: fn name, id, input ->
               send(caller, {:ai_tool_use_raw, name, id, input})
             end,
             on_done: fn response -> send(caller, {:ai_done_raw, response}) end,
             on_error: on_error
           ) do
        {:error, reason} -> on_error.(reason)
        _ -> :ok
      end
    end)

    state
  end

  defp continue_with_tool_results(state, tool_results) do
    # Add tool result messages to history
    result_messages =
      Enum.map(tool_results, fn tr ->
        content =
          if tr.result.success do
            format_tool_result(tr.result.data)
          else
            "Error: #{inspect(tr.result.error)}"
          end

        %{
          role: "tool_result",
          tool_use_id: tr.tool_use_id,
          tool_name: tr.tool_name,
          content: content,
          is_error: not tr.result.success
        }
      end)

    messages = state.messages ++ result_messages
    state = %{state | messages: messages, streaming: true}

    # Continue streaming with updated context
    start_streaming(state, %{})
  end

  defp format_messages_for_api(messages) do
    Enum.flat_map(messages, fn msg ->
      case msg.role do
        "user" ->
          [%{role: "user", content: msg.content}]

        "assistant" ->
          content =
            if msg[:tool_uses] && msg.tool_uses != [] do
              text_blocks =
                if msg.content && msg.content != "" do
                  [%{type: "text", text: msg.content}]
                else
                  []
                end

              tool_blocks =
                Enum.map(msg.tool_uses, fn tu ->
                  %{type: "tool_use", id: tu.id, name: tu.name, input: tu.input}
                end)

              text_blocks ++ tool_blocks
            else
              msg.content
            end

          [%{role: "assistant", content: content}]

        "tool_result" ->
          [
            %{
              role: "user",
              content: [
                %{
                  type: "tool_result",
                  tool_use_id: msg.tool_use_id,
                  content: msg.content,
                  is_error: msg[:is_error] || false
                }
              ]
            }
          ]

        _ ->
          []
      end
    end)
  end

  defp format_tools(tools) do
    Enum.map(tools, fn tool ->
      %{
        name: tool[:name] || tool["name"],
        description: String.trim(tool[:description] || tool["description"] || ""),
        input_schema: tool[:input_schema] || tool[:inputSchema] || tool["input_schema"]
      }
    end)
  end

  defp format_tool_result(data) when is_binary(data), do: data
  defp format_tool_result(data) when is_map(data), do: Jason.encode!(data, pretty: true)
  defp format_tool_result(data) when is_list(data), do: Jason.encode!(data, pretty: true)
  defp format_tool_result(data), do: inspect(data)

  defp format_error(error) when is_binary(error), do: error
  defp format_error(error), do: inspect(error)
end
