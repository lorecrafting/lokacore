defmodule Loka.WorldBuilder.LLM.ClaudeClient do
  @moduledoc """
  Claude API client for World Builder LLM integration.

  Supports streaming responses and tool use for world manipulation.

  ## SSE Streaming

  The Claude API uses Server-Sent Events (SSE) format. Each event is prefixed
  with "data: " and events are separated by double newlines. This module handles
  parsing the SSE format and buffering partial chunks.

  ## Usage

      {:ok, pid} = ClaudeClient.stream_chat(messages, system_prompt, tools)
      # Receive messages:
      # {:stream_chunk, data} - raw SSE data chunk
      # :stream_complete - streaming finished

  Use `parse_sse_chunk/2` to parse raw chunks into events, maintaining a buffer
  for partial data across chunks.
  """

  require Logger

  @api_base "https://api.anthropic.com/v1"
  @model "claude-sonnet-4-5-20250929"
  @max_tokens 4000
  @default_receive_timeout 120_000
  @default_connect_timeout 10_000
  @api_version "2023-06-01"

  @doc """
  Streams a chat completion from Claude.

  ## Options

    * `:caller` - PID to receive stream messages (default: `self()`)
    * `:max_tokens` - Maximum tokens in response (default: #{@max_tokens})
    * `:receive_timeout` - Timeout for receiving data (default: #{@default_receive_timeout}ms)

  ## Messages sent to caller

    * `{:stream_chunk, data}` - Raw SSE data chunk (use `parse_sse_chunk/2` to parse)
    * `:stream_complete` - Streaming finished successfully
    * `{:stream_error, reason}` - Error occurred during streaming
  """
  def stream_chat(messages, system_prompt, tools \\ [], opts \\ []) do
    case get_api_key() do
      {:error, :api_key_not_configured} ->
        Logger.error("[ClaudeClient] API key not configured")
        {:error, :api_key_not_configured}

      api_key when is_binary(api_key) ->
        caller = opts[:caller] || self()
        receive_timeout = opts[:receive_timeout] || @default_receive_timeout

        request_body =
          %{
            model: @model,
            max_tokens: opts[:max_tokens] || @max_tokens,
            system: system_prompt,
            messages: messages,
            stream: true
          }
          |> maybe_add_tools(tools)

        case Req.post(
               url: "#{@api_base}/messages",
               json: request_body,
               headers: [
                 {"x-api-key", api_key},
                 {"anthropic-version", @api_version}
               ],
               receive_timeout: receive_timeout,
               connect_options: [timeout: @default_connect_timeout],
               into: fn {:data, data}, {req, resp} ->
                 send(caller, {:stream_chunk, data})
                 {:cont, {req, resp}}
               end
             ) do
          {:ok, %Req.Response{status: status}} when status in 200..299 ->
            send(caller, :stream_complete)
            :ok

          {:ok, %Req.Response{status: status, body: body}} ->
            error = {:http_error, status, body}
            Logger.error("[ClaudeClient] API returned status #{status}: #{inspect(body)}")
            send(caller, {:stream_error, error})
            {:error, error}

          {:error, %Req.TransportError{reason: :timeout}} ->
            Logger.error("[ClaudeClient] Request timed out after #{receive_timeout}ms")
            send(caller, {:stream_error, :timeout})
            {:error, :timeout}

          {:error, reason} ->
            Logger.error("[ClaudeClient] Request failed: #{inspect(reason)}")
            send(caller, {:stream_error, reason})
            {:error, reason}
        end
    end
  end

  # Only add tools key if tools list is non-empty
  defp maybe_add_tools(body, []), do: body
  defp maybe_add_tools(body, tools), do: Map.put(body, :tools, tools)

  @doc """
  Parses raw SSE data into events.

  SSE format: each event is prefixed with "data: " and events are separated
  by double newlines. This function handles:
  - Multiple events in a single chunk
  - Partial events split across chunks (via buffer)
  - The special "[DONE]" marker

  ## Parameters

    * `chunk` - Raw SSE data from the stream
    * `buffer` - Accumulated partial data from previous chunks

  ## Returns

  `{events, new_buffer}` where:
    * `events` - List of parsed JSON events (maps)
    * `new_buffer` - Partial data to carry forward to next chunk

  ## Example

      iex> {events, buffer} = ClaudeClient.parse_sse_chunk("data: {\\"type\\":\\"ping\\"}\\n\\n", "")
      {[%{"type" => "ping"}], ""}
  """
  def parse_sse_chunk(chunk, buffer) do
    # Combine with any buffered partial data
    data = buffer <> chunk

    # Split on double newlines (SSE event separator)
    parts = String.split(data, "\n\n")

    # Last part might be incomplete - buffer it for next chunk
    {complete_parts, incomplete} =
      case parts do
        [] -> {[], ""}
        [single] -> {[], single}
        many -> {Enum.drop(many, -1), List.last(many)}
      end

    # Parse each complete SSE event
    events =
      complete_parts
      |> Enum.flat_map(&parse_sse_lines/1)
      |> Enum.reject(&is_nil/1)

    {events, incomplete}
  end

  # Parse lines within a single SSE event block
  defp parse_sse_lines(block) do
    block
    |> String.split("\n")
    |> Enum.map(&parse_sse_line/1)
  end

  # Parse a single SSE line
  defp parse_sse_line("data: [DONE]"), do: nil

  defp parse_sse_line("data: " <> json_data) do
    case Jason.decode(json_data) do
      {:ok, parsed} -> parsed
      {:error, _} -> nil
    end
  end

  defp parse_sse_line(_), do: nil

  @doc """
  Processes a parsed SSE event and extracts relevant content.

  ## Parameters

    * `event` - Parsed JSON event from `parse_sse_chunk/2`
    * `state` - Accumulator state for building up content

  ## Returns

    * `{:text, text, state}` - Text content received
    * `{:tool_use_start, tool_info, state}` - Tool use block started
    * `{:tool_use_delta, json_delta, state}` - Tool use JSON delta
    * `{:done, state}` - Message complete
    * `{:error, message}` - Error occurred
    * `{:continue, state}` - No actionable content (ping, etc.)
  """
  def handle_event(%{"type" => "content_block_delta", "delta" => delta}, state) do
    cond do
      text = delta["text"] ->
        {:text, text, state}

      json = delta["partial_json"] ->
        {:tool_use_delta, json, state}

      true ->
        {:continue, state}
    end
  end

  def handle_event(%{"type" => "content_block_start", "content_block" => block}, state) do
    case block["type"] do
      "tool_use" ->
        tool_info = %{
          id: block["id"],
          name: block["name"]
        }

        {:tool_use_start, tool_info, state}

      _ ->
        {:continue, state}
    end
  end

  def handle_event(%{"type" => "message_stop"}, state) do
    {:done, state}
  end

  def handle_event(%{"type" => "message_delta"}, state) do
    # Message delta contains stop_reason, usage, etc. - informational only
    {:continue, state}
  end

  def handle_event(%{"type" => "error", "error" => error}, _state) do
    {:error, error["message"] || "Unknown error"}
  end

  def handle_event(%{"type" => "ping"}, state) do
    {:continue, state}
  end

  def handle_event(_event, state) do
    {:continue, state}
  end

  @doc """
  Estimates token count for text.

  Uses a conservative estimate of ~3 characters per token for English text.
  This is intentionally conservative to avoid exceeding context limits.

  Note: This is a rough estimate. For accurate counts, use the Anthropic
  token counting API endpoint.
  """
  @spec count_tokens(String.t()) :: non_neg_integer()
  def count_tokens(text) when is_binary(text) do
    # Conservative estimate: ~3 chars per token for English
    # Add 10% buffer for safety
    chars = String.length(text)
    trunc(chars / 3 * 1.1)
  end

  def count_tokens(_), do: 0

  defp get_api_key do
    System.get_env("ANTHROPIC_API_KEY") ||
      Application.get_env(:loka, :anthropic_api_key) ||
      {:error, :api_key_not_configured}
  end

  @doc """
  Defines available tools for Claude to manipulate world content.
  """
  def world_builder_tools do
    [
      %{
        name: "create_room",
        description: "Creates a new room in the world",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Unique room key (e.g., forest_path_1)"},
            name: %{type: "string", description: "Room display name"},
            description: %{type: "string", description: "Room description"},
            x: %{type: "number", description: "X coordinate"},
            y: %{type: "number", description: "Y coordinate"},
            zone: %{type: "string", description: "Zone key this room belongs to"}
          },
          required: ["key", "name", "description"]
        }
      },
      %{
        name: "update_room",
        description: "Updates an existing room's properties",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Room key to update"},
            name: %{type: "string", description: "New room name"},
            description: %{type: "string", description: "New room description"},
            attributes: %{type: "object", description: "Additional attributes to set"}
          },
          required: ["key"]
        }
      },
      %{
        name: "create_exit",
        description: "Creates an exit between two rooms",
        input_schema: %{
          type: "object",
          properties: %{
            from: %{type: "string", description: "Source room key"},
            to: %{type: "string", description: "Destination room key"},
            direction: %{type: "string", description: "Exit direction (north, south, etc.)"}
          },
          required: ["from", "to", "direction"]
        }
      },
      %{
        name: "create_npc",
        description: "Creates a new NPC entity",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Unique NPC key"},
            name: %{type: "string", description: "NPC display name"},
            description: %{type: "string", description: "NPC description"},
            room: %{type: "string", description: "Starting room key"},
            attributes: %{type: "object", description: "NPC attributes (level, hostile, etc.)"}
          },
          required: ["key", "name", "description"]
        }
      }
    ]
  end
end
