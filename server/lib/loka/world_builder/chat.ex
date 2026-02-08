defmodule Loka.WorldBuilder.Chat do
  @moduledoc """
  Chat management for the World Builder.

  Provides helper functions for the LiveView to manage chat state,
  send messages to Anthropic, and process streaming responses.
  """

  alias Loka.WorldBuilder.{
    AnthropicClient,
    ContextBuilder,
    Projects,
    ToolExecutor,
    ValidationManager
  }

  @doc """
  Initialize chat assigns for a LiveView socket.
  """
  def init_assigns(socket) do
    Phoenix.Component.assign(socket,
      chat_messages: [],
      chat_streaming: false,
      chat_current_response: "",
      chat_error: nil,
      pending_tool_results: [],
      chat_queued_messages: [],
      chat_current_tool: nil,
      chat_tool_step: 0,
      chat_total_steps: 0
    )
  end

  @doc """
  Send a message and start streaming the response.
  Returns the updated socket.
  """
  def send_message(socket, message) when is_binary(message) and message != "" do
    # Add user message
    user_msg = %{role: "user", content: message}
    messages = socket.assigns.chat_messages ++ [user_msg]

    socket =
      socket
      |> Phoenix.Component.assign(:chat_messages, messages)
      |> Phoenix.Component.assign(:chat_streaming, true)
      |> Phoenix.Component.assign(:chat_current_response, "")
      |> Phoenix.Component.assign(:chat_error, nil)

    # Get project context
    project_key = get_in(socket.assigns, [:current_project, :key])

    # Get system prompt with selection context
    system = get_system_prompt(project_key, socket.assigns)

    # Get tools
    tools = AnthropicClient.get_tools()

    # Format messages for API
    api_messages = format_messages_for_api(messages)

    # Start streaming
    AnthropicClient.stream_to_liveview(
      self(),
      api_messages,
      tools,
      system: system
    )

    socket
  end

  def send_message(socket, _), do: socket

  @doc """
  Handle text delta from streaming response.
  """
  def handle_text_delta(socket, text) do
    current = socket.assigns.chat_current_response
    Phoenix.Component.assign(socket, :chat_current_response, current <> text)
  end

  # Tools that mutate content and should trigger validation
  @content_tools ~w(wb_create_room wb_update_room wb_delete_room wb_create_npc wb_create_item
                     wb_create_quest wb_update_quest wb_create_dialogue
                     wb_create_exit wb_remove_exit wb_batch_create_rooms)

  @doc """
  Handle tool use from streaming response.
  Executes the tool and stores the result for continuation.
  """
  def handle_tool_use(socket, tool_name, tool_id, input, opts \\ []) do
    # Track tool step progress
    total_steps = opts[:total_steps] || socket.assigns[:chat_total_steps] || 0
    current_step = (socket.assigns[:chat_tool_step] || 0) + 1

    # Show current tool to user
    tool_summary = format_tool_summary(tool_name, input)

    socket =
      socket
      |> Phoenix.Component.assign(:chat_current_tool, tool_summary)
      |> Phoenix.Component.assign(:chat_tool_step, current_step)
      |> Phoenix.Component.assign(:chat_total_steps, max(total_steps, current_step))

    # Execute the tool
    project_key = get_in(socket.assigns, [:current_project, :key])

    result =
      try do
        case ToolExecutor.execute(tool_name, input, project_key: project_key) do
          {:ok, data} -> %{success: true, data: data}
          {:error, reason} -> %{success: false, error: reason}
        end
      rescue
        e -> %{success: false, error: "Tool crashed: #{Exception.message(e)}"}
      end

    # Store pending tool result
    tool_results = socket.assigns.pending_tool_results

    tool_result = %{
      tool_use_id: tool_id,
      tool_name: tool_name,
      input: input,
      result: result
    }

    socket =
      socket
      |> Phoenix.Component.assign(:pending_tool_results, tool_results ++ [tool_result])
      |> Phoenix.Component.assign(:chat_current_tool, nil)
      |> maybe_update_project_assigns(tool_name, input, result)

    # Track whether any content tools ran (validation happens once in continue_with_tool_results)
    had_content_tool = Map.get(socket.assigns, :had_content_tool, false)

    if tool_name in @content_tools and result.success do
      Phoenix.Component.assign(socket, :had_content_tool, true)
    else
      Phoenix.Component.assign(socket, :had_content_tool, had_content_tool)
    end
  end

  # After project creation/deletion, refresh the projects list and auto-select
  defp maybe_update_project_assigns(socket, "wb_create_project", input, %{success: true}) do
    socket
    |> Phoenix.Component.assign(:projects, Projects.list_projects())
    |> Phoenix.Component.assign(:current_project, %{key: input["key"]})
  end

  defp maybe_update_project_assigns(socket, "wb_load_project", input, %{success: true}) do
    socket
    |> Phoenix.Component.assign(:current_project, %{key: input["key"]})
  end

  defp maybe_update_project_assigns(socket, "wb_delete_project", _input, %{success: true}) do
    socket
    |> Phoenix.Component.assign(:projects, Projects.list_projects())
    |> Phoenix.Component.assign(:current_project, nil)
  end

  defp maybe_update_project_assigns(socket, _tool_name, _input, _result), do: socket

  # Format tool name and input into a user-friendly summary
  defp format_tool_summary(tool_name, input) do
    case tool_name do
      "wb_create_room" ->
        "Creating room: #{input["name"] || input["key"]}"

      "wb_update_room" ->
        "Updating room: #{input["key"]}"

      "wb_create_npc" ->
        "Creating NPC: #{input["name"] || input["key"]}"

      "wb_update_npc" ->
        "Updating NPC: #{input["key"]}"

      "wb_create_item" ->
        "Creating item: #{input["name"] || input["key"]}"

      "wb_update_item" ->
        "Updating item: #{input["key"]}"

      "wb_create_exit" ->
        "Creating exit: #{input["from"]} → #{input["direction"]} → #{input["to"]}"

      "wb_list_rooms" ->
        "Listing rooms..."

      "wb_list_npcs" ->
        "Listing NPCs..."

      "wb_list_items" ->
        "Listing items..."

      "wb_get_room" ->
        "Reading room: #{input["key"]}"

      "wb_get_npc" ->
        "Reading NPC: #{input["key"]}"

      "wb_get_item" ->
        "Reading item: #{input["key"]}"

      "wb_delete_room" ->
        "Deleting room: #{input["key"]}"

      "wb_delete_npc" ->
        "Deleting NPC: #{input["key"]}"

      "wb_delete_item" ->
        "Deleting item: #{input["key"]}"

      _ ->
        "Running: #{tool_name}"
    end
  end

  @doc """
  Handle completion of streaming response.
  If there were tool uses, continues the conversation with results.
  """
  def handle_done(socket, response) do
    # Add assistant message
    assistant_msg = %{
      role: "assistant",
      content: response.text,
      tool_uses: response.tool_uses
    }

    messages = socket.assigns.chat_messages ++ [assistant_msg]

    # Check if we need to continue with tool results
    pending_results = socket.assigns.pending_tool_results

    socket =
      socket
      |> Phoenix.Component.assign(:chat_messages, messages)
      |> Phoenix.Component.assign(:chat_streaming, false)
      |> Phoenix.Component.assign(:chat_current_response, "")
      |> Phoenix.Component.assign(:pending_tool_results, [])
      |> Phoenix.Component.assign(:chat_tool_step, 0)
      |> Phoenix.Component.assign(:chat_total_steps, 0)

    # If there were tool uses, continue the conversation with results
    if pending_results != [] do
      continue_with_tool_results(socket, pending_results)
    else
      # No more tool results - check for queued messages
      case process_queue(socket) do
        {:continue, socket} -> socket
        {:done, socket} -> socket
      end
    end
  end

  @doc """
  Handle error from streaming response.
  """
  def handle_error(socket, error) do
    socket
    |> Phoenix.Component.assign(:chat_streaming, false)
    |> Phoenix.Component.assign(:chat_current_response, "")
    |> Phoenix.Component.assign(:chat_error, format_error(error))
  end

  @doc """
  Clear chat history.
  """
  def clear_chat(socket) do
    Phoenix.Component.assign(socket,
      chat_messages: [],
      chat_streaming: false,
      chat_current_response: "",
      chat_error: nil,
      pending_tool_results: [],
      chat_queued_messages: []
    )
  end

  @doc """
  Cancel an in-progress streaming response.
  """
  def cancel_streaming(socket) do
    if socket.assigns.chat_streaming do
      # Add current partial response as a message if any content
      current = socket.assigns.chat_current_response

      messages =
        if String.trim(current) != "" do
          socket.assigns.chat_messages ++
            [%{role: "assistant", content: current <> "\n\n_(cancelled)_"}]
        else
          socket.assigns.chat_messages
        end

      Phoenix.Component.assign(socket,
        chat_messages: messages,
        chat_streaming: false,
        chat_current_response: "",
        pending_tool_results: []
      )
    else
      socket
    end
  end

  @doc """
  Queue a message to be sent after the current response completes.
  """
  def queue_message(socket, message) when is_binary(message) and message != "" do
    queued = socket.assigns[:chat_queued_messages] || []
    Phoenix.Component.assign(socket, :chat_queued_messages, queued ++ [message])
  end

  def queue_message(socket, _), do: socket

  @doc """
  Intercede: cancel current streaming and immediately send a new message.
  """
  def intercede(socket, message) when is_binary(message) and message != "" do
    socket
    |> cancel_streaming()
    |> send_message(message)
  end

  def intercede(socket, _), do: socket

  @doc """
  Clear the message queue.
  """
  def clear_queue(socket) do
    Phoenix.Component.assign(socket, :chat_queued_messages, [])
  end

  @doc """
  Process the next queued message. Called after a response completes.
  Returns {:continue, socket} if a message was processed, {:done, socket} if queue is empty.
  """
  def process_queue(socket) do
    queued = socket.assigns[:chat_queued_messages] || []

    case queued do
      [next | rest] ->
        socket =
          socket
          |> Phoenix.Component.assign(:chat_queued_messages, rest)
          |> send_message(next)

        {:continue, socket}

      [] ->
        {:done, socket}
    end
  end

  # Private helpers

  defp continue_with_tool_results(socket, tool_results) do
    # Add tool result messages
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
          tool_name: tr.tool_name,
          tool_use_id: tr.tool_use_id,
          content: content,
          is_error: not tr.result.success
        }
      end)

    messages = socket.assigns.chat_messages ++ result_messages

    socket =
      socket
      |> Phoenix.Component.assign(:chat_messages, messages)
      |> Phoenix.Component.assign(:chat_streaming, true)
      |> Phoenix.Component.assign(:chat_current_response, "")

    # Run validation once after all tools in this batch complete (not per-tool)
    socket =
      if Map.get(socket.assigns, :had_content_tool, false) do
        socket
        |> maybe_store_validation()
        |> Phoenix.Component.assign(:had_content_tool, false)
      else
        socket
      end

    # Get project context
    project_key = get_in(socket.assigns, [:current_project, :key])

    # Get system prompt with selection context (includes pending validation if any)
    system = get_system_prompt(project_key, socket.assigns)

    # Clear pending validation after it's been injected into the prompt
    socket = Phoenix.Component.assign(socket, :pending_validation, nil)

    # Get tools
    tools = AnthropicClient.get_tools()

    # Format messages for API (including tool results)
    api_messages = format_messages_for_api(messages)

    # Continue streaming
    AnthropicClient.stream_to_liveview(
      self(),
      api_messages,
      tools,
      system: system
    )

    socket
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

  defp format_tool_result(data) when is_binary(data), do: data
  defp format_tool_result(data) when is_map(data), do: Jason.encode!(data, pretty: true)
  defp format_tool_result(data) when is_list(data), do: Jason.encode!(data, pretty: true)
  defp format_tool_result(data), do: inspect(data)

  defp format_error(error) when is_binary(error), do: error
  defp format_error(error), do: inspect(error)

  defp maybe_store_validation(socket) do
    try do
      results = ValidationManager.validate_all()

      if results.total_errors > 0 or results.total_warnings > 0 do
        feedback = format_validation_feedback(results)
        Phoenix.Component.assign(socket, :pending_validation, feedback)
      else
        socket
      end
    rescue
      _ -> socket
    end
  end

  defp format_validation_feedback(results) do
    parts = []

    parts =
      if results.total_errors > 0 do
        error_msgs = collect_validation_messages(results, :errors)
        parts ++ ["Errors (#{results.total_errors}): #{Enum.join(error_msgs, "; ")}"]
      else
        parts
      end

    parts =
      if results.total_warnings > 0 do
        warning_msgs = collect_validation_messages(results, :warnings)
        parts ++ ["Warnings (#{results.total_warnings}): #{Enum.join(warning_msgs, "; ")}"]
      else
        parts
      end

    "[Validation after your last action] " <> Enum.join(parts, " | ")
  end

  defp collect_validation_messages(results, field) do
    quest_msgs = Map.get(results.quests, field, []) |> Enum.map(&format_validation_msg/1)
    cutscene_msgs = Map.get(results.cutscenes, field, []) |> Enum.map(&format_validation_msg/1)

    room_msgs =
      case field do
        :errors ->
          results.rooms.errors |> Enum.flat_map(fn r -> r.errors end) |> Enum.take(5)

        :warnings ->
          results.rooms.warnings |> Enum.flat_map(fn r -> r.warnings end) |> Enum.take(5)
      end

    (quest_msgs ++ cutscene_msgs ++ room_msgs) |> Enum.take(10)
  end

  # Quest/cutscene validators return tuples like {:missing_speaker, "quest_key", "npc_key"}
  defp format_validation_msg(msg) when is_binary(msg), do: msg
  defp format_validation_msg(msg) when is_tuple(msg), do: inspect(msg)

  defp get_system_prompt(project_key, assigns) do
    base_prompt = load_system_prompt()

    project_context =
      if project_key do
        """

        ## Current Project Context

        You are working on project: **#{project_key}**

        Use the project tools to manage design documents:
        - `wb_write_doc` to create/update documents
        - `wb_read_doc` to read existing documents
        - `wb_list_docs` to see all documents

        Always pass `project_key: "#{project_key}"` when using document tools.
        """
      else
        """

        ## Getting Started

        No project is currently loaded. Start by:
        1. Using `wb_list_projects` to see existing projects
        2. Using `wb_create_project` to create a new project
        3. Using `wb_load_project` to load an existing project
        """
      end

    selection_context =
      assigns
      |> ContextBuilder.build()
      |> ContextBuilder.format_for_system_prompt()

    validation_context =
      case Map.get(assigns, :pending_validation) do
        nil -> ""
        feedback -> "\n\n## Validation Feedback\n\n#{feedback}"
      end

    base_prompt <> project_context <> selection_context <> validation_context
  end

  defp load_system_prompt do
    path = Application.app_dir(:loka, "priv/world_builder/system_prompt.md")

    case File.read(path) do
      {:ok, content} -> content
      {:error, _} -> default_system_prompt()
    end
  end

  defp default_system_prompt do
    """
    # World Builder Assistant

    You are a creative writing and game design assistant specialized in building
    MUD (Multi-User Dungeon) worlds. You help create rich, interconnected game
    worlds with compelling narratives, memorable characters, and engaging quests.

    ## Your Capabilities

    You have access to tools for:
    - Managing projects and design documents
    - Creating rooms, NPCs, items, and zones
    - Designing quests with objectives and rewards
    - Building dialogue trees for NPCs
    - Reading framework guides for best practices

    ## Guidelines

    1. **Start with design** - Create design documents before building content
    2. **Follow the guides** - Use `wb_read_guide` to learn best practices
    3. **Be consistent** - Maintain narrative voice and world coherence
    4. **Show, don't tell** - Write immersive, sensory descriptions
    5. **Weave connections** - Create interconnected storylines and characters
    """
  end
end
