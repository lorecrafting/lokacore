defmodule Loka.Framework.Inventory.ContainerRespawn do
  @moduledoc """
  Handles scheduling and executing container respawns.

  When items are taken from a container with respawn enabled, this GenServer
  schedules a respawn after the configured delay. When the timer fires,
  it regenerates the container's contents from its loot table.

  ## Usage

      # Schedule a respawn for a container
      ContainerRespawn.schedule(entity_id)

      # Cancel a pending respawn (e.g., if container is destroyed)
      ContainerRespawn.cancel(entity_id)

  ## How It Works

  1. When `schedule/1` is called, we check if a respawn is already pending
  2. If not, we schedule a timer based on the container's `respawn.delay_seconds`
  3. When the timer fires, we regenerate contents from the loot table
  4. The container entity is updated in the database

  ## Configuration

  Respawn is configured per-container in the prototype:

      components:
        container:
          respawn:
            enabled: true
            delay_seconds: 300  # 5 minutes
            loot_table:
              - item: gold_coin
                weight: 50
                quantity: [1, 5]
  """

  use GenServer

  require Logger

  alias Loka.Engine.Entities
  alias Loka.Framework.Inventory.Container

  # ============================================================================
  # Client API
  # ============================================================================

  @doc """
  Starts the ContainerRespawn server.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Schedules a respawn for a container entity.

  If the container doesn't have respawn enabled or a respawn is already
  scheduled, this is a no-op.

  Returns:
    - `:ok` if respawn was scheduled
    - `:already_scheduled` if a respawn is already pending
    - `:respawn_disabled` if the container doesn't have respawn enabled
    - `{:error, reason}` on failure
  """
  @spec schedule(String.t()) :: :ok | :already_scheduled | :respawn_disabled | {:error, term()}
  def schedule(entity_id) do
    GenServer.call(__MODULE__, {:schedule, entity_id})
  end

  @doc """
  Cancels a pending respawn for a container.

  Returns `:ok` regardless of whether there was a pending respawn.
  """
  @spec cancel(String.t()) :: :ok
  def cancel(entity_id) do
    GenServer.cast(__MODULE__, {:cancel, entity_id})
  end

  @doc """
  Checks if a respawn is pending for a container.
  """
  @spec pending?(String.t()) :: boolean()
  def pending?(entity_id) do
    GenServer.call(__MODULE__, {:pending?, entity_id})
  end

  @doc """
  Returns the number of pending respawns (for monitoring).
  """
  @spec pending_count() :: non_neg_integer()
  def pending_count do
    GenServer.call(__MODULE__, :pending_count)
  end

  # ============================================================================
  # Server Callbacks
  # ============================================================================

  @impl true
  def init(_opts) do
    # State is a map of entity_id => timer_ref
    {:ok, %{timers: %{}}}
  end

  @impl true
  def handle_call({:schedule, entity_id}, _from, state) do
    case Map.get(state.timers, entity_id) do
      nil ->
        # No pending respawn, check if we should schedule one
        case schedule_respawn(entity_id, state) do
          {:ok, new_state} ->
            {:reply, :ok, new_state}

          {:error, :respawn_disabled} ->
            {:reply, :respawn_disabled, state}

          {:error, reason} ->
            {:reply, {:error, reason}, state}
        end

      _timer_ref ->
        # Already scheduled
        {:reply, :already_scheduled, state}
    end
  end

  def handle_call({:pending?, entity_id}, _from, state) do
    {:reply, Map.has_key?(state.timers, entity_id), state}
  end

  def handle_call(:pending_count, _from, state) do
    {:reply, map_size(state.timers), state}
  end

  @impl true
  def handle_cast({:cancel, entity_id}, state) do
    case Map.pop(state.timers, entity_id) do
      {nil, _state} ->
        {:noreply, state}

      {timer_ref, new_timers} ->
        Process.cancel_timer(timer_ref)
        {:noreply, %{state | timers: new_timers}}
    end
  end

  @impl true
  def handle_info({:respawn, entity_id}, state) do
    # Remove from timers map
    new_timers = Map.delete(state.timers, entity_id)

    # Execute the respawn
    execute_respawn(entity_id)

    {:noreply, %{state | timers: new_timers}}
  end

  # ============================================================================
  # Private Functions
  # ============================================================================

  defp schedule_respawn(entity_id, state) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:error, :entity_not_found}

      schema ->
        entity = Entities.to_entity(schema)

        case Container.get_container(entity) do
          nil ->
            {:error, :not_a_container}

          container ->
            if Container.respawn_enabled?(container) do
              delay_ms = Container.respawn_delay(container) * 1000
              timer_ref = Process.send_after(self(), {:respawn, entity_id}, delay_ms)
              new_timers = Map.put(state.timers, entity_id, timer_ref)

              Logger.debug(
                "Scheduled container respawn for #{entity_id} in #{Container.respawn_delay(container)}s"
              )

              {:ok, %{state | timers: new_timers}}
            else
              {:error, :respawn_disabled}
            end
        end
    end
  end

  defp execute_respawn(entity_id) do
    case Entities.get_entity(entity_id) do
      nil ->
        Logger.warning("Container respawn failed: entity #{entity_id} not found")

      schema ->
        entity = Entities.to_entity(schema)

        case Container.get_container(entity) do
          nil ->
            Logger.warning("Container respawn failed: #{entity_id} is not a container")

          container ->
            # Generate new contents from loot table
            new_contents = Container.generate_initial_contents(container)

            # Update the container with new contents
            updated_container = %{container | contents: new_contents}

            # Persist to database
            update_container_in_entity(schema, updated_container)

            Logger.debug("Container #{entity_id} respawned with #{length(new_contents)} items")

            # Broadcast respawn event to room if entity is in one
            broadcast_respawn(entity, new_contents)
        end
    end
  end

  defp update_container_in_entity(schema, %Container{} = container) do
    components = Map.get(schema.components, "components", schema.components)
    updated_components = Map.put(components, "container", Container.to_map(container))
    Entities.update_entity(schema, %{components: updated_components})
  end

  defp broadcast_respawn(entity, new_contents) when length(new_contents) > 0 do
    # If the entity has a room_id, broadcast that the container has respawned
    room_id =
      Map.get(entity, :location_id) || get_in(entity, [Access.key(:components, %{}), "room_id"])

    if room_id do
      message = "Fresh growth appears in the #{entity.short_desc || "container"}."

      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "location:#{room_id}",
        {:ambient_message, message}
      )
    end
  end

  defp broadcast_respawn(_entity, _contents), do: :ok
end
