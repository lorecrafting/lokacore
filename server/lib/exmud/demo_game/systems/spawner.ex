defmodule Exmud.DemoGame.Systems.Spawner do
  @moduledoc """
  Handles mob spawning and respawning for the demo game.

  When a mob is killed, it despawns (marked as dead) and a respawn timer starts.
  After the respawn delay, the mob respawns at its original location with full health.

  ## Usage

      # Mark a mob as dead (despawn)
      Spawner.despawn_mob(entity_id)

      # Check if mob is currently despawned
      Spawner.is_despawned?(entity_id)

      # Force immediate respawn (for testing)
      Spawner.respawn_mob(entity_id)
  """

  use GenServer

  alias Exmud.Engine.Entities

  # 30 seconds
  @default_respawn_delay_ms 30_000

  # Client API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Despawns a mob (marks it as dead and schedules respawn).
  Returns {:ok, respawn_time} or {:error, reason}.
  """
  def despawn_mob(entity_id, opts \\ []) do
    respawn_delay = Keyword.get(opts, :respawn_delay, @default_respawn_delay_ms)
    GenServer.call(__MODULE__, {:despawn, entity_id, respawn_delay})
  end

  @doc """
  Checks if a mob is currently despawned (dead, awaiting respawn).
  """
  def is_despawned?(entity_id) do
    GenServer.call(__MODULE__, {:is_despawned, entity_id})
  end

  @doc """
  Forces immediate respawn of a mob.
  """
  def respawn_mob(entity_id) do
    GenServer.call(__MODULE__, {:respawn, entity_id})
  end

  @doc """
  Gets all currently despawned mobs.
  """
  def list_despawned do
    GenServer.call(__MODULE__, :list_despawned)
  end

  # Server Callbacks

  @impl true
  def init(_opts) do
    # State: %{entity_id => %{original_health: map, respawn_at: DateTime, timer_ref: ref}}
    {:ok, %{despawned: %{}}}
  end

  @impl true
  def handle_call({:despawn, entity_id, respawn_delay}, _from, state) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:reply, {:error, :entity_not_found}, state}

      entity ->
        # Store original health from combatant component
        combatant = Map.get(entity.components || %{}, "combatant", %{})
        original_health = Map.get(combatant, "health", %{"current" => 50, "max" => 50})

        # Mark entity as despawned by setting a flag in components
        updated_components = Map.put(entity.components || %{}, "despawned", true)
        {:ok, _} = Entities.update_entity(entity, %{components: updated_components})

        # Schedule respawn
        timer_ref = Process.send_after(self(), {:do_respawn, entity_id}, respawn_delay)
        respawn_at = DateTime.add(DateTime.utc_now(), respawn_delay, :millisecond)

        despawn_info = %{
          original_health: original_health,
          respawn_at: respawn_at,
          timer_ref: timer_ref,
          location_id: entity.location_id
        }

        new_state = put_in(state, [:despawned, entity_id], despawn_info)
        {:reply, {:ok, respawn_at}, new_state}
    end
  end

  @impl true
  def handle_call({:is_despawned, entity_id}, _from, state) do
    is_despawned = Map.has_key?(state.despawned, entity_id)
    {:reply, is_despawned, state}
  end

  @impl true
  def handle_call({:respawn, entity_id}, _from, state) do
    case Map.get(state.despawned, entity_id) do
      nil ->
        {:reply, {:error, :not_despawned}, state}

      despawn_info ->
        # Cancel any pending timer
        if despawn_info.timer_ref, do: Process.cancel_timer(despawn_info.timer_ref)

        # Do the respawn
        new_state = do_respawn_mob(entity_id, despawn_info, state)
        {:reply, :ok, new_state}
    end
  end

  @impl true
  def handle_call(:list_despawned, _from, state) do
    despawned_list =
      Enum.map(state.despawned, fn {id, info} ->
        %{entity_id: id, respawn_at: info.respawn_at}
      end)

    {:reply, despawned_list, state}
  end

  @impl true
  def handle_info({:do_respawn, entity_id}, state) do
    case Map.get(state.despawned, entity_id) do
      nil ->
        # Already respawned or doesn't exist
        {:noreply, state}

      despawn_info ->
        new_state = do_respawn_mob(entity_id, despawn_info, state)
        {:noreply, new_state}
    end
  end

  # Private Functions

  defp do_respawn_mob(entity_id, despawn_info, state) do
    case Entities.get_entity(entity_id) do
      nil ->
        # Entity was deleted, just remove from tracking
        %{state | despawned: Map.delete(state.despawned, entity_id)}

      entity ->
        # Restore health and remove despawned flag
        combatant = Map.get(entity.components || %{}, "combatant", %{})
        restored_combatant = Map.put(combatant, "health", despawn_info.original_health)

        updated_components =
          entity.components
          |> Map.put("combatant", restored_combatant)
          |> Map.delete("despawned")

        {:ok, _} = Entities.update_entity(entity, %{components: updated_components})

        # Broadcast respawn event
        if despawn_info.location_id do
          Phoenix.PubSub.broadcast(
            Exmud.PubSub,
            "room:#{despawn_info.location_id}",
            {:mob_respawned, entity_id, entity.name}
          )
        end

        # Remove from despawned tracking
        %{state | despawned: Map.delete(state.despawned, entity_id)}
    end
  end
end
