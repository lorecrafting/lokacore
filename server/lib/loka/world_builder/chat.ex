defmodule Loka.WorldBuilder.Chat do
  @moduledoc """
  Chat management for the World Builder.

  Provides helper functions for the LiveView to manage chat state,
  send messages to Anthropic, and process streaming responses.
  """

  alias Loka.WorldBuilder.{AnthropicClient, ToolExecutor}

  @doc """
  Initialize chat assigns for a LiveView socket.
  """
  def init_assigns(socket) do
    Phoenix.Component.assign(socket,
      chat_messages: [],
      chat_streaming: false,
      chat_current_response: "",
      chat_error: nil,
      pending_tool_results: []
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

    # Get system prompt
    system = get_system_prompt(project_key)

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

  @doc """
  Handle tool use from streaming response.
  Executes the tool and stores the result for continuation.
  """
  def handle_tool_use(socket, tool_name, tool_id, input) do
    # Execute the tool
    project_key = get_in(socket.assigns, [:current_project, :key])

    result =
      case ToolExecutor.execute(tool_name, input, project_key: project_key) do
        {:ok, data} -> %{success: true, data: data}
        {:error, reason} -> %{success: false, error: reason}
      end

    # Store pending tool result
    tool_results = socket.assigns.pending_tool_results

    tool_result = %{
      tool_use_id: tool_id,
      tool_name: tool_name,
      input: input,
      result: result
    }

    Phoenix.Component.assign(socket, :pending_tool_results, tool_results ++ [tool_result])
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

    # If there were tool uses, continue the conversation with results
    if pending_results != [] do
      continue_with_tool_results(socket, pending_results)
    else
      socket
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
      pending_tool_results: []
    )
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

    # Get project context
    project_key = get_in(socket.assigns, [:current_project, :key])

    # Get system prompt
    system = get_system_prompt(project_key)

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

  defp get_system_prompt(project_key) do
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

    base_prompt <> project_context
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
