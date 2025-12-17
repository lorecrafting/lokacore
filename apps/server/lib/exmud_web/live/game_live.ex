defmodule ExmudWeb.GameLive do
  @moduledoc """
  LiveView game client for ExMUD.

  Provides a mobile-responsive text-based interface for playing the game.
  Uses Phoenix.PubSub for real-time updates.
  """
  use ExmudWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      # Subscribe to player-specific events when we have player sessions
      # Phoenix.PubSub.subscribe(Exmud.PubSub, "player:#{player_id}")
    end

    {:ok,
     socket
     |> assign(:output, [welcome_message()])
     |> assign(:command, "")
     |> assign(:history, [])
     |> assign(:history_index, -1)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div class="flex-none mb-4">
        <h1 class="text-2xl font-bold text-primary">ExMUD</h1>
        <p class="text-sm text-base-content/70">Text Adventure Game Client</p>
      </div>

      <div
        id="game-output"
        class="flex-1 bg-base-200 rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-1"
        phx-hook="ScrollToBottom"
      >
        <div :for={line <- @output} class={output_class(line)}>
          <%= line.text %>
        </div>
      </div>

      <form phx-submit="send_command" class="flex-none mt-4">
        <div class="flex gap-2">
          <input
            type="text"
            name="command"
            value={@command}
            phx-keydown="handle_keydown"
            placeholder="Enter command..."
            autocomplete="off"
            autofocus
            class="input input-bordered flex-1 font-mono"
          />
          <button type="submit" class="btn btn-primary">
            Send
          </button>
        </div>
        <p class="text-xs text-base-content/50 mt-2">
          Type <code class="kbd kbd-sm">help</code> for available commands.
          Use <span class="kbd kbd-sm">↑</span>/<span class="kbd kbd-sm">↓</span> for command history.
        </p>
      </form>
    </div>
    """
  end

  @impl true
  def handle_event("send_command", %{"command" => command}, socket) do
    command = String.trim(command)

    if command == "" do
      {:noreply, socket}
    else
      socket =
        socket
        |> add_output(:input, "> #{command}")
        |> process_command(command)
        |> add_to_history(command)
        |> assign(:command, "")
        |> assign(:history_index, -1)

      {:noreply, socket}
    end
  end

  def handle_event("handle_keydown", %{"key" => "ArrowUp"}, socket) do
    history = socket.assigns.history
    current_index = socket.assigns.history_index

    new_index = min(current_index + 1, length(history) - 1)
    command = Enum.at(history, new_index, "")

    {:noreply,
     socket
     |> assign(:history_index, new_index)
     |> assign(:command, command)}
  end

  def handle_event("handle_keydown", %{"key" => "ArrowDown"}, socket) do
    history = socket.assigns.history
    current_index = socket.assigns.history_index

    new_index = max(current_index - 1, -1)
    command = if new_index == -1, do: "", else: Enum.at(history, new_index, "")

    {:noreply,
     socket
     |> assign(:history_index, new_index)
     |> assign(:command, command)}
  end

  def handle_event("handle_keydown", _params, socket) do
    {:noreply, socket}
  end

  # Command processing - placeholder for engine integration
  defp process_command(socket, "help") do
    help_text = """
    Available commands:
      look        - Look around the current room
      go <dir>    - Move in a direction (north, south, east, west)
      say <msg>   - Say something to the room
      inventory   - Check your inventory
      help        - Show this help message
      clear       - Clear the screen
    """

    add_output(socket, :system, help_text)
  end

  defp process_command(socket, "clear") do
    assign(socket, :output, [])
  end

  defp process_command(socket, "look") do
    # TODO: Integrate with engine to get actual room description
    room_desc = """
    [The Starting Room]
    You find yourself in a simple stone chamber. Torchlight flickers on the walls,
    casting dancing shadows. A wooden door leads north.

    Exits: north
    """

    add_output(socket, :room, room_desc)
  end

  defp process_command(socket, "inventory") do
    add_output(socket, :system, "You are carrying: nothing")
  end

  defp process_command(socket, "go " <> direction) do
    add_output(socket, :error, "You cannot go #{direction} from here.")
  end

  defp process_command(socket, "say " <> message) do
    add_output(socket, :speech, "You say: \"#{message}\"")
  end

  defp process_command(socket, command) do
    add_output(socket, :error, "Unknown command: #{command}. Type 'help' for available commands.")
  end

  defp add_output(socket, type, text) do
    line = %{type: type, text: text, timestamp: DateTime.utc_now()}
    update(socket, :output, fn output -> output ++ [line] end)
  end

  defp add_to_history(socket, command) do
    update(socket, :history, fn history -> [command | history] end)
  end

  defp output_class(%{type: :input}), do: "text-primary font-bold"
  defp output_class(%{type: :error}), do: "text-error"
  defp output_class(%{type: :system}), do: "text-info whitespace-pre-wrap"
  defp output_class(%{type: :room}), do: "text-success whitespace-pre-wrap"
  defp output_class(%{type: :speech}), do: "text-warning"
  defp output_class(_), do: "text-base-content"

  defp welcome_message do
    %{
      type: :system,
      text: """
      Welcome to ExMUD!
      A text-based adventure awaits you.

      Type 'help' to see available commands.
      """,
      timestamp: DateTime.utc_now()
    }
  end
end
