defmodule LokaWeb.Channels.BuilderCommands.AI do
  @moduledoc """
  AI command handlers for the builder terminal.

  Manages `/ai <prompt>`, `chat` mode toggle, `/ai clear` commands.
  Uses Loka.AI.Conversation engine for streaming responses.
  """

  require Logger

  import Phoenix.Socket, only: [assign: 3]
  import Phoenix.Channel, only: [push: 3]

  alias Loka.AI.Conversation
  alias Loka.WorldBuilder.{AnthropicClient, ToolExecutor}

  # Cache system prompt at compile time to avoid reading from disk on every AI call
  @system_prompt_path Path.join(:code.priv_dir(:loka), "world_builder/system_prompt.md")
  @external_resource @system_prompt_path
  @cached_system_prompt (case File.read(@system_prompt_path) do
                           {:ok, content} -> content
                           {:error, _} -> nil
                         end)

  @doc """
  Handle `/ai <prompt>` — send a one-shot prompt to the AI.
  """
  def execute(:ai, %{prompt: prompt}, socket) do
    socket = ensure_conversation(socket)
    conversation = socket.assigns.ai_conversation

    conversation = Conversation.send_message(conversation, prompt, build_context(socket))
    socket = assign(socket, :ai_conversation, conversation)

    {:ok, socket}
  end

  # Handle `/ai clear` — reset conversation history.
  def execute(:ai_clear, _params, socket) do
    socket =
      if socket.assigns[:ai_conversation] do
        conversation = Conversation.clear_history(socket.assigns.ai_conversation)
        assign(socket, :ai_conversation, conversation)
      else
        socket
      end

    push(socket, "output", %{text: "[BUILDER] AI conversation history cleared."})
    {:ok, socket}
  end

  # Handle `chat` — enter chat mode.
  def execute(:chat_mode, _params, socket) do
    socket =
      socket
      |> assign(:chat_mode, true)
      |> ensure_conversation()

    push(socket, "chat_mode_changed", %{mode: "chat"})

    push(socket, "output", %{
      text: "[BUILDER] Entered chat mode. Type 'exit' or '/exit' to leave."
    })

    {:ok, socket}
  end

  # Handle `exit` / `/exit` — leave chat mode.
  def execute(:exit_chat, _params, socket) do
    socket = assign(socket, :chat_mode, false)

    push(socket, "chat_mode_changed", %{mode: "normal"})
    push(socket, "output", %{text: "[BUILDER] Left chat mode."})
    {:ok, socket}
  end

  @doc """
  Handle chat mode input — route plain text to AI.
  """
  def handle_chat_input(text, socket) do
    # Check for exit commands
    trimmed = String.trim(text)

    if trimmed in ["exit", "/exit"] do
      execute(:exit_chat, %{}, socket)
    else
      socket = ensure_conversation(socket)
      conversation = socket.assigns.ai_conversation

      conversation = Conversation.send_message(conversation, trimmed, build_context(socket))
      socket = assign(socket, :ai_conversation, conversation)

      {:ok, socket}
    end
  end

  @doc """
  Handle AI streaming events from the Conversation engine.
  Called by game_channel handle_info clauses.
  """
  def handle_ai_event({:ai_text_delta, text}, socket) do
    push(socket, "ai_stream_delta", %{text: text})
    {:noreply, socket}
  end

  def handle_ai_event({:ai_tool_use_raw, name, id, input}, socket) do
    conversation = socket.assigns[:ai_conversation]

    if conversation do
      conversation = Conversation.handle_tool_use(conversation, name, id, input)
      socket = assign(socket, :ai_conversation, conversation)

      # Push tool event to client
      summary = format_tool_summary(name, input)
      push(socket, "ai_stream_tool", %{name: name, summary: summary})

      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  def handle_ai_event({:ai_done_raw, response}, socket) do
    conversation = socket.assigns[:ai_conversation]

    if conversation do
      conversation = Conversation.handle_done(conversation, response)
      socket = assign(socket, :ai_conversation, conversation)
      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  def handle_ai_event({:ai_done}, socket) do
    # Reload TypedObject registry once after all tool calls in this turn
    Loka.Engine.TypedObject.Loader.reload()
    push(socket, "ai_stream_done", %{})
    {:noreply, socket}
  end

  def handle_ai_event({:ai_error, reason}, socket) do
    push(socket, "ai_stream_error", %{error: reason})
    {:noreply, socket}
  end

  def handle_ai_event({:ai_tool_use, _name, _id, _input, _result}, socket) do
    # Verbose mode tool completion — already pushed during handle_tool_use_raw
    {:noreply, socket}
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp ensure_conversation(socket) do
    if socket.assigns[:ai_conversation] do
      socket
    else
      config = %{
        tools: AnthropicClient.get_tools(),
        system_prompt_fn: &build_system_prompt/1,
        tool_executor_fn: fn name, input, _opts ->
          # Defer reloads — a single reload happens when the conversation turn ends
          Process.put(:loka_defer_reload, true)
          ToolExecutor.execute(name, input)
        end,
        verbosity: :verbose,
        caller_pid: self(),
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096
      }

      assign(socket, :ai_conversation, Conversation.new(config))
    end
  end

  defp build_context(socket) do
    %{
      room_key: get_current_room_key(socket)
    }
  end

  defp get_current_room_key(socket) do
    game_state = socket.assigns[:game_state]

    if game_state do
      alias LokaWeb.Channels.RoomHelpers
      {room, _} = RoomHelpers.load_player_room(game_state)
      Map.get(room, :key, "unknown")
    else
      "unknown"
    end
  end

  defp build_system_prompt(context) do
    base = load_system_prompt()

    room_context =
      case context[:room_key] do
        nil -> ""
        "unknown" -> ""
        key -> "\n\nBuilder is currently in room: **#{key}**"
      end

    terminal_context = """

    ## Terminal Formatting

    Format responses for a monospace terminal:
    - Keep lines under 80 characters
    - Use plain text, newlines for structure
    - No markdown headers (use CAPS or dashes for emphasis)
    - Indent with 2 spaces for hierarchy
    """

    base <> room_context <> terminal_context
  end

  defp load_system_prompt do
    @cached_system_prompt ||
      """
      # World Builder Assistant

      You are a creative writing and game design assistant specialized in building
      MUD (Multi-User Dungeon) worlds. You help create rich, interconnected game
      worlds with compelling narratives, memorable characters, and engaging quests.

      You have access to tools for managing rooms, NPCs, items, quests, dialogues,
      scripts, zones, and design documents.
      """
  end

  defp format_tool_summary(name, input) do
    case name do
      "wb_create_room" -> "Creating room: #{input["name"] || input["key"]}"
      "wb_update_room" -> "Updating room: #{input["key"]}"
      "wb_create_npc" -> "Creating NPC: #{input["name"] || input["key"]}"
      "wb_create_item" -> "Creating item: #{input["name"] || input["key"]}"
      "wb_create_exit" -> "Exit: #{input["from"]} -> #{input["direction"]} -> #{input["to"]}"
      "wb_delete_room" -> "Deleting room: #{input["key"]}"
      "wb_delete_npc" -> "Deleting NPC: #{input["key"]}"
      "wb_list_rooms" -> "Listing rooms..."
      "wb_list_npcs" -> "Listing NPCs..."
      "wb_list_items" -> "Listing items..."
      "wb_get_room" -> "Reading room: #{input["key"]}"
      "wb_get_npc" -> "Reading NPC: #{input["key"]}"
      _ -> name
    end
  end
end
