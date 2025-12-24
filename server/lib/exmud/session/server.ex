defmodule Exmud.Session.Server do
  @moduledoc """
  Per-player session process managing connected clients and game state.

  Each online player has exactly one `Session.Server` process, regardless of
  how many clients (browser tabs, mobile, SSH) are connected. This provides:

  - **Multi-client support**: Same player on multiple devices simultaneously
  - **Reconnect grace period**: Session survives brief disconnects
  - **Centralized state**: Room, combat, dialogue state in one place
  - **Automatic cleanup**: Process monitors detect client disconnects

  ## Lifecycle

  ```
  1. Player connects → Session.Supervisor.get_or_start_session(player)
  2. Client registers → Session.Server.register_client(player_id, :liveview, pid)
  3. Session monitors client process
  4. Client disconnects → Process.monitor fires {:DOWN, ...}
  5. No clients left → Start 30s disconnect timer
  6. Reconnect before timeout → Cancel timer, continue
  7. Timeout expires → Session terminates, cleanup room index
  ```

  ## Client Types

  Currently supported:
  - `:liveview` - Phoenix LiveView WebSocket connection
  - `:tui` - Terminal UI via Unix socket (admin tools)

  Future:
  - `:ssh` - SSH/telnet for traditional MUD clients
  - `:mobile` - Native mobile app via WebSocket
  - `:discord` - Discord bot integration

  ## State Management

  The session tracks:
  - Connected clients (by process monitor ref)
  - Current room (for room index)
  - Combat state (if in combat)
  - Dialogue state (if in dialogue)

  Game state is NOT stored here—it lives in `PlayerGameState` (database).
  The session just tracks ephemeral connection state.

  ## Usage

      # Register a client (called by LiveView/TUI on connect)
      :ok = Session.Server.register_client(player_id, :liveview, self())

      # Send message to player (routed to all connected clients)
      Session.Server.send_message(player_id, {:room_message, "Hello!"})

      # Update session state
      Session.Server.update_state(player_id, [{:room_id, "room_123"}])

      # Get session info (for admin dashboard)
      Session.Server.get_state(player_id)
  """

  use GenServer, restart: :temporary
  require Logger

  alias Exmud.Session.Registry, as: SessionRegistry

  # Session stays alive 30s after last client disconnects
  # This allows for reconnection without losing session state
  @disconnect_timeout :timer.seconds(30)

  defstruct [
    :player_id,
    :player,
    :current_room_id,
    :combat_state,
    :dialogue_state,
    :disconnect_timer,
    :created_at,
    # %{monitor_ref => {client_type, pid, metadata}}
    clients: %{}
  ]

  @type client_type :: :liveview | :tui | :ssh | :mobile | :discord | atom()

  @type t :: %__MODULE__{
          player_id: term(),
          player: map(),
          current_room_id: String.t() | nil,
          combat_state: map() | nil,
          dialogue_state: map() | nil,
          disconnect_timer: reference() | nil,
          created_at: DateTime.t(),
          clients: %{reference() => {client_type(), pid(), map()}}
        }

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts a session server for a player.

  Called by `Session.Supervisor`. Uses the `:via` tuple pattern to register
  in `Exmud.Session.PlayerRegistry` for O(1) lookups by player_id.
  """
  def start_link(player) do
    GenServer.start_link(__MODULE__, player, name: via_tuple(player.id))
  end

  @doc """
  Registers a client connection with this session.

  The session monitors the client process and automatically handles cleanup
  when the client disconnects (process terminates).

  ## Parameters

  - `player_id` - The player's ID
  - `client_type` - Type of client (`:liveview`, `:tui`, `:ssh`, etc.)
  - `client_pid` - The client process to monitor
  - `meta` - Optional metadata (e.g., IP address, user agent)

  ## Returns

  - `:ok` on success

  ## Examples

      # From LiveView mount
      Session.Server.register_client(player.id, :liveview, self())

      # From TUI handler with metadata
      Session.Server.register_client(player.id, :tui, self(), %{ip: "127.0.0.1"})
  """
  @spec register_client(term(), client_type(), pid(), map()) :: :ok
  def register_client(player_id, client_type, client_pid, meta \\ %{}) do
    GenServer.call(via_tuple(player_id), {:register_client, client_type, client_pid, meta})
  end

  @doc """
  Sends a message to the player via all connected clients.

  The message format is `{:session_message, message}`. Each client type
  handles this in its own way (LiveView pushes to browser, TUI sends JSON, etc.)

  ## Examples

      Session.Server.send_message(player_id, {:room_message, "A wolf howls nearby."})
      Session.Server.send_message(player_id, {:force_disconnect, "Kicked by admin"})
  """
  @spec send_message(term(), term()) :: :ok
  def send_message(player_id, message) do
    GenServer.cast(via_tuple(player_id), {:send_message, message})
  end

  @doc """
  Updates the session state.

  Accepts a keyword list or list of tuples with updates:
  - `{:room_id, room_id}` - Update current room (also updates room index)
  - `{:combat_state, combat}` - Set combat state (nil to clear)
  - `{:dialogue_state, dialogue}` - Set dialogue state (nil to clear)

  ## Examples

      # Player enters a room
      Session.Server.update_state(player_id, [{:room_id, "room_123"}])

      # Player starts combat
      Session.Server.update_state(player_id, [{:combat_state, %{enemy: "goblin"}}])

      # Player ends combat and dialogue
      Session.Server.update_state(player_id, [
        {:combat_state, nil},
        {:dialogue_state, nil}
      ])
  """
  @spec update_state(term(), keyword() | [{atom(), term()}]) :: :ok
  def update_state(player_id, updates) do
    GenServer.cast(via_tuple(player_id), {:update_state, updates})
  end

  @doc """
  Gets the current session state.

  Returns a map with session info suitable for admin dashboards.

  ## Returns

      %{
        player_id: "player_123",
        player_email: "user@example.com",
        current_room_id: "room_courtyard",
        in_combat: false,
        in_dialogue: false,
        client_count: 2,
        client_types: [:liveview, :mobile],
        created_at: ~U[2024-01-15 10:30:00Z]
      }
  """
  @spec get_state(term()) :: map()
  def get_state(player_id) do
    GenServer.call(via_tuple(player_id), :get_state)
  end

  @doc """
  Checks if a session process exists for a player.
  """
  @spec exists?(term()) :: boolean()
  def exists?(player_id) do
    case Registry.lookup(Exmud.Session.PlayerRegistry, player_id) do
      [{_pid, _meta}] -> true
      [] -> false
    end
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(player) do
    # Registration in PlayerRegistry happens automatically via :via tuple
    Logger.info("[Session.Server] Started for player #{player.id} (#{player.email})")

    state = %__MODULE__{
      player_id: player.id,
      player: player,
      created_at: DateTime.utc_now()
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:register_client, client_type, client_pid, meta}, _from, state) do
    # Monitor the client process to detect disconnects
    ref = Process.monitor(client_pid)

    # Cancel disconnect timer if this is a reconnection
    state = cancel_disconnect_timer(state)

    # Add to clients map
    clients = Map.put(state.clients, ref, {client_type, client_pid, meta})

    Logger.info(
      "[Session.Server] Client registered: #{client_type} for player #{state.player_id} " <>
        "(#{map_size(clients)} total clients)"
    )

    {:reply, :ok, %{state | clients: clients}}
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, session_info(state), state}
  end

  @impl true
  def handle_cast({:send_message, message}, state) do
    # Send to all connected clients
    for {_ref, {client_type, client_pid, _meta}} <- state.clients do
      send_to_client(client_type, client_pid, message)
    end

    {:noreply, state}
  end

  @impl true
  def handle_cast({:update_state, updates}, state) do
    old_room_id = state.current_room_id

    state =
      Enum.reduce(updates, state, fn
        {:room_id, room_id}, acc -> %{acc | current_room_id: room_id}
        {:combat_state, combat}, acc -> %{acc | combat_state: combat}
        {:dialogue_state, dialogue}, acc -> %{acc | dialogue_state: dialogue}
        _, acc -> acc
      end)

    # Update room index if room changed
    if state.current_room_id != old_room_id do
      SessionRegistry.update_room_index(self(), old_room_id, state.current_room_id)
    end

    {:noreply, state}
  end

  @impl true
  def handle_info({:DOWN, ref, :process, _pid, _reason}, state) do
    # Client process terminated (disconnect, crash, etc.)
    case Map.pop(state.clients, ref) do
      {nil, _} ->
        # Unknown ref, ignore
        {:noreply, state}

      {{client_type, _pid, _meta}, remaining_clients} ->
        Logger.info(
          "[Session.Server] Client disconnected: #{client_type} for player #{state.player_id} " <>
            "(#{map_size(remaining_clients)} remaining)"
        )

        state = %{state | clients: remaining_clients}

        if map_size(remaining_clients) == 0 do
          # No clients left - start disconnect timer
          Logger.info(
            "[Session.Server] No clients remaining for player #{state.player_id}, " <>
              "starting #{div(@disconnect_timeout, 1000)}s disconnect timer"
          )

          timer = Process.send_after(self(), :disconnect_timeout, @disconnect_timeout)
          {:noreply, %{state | disconnect_timer: timer}}
        else
          {:noreply, state}
        end
    end
  end

  @impl true
  def handle_info(:disconnect_timeout, state) do
    if map_size(state.clients) == 0 do
      Logger.info("[Session.Server] Disconnect timeout for player #{state.player_id}, terminating")

      # Clean up room index
      SessionRegistry.remove_from_room_index(self(), state.current_room_id)

      {:stop, :normal, state}
    else
      # Client reconnected before timeout
      Logger.debug(
        "[Session.Server] Disconnect timeout ignored for player #{state.player_id} " <>
          "(client reconnected)"
      )

      {:noreply, state}
    end
  end

  @impl true
  def handle_info({:broadcast, message}, state) do
    # Handle broadcasts from Session.broadcast_to_room/broadcast_all
    for {_ref, {client_type, client_pid, _meta}} <- state.clients do
      send_to_client(client_type, client_pid, message)
    end

    {:noreply, state}
  end

  @impl true
  def handle_info(msg, state) do
    Logger.warning("[Session.Server] Unexpected message: #{inspect(msg)}")
    {:noreply, state}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp via_tuple(player_id) do
    {:via, Registry, {Exmud.Session.PlayerRegistry, player_id}}
  end

  defp send_to_client(:liveview, pid, message) do
    send(pid, {:session_message, message})
  end

  defp send_to_client(:tui, pid, message) do
    send(pid, {:session_message, message})
  end

  defp send_to_client(:ssh, pid, message) do
    send(pid, {:session_message, message})
  end

  defp send_to_client(:mobile, pid, message) do
    send(pid, {:session_message, message})
  end

  defp send_to_client(:discord, pid, message) do
    send(pid, {:session_message, message})
  end

  defp send_to_client(client_type, pid, message) do
    Logger.warning("[Session.Server] Unknown client type: #{client_type}")
    send(pid, {:session_message, message})
  end

  defp cancel_disconnect_timer(%{disconnect_timer: nil} = state), do: state

  defp cancel_disconnect_timer(%{disconnect_timer: timer} = state) do
    Process.cancel_timer(timer)
    %{state | disconnect_timer: nil}
  end

  defp session_info(state) do
    %{
      player_id: state.player_id,
      player_email: state.player.email,
      current_room_id: state.current_room_id,
      in_combat: state.combat_state != nil,
      in_dialogue: state.dialogue_state != nil,
      client_count: map_size(state.clients),
      client_types: Enum.map(state.clients, fn {_, {type, _, _}} -> type end),
      created_at: state.created_at
    }
  end
end
