defmodule Loka.Engine.ZoneReset do
  @moduledoc """
  GenServer that manages zone reset timers and executes reset commands.

  Zone resets periodically respawn mobs and items in designated areas.
  This is based on DikuMUD's zone reset system.

  ## Reset Types

  - `:mob` - Spawn NPCs up to max count, with optional equipment/inventory
  - `:object` - Spawn items up to max count, with optional container contents
  - `:door` - Set door state (open/closed/locked)
  - `:remove` - Delete entities matching prototype in room

  ## Usage

      # Manual reset (e.g., from admin dashboard)
      ZoneReset.reset("monastery")

      # Get zone status
      {:ok, status} = ZoneReset.status("monastery")

      # Enable/disable a zone
      ZoneReset.set_enabled("monastery", false)
  """

  use GenServer
  require Logger

  alias Loka.Engine.{
    Zone,
    Spawner,
    Entities,
    EntityRegistry,
    EntityServer,
    EventBus,
    Event
  }

  alias Loka.Engine.Schema.EntitySchema
  alias Loka.Content

  @check_interval_ms 60_000

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the ZoneReset GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Manually triggers a zone reset.

  Bypasses the timer and reset_mode checks.
  """
  @spec reset(String.t(), GenServer.server()) :: :ok | {:error, term()}
  def reset(zone_key, server \\ __MODULE__) do
    GenServer.call(server, {:reset, zone_key})
  end

  @doc """
  Gets the status of a zone.

  Returns a map with:
  - `:zone` - Zone struct
  - `:next_reset_at` - Next scheduled reset time
  - `:players_present` - Whether players are in the zone
  - `:timer_active` - Whether the timer is running
  """
  @spec status(String.t(), GenServer.server()) ::
          {:ok, map()} | {:error, :not_found}
  def status(zone_key, server \\ __MODULE__) do
    GenServer.call(server, {:status, zone_key})
  end

  @doc """
  Gets status for all zones.
  """
  @spec all_status(GenServer.server()) :: [map()]
  def all_status(server \\ __MODULE__) do
    GenServer.call(server, :all_status)
  end

  @doc """
  Enables or disables a zone.
  """
  @spec set_enabled(String.t(), boolean(), GenServer.server()) :: :ok | {:error, :not_found}
  def set_enabled(zone_key, enabled, server \\ __MODULE__) do
    GenServer.call(server, {:set_enabled, zone_key, enabled})
  end

  @doc """
  Reloads zones and rebuilds timers.

  Called after zone reload to pick up new zone definitions.
  """
  @spec reload(GenServer.server()) :: :ok
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Schedule periodic check for zone resets
    schedule_check()

    state = %{
      timers: %{},
      last_check: DateTime.utc_now()
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:reset, zone_key}, _from, state) do
    case Content.Zone.get(zone_key) do
      {:ok, typed_object} ->
        zone = Content.Zone.to_zone_struct(typed_object)
        result = execute_reset(zone)
        {:reply, result, state}

      {:error, :not_found} ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:status, zone_key}, _from, state) do
    case Content.Zone.get(zone_key) do
      {:ok, typed_object} ->
        zone = Content.Zone.to_zone_struct(typed_object)
        players_present = Content.Zone.players_in_zone?(zone_key)

        status = %{
          zone: zone,
          next_reset_at: Zone.next_reset_at(zone),
          players_present: players_present,
          timer_active: zone.enabled and zone.reset_mode != :never
        }

        {:reply, {:ok, status}, state}

      {:error, :not_found} ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call(:all_status, _from, state) do
    zones =
      Content.Zone.all()
      |> Enum.map(&Content.Zone.to_zone_struct/1)

    statuses =
      Enum.map(zones, fn zone ->
        players_present = Content.Zone.players_in_zone?(zone.key)

        %{
          zone: zone,
          next_reset_at: Zone.next_reset_at(zone),
          players_present: players_present,
          timer_active: zone.enabled and zone.reset_mode != :never
        }
      end)

    {:reply, statuses, state}
  end

  @impl true
  def handle_call({:set_enabled, zone_key, enabled}, _from, state) do
    result = Content.Zone.set_enabled(zone_key, enabled)
    {:reply, result, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    # No-op in V2 — zone-room mappings are derived from entity data
    Content.Zone.rebuild()
    {:reply, :ok, state}
  end

  @impl true
  def handle_info(:check_resets, state) do
    now = DateTime.utc_now()

    zones =
      Content.Zone.enabled()
      |> Enum.map(&Content.Zone.to_zone_struct/1)

    # Check each zone for reset
    Enum.each(zones, fn zone ->
      if should_reset_now?(zone, now) do
        players_present = Content.Zone.players_in_zone?(zone.key)

        if Zone.should_reset?(zone, players_present) do
          Task.start(fn -> execute_reset(zone) end)
        end
      end
    end)

    # Schedule next check
    schedule_check()

    {:noreply, %{state | last_check: now}}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp schedule_check do
    Process.send_after(self(), :check_resets, @check_interval_ms)
  end

  defp should_reset_now?(zone, now) do
    next_reset = Zone.next_reset_at(zone)
    DateTime.compare(now, next_reset) != :lt
  end

  defp execute_reset(zone) do
    Logger.info("Starting zone reset for #{zone.key}")

    EventBus.broadcast(
      "events:zone",
      Event.new(:zone_reset_started, %{payload: %{zone_key: zone.key}})
    )

    stats = %{
      mobs_spawned: 0,
      objects_spawned: 0,
      doors_reset: 0,
      entities_removed: 0,
      errors: []
    }

    # Execute each reset command in order
    final_stats =
      Enum.reduce(zone.resets, stats, fn reset, acc ->
        execute_reset_command(zone.key, reset, acc)
      end)

    # Update last reset time
    Content.Zone.update_last_reset(zone.key, DateTime.utc_now())

    EventBus.broadcast(
      "events:zone",
      Event.new(:zone_reset_completed, %{payload: %{zone_key: zone.key, stats: final_stats}})
    )

    Logger.info(
      "Zone reset completed for #{zone.key}: " <>
        "#{final_stats.mobs_spawned} mobs, " <>
        "#{final_stats.objects_spawned} objects, " <>
        "#{final_stats.doors_reset} doors, " <>
        "#{final_stats.entities_removed} removed"
    )

    :ok
  end

  defp execute_reset_command(zone_key, %{type: :mob} = reset, stats) do
    prototype = Map.get(reset, :prototype)
    room = Map.get(reset, :room)
    rooms = Map.get(reset, :rooms, [room]) |> List.wrap() |> Enum.reject(&is_nil/1)
    max = Map.get(reset, :max, 1)

    # Count existing entities with this prototype
    current_count = Entities.count_by_key(prototype)
    to_spawn = max(0, max - current_count)

    if to_spawn > 0 do
      # Spawn across rooms in round-robin fashion
      spawned =
        Enum.take(Stream.cycle(rooms), to_spawn)
        |> Enum.reduce(0, fn room_key, count ->
          case spawn_mob(zone_key, prototype, room_key, reset) do
            {:ok, _entity} -> count + 1
            {:error, _reason} -> count
          end
        end)

      %{stats | mobs_spawned: stats.mobs_spawned + spawned}
    else
      stats
    end
  end

  defp execute_reset_command(zone_key, %{type: :object} = reset, stats) do
    prototype = Map.get(reset, :prototype)
    room = Map.get(reset, :room)
    max = Map.get(reset, :max, 1)

    # Count existing entities with this prototype
    current_count = Entities.count_by_key(prototype)
    to_spawn = max(0, max - current_count)

    if to_spawn > 0 do
      spawned =
        Enum.reduce(1..to_spawn, 0, fn _, count ->
          case spawn_object(zone_key, prototype, room, reset) do
            {:ok, _entity} -> count + 1
            {:error, _reason} -> count
          end
        end)

      %{stats | objects_spawned: stats.objects_spawned + spawned}
    else
      stats
    end
  end

  defp execute_reset_command(_zone_key, %{type: :door} = reset, stats) do
    room = Map.get(reset, :room)
    direction = Map.get(reset, :direction)
    door_state = Map.get(reset, :state)

    case set_door_state(room, direction, door_state) do
      :ok ->
        %{stats | doors_reset: stats.doors_reset + 1}

      {:error, reason} ->
        %{stats | errors: [{:door, room, direction, reason} | stats.errors]}
    end
  end

  defp execute_reset_command(_zone_key, %{type: :remove} = reset, stats) do
    prototype = Map.get(reset, :prototype)
    room = Map.get(reset, :room)

    removed = remove_entities(prototype, room)
    %{stats | entities_removed: stats.entities_removed + removed}
  end

  defp execute_reset_command(zone_key, reset, stats) do
    Logger.warning("Unknown reset command type in zone #{zone_key}: #{inspect(reset)}")
    stats
  end

  defp spawn_mob(zone_key, prototype, room_key, reset) do
    # Find the room entity by key
    case find_room_by_key(room_key) do
      {:ok, room} ->
        opts = [location_id: room.id]

        case Spawner.spawn(prototype, opts) do
          {:ok, entity} ->
            # Apply equipment and inventory
            apply_equipment(entity, Map.get(reset, :equipment))
            apply_inventory(entity, Map.get(reset, :inventory))

            EventBus.broadcast(
              "events:zone",
              Event.new(:zone_entity_spawned, %{
                payload: %{zone_key: zone_key, entity_id: entity.id}
              })
            )

            {:ok, entity}

          error ->
            Logger.warning("Failed to spawn mob #{prototype} in #{room_key}: #{inspect(error)}")
            error
        end

      {:error, _} = error ->
        Logger.warning("Room not found: #{room_key}")
        error
    end
  end

  defp spawn_object(zone_key, prototype, room_key, reset) do
    case find_room_by_key(room_key) do
      {:ok, room} ->
        opts = [location_id: room.id]

        case Spawner.spawn(prototype, opts) do
          {:ok, entity} ->
            # Spawn container contents
            spawn_contents(entity, Map.get(reset, :contains))

            EventBus.broadcast(
              "events:zone",
              Event.new(:zone_entity_spawned, %{
                payload: %{zone_key: zone_key, entity_id: entity.id}
              })
            )

            {:ok, entity}

          error ->
            Logger.warning(
              "Failed to spawn object #{prototype} in #{room_key}: #{inspect(error)}"
            )

            error
        end

      {:error, _} = error ->
        error
    end
  end

  defp find_room_by_key(room_key) do
    # Find room entity by prototype key
    case Entities.get_all_by_key(room_key) do
      [room | _] -> {:ok, room}
      [] -> {:error, :not_found}
    end
  end

  defp apply_equipment(_entity, nil), do: :ok
  defp apply_equipment(_entity, equipment) when equipment == %{}, do: :ok

  defp apply_equipment(entity, equipment) when is_map(equipment) do
    # Equipment is a map like %{wield: "sword", body: "armor"}
    # Spawn each item and set it in the entity's equipment component
    Enum.each(equipment, fn {slot, item_prototype} ->
      case Spawner.spawn(item_prototype, location_id: entity.id) do
        {:ok, item} ->
          # Update entity's equipment component with the slot mapping
          set_entity_equipment_slot(entity.id, slot, item.id)
          Logger.debug("Equipped #{item_prototype} on #{entity.id} slot #{slot}")
          {:ok, item}

        error ->
          Logger.warning("Failed to spawn equipment #{item_prototype}: #{inspect(error)}")
          error
      end
    end)
  end

  defp apply_inventory(_entity, nil), do: :ok
  defp apply_inventory(_entity, []), do: :ok

  defp apply_inventory(entity, items) when is_list(items) do
    Enum.each(items, fn item_prototype ->
      case Spawner.spawn(item_prototype, location_id: entity.id) do
        {:ok, _item} ->
          Logger.debug("Added #{item_prototype} to #{entity.id} inventory")

        error ->
          Logger.warning("Failed to spawn inventory item #{item_prototype}: #{inspect(error)}")
      end
    end)
  end

  defp spawn_contents(_container, nil), do: :ok
  defp spawn_contents(_container, []), do: :ok

  defp spawn_contents(container, contents) when is_list(contents) do
    Enum.each(contents, fn item_prototype ->
      case Spawner.spawn(item_prototype, location_id: container.id) do
        {:ok, _item} ->
          Logger.debug("Spawned #{item_prototype} inside #{container.id}")

        error ->
          Logger.warning("Failed to spawn container content #{item_prototype}: #{inspect(error)}")
      end
    end)
  end

  defp set_entity_equipment_slot(entity_id, slot, item_id) do
    # Update the entity's equipment component to track equipped items
    case EntityRegistry.get_or_start(entity_id) do
      {:ok, pid} ->
        EntityServer.update(pid, fn entity ->
          equipment = Map.get(entity.components, :equipment, %{})
          updated_equipment = Map.put(equipment, slot, item_id)
          put_in(entity.components[:equipment], updated_equipment)
        end)

      {:error, reason} ->
        Logger.warning("Failed to set equipment slot on #{entity_id}: #{inspect(reason)}")
        :error
    end
  end

  defp set_door_state(room_key, direction, state) do
    # Find the exit entity for this direction in the room
    case find_room_by_key(room_key) do
      {:ok, room} ->
        # Find exit in this room with matching direction
        case find_exit_in_room(room.id, direction) do
          {:ok, exit_entity} ->
            # Update the exit's door state
            update_door_state(exit_entity, state)

          {:error, _} = error ->
            error
        end

      {:error, _} = error ->
        error
    end
  end

  defp find_exit_in_room(room_id, direction) do
    import Ecto.Query

    direction_str = to_string(direction)

    # Find exits in this room
    query =
      from(e in EntitySchema,
        where: e.location_id == ^room_id and e.type == :exit
      )

    exits = Loka.Repo.all(query)

    # Find the one with matching direction
    matching_exit =
      Enum.find(exits, fn exit ->
        exit_data = Map.get(exit.components || %{}, "exit", %{})
        Map.get(exit_data, "direction") == direction_str
      end)

    case matching_exit do
      nil -> {:error, :exit_not_found}
      exit -> {:ok, exit}
    end
  end

  defp update_door_state(exit_entity, state) do
    # Update the exit's components to set door state
    components = exit_entity.components || %{}
    exit_data = Map.get(components, "exit", %{})
    updated_exit_data = Map.put(exit_data, "door_state", to_string(state))
    updated_components = Map.put(components, "exit", updated_exit_data)

    case Entities.update_entity(exit_entity, %{components: updated_components}) do
      {:ok, _} -> :ok
      error -> error
    end
  end

  defp remove_entities(prototype, room_key) do
    case find_room_by_key(room_key) do
      {:ok, room} ->
        # Find entities with this prototype in the room
        import Ecto.Query

        query =
          from(e in EntitySchema,
            where: e.key == ^prototype and e.location_id == ^room.id
          )

        entities = Loka.Repo.all(query)

        # Delete each entity
        Enum.reduce(entities, 0, fn entity, count ->
          case Entities.delete_entity(entity) do
            {:ok, _} -> count + 1
            _ -> count
          end
        end)

      {:error, _} ->
        0
    end
  end
end
