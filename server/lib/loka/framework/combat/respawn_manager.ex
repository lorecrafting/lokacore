defmodule Loka.Framework.Combat.RespawnManager do
  @moduledoc """
  Handles mob despawning and respawning using entity components.

  When a mob is killed, it's marked as despawned in its components and a respawn
  timer is scheduled via the entity's EntityServer process. After the delay,
  the EntityServer restores health and removes the despawned flag.

  No GenServer state — all data lives in entity components.

  ## Usage

      # Mark a mob as dead (despawn)
      RespawnManager.despawn_mob(entity_id)

      # Check if mob is currently despawned
      RespawnManager.is_despawned?(entity_id)

      # Force immediate respawn (for testing)
      RespawnManager.respawn_mob(entity_id)
  """

  alias Loka.Engine.Entities
  alias Loka.Engine.EntityRegistry

  # 30 seconds
  @default_respawn_delay_ms 30_000

  @doc """
  Despawns a mob (marks it as dead and schedules respawn).
  Returns {:ok, respawn_time} or {:error, reason}.
  """
  def despawn_mob(entity_id, opts \\ []) do
    respawn_delay = Keyword.get(opts, :respawn_delay, @default_respawn_delay_ms)

    case Entities.get_entity(entity_id) do
      nil ->
        {:error, :entity_not_found}

      entity ->
        # Store original health for restoration on respawn
        combatant = Map.get(entity.components || %{}, "combatant", %{})
        original_health = Map.get(combatant, "health", %{"current" => 50, "max" => 50})

        respawn_data = %{"original_health" => original_health}

        updated_components =
          (entity.components || %{})
          |> Map.put("despawned", true)
          |> Map.put("respawn_data", respawn_data)

        {:ok, _} = Entities.update_entity(entity, %{components: updated_components})

        # Schedule respawn via the entity's EntityServer process
        case EntityRegistry.lookup(entity_id) do
          {:ok, pid} ->
            Process.send_after(pid, :respawn, respawn_delay)

          :not_found ->
            :ok
        end

        respawn_at = DateTime.add(DateTime.utc_now(), respawn_delay, :millisecond)
        {:ok, respawn_at}
    end
  end

  @doc """
  Checks if a mob is currently despawned (dead, awaiting respawn).
  """
  def is_despawned?(entity_id) do
    case Entities.get_entity(entity_id) do
      nil -> false
      entity -> entity.components["despawned"] == true
    end
  end

  @doc """
  Forces immediate respawn of a mob.
  """
  def respawn_mob(entity_id) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:error, :not_despawned}

      entity ->
        if entity.components["despawned"] == true do
          # Send immediate respawn to EntityServer
          case EntityRegistry.lookup(entity_id) do
            {:ok, pid} ->
              send(pid, :respawn)
              # Give the EntityServer a moment to process
              Process.sleep(10)
              :ok

            :not_found ->
              # No EntityServer running — do respawn inline
              do_inline_respawn(entity)
              :ok
          end
        else
          {:error, :not_despawned}
        end
    end
  end

  # Inline respawn for when no EntityServer is running (e.g., tests)
  defp do_inline_respawn(entity) do
    respawn_data = Map.get(entity.components, "respawn_data", %{})
    original_health = Map.get(respawn_data, "original_health", %{"current" => 50, "max" => 50})

    combatant = Map.get(entity.components, "combatant", %{})
    restored_combatant = Map.put(combatant, "health", original_health)

    updated_components =
      entity.components
      |> Map.put("combatant", restored_combatant)
      |> Map.delete("despawned")
      |> Map.delete("respawn_data")

    Entities.update_entity(entity, %{components: updated_components})
  end
end
