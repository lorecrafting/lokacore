defmodule Loka.Engine.EntityServer do
  @moduledoc """
  GenServer for active entity (room or NPC).

  Holds entity state in memory, periodically saves to DB,
  and hibernates after inactivity.

  ## Lifecycle

  1. Start: Load entity from DB into process state (with tags)
  2. Active: Handle events, update state, mark dirty
  3. Save: Periodic save of dirty state to DB
  4. Idle: After timeout with no activity, hibernate or stop
  5. Stop: Final save to DB

  ## V2 Event Dispatch

  `dispatch_event/3` is the central event processing function. It runs the
  behavior chain with snapshot rollback — if a catastrophic failure occurs,
  the entity reverts to the pre-event state.

  ## Usage

      # Start an entity server
      {:ok, pid} = EntityServer.start_link("entity-uuid")

      # Get the current entity state
      entity = EntityServer.get_entity(pid)

      # Update the entity (with optional force_save)
      EntityServer.update(pid, fn entity ->
        %{entity | short_desc: "New Name"}
      end, force_save: true)

      # Reload from DB
      EntityServer.reload(pid)
  """

  use GenServer
  require Logger

  alias Loka.Engine.{Behavior, Entities, Entity, EventBus, Event, StateMachine}

  @lifecycle_machine StateMachine.new(%{
                       initial: "loading",
                       transitions: %{
                         "loading" => ["alive", "error"],
                         "alive" => ["despawning", "error"],
                         "despawning" => ["saved"],
                         "saved" => [],
                         "error" => ["loading"]
                       }
                     })

  def lifecycle_machine, do: @lifecycle_machine

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
    :tick_timer,
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
  - `:idle_timeout_ms` - Time before stopping idle process (default: 2 min)
  - `:save_interval_ms` - Time between auto-saves (default: 1 min)
  - `:hibernate_after_ms` - Time before hibernating (default: 30s)
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

  ## Options

  - `:force_save` - If true, immediately persists to DB (default: false).
    Use for critical operations: room changes, item pickup/drop, quest
    completion, XP/level, gold, equipment, death penalties, builder edits.

  ## Examples

      EntityServer.update(pid, fn entity ->
        %{entity | short_desc: "New Name"}
      end, force_save: true)
  """
  def update(server, fun, opts \\ []) when is_function(fun, 1) do
    GenServer.call(server, {:update, fun, opts})
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

  @doc """
  Reloads the entity from the database, discarding in-memory changes.
  """
  def reload(server) do
    GenServer.call(server, :reload)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init({entity_id, opts}) do
    start_time = System.monotonic_time()

    # Load entity from database using V2 API (includes tag preloading)
    case Entities.find_one(entity_id) do
      {:error, :not_found} ->
        {:stop, {:error, :entity_not_found}}

      {:ok, entity} ->
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

        # Schedule tick if entity has tick interval configured
        tick_timer = maybe_schedule_tick(entity)

        state = %__MODULE__{
          entity_id: entity_id,
          entity: entity,
          dirty: false,
          last_activity: now,
          save_timer: save_timer,
          idle_timer: idle_timer,
          tick_timer: tick_timer,
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
  def handle_call({:update, fun, opts}, _from, state) do
    updated_entity = fun.(state.entity)
    new_state = %{state | entity: updated_entity} |> mark_dirty()

    new_state =
      if Keyword.get(opts, :force_save, false) do
        do_save(new_state)
      else
        new_state
      end

    {:reply, {:ok, updated_entity}, new_state}
  end

  # V1 compat: handle {:update, fun} without opts
  @impl true
  def handle_call({:update, fun}, from, state) do
    handle_call({:update, fun, []}, from, state)
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
  def handle_call(:reload, _from, state) do
    case Entities.find_one(state.entity_id) do
      {:ok, fresh} ->
        {:reply, :ok, %{state | entity: fresh, dirty: false}}

      {:error, :not_found} ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_cast({:event, event}, state) do
    Logger.debug("EntityServer #{state.entity_id} received event: #{inspect(event.type)}")

    # Process event through entity's traits (V1 path: module behaviors)
    case process_traits(state.entity, event) do
      {:ok, updated_entity, emitted_events} ->
        # Broadcast any events emitted by traits
        Enum.each(emitted_events, &EventBus.emit/1)
        new_state = %{state | entity: updated_entity} |> mark_dirty()

        # For signal events, also run on_signal scripts
        maybe_run_signal_script(updated_entity, event)

        {:noreply, new_state}

      {:error, reason} ->
        Logger.warning(
          "EntityServer #{state.entity_id} trait error on #{event.type}: #{inspect(reason)}"
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
    new_state = do_async_save(state)
    # Reschedule the auto-save timer
    save_timer = schedule_auto_save(state.save_interval_ms)
    {:noreply, %{new_state | save_timer: save_timer}}
  end

  @impl true
  def handle_info({:async_save_result, {:ok, saved}}, state) do
    Logger.debug("EntityServer #{state.entity_id} async save completed")
    {:noreply, %{state | entity: saved}}
  end

  @impl true
  def handle_info({:async_save_result, {:error, reason}}, state) do
    Logger.error("EntityServer #{state.entity_id} async save failed: #{inspect(reason)}")
    # Re-mark dirty so next auto_save retries
    {:noreply, %{state | dirty: true}}
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

  # Tick handler — dispatches to traits but does NOT reset idle timer (Decision 13)
  @impl true
  def handle_info(:tick, state) do
    entity = state.entity

    # Initialize Volatile state for traits
    Process.put(:entity_volatile, Map.get(state, :volatile, %{}))

    # Dispatch on_tick to all module traits that implement it
    # Script traits are dispatched separately via the script executor
    updated_entity =
      (entity.traits || [])
      |> Enum.filter(&is_atom/1)
      |> Enum.reduce(entity, fn trait_mod, ent ->
        if function_exported?(trait_mod, :on_tick, 1) do
          try do
            case trait_mod.on_tick(ent) do
              {:ok, updated} -> updated
              _ -> ent
            end
          rescue
            e ->
              Logger.warning("[#{entity.key}] trait #{trait_mod} crashed on tick: #{inspect(e)}")

              ent
          end
        else
          ent
        end
      end)

    # Dispatch on_tick to script traits
    updated_entity = dispatch_script_traits_tick(updated_entity)

    # Recover volatile state from process dictionary
    updated_volatile = Process.get(:entity_volatile, %{})

    new_state =
      %{state | entity: updated_entity, dirty: true}
      |> Map.put(:volatile, updated_volatile)

    # Reschedule tick — do NOT touch idle timer
    tick_timer = maybe_schedule_tick(updated_entity)
    {:noreply, %{new_state | tick_timer: tick_timer}}
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
  # V2 Event Dispatch
  # =============================================================================

  @doc """
  Dispatches an event through the entity's trait chain with snapshot rollback.

  Each module trait's `on_event/3` is called in order. If a trait crashes, it is
  skipped and the chain continues. If a catastrophic failure occurs, the entity
  reverts to the pre-event snapshot.

  Returns:
  - `{:ok, updated_entity}` — normal completion
  - `{:halted, updated_entity}` — a trait halted the chain
  - `{:error, snapshot}` — catastrophic failure, reverted to snapshot
  """
  def dispatch_event(entity, event_name, payload) do
    snapshot = Entity.snapshot(entity)

    try do
      # Only module traits participate in dispatch_event (script traits use hooks)
      module_traits = Enum.filter(entity.traits || [], &is_atom/1)

      result =
        module_traits
        |> Enum.reduce_while({:ok, entity, payload}, fn trait_mod, {:ok, ent, pl} ->
          if function_exported?(trait_mod, :on_event, 3) do
            try do
              case trait_mod.on_event(ent, event_name, pl) do
                {:ok, updated} -> {:cont, {:ok, updated, pl}}
                {:ok, updated, new_pl} -> {:cont, {:ok, updated, new_pl}}
                {:halt, updated} -> {:halt, {:halt, updated}}
              end
            rescue
              e ->
                Logger.warning(
                  "[#{entity.key}] trait #{inspect(trait_mod)} crashed on #{event_name}: #{inspect(e)}"
                )

                {:cont, {:ok, ent, pl}}
            end
          else
            {:cont, {:ok, ent, pl}}
          end
        end)

      case result do
        {:ok, final_entity, _payload} -> {:ok, final_entity}
        {:halt, final_entity} -> {:halted, final_entity}
      end
    rescue
      _ -> {:error, snapshot}
    end
  end

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
  defp save_if_dirty(%{dirty: true} = state), do: do_save(state)

  # Async save for auto_save timer — doesn't block the GenServer
  defp do_async_save(%{dirty: false} = state), do: state

  defp do_async_save(%{dirty: true} = state) do
    entity = state.entity
    server_pid = self()

    Task.start(fn ->
      start_time = System.monotonic_time()
      result = Entities.save(entity)

      :telemetry.execute(
        [:loka, :entity, :save],
        %{duration: System.monotonic_time() - start_time},
        %{entity_id: entity.id, entity_type: entity.type, success: match?({:ok, _}, result)}
      )

      send(server_pid, {:async_save_result, result})
    end)

    # Optimistically mark clean — will re-dirty on failure via handle_info
    %{state | dirty: false}
  end

  # Synchronous save for force_save and terminate paths
  defp do_save(state) do
    start_time = System.monotonic_time()

    result = Entities.save(state.entity)

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
      {:ok, saved} ->
        Logger.debug("EntityServer #{state.entity_id} saved to database")
        %{state | entity: saved, dirty: false}

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

  defp maybe_schedule_tick(%Entity{components: components}) do
    case get_in(components || %{}, ["tick", "interval"]) do
      interval when is_integer(interval) and interval > 0 ->
        # Add jitter to prevent thundering herd (±10%)
        jitter = trunc(interval * 0.1 * (:rand.uniform() - 0.5))
        Process.send_after(self(), :tick, interval + jitter)

      _ ->
        nil
    end
  end

  defp subscribe_to_topics(%Entity{} = entity) do
    # Subscribe to entity-specific topic
    EventBus.subscribe("entity:#{entity.id}")

    # If it's a room, also subscribe to room topic
    if entity.type == :room do
      EventBus.subscribe("location:#{entity.id}")
    end

    :ok
  end

  defp maybe_run_signal_script(%Entity{scripts: scripts} = entity, %Event{type: :signal} = event) do
    script_key = Map.get(scripts, "on_signal") || Map.get(scripts, :on_signal)

    if script_key do
      Task.start(fn ->
        alias Loka.Engine.Script.Executor

        context = %{
          trigger: :signal,
          signal_name: event.payload[:signal_name],
          signal_data: event.payload[:data] || %{},
          source_id: event.source
        }

        case Executor.run_by_key(script_key, entity, context) do
          {:ok, _} ->
            :ok

          {:error, reason} ->
            Logger.warning("[EntityServer] Signal script failed: #{inspect(reason)}")
        end
      end)
    end
  end

  defp maybe_run_signal_script(_, _), do: :ok

  defp process_traits(%Entity{traits: []} = entity, _event) do
    # No traits attached, entity unchanged
    {:ok, entity, []}
  end

  defp process_traits(%Entity{} = entity, event) do
    # Process event through module traits (V1 path)
    Behavior.process_event(entity, event, %{})
  end

  # =============================================================================
  # Script Trait Dispatcher
  # =============================================================================

  defp dispatch_script_traits_tick(entity) do
    script_traits =
      (entity.traits || [])
      |> Enum.filter(&is_map/1)
      |> Enum.filter(fn t -> is_binary(t["script"]) end)

    if script_traits == [] do
      entity
    else
      Enum.reduce(script_traits, entity, fn trait, ent ->
        run_script_trait(ent, trait, :tick)
      end)
    end
  end

  defp run_script_trait(entity, %{"script" => script_key} = trait, hook) do
    alias Loka.Content.Script, as: ContentScript
    config = trait["config"] || %{}

    case ContentScript.get(script_key) do
      {:ok, script} ->
        script_hook = ContentScript.hook(script)

        # Only run if the script's hook matches (behavior = tick-based)
        if script_hook == "behavior" and hook == :tick do
          source = ContentScript.source(script)

          context = %{
            trigger: :tick,
            config: config,
            behavior_key: script_key
          }

          try do
            alias Loka.Engine.Script.Executor

            case Executor.execute_source(source, entity, context) do
              {:ok, _result, _actions} ->
                entity

              {:error, reason} ->
                Logger.warning(
                  "[EntityServer] Script trait #{script_key} failed: #{inspect(reason)}"
                )

                entity
            end
          rescue
            e ->
              Logger.warning("[EntityServer] Script trait #{script_key} crashed: #{inspect(e)}")
              entity
          end
        else
          entity
        end

      {:error, _} ->
        Logger.debug("[EntityServer] Script trait not found: #{script_key}")
        entity
    end
  end
end
