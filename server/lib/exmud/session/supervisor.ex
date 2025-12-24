defmodule Exmud.Session.Supervisor do
  @moduledoc """
  DynamicSupervisor for player session processes.

  Manages the lifecycle of `Session.Server` processes—one per online player.
  Sessions are `:temporary` restart strategy, meaning they don't automatically
  restart on crash (player just needs to reconnect).

  ## Design Rationale

  - **:temporary restart**: Session state is ephemeral. If a session crashes,
    the player reconnects and gets a fresh session. No need to preserve
    potentially corrupted state.

  - **:one_for_one strategy**: Each session is independent. One crashing
    session shouldn't affect others.

  - **DynamicSupervisor**: Sessions are created/destroyed dynamically as
    players connect/disconnect. Static supervision wouldn't work here.

  ## Usage

      # Start a new session (called internally by Session.connect/4)
      {:ok, pid} = Session.Supervisor.start_session(player)

      # Get or start (idempotent - won't duplicate)
      {:ok, pid} = Session.Supervisor.get_or_start_session(player)

      # Count active sessions
      Session.Supervisor.count_sessions()

      # List all session pids (for debugging)
      Session.Supervisor.list_sessions()
  """

  use DynamicSupervisor
  require Logger

  alias Exmud.Session.{Server, Registry}

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the session supervisor.

  Called by the application supervisor during startup.
  """
  def start_link(opts \\ []) do
    DynamicSupervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Starts a new session for a player.

  Creates a new `Session.Server` process under this supervisor.
  Returns `{:error, {:already_started, pid}}` if a session already exists.

  ## Parameters

  - `player` - A player struct with at least `:id` and `:email` fields

  ## Returns

  - `{:ok, pid}` on success
  - `{:error, {:already_started, pid}}` if session exists
  - `{:error, reason}` on failure
  """
  @spec start_session(map()) :: {:ok, pid()} | {:error, term()}
  def start_session(player) do
    child_spec = {Server, player}

    case DynamicSupervisor.start_child(__MODULE__, child_spec) do
      {:ok, pid} ->
        Logger.debug("[Session.Supervisor] Started session for player #{player.id}")
        {:ok, pid}

      {:error, {:already_started, pid}} ->
        Logger.debug("[Session.Supervisor] Session already exists for player #{player.id}")
        {:error, {:already_started, pid}}

      {:error, reason} = error ->
        Logger.error(
          "[Session.Supervisor] Failed to start session for player #{player.id}: #{inspect(reason)}"
        )

        error
    end
  end

  @doc """
  Gets an existing session or starts a new one.

  This is idempotent—safe to call multiple times for the same player.
  If a session already exists, returns its pid. Otherwise, creates a new one.

  ## Parameters

  - `player` - A player struct with at least `:id` and `:email` fields

  ## Returns

  - `{:ok, pid}` on success (existing or newly created)
  - `{:error, reason}` on failure
  """
  @spec get_or_start_session(map()) :: {:ok, pid()} | {:error, term()}
  def get_or_start_session(player) do
    case Registry.get_session(player.id) do
      nil ->
        # No existing session, start a new one
        case start_session(player) do
          {:ok, pid} -> {:ok, pid}
          {:error, {:already_started, pid}} -> {:ok, pid}
          error -> error
        end

      pid ->
        {:ok, pid}
    end
  end

  @doc """
  Returns the count of active sessions.
  """
  @spec count_sessions() :: non_neg_integer()
  def count_sessions do
    DynamicSupervisor.count_children(__MODULE__).active
  end

  @doc """
  Lists all active session pids.

  Useful for debugging and admin tools. For player info, use
  `Session.list_online/0` instead.
  """
  @spec list_sessions() :: [pid()]
  def list_sessions do
    __MODULE__
    |> DynamicSupervisor.which_children()
    |> Enum.map(fn {_, pid, _, _} -> pid end)
    |> Enum.filter(&is_pid/1)
  end

  @doc """
  Terminates a session by player_id.

  Used for admin kick functionality. The session will clean up its
  room index and notify clients before terminating.

  ## Returns

  - `:ok` on success
  - `{:error, :not_found}` if no session exists
  """
  @spec terminate_session(term()) :: :ok | {:error, :not_found}
  def terminate_session(player_id) do
    case Registry.get_session(player_id) do
      nil ->
        {:error, :not_found}

      pid ->
        DynamicSupervisor.terminate_child(__MODULE__, pid)
        :ok
    end
  end

  # =============================================================================
  # Supervisor Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    Logger.info("[Session.Supervisor] Starting")
    DynamicSupervisor.init(strategy: :one_for_one)
  end
end
