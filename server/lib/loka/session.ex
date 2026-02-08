defmodule Loka.Session do
  use Boundary, top_level?: true, deps: [Loka.Engine], exports: :all

  @moduledoc """
  Unified session management for Loka players.

  This module provides a central API for managing player sessions across
  all client types (LiveView, SSH, mobile, etc.). It enables:

  - **Multi-client support**: Same player on multiple devices simultaneously
  - **Reconnect grace period**: 30s window to reconnect without losing session
  - **Admin visibility**: Who's online, session inspection, kick players
  - **Cross-client messaging**: Send to player regardless of client type
  - **Room broadcasts**: Efficiently notify all players in a room

  ## Architecture

  ```
  ┌─────────────────────────────────────────────────────────────────┐
  │                      Loka.Session (this module)                │
  │                         Public API                              │
  └─────────────────────────────────┬───────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │ Session.Registry│    │ Session.Server  │    │Session.Supervisor│
  │                 │    │ (per player)    │    │                 │
  │ - Player lookup │    │ - Client mgmt   │    │ - Start/stop    │
  │ - Room index    │    │ - State tracking│    │ - Fault tolerance│
  │ - Online count  │    │ - Message routing│   │                 │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
  ```

  ## Quick Start

  ### Connecting a Player (from LiveView)

      def mount(_params, _session, socket) do
        player = socket.assigns.current_scope.player

        # Connect player to session system
        {:ok, _session_pid} = Loka.Session.connect(player, :liveview, self())

        # Update room when player enters
        Loka.Session.update_room(player.id, room.id)

        {:ok, socket}
      end

  ### Handling Session Messages (in LiveView)

      def handle_info({:session_message, message}, socket) do
        case message do
          {:room_message, text} ->
            {:noreply, add_event(socket, text)}

          {:force_disconnect, reason} ->
            {:noreply, redirect(socket, to: ~p"/players/log-in?reason=\#{reason}")}

          {:announcement, text} ->
            {:noreply, add_announcement(socket, text)}

          _ ->
            {:noreply, socket}
        end
      end

  ### Admin Operations

      # List all online players
      Loka.Session.list_online()

      # Send server announcement
      Loka.Session.broadcast_all({:announcement, "Server restart in 5 minutes"})

      # Kick a player
      Loka.Session.disconnect(player_id, "Kicked by admin")

  ## Message Types

  Messages sent via `send_to_player/2` or broadcasts are wrapped as
  `{:session_message, message}` when delivered to client processes.

  Common message types:

  - `{:room_message, text}` - Narrative text for the room
  - `{:player_entered, name}` - Another player entered the room
  - `{:player_left, name}` - Another player left the room
  - `{:force_disconnect, reason}` - Admin kicked the player
  - `{:announcement, text}` - Server-wide announcement

  ## Design Notes

  - Sessions are `:temporary` - they don't restart on crash
  - Room index uses ETS for O(1) room broadcasts
  - Player lookup uses Elixir Registry for O(1) access
  - 30-second grace period allows tab refresh without losing session
  """

  alias Loka.Session.{Registry, Server, Supervisor}

  @type client_type :: :liveview | :ssh | :mobile | :discord | atom()
  @type player_id :: String.t() | integer()
  @type room_id :: String.t() | nil
  @type message :: term()

  # =============================================================================
  # Connection Management
  # =============================================================================

  @doc """
  Connects a player, starting a session if needed.

  This is the main entry point for client connections. Call this when a
  player connects via any client type (LiveView, SSH, mobile, etc.).

  - If no session exists, creates one
  - If session exists (e.g., player on another tab), joins it
  - Monitors the client process for automatic disconnect handling

  ## Parameters

  - `player` - Player struct with `:id` and `:email` fields
  - `client_type` - Type of client (`:liveview`, `:ssh`, `:mobile`, etc.)
  - `client_pid` - The client process to monitor (usually `self()`)
  - `meta` - Optional metadata (IP, user agent, etc.)

  ## Returns

  - `{:ok, session_pid}` on success

  ## Examples

      # From LiveView mount
      {:ok, _pid} = Session.connect(player, :liveview, self())

      # From mobile handler with metadata
      {:ok, _pid} = Session.connect(player, :mobile, self(), %{ip: "127.0.0.1"})
  """
  @spec connect(map(), client_type(), pid(), map()) :: {:ok, pid(), String.t()}
  def connect(player, client_type, client_pid, meta \\ %{}) do
    {:ok, session_pid} = Supervisor.get_or_start_session(player)
    {:ok, session_id} = Server.register_client(player.id, client_type, client_pid, meta)
    {:ok, session_pid, session_id}
  end

  @doc """
  Checks if a player is currently online.

  ## Examples

      if Session.online?(player_id) do
        Session.send_to_player(player_id, {:notification, "You have mail!"})
      end
  """
  @spec online?(player_id()) :: boolean()
  def online?(player_id) do
    Registry.online?(player_id)
  end

  # =============================================================================
  # Messaging
  # =============================================================================

  @doc """
  Sends a message to a specific player.

  The message is delivered to all connected clients for that player.
  Clients receive messages as `{:session_message, message}`.

  ## Parameters

  - `player_id` - The player's ID
  - `message` - Any term (will be wrapped in `{:session_message, ...}`)

  ## Returns

  - `:ok` on success
  - `{:error, :not_online}` if player is offline

  ## Examples

      # Send a notification
      Session.send_to_player(player_id, {:notification, "New mail!"})

      # Send a room message
      Session.send_to_player(player_id, {:room_message, "You hear footsteps."})

      # Force disconnect
      Session.send_to_player(player_id, {:force_disconnect, "Kicked"})
  """
  @spec send_to_player(player_id(), message()) :: :ok | {:error, :not_online}
  def send_to_player(player_id, message) do
    case Registry.get_session(player_id) do
      nil ->
        {:error, :not_online}

      _pid ->
        Server.send_message(player_id, message)
        :ok
    end
  end

  @doc """
  Broadcasts a message to all players in a room.

  Uses an ETS index for efficient O(1) lookup of players in the room,
  rather than iterating through all sessions.

  ## Parameters

  - `room_id` - The room's ID
  - `message` - Any term (will be wrapped in `{:session_message, ...}`)

  ## Returns

  - `:ok` (always succeeds, even if room is empty)

  ## Examples

      # Notify room of an event
      Session.broadcast_to_room(room_id, {:room_message, "A wolf howls nearby."})

      # Player action visible to room
      Session.broadcast_to_room(room_id, {:player_action, player_name, "draws a sword"})
  """
  @spec broadcast_to_room(room_id(), message()) :: :ok
  def broadcast_to_room(room_id, message) do
    for session_pid <- Registry.sessions_in_room(room_id) do
      send(session_pid, {:broadcast, message})
    end

    :ok
  end

  @doc """
  Broadcasts a message to all online players.

  Use sparingly—for server announcements, maintenance warnings, etc.

  ## Examples

      Session.broadcast_all({:announcement, "Server restarting in 5 minutes"})
      Session.broadcast_all({:system, :maintenance_mode, true})
  """
  @spec broadcast_all(message()) :: :ok
  def broadcast_all(message) do
    for {_player_id, session_pid, _meta} <- Registry.list_sessions() do
      send(session_pid, {:broadcast, message})
    end

    :ok
  end

  # =============================================================================
  # State Management
  # =============================================================================

  @doc """
  Updates a player's current room in the session.

  This updates the room index for efficient room broadcasts. Call this
  whenever a player moves to a new room.

  ## Examples

      # Player enters a room
      Session.update_room(player_id, "room_courtyard")

      # Player leaves world (disconnect)
      Session.update_room(player_id, nil)
  """
  @spec update_room(player_id(), room_id()) :: :ok | {:error, :not_online}
  def update_room(player_id, room_id) do
    if online?(player_id) do
      Server.update_state(player_id, [{:room_id, room_id}])
      :ok
    else
      {:error, :not_online}
    end
  end

  @doc """
  Updates combat state for a player's session.

  ## Examples

      # Player enters combat
      Session.update_combat(player_id, %{enemy: "goblin", round: 1})

      # Player exits combat
      Session.update_combat(player_id, nil)
  """
  @spec update_combat(player_id(), map() | nil) :: :ok | {:error, :not_online}
  def update_combat(player_id, combat_state) do
    if online?(player_id) do
      Server.update_state(player_id, [{:combat_state, combat_state}])
      :ok
    else
      {:error, :not_online}
    end
  end

  @doc """
  Updates dialogue state for a player's session.

  ## Examples

      # Player starts dialogue
      Session.update_dialogue(player_id, %{npc: "merchant", node: "greeting"})

      # Player ends dialogue
      Session.update_dialogue(player_id, nil)
  """
  @spec update_dialogue(player_id(), map() | nil) :: :ok | {:error, :not_online}
  def update_dialogue(player_id, dialogue_state) do
    if online?(player_id) do
      Server.update_state(player_id, [{:dialogue_state, dialogue_state}])
      :ok
    else
      {:error, :not_online}
    end
  end

  # =============================================================================
  # Admin & Observability
  # =============================================================================

  @doc """
  Lists all online players with session info.

  Returns a list of maps with session details. Useful for admin dashboards.

  ## Returns

      [
        %{
          player_id: "abc123",
          player_email: "user@example.com",
          current_room_id: "room_courtyard",
          in_combat: false,
          in_dialogue: true,
          client_count: 2,
          client_types: [:liveview, :mobile],
          created_at: ~U[2024-01-15 10:30:00Z]
        },
        ...
      ]
  """
  @spec list_online() :: [map()]
  def list_online do
    Registry.list_sessions()
    |> Enum.map(fn {player_id, _pid, _meta} ->
      Server.get_state(player_id)
    end)
  end

  @doc """
  Returns the count of online players.

  More efficient than `length(list_online())`.
  """
  @spec online_count() :: non_neg_integer()
  def online_count do
    Registry.online_count()
  end

  @doc """
  Gets session state for a specific player.

  Returns `nil` if player is offline.

  ## Returns

      %{
        player_id: "abc123",
        player_email: "user@example.com",
        current_room_id: "room_courtyard",
        in_combat: false,
        in_dialogue: false,
        client_count: 1,
        client_types: [:liveview],
        created_at: ~U[2024-01-15 10:30:00Z]
      }
  """
  @spec get_session_info(player_id()) :: map() | nil
  def get_session_info(player_id) do
    if online?(player_id) do
      Server.get_state(player_id)
    else
      nil
    end
  end

  @doc """
  Force disconnects a player.

  Sends a disconnect message to all clients, then terminates the session.
  Use for admin kick functionality.

  ## Parameters

  - `player_id` - The player's ID
  - `reason` - Reason string (sent to client, shown to player)

  ## Returns

  - `:ok` on success
  - `{:error, :not_online}` if player was already offline

  ## Examples

      Session.disconnect(player_id, "Kicked by admin")
      Session.disconnect(player_id, "Server maintenance")
  """
  @spec disconnect(player_id(), String.t()) :: :ok | {:error, :not_online}
  def disconnect(player_id, reason \\ "Disconnected") do
    case Registry.get_session(player_id) do
      nil ->
        {:error, :not_online}

      _pid ->
        # Notify clients before terminating
        Server.send_message(player_id, {:force_disconnect, reason})

        # Terminate the session
        Supervisor.terminate_session(player_id)
    end
  end

  @doc """
  Returns stats about the session system.

  Useful for monitoring and admin dashboards.

  ## Returns

      %{
        online_players: 42,
        active_sessions: 42,
        players_in_combat: 5,
        players_in_dialogue: 3
      }
  """
  @spec stats() :: map()
  def stats do
    sessions = list_online()

    %{
      online_players: length(sessions),
      active_sessions: Supervisor.count_sessions(),
      players_in_combat: Enum.count(sessions, & &1.in_combat),
      players_in_dialogue: Enum.count(sessions, & &1.in_dialogue)
    }
  end
end
