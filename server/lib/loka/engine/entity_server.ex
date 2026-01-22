defmodule Loka.Engine.EntityServer do
  @moduledoc """
  GenServer for active entity (room or NPC).

  Holds entity state in memory, periodically saves to DB,
  and hibernates after inactivity.

  ## Lifecycle

  1. Start: Load entity from DB into process state
  2. Active: Handle events, update state, mark dirty
  3. Save: Periodic save of dirty state to DB
  4. Idle: After timeout with no activity, hibernate or stop
  5. Stop: Final save to DB

  ## Usage

      # Start an entity server
      {:ok, pid} = EntityServer.start_link("entity-uuid")

      # Get the current entity state
      entity = EntityServer.get_entity(pid)

      # Update the entity
      EntityServer.update(pid, fn entity ->
        %{entity | name: "New Name"}
      end)

      # Force save
      EntityServer.save_now(pid)
  """

  use GenServer
  require Logger

  alias Loka.Engine.{Behavior, Entities, Entity, EventBus}

  # Configuration - can be overridden via opts
  # 2 minutes
  @default_idle_timeout_ms 120_000
  # 1 minute
  @default_save_interval_ms 60_000
  # 30 seconds
  @default_hibernate_after_ms 30_000

  defstruct [
    :entity_id,
    :entity,
    :dirty,
    :last_activity,
    :save_timer,
    :idle_timer,
    :idle_timeout_ms,
    :save_interval_ms,
    :hibernate_after_ms
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts an EntityServer process for the given entity ID.

  ## Options

  - `:name` - Optional name for the process
  - `:idle_timeout_ms` - Time before stopping idle process (default: 5 min)
  - `:save_interval_ms` - Time between auto-saves (default: 1 min)
  - `:hibernate_after_ms` - Time before hibernating (default: 2 min)
  """
  def start_link(entity_id, opts \\ []) do
    name = Keyword.get(opts, :name)
    gen_opts = if name, do: [name: name], else: []

    GenServer.start_link(__MODULE__, {entity_id, opts}, gen_opts)
  end

  @doc """
  Gets the full EntityServer state (for debugging/testing).
  """
  def get(server) do
    GenServer.call(server, :get)
  end

  @doc """
  Gets the current entity struct.
  """
  def get_entity(server) do
    GenServer.call(server, :get_entity)
  end

  @doc """
  Updates the entity using a function.

  The function receives the current entity and should return the updated entity.
  Marks the state as dirty for auto-save.

  ## Examples

      EntityServer.update(pid, fn entity ->
        Entity.set_attribute(entity, "health", 50)
      end)
  """
  def update(server, fun) when is_function(fun, 1) do
    GenServer.call(server, {:update, fun})
  end

  @doc """
  Sends an event to the entity for processing.
  """
  def handle_event(server, event) do
    GenServer.cast(server, {:event, event})
  end

  @doc """
  Resets the idle timer (touch to keep alive).
  """
  def touch(server) do
    GenServer.cast(server, :touch)
  end

  @doc """
  Forces an immediate save of the entity state.
  """
  def save_now(server) do
    GenServer.call(server, :save_now)
  end

  @doc """
  Gracefully stops the EntityServer, saving state first.
  """
  def stop(server) do
    GenServer.call(server, :stop)
  end

  @doc """
  Checks if the entity state has unsaved changes.
  """
  def dirty?(server) do
    GenServer.call(server, :dirty?)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init({entity_id, opts}) do
    start_time = System.monotonic_time()

    # Load entity from database
    case Entities.get_entity(entity_id) do
      nil ->
        {:stop, {:error, :entity_not_found}}

      schema ->
        entity = Entities.to_entity(schema)
        now = DateTime.utc_now()

        # Get configuration from opts or use defaults
        idle_timeout_ms = Keyword.get(opts, :idle_timeout_ms, @default_idle_timeout_ms)
        save_interval_ms = Keyword.get(opts, :save_interval_ms, @default_save_interval_ms)
        hibernate_after_ms = Keyword.get(opts, :hibernate_after_ms, @default_hibernate_after_ms)

        # Start timers
        save_timer = schedule_auto_save(save_interval_ms)
        idle_timer = schedule_idle_check(idle_timeout_ms)

        # Subscribe to entity's event topics
        subscribe_to_topics(entity)

        # Register in room for efficient room-based broadcasts
        if entity.location_id do
          Loka.Engine.EntityRegistry.register_in_room(entity_id, entity.location_id)
        end

        state = %__MODULE__{
          entity_id: entity_id,
          entity: entity,
          dirty: false,
          last_activity: now,
          save_timer: save_timer,
          idle_timer: idle_timer,
          idle_timeout_ms: idle_timeout_ms,
          save_interval_ms: save_interval_ms,
          hibernate_after_ms: hibernate_after_ms
        }

        # Emit telemetry for entity start
        :telemetry.execute(
          [:loka, :entity, :start],
          %{duration: System.monotonic_time() - start_time},
          %{entity_id: entity_id, entity_type: entity.type, location_id: entity.location_id}
        )

        Logger.debug("EntityServer started for #{entity.type} #{entity_id}")
        {:ok, state}
    end
  end

  @impl true
  def handle_call(:get, _from, state) do
    {:reply, state, touch_state(state)}
  end

  @impl true
  def handle_call(:get_entity, _from, state) do
    {:reply, state.entity, touch_state(state)}
  end

  @impl true
  def handle_call({:update, fun}, _from, state) do
    updated_entity = fun.(state.entity)
    new_state = %{state | entity: updated_entity} |> mark_dirty()
    {:reply, {:ok, updated_entity}, new_state}
  end

  @impl true
  def handle_call(:save_now, _from, state) do
    new_state = save_if_dirty(state)
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call(:stop, _from, state) do
    new_state = save_if_dirty(state)
    {:stop, :normal, :ok, new_state}
  end

  @impl true
  def handle_call(:dirty?, _from, state) do
    {:reply, state.dirty, state}
  end

  @impl true
  def handle_cast({:event, event}, state) do
    Logger.debug("EntityServer #{state.entity_id} received event: #{inspect(event.type)}")

    # Process event through entity's behaviors
    case process_behaviors(state.entity, event) do
      {:ok, updated_entity, emitted_events} ->
        # Broadcast any events emitted by behaviors
        Enum.each(emitted_events, &EventBus.emit/1)
        new_state = %{state | entity: updated_entity} |> mark_dirty()
        {:noreply, new_state}

      {:error, reason} ->
        Logger.warning(
          "EntityServer #{state.entity_id} behavior error on #{event.type}: #{inspect(reason)}"
        )

        {:noreply, touch_state(state)}
    end
  end

  @impl true
  def handle_cast(:touch, state) do
    {:noreply, touch_state(state)}
  end

  @impl true
  def handle_info(:auto_save, state) do
    new_state = save_if_dirty(state)
    # Reschedule the auto-save timer
    save_timer = schedule_auto_save(state.save_interval_ms)
    {:noreply, %{new_state | save_timer: save_timer}}
  end

  @impl true
  def handle_info(:check_idle, state) do
    idle_duration = DateTime.diff(DateTime.utc_now(), state.last_activity, :millisecond)

    cond do
      idle_duration >= state.idle_timeout_ms ->
        # Too idle - stop the process after saving
        Logger.debug("EntityServer #{state.entity_id} stopping due to inactivity")
        new_state = save_if_dirty(state)
        {:stop, :normal, new_state}

      idle_duration >= state.hibernate_after_ms ->
        # Somewhat idle - hibernate to reduce memory
        Logger.debug("EntityServer #{state.entity_id} hibernating")
        idle_timer = schedule_idle_check(state.idle_timeout_ms - idle_duration)
        {:noreply, %{state | idle_timer: idle_timer}, :hibernate}

      true ->
        # Still active - reschedule check
        remaining = state.idle_timeout_ms - idle_duration
        idle_timer = schedule_idle_check(remaining)
        {:noreply, %{state | idle_timer: idle_timer}}
    end
  end

  # Handle PubSub events
  @impl true
  def handle_info({:event, event}, state) do
    # Received event from EventBus subscription
    handle_cast({:event, event}, state)
  end

  # Handle player entered room notification (from GameChannel)
  @impl true
  def handle_info({:player_entered, _player_id, _player_name}, state) do
    # Room was notified that a player entered
    # Could trigger NPC reactions, room scripts, etc.
    {:noreply, touch_state(state)}
  end

  # Handle player left room notification
  @impl true
  def handle_info({:player_left, _player_id, _player_name}, state) do
    # Room was notified that a player left
    {:noreply, touch_state(state)}
  end

  # Catch-all for unknown messages to prevent crashes
  @impl true
  def handle_info(msg, state) do
    Logger.debug("EntityServer #{state.entity_id} received unknown message: #{inspect(msg)}")
    {:noreply, state}
  end

  @impl true
  def terminate(reason, state) do
    # Always try to save on termination
    Logger.debug("EntityServer #{state.entity_id} terminating: #{inspect(reason)}")

    # Emit telemetry for entity stop
    uptime_ms =
      if state.last_activity do
        DateTime.diff(DateTime.utc_now(), state.last_activity, :millisecond)
      else
        0
      end

    :telemetry.execute(
      [:loka, :entity, :stop],
      %{uptime_ms: uptime_ms},
      %{
        entity_id: state.entity_id,
        entity_type: state.entity && state.entity.type,
        reason: terminate_reason(reason),
        dirty_on_stop: state.dirty
      }
    )

    # Unregister from room index
    if state.entity && state.entity.location_id do
      Loka.Engine.EntityRegistry.unregister_from_room(state.entity_id, state.entity.location_id)
    end

    save_if_dirty(state)
    :ok
  end

  defp terminate_reason(:normal), do: :normal
  defp terminate_reason(:shutdown), do: :shutdown
  defp terminate_reason({:shutdown, _}), do: :shutdown
  defp terminate_reason(_), do: :error

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp mark_dirty(state) do
    %{state | dirty: true, last_activity: DateTime.utc_now()}
  end

  defp touch_state(state) do
    %{state | last_activity: DateTime.utc_now()}
  end

  defp save_if_dirty(%{dirty: false} = state), do: state

  defp save_if_dirty(%{dirty: true} = state) do
    start_time = System.monotonic_time()

    result = Entities.save_entity(state.entity)

    # Emit telemetry for entity save
    :telemetry.execute(
      [:loka, :entity, :save],
      %{duration: System.monotonic_time() - start_time},
      %{
        entity_id: state.entity_id,
        entity_type: state.entity.type,
        success: match?({:ok, _}, result)
      }
    )

    case result do
      {:ok, _} ->
        Logger.debug("EntityServer #{state.entity_id} saved to database")
        %{state | dirty: false}

      {:error, reason} ->
        Logger.error("EntityServer #{state.entity_id} failed to save: #{inspect(reason)}")
        state
    end
  end

  defp schedule_auto_save(interval_ms) do
    # Add jitter to prevent thundering herd (±10%)
    jitter = trunc(interval_ms * 0.1 * (:rand.uniform() - 0.5))
    Process.send_after(self(), :auto_save, interval_ms + jitter)
  end

  defp schedule_idle_check(interval_ms) do
    # Ensure we don't schedule with a negative or zero interval
    interval = max(interval_ms, 1000)
    Process.send_after(self(), :check_idle, interval)
  end

  defp subscribe_to_topics(%Entity{} = entity) do
    # Subscribe to entity-specific topic
    EventBus.subscribe("entity:#{entity.id}")

    # If it's a room, also subscribe to room topic
    if entity.type == :room do
      EventBus.subscribe("room:#{entity.id}")
    end

    :ok
  end

  defp process_behaviors(%Entity{behaviors: []} = entity, _event) do
    # No behaviors attached, entity unchanged
    {:ok, entity, []}
  end

  defp process_behaviors(%Entity{} = entity, event) do
    # Process event through all behaviors
    Behavior.process_event(entity, event, %{})
  end
end
