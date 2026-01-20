defmodule Loka.Timers.Server do
  @moduledoc """
  Central timer management service for persistent game timers.

  Handles crafting queues, offline progression, and other timers that need to
  survive server restarts and continue while players are offline.

  ## Architecture

  - Single GenServer process manages all timers
  - Timers persisted to database (Loka.Timers.Timer schema)
  - On startup, loads pending timers and schedules them
  - On completion, marks timer complete and delivers to player
  - If player offline, timer stays undelivered until reconnect

  ## Timer Types

  - `:crafting` - Item crafting with duration
  - `:gathering` - Offline resource gathering
  - `:quest` - Quest-related timers
  - `:cooldown` - Ability cooldowns

  ## Usage

      # Schedule a 30-second crafting timer
      {:ok, timer} = Loka.Timers.schedule(player_id, :crafting, 30_000, %{
        recipe_key: "iron_sword",
        outputs: [%{item: "iron_sword", quantity: 1}]
      })

      # Cancel a timer
      :ok = Loka.Timers.cancel(timer_id)

      # Get player's active timers
      timers = Loka.Timers.get_active(player_id)

      # Get completed but undelivered timers (for reconnect)
      completed = Loka.Timers.get_completed_undelivered(player_id)

  ## Delivery

  When a timer completes:
  1. Timer marked as `completed_at` in database
  2. If player has active Session, deliver via `Session.Server.send_message/2`
  3. If player offline, `delivered` stays false
  4. On reconnect, GameChannel checks for undelivered timers and delivers them
  """

  use GenServer
  require Logger

  alias Loka.Timers.Timer
  alias Loka.Session.Server, as: SessionServer
  alias Loka.Engine.Script.Executor
  alias Loka.Engine.{EntityRegistry, EntityServer}

  @type timer_type :: :crafting | :gathering | :quest | :cooldown

  # State: %{
  #   timer_refs: %{timer_id => timer_ref},  # Persistent timer refs
  #   script_timers: %{ref => timer_data}    # In-memory script timer refs
  # }
  # Maps timer IDs to their Process.send_after references for cancellation

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc """
  Schedule a script to run after a delay.

  Unlike persistent timers, script timers are in-memory only and don't survive
  server restarts. This is appropriate for behavior timers (patrol, schedule)
  that can restart cleanly.

  ## Parameters

  - `entity_id` - The entity ID to run the script on
  - `delay_seconds` - Delay in seconds before running the script
  - `script_key` - Key of the script to run
  - `context` - Additional context to pass to the script (config, etc.)

  ## Returns

  - `{:ok, ref}` - Timer scheduled, returns reference for cancellation
  """
  @spec schedule_script(String.t(), number(), String.t(), map()) :: {:ok, reference()}
  def schedule_script(entity_id, delay_seconds, script_key, context \\ %{}) do
    GenServer.call(__MODULE__, {:schedule_script, entity_id, delay_seconds, script_key, context})
  end

  @doc """
  Cancel a script timer by reference.
  """
  @spec cancel_script_timer(reference()) :: :ok
  def cancel_script_timer(ref) do
    GenServer.call(__MODULE__, {:cancel_script_timer, ref})
  end

  @doc """
  Schedule a new timer for a player.

  ## Parameters

  - `player_id` - The player's ID
  - `timer_type` - Type of timer (:crafting, :gathering, :quest, :cooldown)
  - `duration_ms` - Duration in milliseconds
  - `data` - Timer-specific data (recipe, outputs, etc.)

  ## Returns

  - `{:ok, timer}` - Timer created and scheduled
  - `{:error, reason}` - Failed to create timer
  """
  @spec schedule(String.t(), timer_type(), integer(), map()) ::
          {:ok, Timer.t()} | {:error, term()}
  def schedule(player_id, timer_type, duration_ms, data \\ %{}) do
    GenServer.call(__MODULE__, {:schedule, player_id, timer_type, duration_ms, data})
  end

  @doc """
  Cancel a timer by ID.

  Marks the timer as cancelled in the database and cancels any pending
  Process.send_after.

  ## Returns

  - `:ok` - Timer cancelled
  - `{:error, :not_found}` - Timer not found
  """
  @spec cancel(String.t()) :: :ok | {:error, :not_found}
  def cancel(timer_id) do
    GenServer.call(__MODULE__, {:cancel, timer_id})
  end

  @doc """
  Get all active (pending) timers for a player.

  Returns timers sorted by completion time.
  """
  @spec get_active(String.t()) :: [Timer.t()]
  def get_active(player_id) do
    Timer.get_pending(player_id)
  end

  @doc """
  Get completed but undelivered timers for a player.

  Used when player reconnects to catch up on offline progress.
  """
  @spec get_completed_undelivered(String.t()) :: [Timer.t()]
  def get_completed_undelivered(player_id) do
    Timer.get_completed_undelivered(player_id)
  end

  @doc """
  Mark timers as delivered.

  Called after successfully delivering timer completions to a player.
  """
  @spec mark_delivered([Timer.t()]) :: :ok
  def mark_delivered(timers) do
    Enum.each(timers, &Timer.mark_delivered/1)
    :ok
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Load and schedule all pending timers from database
    pending_timers = Timer.get_all_pending()
    Logger.info("[Timers.Server] Starting with #{length(pending_timers)} pending timers")

    timer_refs =
      pending_timers
      |> Enum.map(&schedule_timer_process/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new()

    {:ok, %{timer_refs: timer_refs, script_timers: %{}}}
  end

  @impl true
  def handle_call({:schedule, player_id, timer_type, duration_ms, data}, _from, state) do
    case Timer.create(player_id, timer_type, duration_ms, data) do
      {:ok, timer} ->
        {timer_id, timer_ref} = schedule_timer_process(timer)
        new_refs = Map.put(state.timer_refs, timer_id, timer_ref)

        Logger.info(
          "[Timers.Server] Scheduled #{timer_type} timer #{timer.id} for player #{player_id} " <>
            "(#{duration_ms}ms)"
        )

        {:reply, {:ok, timer}, %{state | timer_refs: new_refs}}

      {:error, changeset} ->
        Logger.error("[Timers.Server] Failed to create timer: #{inspect(changeset.errors)}")
        {:reply, {:error, changeset.errors}, state}
    end
  end

  @impl true
  def handle_call({:cancel, timer_id}, _from, state) do
    case Timer.get(timer_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      timer ->
        # Cancel the scheduled process message
        case Map.get(state.timer_refs, timer_id) do
          nil -> :ok
          ref -> Process.cancel_timer(ref)
        end

        # Mark as cancelled in database
        Timer.mark_cancelled(timer)

        new_refs = Map.delete(state.timer_refs, timer_id)

        Logger.info("[Timers.Server] Cancelled timer #{timer_id}")

        {:reply, :ok, %{state | timer_refs: new_refs}}
    end
  end

  @impl true
  def handle_call({:schedule_script, entity_id, delay_seconds, script_key, context}, _from, state) do
    delay_ms = round(delay_seconds * 1000)

    timer_data = %{
      entity_id: entity_id,
      script_key: script_key,
      context: context,
      scheduled_at: DateTime.utc_now()
    }

    ref = Process.send_after(self(), {:script_timer_complete, timer_data}, delay_ms)

    Logger.debug(
      "[Timers.Server] Scheduled script timer: #{script_key} for entity #{entity_id} in #{delay_seconds}s"
    )

    new_script_timers = Map.put(state.script_timers, ref, timer_data)
    {:reply, {:ok, ref}, %{state | script_timers: new_script_timers}}
  end

  @impl true
  def handle_call({:cancel_script_timer, ref}, _from, state) do
    Process.cancel_timer(ref)
    new_script_timers = Map.delete(state.script_timers, ref)
    {:reply, :ok, %{state | script_timers: new_script_timers}}
  end

  @impl true
  def handle_info({:timer_complete, timer_id}, state) do
    case Timer.get(timer_id) do
      nil ->
        Logger.warning("[Timers.Server] Timer #{timer_id} not found on completion")
        {:noreply, state}

      %Timer{cancelled: true} ->
        Logger.debug("[Timers.Server] Timer #{timer_id} was cancelled, ignoring completion")
        {:noreply, state}

      %Timer{completed_at: completed} when not is_nil(completed) ->
        Logger.debug("[Timers.Server] Timer #{timer_id} already completed")
        {:noreply, state}

      timer ->
        # Mark as completed
        {:ok, completed_timer} = Timer.mark_completed(timer)

        Logger.info(
          "[Timers.Server] Timer #{timer_id} (#{timer.timer_type}) completed for player #{timer.player_id}"
        )

        # Try to deliver to player
        deliver_timer_completion(completed_timer)

        # Remove from refs
        new_refs = Map.delete(state.timer_refs, timer_id)
        {:noreply, %{state | timer_refs: new_refs}}
    end
  end

  @impl true
  def handle_info({:script_timer_complete, timer_data}, state) do
    %{entity_id: entity_id, script_key: script_key, context: context} = timer_data

    Logger.debug("[Timers.Server] Script timer complete: #{script_key} for entity #{entity_id}")

    # Run the script asynchronously to avoid blocking the timer server
    Task.start(fn ->
      run_scheduled_script(entity_id, script_key, context)
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info(msg, state) do
    Logger.warning("[Timers.Server] Unexpected message: #{inspect(msg)}")
    {:noreply, state}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  # Schedule a Process.send_after for a timer
  # Returns {timer_id, timer_ref} or nil if timer is past due
  defp schedule_timer_process(timer) do
    remaining = Timer.remaining_ms(timer)

    if remaining <= 0 do
      # Timer already past due - complete it immediately
      send(self(), {:timer_complete, timer.id})
      {timer.id, nil}
    else
      ref = Process.send_after(self(), {:timer_complete, timer.id}, remaining)
      {timer.id, ref}
    end
  end

  # Try to deliver timer completion to player
  # If player is online, send via Session; otherwise stays undelivered
  defp deliver_timer_completion(timer) do
    player_id = timer.player_id

    if SessionServer.exists?(player_id) do
      # Player is online - deliver immediately
      message = build_timer_message(timer)
      SessionServer.send_message(player_id, message)

      # Mark as delivered
      Timer.mark_delivered(timer)

      Logger.debug("[Timers.Server] Delivered timer #{timer.id} to online player #{player_id}")
    else
      Logger.debug(
        "[Timers.Server] Player #{player_id} offline, timer #{timer.id} will be delivered on reconnect"
      )
    end
  end

  # Build the message to send to the player
  defp build_timer_message(timer) do
    {:timer_completed,
     %{
       timer_id: timer.id,
       timer_type: timer.timer_type,
       data: timer.data,
       scheduled_at: timer.scheduled_at,
       completed_at: timer.completed_at
     }}
  end

  # Run a scheduled script with the entity context
  defp run_scheduled_script(entity_id, script_key, context) do
    # Look up the entity from the EntityRegistry (active entities)
    case EntityRegistry.get_or_start(entity_id) do
      {:ok, pid} ->
        entity = EntityServer.get_entity(pid)
        # Merge scheduled context with a minimal context
        script_context = Map.merge(%{scheduled: true}, context)

        case Executor.run_by_key(script_key, entity, script_context) do
          {:ok, _result} ->
            Logger.debug("[Timers.Server] Scheduled script #{script_key} completed successfully")

          {:error, reason} ->
            Logger.warning(
              "[Timers.Server] Scheduled script #{script_key} failed: #{inspect(reason)}"
            )
        end

      {:error, reason} ->
        Logger.warning(
          "[Timers.Server] Entity #{entity_id} not found for scheduled script #{script_key}: #{inspect(reason)}"
        )
    end
  end
end
