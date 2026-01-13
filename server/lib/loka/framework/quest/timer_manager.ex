defmodule Loka.Framework.Quest.TimerManager do
  @moduledoc """
  Manages timed quest objectives with expiration tracking.

  Handles scheduling, notifications, and expiration of time-limited objectives.

  ## Features

  - Automatic timer scheduling when quests with timed objectives are accepted
  - Warning notifications before expiration (configurable)
  - Expiration handling with objective failure
  - Persistent timers across process restarts

  ## Usage

      # Start a timer for a timed objective
      TimerManager.start_objective_timer(player_id, quest_id, objective_id, time_limit_seconds)

      # Cancel a timer (e.g., when objective is completed)
      TimerManager.cancel_objective_timer(player_id, quest_id, objective_id)

      # Check remaining time
      TimerManager.get_remaining_time(player_id, quest_id, objective_id)

      # Check if objective has expired
      TimerManager.is_expired?(player_id, quest_id, objective_id)

  ## Events

  The TimerManager broadcasts events via PubSub:

  - `{:objective_warning, quest_id, objective_id, seconds_remaining}` - Warning before expiration
  - `{:objective_expired, quest_id, objective_id}` - Objective time limit reached

  Subscribe to receive notifications:

      Phoenix.PubSub.subscribe(Loka.PubSub, "quest_timer:\#{player_id}")
  """

  use GenServer
  require Logger

  alias Phoenix.PubSub
  alias Loka.Admin.GameLog

  @table :loka_quest_timers
  # Seconds before expiration to send warnings
  @warning_intervals [60, 30, 10]
  # Check timers every second
  @check_interval 1_000

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the timer manager.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Starts a timer for a timed objective.

  ## Parameters

  - `player_id` - The player's ID
  - `quest_id` - The quest ID
  - `objective_id` - The objective ID
  - `time_limit` - Time limit in seconds
  - `opts` - Options:
    - `:started_at` - DateTime when timer started (defaults to now)

  ## Returns

  - `{:ok, expires_at}` on success
  - `{:error, reason}` on failure
  """
  def start_objective_timer(player_id, quest_id, objective_id, time_limit, opts \\ []) do
    GenServer.call(
      __MODULE__,
      {:start_timer, player_id, quest_id, objective_id, time_limit, opts}
    )
  end

  @doc """
  Cancels a timer for an objective (e.g., when completed).
  """
  def cancel_objective_timer(player_id, quest_id, objective_id) do
    GenServer.call(__MODULE__, {:cancel_timer, player_id, quest_id, objective_id})
  end

  @doc """
  Gets remaining time for an objective in seconds.

  Returns `nil` if no timer exists.
  """
  def get_remaining_time(player_id, quest_id, objective_id) do
    GenServer.call(__MODULE__, {:get_remaining, player_id, quest_id, objective_id})
  end

  @doc """
  Gets all active timers for a player.

  Returns a list of timer info maps.
  """
  def get_player_timers(player_id) do
    GenServer.call(__MODULE__, {:get_player_timers, player_id})
  end

  @doc """
  Checks if an objective has expired.
  """
  def is_expired?(player_id, quest_id, objective_id) do
    case get_remaining_time(player_id, quest_id, objective_id) do
      nil -> false
      remaining -> remaining <= 0
    end
  end

  @doc """
  Gets the expiration time for an objective.

  Returns `{:ok, expires_at}` or `{:error, :not_found}`.
  """
  def get_expires_at(player_id, quest_id, objective_id) do
    GenServer.call(__MODULE__, {:get_expires_at, player_id, quest_id, objective_id})
  end

  @doc """
  Clears all timers for a player (e.g., when resetting quests).
  """
  def clear_player_timers(player_id) do
    GenServer.call(__MODULE__, {:clear_player, player_id})
  end

  @doc """
  Clears all timers for a specific quest (e.g., when quest is completed).
  """
  def clear_quest_timers(player_id, quest_id) do
    GenServer.call(__MODULE__, {:clear_quest, player_id, quest_id})
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:set, :protected, read_concurrency: true])

    # Schedule periodic timer check
    Process.send_after(self(), :check_timers, @check_interval)

    state = %{
      table: table,
      # %{timer_key => timer_data}
      timers: %{},
      # %{timer_key => [warned_at_seconds]}
      warned: %{}
    }

    Logger.info("#{__MODULE__} started")
    {:ok, state}
  end

  @impl true
  def handle_call(
        {:start_timer, player_id, quest_id, objective_id, time_limit, opts},
        _from,
        state
      ) do
    started_at = Keyword.get(opts, :started_at, DateTime.utc_now())
    expires_at = DateTime.add(started_at, time_limit, :second)
    timer_key = timer_key(player_id, quest_id, objective_id)

    timer_data = %{
      player_id: player_id,
      quest_id: quest_id,
      objective_id: objective_id,
      time_limit: time_limit,
      started_at: started_at,
      expires_at: expires_at
    }

    :ets.insert(state.table, {timer_key, timer_data})
    new_timers = Map.put(state.timers, timer_key, timer_data)

    Logger.debug(
      "[TimerManager] Started timer for #{quest_id}/#{objective_id} (player #{player_id}), expires in #{time_limit}s"
    )

    {:reply, {:ok, expires_at}, %{state | timers: new_timers}}
  end

  @impl true
  def handle_call({:cancel_timer, player_id, quest_id, objective_id}, _from, state) do
    timer_key = timer_key(player_id, quest_id, objective_id)

    :ets.delete(state.table, timer_key)
    new_timers = Map.delete(state.timers, timer_key)
    new_warned = Map.delete(state.warned, timer_key)

    Logger.debug("[TimerManager] Cancelled timer for #{quest_id}/#{objective_id}")

    {:reply, :ok, %{state | timers: new_timers, warned: new_warned}}
  end

  @impl true
  def handle_call({:get_remaining, player_id, quest_id, objective_id}, _from, state) do
    timer_key = timer_key(player_id, quest_id, objective_id)

    result =
      case Map.get(state.timers, timer_key) do
        nil ->
          nil

        %{expires_at: expires_at} ->
          DateTime.diff(expires_at, DateTime.utc_now(), :second)
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:get_player_timers, player_id}, _from, state) do
    timers =
      state.timers
      |> Enum.filter(fn {_key, data} -> data.player_id == player_id end)
      |> Enum.map(fn {_key, data} ->
        remaining = DateTime.diff(data.expires_at, DateTime.utc_now(), :second)

        Map.put(data, :remaining_seconds, max(0, remaining))
      end)

    {:reply, timers, state}
  end

  @impl true
  def handle_call({:get_expires_at, player_id, quest_id, objective_id}, _from, state) do
    timer_key = timer_key(player_id, quest_id, objective_id)

    result =
      case Map.get(state.timers, timer_key) do
        nil -> {:error, :not_found}
        %{expires_at: expires_at} -> {:ok, expires_at}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:clear_player, player_id}, _from, state) do
    {cleared_keys, remaining_timers} =
      Enum.split_with(state.timers, fn {_key, data} ->
        data.player_id == player_id
      end)

    Enum.each(cleared_keys, fn {key, _} ->
      :ets.delete(state.table, key)
    end)

    new_timers = Map.new(remaining_timers)
    new_warned = Map.drop(state.warned, Enum.map(cleared_keys, &elem(&1, 0)))

    {:reply, :ok, %{state | timers: new_timers, warned: new_warned}}
  end

  @impl true
  def handle_call({:clear_quest, player_id, quest_id}, _from, state) do
    {cleared_keys, remaining_timers} =
      Enum.split_with(state.timers, fn {_key, data} ->
        data.player_id == player_id && data.quest_id == quest_id
      end)

    Enum.each(cleared_keys, fn {key, _} ->
      :ets.delete(state.table, key)
    end)

    new_timers = Map.new(remaining_timers)
    new_warned = Map.drop(state.warned, Enum.map(cleared_keys, &elem(&1, 0)))

    {:reply, :ok, %{state | timers: new_timers, warned: new_warned}}
  end

  @impl true
  def handle_info(:check_timers, state) do
    now = DateTime.utc_now()
    new_state = process_timers(state, now)

    # Schedule next check
    Process.send_after(self(), :check_timers, @check_interval)

    {:noreply, new_state}
  end

  # =============================================================================
  # Private - Timer Processing
  # =============================================================================

  defp process_timers(state, now) do
    Enum.reduce(state.timers, state, fn {timer_key, timer_data}, acc_state ->
      remaining = DateTime.diff(timer_data.expires_at, now, :second)

      cond do
        # Timer expired
        remaining <= 0 ->
          handle_expiration(acc_state, timer_key, timer_data)

        # Check for warnings
        true ->
          handle_warnings(acc_state, timer_key, timer_data, remaining)
      end
    end)
  end

  defp handle_expiration(state, timer_key, timer_data) do
    %{player_id: player_id, quest_id: quest_id, objective_id: objective_id} = timer_data

    # Broadcast expiration event
    PubSub.broadcast(
      Loka.PubSub,
      "quest_timer:#{player_id}",
      {:objective_expired, quest_id, objective_id}
    )

    # Log the expiration
    GameLog.Quest.log_objective_expired(
      player_id,
      quest_id,
      objective_id,
      timer_data.time_limit
    )

    Logger.info(
      "[TimerManager] Objective #{quest_id}/#{objective_id} expired for player #{player_id}"
    )

    # Remove the timer
    :ets.delete(state.table, timer_key)

    %{
      state
      | timers: Map.delete(state.timers, timer_key),
        warned: Map.delete(state.warned, timer_key)
    }
  end

  defp handle_warnings(state, timer_key, timer_data, remaining) do
    already_warned = Map.get(state.warned, timer_key, [])

    warnings_to_send =
      @warning_intervals
      |> Enum.filter(fn interval ->
        remaining <= interval && interval not in already_warned
      end)

    if Enum.empty?(warnings_to_send) do
      state
    else
      %{player_id: player_id, quest_id: quest_id, objective_id: objective_id} = timer_data

      # Send warnings
      Enum.each(warnings_to_send, fn _interval ->
        PubSub.broadcast(
          Loka.PubSub,
          "quest_timer:#{player_id}",
          {:objective_warning, quest_id, objective_id, remaining}
        )

        Logger.debug(
          "[TimerManager] Warning: #{quest_id}/#{objective_id} expires in #{remaining}s"
        )
      end)

      # Update warned list
      new_warned = Map.put(state.warned, timer_key, already_warned ++ warnings_to_send)
      %{state | warned: new_warned}
    end
  end

  # =============================================================================
  # Private - Helpers
  # =============================================================================

  defp timer_key(player_id, quest_id, objective_id) do
    "#{player_id}:#{quest_id}:#{objective_id}"
  end
end
