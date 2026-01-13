defmodule Loka.Session.Registry do
  @moduledoc """
  Lightweight session registry using Elixir's built-in Registry and ETS.

  Provides O(1) lookups for:
  - `player_id` → `session_pid` (via Elixir Registry)
  - `room_id` → `[session_pids]` (via ETS index for efficient room broadcasts)
  - List all online players

  ## Architecture

  This module manages two data structures:

  1. **Player Registry** (`Loka.Session.PlayerRegistry`)
     - Elixir's built-in Registry for player_id → session_pid mapping
     - Automatically cleaned up when session processes terminate

  2. **Room Index** (ETS `:bag` table)
     - Maps room_id → session_pid for efficient room broadcasts
     - Must be manually updated when players move rooms or disconnect

  ## Usage

      # Get session for a player (nil if offline)
      Session.Registry.get_session(player_id)

      # List all online players
      Session.Registry.list_sessions()

      # Get all sessions in a room (for broadcasts)
      Session.Registry.sessions_in_room(room_id)

      # Update when player moves
      Session.Registry.update_room_index(session_pid, old_room_id, new_room_id)

  ## Design Notes

  - Uses ETS `:bag` type for room index to support multiple sessions per room
  - Read concurrency enabled for performance
  - GenServer only needed for ETS table ownership (no state)
  """

  use GenServer
  require Logger

  @room_index :loka_session_room_index

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the session registry.

  Called by the application supervisor. Creates the ETS table for room indexing.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Gets the session pid for a player.

  Returns `nil` if the player is not online.

  ## Examples

      iex> Session.Registry.get_session("player_123")
      #PID<0.456.0>

      iex> Session.Registry.get_session("offline_player")
      nil
  """
  @spec get_session(String.t() | integer()) :: pid() | nil
  def get_session(player_id) do
    case Registry.lookup(Loka.Session.PlayerRegistry, player_id) do
      [{pid, _meta}] -> pid
      [] -> nil
    end
  end

  @doc """
  Lists all online player sessions.

  Returns a list of `{player_id, session_pid, metadata}` tuples.

  ## Examples

      iex> Session.Registry.list_sessions()
      [{"player_1", #PID<0.100.0>, %{email: "a@b.com"}}, ...]
  """
  @spec list_sessions() :: [{term(), pid(), map()}]
  def list_sessions do
    Registry.select(Loka.Session.PlayerRegistry, [
      {{:"$1", :"$2", :"$3"}, [], [{{:"$1", :"$2", :"$3"}}]}
    ])
  end

  @doc """
  Returns the count of online players.

  More efficient than `length(list_sessions())` as it doesn't fetch all data.
  """
  @spec online_count() :: non_neg_integer()
  def online_count do
    Registry.count(Loka.Session.PlayerRegistry)
  end

  @doc """
  Returns a list of online player maps with id and name.

  ## Examples

      iex> Session.Registry.get_online_players()
      [%{id: "player_1", name: "Alice"}, %{id: "player_2", name: "Bob"}]
  """
  @spec get_online_players() :: [map()]
  def get_online_players do
    list_sessions()
    |> Enum.map(fn {player_id, _pid, metadata} ->
      %{id: player_id, name: Map.get(metadata, :name, "Unknown")}
    end)
  end

  @doc """
  Gets all session pids currently in a room.

  Used for efficient room broadcasts without iterating all sessions.

  ## Examples

      iex> Session.Registry.sessions_in_room("room_courtyard")
      [#PID<0.100.0>, #PID<0.200.0>]
  """
  @spec sessions_in_room(String.t() | nil) :: [pid()]
  def sessions_in_room(nil), do: []

  def sessions_in_room(room_id) do
    @room_index
    |> :ets.lookup(room_id)
    |> Enum.map(fn {_room, session_pid} -> session_pid end)
  end

  @doc """
  Updates the room index when a player moves rooms.

  Removes from old room index (if any) and adds to new room index (if any).
  Safe to call with `nil` for either room.

  ## Examples

      # Player enters first room
      Session.Registry.update_room_index(self(), nil, "room_courtyard")

      # Player moves between rooms
      Session.Registry.update_room_index(self(), "room_courtyard", "room_temple")

      # Player leaves world (disconnect cleanup)
      Session.Registry.update_room_index(self(), "room_temple", nil)
  """
  @spec update_room_index(pid(), String.t() | nil, String.t() | nil) :: :ok
  def update_room_index(session_pid, old_room_id, new_room_id) do
    if old_room_id do
      :ets.delete_object(@room_index, {old_room_id, session_pid})
    end

    if new_room_id do
      :ets.insert(@room_index, {new_room_id, session_pid})
    end

    :ok
  end

  @doc """
  Removes a session from the room index.

  Called during disconnect cleanup.
  """
  @spec remove_from_room_index(pid(), String.t() | nil) :: :ok
  def remove_from_room_index(_session_pid, nil), do: :ok

  def remove_from_room_index(session_pid, room_id) do
    :ets.delete_object(@room_index, {room_id, session_pid})
    :ok
  end

  @doc """
  Returns all room IDs that currently have active players.

  Useful for ambient message systems that need to know which rooms
  to send periodic messages to.

  ## Examples

      iex> Session.Registry.get_active_rooms()
      ["room_courtyard", "room_temple"]
  """
  @spec get_active_rooms() :: [String.t()]
  def get_active_rooms do
    @room_index
    |> :ets.tab2list()
    |> Enum.map(fn {room_id, _pid} -> room_id end)
    |> Enum.uniq()
  end

  @doc """
  Checks if a player is currently online.
  """
  @spec online?(String.t() | integer()) :: boolean()
  def online?(player_id) do
    get_session(player_id) != nil
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Create ETS table for room indexing
    # :bag allows multiple entries with same key (multiple players per room)
    # :public allows any process to read/write (needed for session processes)
    # :read_concurrency optimizes for frequent reads
    :ets.new(@room_index, [
      :bag,
      :named_table,
      :public,
      read_concurrency: true
    ])

    Logger.info("[Session.Registry] Started with room index table")
    {:ok, %{}}
  end

  @impl true
  def handle_info(msg, state) do
    Logger.warning("[Session.Registry] Unexpected message: #{inspect(msg)}")
    {:noreply, state}
  end
end
