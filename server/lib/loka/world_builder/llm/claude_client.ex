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
    room_tools() ++ entity_tools() ++ quest_tools() ++ dialogue_tools() ++ query_tools()
  end

  defp room_tools do
    [
      %{
        name: "create_room",
        description: "Creates a new room in the world",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Unique room key (e.g., forest_path_1)"},
            name: %{type: "string", description: "Room display name"},
            description: %{
              type: "string",
              description: "Room description (2-4 sentences with sensory details)"
            },
            x: %{type: "number", description: "X coordinate for map placement"},
            y: %{type: "number", description: "Y coordinate for map placement"},
            zone: %{type: "string", description: "Zone key this room belongs to"},
            tags: %{
              type: "array",
              items: %{type: "string"},
              description: "Tags for categorization"
            }
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
            room_key: %{type: "string", description: "Room key to update"},
            name: %{type: "string", description: "New room name"},
            description: %{type: "string", description: "New room description"},
            x: %{type: "number", description: "New X coordinate"},
            y: %{type: "number", description: "New Y coordinate"},
            tags: %{type: "array", items: %{type: "string"}, description: "New tags"}
          },
          required: ["room_key"]
        }
      },
      %{
        name: "delete_room",
        description: "Deletes a room from the world (use with caution)",
        input_schema: %{
          type: "object",
          properties: %{
            room_key: %{type: "string", description: "Room key to delete"}
          },
          required: ["room_key"]
        }
      },
      %{
        name: "create_exit",
        description: "Creates an exit from one room to another",
        input_schema: %{
          type: "object",
          properties: %{
            from_room: %{type: "string", description: "Source room key"},
            direction: %{
              type: "string",
              description: "Exit direction",
              enum: ["north", "south", "east", "west", "up", "down", "enter", "leave"]
            },
            to_room: %{type: "string", description: "Destination room key"}
          },
          required: ["from_room", "direction", "to_room"]
        }
      },
      %{
        name: "remove_exit",
        description: "Removes an exit from a room",
        input_schema: %{
          type: "object",
          properties: %{
            from_room: %{type: "string", description: "Room key to remove exit from"},
            direction: %{type: "string", description: "Direction of exit to remove"}
          },
          required: ["from_room", "direction"]
        }
      },
      %{
        name: "batch_create_rooms",
        description: "Creates multiple rooms at once (for efficiency)",
        input_schema: %{
          type: "object",
          properties: %{
            rooms: %{
              type: "array",
              items: %{
                type: "object",
                properties: %{
                  key: %{type: "string"},
                  name: %{type: "string"},
                  description: %{type: "string"},
                  x: %{type: "number"},
                  y: %{type: "number"}
                },
                required: ["key", "name", "description"]
              },
              description: "Array of room definitions"
            }
          },
          required: ["rooms"]
        }
      }
    ]
  end

  defp entity_tools do
    [
      %{
        name: "create_npc",
        description: "Creates a new NPC entity in a room",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Unique NPC key (e.g., village_elder)"},
            name: %{type: "string", description: "NPC display name"},
            description: %{type: "string", description: "NPC description (appearance, demeanor)"},
            room_key: %{type: "string", description: "Room key where NPC is located"},
            level: %{type: "integer", description: "NPC level (1-100)"},
            tags: %{
              type: "array",
              items: %{type: "string"},
              description: "Tags (quest_giver, shopkeeper, hostile, etc.)"
            },
            keywords: %{
              type: "array",
              items: %{type: "string"},
              description: "Words players can use to target this NPC"
            }
          },
          required: ["key", "name", "description"]
        }
      },
      %{
        name: "create_item",
        description: "Creates a new item in a room or inventory",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Unique item key (e.g., iron_sword)"},
            name: %{type: "string", description: "Item display name"},
            description: %{type: "string", description: "Item description"},
            room_key: %{type: "string", description: "Room key where item is located (optional)"},
            item_type: %{
              type: "string",
              description: "Item type",
              enum: ["weapon", "armor", "consumable", "quest_item", "container", "misc"]
            },
            tags: %{
              type: "array",
              items: %{type: "string"},
              description: "Tags for categorization"
            }
          },
          required: ["key", "name", "description", "item_type"]
        }
      },
      %{
        name: "list_npcs",
        description: "Lists all NPCs, optionally filtered",
        input_schema: %{
          type: "object",
          properties: %{
            room_key: %{type: "string", description: "Filter to NPCs in this room"},
            tag: %{type: "string", description: "Filter to NPCs with this tag"}
          }
        }
      },
      %{
        name: "list_items",
        description: "Lists all items, optionally filtered",
        input_schema: %{
          type: "object",
          properties: %{
            room_key: %{type: "string", description: "Filter to items in this room"},
            item_type: %{type: "string", description: "Filter to items of this type"}
          }
        }
      }
    ]
  end

  defp quest_tools do
    [
      %{
        name: "create_quest",
        description: "Creates a new quest definition",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Unique quest key (e.g., find_the_artifact)"},
            name: %{type: "string", description: "Quest display name"},
            description: %{type: "string", description: "Quest description shown in journal"},
            quest_type: %{
              type: "string",
              description: "Quest type",
              enum: ["main", "side", "daily", "repeatable"]
            },
            giver_key: %{type: "string", description: "NPC key who gives this quest"},
            objectives: %{
              type: "array",
              items: %{
                type: "object",
                properties: %{
                  id: %{type: "string", description: "Unique objective ID within quest"},
                  type: %{
                    type: "string",
                    enum: ["kill", "collect", "reach_room", "talk_to", "use_item"]
                  },
                  target: %{type: "string", description: "Target key (NPC, item, or room)"},
                  count: %{type: "integer", description: "Required count (for kill/collect)"},
                  description: %{type: "string", description: "Objective description"}
                },
                required: ["id", "type", "target"]
              },
              description: "Quest objectives"
            },
            rewards: %{
              type: "object",
              properties: %{
                xp: %{type: "integer", description: "XP reward"},
                gold: %{type: "integer", description: "Gold reward"},
                items: %{
                  type: "array",
                  items: %{type: "string"},
                  description: "Item keys to reward"
                }
              },
              description: "Quest rewards"
            },
            prerequisites: %{
              type: "array",
              items: %{type: "string"},
              description: "Quest keys that must be completed first"
            },
            level_range: %{
              type: "object",
              properties: %{
                min: %{type: "integer"},
                max: %{type: "integer"}
              },
              description: "Recommended level range"
            }
          },
          required: ["key", "name", "description", "giver_key", "objectives"]
        }
      },
      %{
        name: "update_quest",
        description: "Updates an existing quest",
        input_schema: %{
          type: "object",
          properties: %{
            quest_key: %{type: "string", description: "Quest key to update"},
            name: %{type: "string", description: "New quest name"},
            description: %{type: "string", description: "New quest description"},
            objectives: %{type: "array", description: "New objectives array"},
            rewards: %{type: "object", description: "New rewards"}
          },
          required: ["quest_key"]
        }
      },
      %{
        name: "list_quests",
        description: "Lists all quests, optionally filtered",
        input_schema: %{
          type: "object",
          properties: %{
            quest_type: %{type: "string", description: "Filter by quest type"},
            giver_key: %{type: "string", description: "Filter by quest giver NPC"}
          }
        }
      }
    ]
  end

  defp dialogue_tools do
    [
      %{
        name: "create_dialogue",
        description: "Creates a dialogue tree for an NPC",
        input_schema: %{
          type: "object",
          properties: %{
            key: %{type: "string", description: "Unique dialogue key (e.g., elder_greeting)"},
            entity_key: %{type: "string", description: "NPC key this dialogue belongs to"},
            trigger: %{
              type: "string",
              description: "When dialogue triggers",
              enum: ["on_talk", "on_enter", "on_quest_start", "on_quest_complete"]
            },
            entry_node: %{type: "string", description: "Starting node ID"},
            nodes: %{
              type: "object",
              additionalProperties: %{
                type: "object",
                properties: %{
                  text: %{type: "string", description: "NPC's dialogue text"},
                  choices: %{
                    type: "array",
                    items: %{
                      type: "object",
                      properties: %{
                        text: %{type: "string", description: "Player's choice text"},
                        next: %{type: "string", description: "Next node ID or 'end'"}
                      },
                      required: ["text", "next"]
                    }
                  }
                },
                required: ["text"]
              },
              description: "Dialogue nodes keyed by node ID"
            }
          },
          required: ["key", "entity_key", "entry_node", "nodes"]
        }
      },
      %{
        name: "get_dialogue",
        description: "Gets a dialogue definition by key",
        input_schema: %{
          type: "object",
          properties: %{
            dialogue_key: %{type: "string", description: "Dialogue key to retrieve"}
          },
          required: ["dialogue_key"]
        }
      }
    ]
  end

  defp query_tools do
    [
      %{
        name: "get_room_info",
        description: "Gets detailed information about a room",
        input_schema: %{
          type: "object",
          properties: %{
            room_key: %{type: "string", description: "Room key to look up"}
          },
          required: ["room_key"]
        }
      },
      %{
        name: "list_rooms",
        description: "Lists all rooms, optionally filtered by tag",
        input_schema: %{
          type: "object",
          properties: %{
            filter_tag: %{type: "string", description: "Filter to rooms with this tag"}
          }
        }
      },
      %{
        name: "get_zone_info",
        description: "Gets information about a zone",
        input_schema: %{
          type: "object",
          properties: %{
            zone_key: %{type: "string", description: "Zone key to look up"}
          },
          required: ["zone_key"]
        }
      },
      %{
        name: "list_zones",
        description: "Lists all zones",
        input_schema: %{
          type: "object",
          properties: %{}
        }
      }
    ]
  end
end
