defmodule Loka.Framework.Scripting.WorldEventHandler do
  @moduledoc """
  Bridges world events (time, weather, etc.) to behavior script execution.

  Subscribes to PubSub world events and triggers scripts for entities that
  have registered subscriptions to those events.

  ## How It Works

  1. Entities register event subscriptions (typically via behaviors)
  2. WorldEventHandler subscribes to "world:events" topic
  3. When events occur, finds subscribed entities and runs their scripts

  ## Usage

      # Register an entity for an event
      WorldEventHandler.subscribe("npc-123", :dawn, "patrol", %{route: [...]})

      # Unsubscribe
      WorldEventHandler.unsubscribe("npc-123", :dawn)

  ## Supported Events

  Time events (from DayNight system):
  - :dawn, :morning, :noon, :afternoon, :dusk, :evening, :midnight

  Weather events (future):
  - :rain_start, :rain_stop, :storm_start, :storm_stop
  """

  use GenServer
  require Logger

  alias Loka.Engine.Script.Executor
  alias Loka.Engine.{EntityRegistry, EntityServer}

  @pubsub Loka.PubSub
  @topic "world:events"

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Subscribe an entity to a world event.

  When the event fires, the specified behavior script will be run with the
  given config.

  ## Parameters

  - `entity_id` - ID of the entity to trigger
  - `event` - Event to subscribe to (e.g., :dawn, :noon)
  - `behavior_key` - Script key to run when event fires
  - `config` - Config to pass to the behavior script

  ## Example

      WorldEventHandler.subscribe("guard-1", :dawn, "day_night_schedule", %{
        wake_message: "*stretches and yawns*"
      })
  """
  @spec subscribe(String.t(), atom(), String.t(), map()) :: :ok
  def subscribe(entity_id, event, behavior_key, config \\ %{}, server \\ __MODULE__) do
    GenServer.call(server, {:subscribe, entity_id, event, behavior_key, config})
  end

  @doc """
  Unsubscribe an entity from a world event.
  """
  @spec unsubscribe(String.t(), atom()) :: :ok
  def unsubscribe(entity_id, event, server \\ __MODULE__) do
    GenServer.call(server, {:unsubscribe, entity_id, event})
  end

  @doc """
  Unsubscribe an entity from all events (e.g., when entity despawns).
  """
  @spec unsubscribe_all(String.t()) :: :ok
  def unsubscribe_all(entity_id, server \\ __MODULE__) do
    GenServer.call(server, {:unsubscribe_all, entity_id})
  end

  @doc """
  List all subscriptions for debugging.
  """
  @spec list_subscriptions() :: map()
  def list_subscriptions(server \\ __MODULE__) do
    GenServer.call(server, :list_subscriptions)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Subscribe to world events
    Phoenix.PubSub.subscribe(@pubsub, @topic)
    Logger.info("[WorldEventHandler] Started and subscribed to #{@topic}")

    # State: %{event => %{entity_id => {behavior_key, config}}}
    {:ok, %{subscriptions: %{}}}
  end

  @impl true
  def handle_call({:subscribe, entity_id, event, behavior_key, config}, _from, state) do
    subscriptions =
      Map.update(
        state.subscriptions,
        event,
        %{entity_id => {behavior_key, config}},
        fn entities ->
          Map.put(entities, entity_id, {behavior_key, config})
        end
      )

    Logger.debug("[WorldEventHandler] #{entity_id} subscribed to #{event}")
    {:reply, :ok, %{state | subscriptions: subscriptions}}
  end

  @impl true
  def handle_call({:unsubscribe, entity_id, event}, _from, state) do
    subscriptions =
      Map.update(state.subscriptions, event, %{}, fn entities ->
        Map.delete(entities, entity_id)
      end)

    {:reply, :ok, %{state | subscriptions: subscriptions}}
  end

  @impl true
  def handle_call({:unsubscribe_all, entity_id}, _from, state) do
    # Remove entity from all events
    subscriptions =
      state.subscriptions
      |> Enum.map(fn {event, entities} ->
        {event, Map.delete(entities, entity_id)}
      end)
      |> Map.new()

    {:reply, :ok, %{state | subscriptions: subscriptions}}
  end

  @impl true
  def handle_call(:list_subscriptions, _from, state) do
    {:reply, state.subscriptions, state}
  end

  @impl true
  def handle_info({:time_event, event_name, data}, state) do
    Logger.debug("[WorldEventHandler] Received time event: #{event_name}")
    trigger_subscribed_scripts(event_name, data, state.subscriptions)
    {:noreply, state}
  end

  @impl true
  def handle_info({:weather_event, event_name, data}, state) do
    Logger.debug("[WorldEventHandler] Received weather event: #{event_name}")
    trigger_subscribed_scripts(event_name, data, state.subscriptions)
    {:noreply, state}
  end

  @impl true
  def handle_info(msg, state) do
    Logger.debug("[WorldEventHandler] Ignoring unknown message: #{inspect(msg)}")
    {:noreply, state}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp trigger_subscribed_scripts(event_name, event_data, subscriptions) do
    # Get entities subscribed to this event
    entities = Map.get(subscriptions, event_name, %{})

    if map_size(entities) > 0 do
      Logger.debug(
        "[WorldEventHandler] Triggering #{map_size(entities)} scripts for #{event_name}"
      )

      # Trigger each subscribed entity's script
      Enum.each(entities, fn {entity_id, {behavior_key, config}} ->
        Task.start(fn ->
          run_behavior_script(entity_id, behavior_key, config, event_name, event_data)
        end)
      end)
    end
  end

  defp run_behavior_script(entity_id, behavior_key, config, event_name, event_data) do
    # Get the entity
    case EntityRegistry.get_or_start(entity_id) do
      {:ok, pid} ->
        entity = EntityServer.get_entity(pid)

        # Build context with event info and behavior config
        context = %{
          behavior_key: behavior_key,
          config: config,
          triggered_by: :world_event,
          event: event_name,
          event_data: event_data
        }

        case Executor.run_by_key(behavior_key, entity, context) do
          {:ok, _result} ->
            Logger.debug("[WorldEventHandler] Script #{behavior_key} completed for #{entity_id}")

          {:error, reason} ->
            Logger.warning(
              "[WorldEventHandler] Script #{behavior_key} failed for #{entity_id}: #{inspect(reason)}"
            )
        end

      {:error, reason} ->
        Logger.warning(
          "[WorldEventHandler] Entity #{entity_id} not found for #{event_name}: #{inspect(reason)}"
        )
    end
  end
end
