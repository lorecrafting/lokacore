defmodule Loka.Framework.World.NpcAmbient do
  @moduledoc """
  Handles ambient actions for NPCs - periodic character-specific flavor text.

  ## Overview

  NPC ambient actions are custom messages that broadcast periodically to bring
  NPCs to life. Unlike emotes (which use generic socials.yml templates), ambient
  actions are unique to each NPC and reflect their personality, role, and the
  story setting.

  ## Configuration

  NPCs define ambient actions in their YAML prototype under `components.ambient_actions`:

  ```yaml
  components:
    ambient_actions:
      messages:
        - "The merchant adjusts a silk scarf on the display."
        - "Dorje polishes a brass singing bowl with practiced care."
        - "The trader's eyes scan the courtyard for potential customers."
      interval_min: 30      # Minimum seconds between actions (default: 45)
      interval_max: 60      # Maximum seconds between actions (default: 90)
      chance: 0.5           # Probability of action when timer fires (default: 0.4)
  ```

  ## How It Works

  1. `NpcAmbient.Scheduler` (GenServer) maintains timers for all NPCs with ambient configs
  2. When a timer fires, it calls `maybe_emit_ambient/1` with the entity
  3. Based on `chance`, a random message is selected and broadcast to the room
  4. The timer is rescheduled for `interval_min..interval_max` seconds

  ## Message Guidelines

  Good ambient actions:
  - Reflect the NPC's personality and role
  - Fit the setting and atmosphere
  - Are varied enough to not feel repetitive
  - Use the NPC's name or description for clarity

  Examples:
  - Temple cat: "The grey cat grooms her paw with meticulous care."
  - Merchant: "Dorje arranges his wares with an eye for presentation."
  - Hermit: "Milarepa hums a strange melody that bends the air around him."
  """

  alias Loka.Engine.Entity

  require Logger

  @default_interval_min 45
  @default_interval_max 90
  @default_chance 0.4

  @doc """
  Extracts ambient action configuration from an entity's components.

  Returns `nil` if no ambient_actions component is configured.

  ## Examples

      iex> get_config(%Entity{components: %{ambient_actions: %{messages: ["Hello"]}}})
      %{messages: ["Hello"], interval_min: 45, interval_max: 90, chance: 0.4}

      iex> get_config(%Entity{components: %{}})
      nil
  """
  @spec get_config(map()) :: map() | nil
  def get_config(entity) when is_map(entity) do
    # First check components.ambient_actions (explicit ambient config)
    # Then fall back to behavior_config.*.ambient_messages (patrol/wander behaviors)
    case get_component_config(entity) do
      nil -> get_behavior_config(entity)
      config -> config
    end
  end

  def get_config(_), do: nil

  # Check components.ambient_actions
  defp get_component_config(%{components: components}) when is_map(components) do
    case Map.get(components, :ambient_actions) || Map.get(components, "ambient_actions") do
      nil -> nil
      config -> normalize_config(config)
    end
  end

  defp get_component_config(_), do: nil

  # Check behavior_config for ambient_messages (patrol, wander, etc.)
  defp get_behavior_config(entity) do
    # Try to get behavior_config from components (Entity struct) or direct field (EntitySchema)
    behavior_config = get_behavior_config_map(entity)

    if behavior_config do
      # Look for ambient_messages in any behavior config (patrol, wander, aggressive, etc.)
      messages =
        behavior_config
        |> Enum.flat_map(fn {_behavior_name, config} ->
          get_ambient_messages_from_config(config)
        end)

      if messages != [] do
        %{
          messages: messages,
          interval_min: @default_interval_min,
          interval_max: @default_interval_max,
          chance: @default_chance
        }
      else
        nil
      end
    else
      nil
    end
  end

  defp get_behavior_config_map(%{components: components}) when is_map(components) do
    Map.get(components, :behavior_config) || Map.get(components, "behavior_config")
  end

  defp get_behavior_config_map(_), do: nil

  defp get_ambient_messages_from_config(config) when is_map(config) do
    messages = Map.get(config, :ambient_messages) || Map.get(config, "ambient_messages") || []
    if is_list(messages), do: messages, else: []
  end

  defp get_ambient_messages_from_config(_), do: []

  defp normalize_config(config) when is_map(config) do
    messages = get_messages(config)

    if messages == [] do
      nil
    else
      %{
        messages: messages,
        interval_min: get_number(config, [:interval_min, "interval_min"], @default_interval_min),
        interval_max: get_number(config, [:interval_max, "interval_max"], @default_interval_max),
        chance: get_number(config, [:chance, "chance"], @default_chance)
      }
    end
  end

  defp normalize_config(_), do: nil

  defp get_messages(config) do
    messages = Map.get(config, :messages) || Map.get(config, "messages") || []
    if is_list(messages), do: messages, else: []
  end

  defp get_number(config, keys, default) do
    Enum.find_value(keys, default, fn key ->
      case Map.get(config, key) do
        nil -> nil
        val when is_number(val) -> val
        _ -> nil
      end
    end)
  end

  @doc """
  Calculates the next interval in milliseconds for ambient action scheduling.

  Returns a random value between `interval_min` and `interval_max` seconds,
  converted to milliseconds.
  """
  @spec next_interval(map()) :: pos_integer()
  def next_interval(%{interval_min: min, interval_max: max}) do
    seconds = min + :rand.uniform(max(max - min, 1))
    seconds * 1000
  end

  @doc """
  Attempts to emit an ambient action for the given entity.

  Based on the configured `chance`, selects a random message and broadcasts
  it to the entity's current room. Returns `:ok` regardless of whether a
  message was emitted.

  Note: Per-player deduplication is handled in GameChannel, not here.
  """
  @spec maybe_emit_ambient(map()) :: :ok
  def maybe_emit_ambient(entity) when is_map(entity) do
    case get_config(entity) do
      nil ->
        :ok

      config ->
        if :rand.uniform() < config.chance do
          emit_message(entity, config.messages)
        end

        :ok
    end
  end

  defp emit_message(entity, messages)
       when is_map(entity) and is_list(messages) and messages != [] do
    message = Enum.random(messages)
    room_id = get_location_id(entity)

    if room_id do
      formatted = format_message(message)

      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "room:#{room_id}",
        {:ambient_message, formatted}
      )

      Logger.debug("NPC ambient: #{entity.key} emitted: #{message}")
    end

    :ok
  end

  defp emit_message(_, _), do: :ok

  defp get_location_id(%{location_id: location_id}) when is_binary(location_id), do: location_id
  defp get_location_id(%Entity{} = entity), do: Map.get(entity.components, "location")
  defp get_location_id(_), do: nil

  defp format_message(message) do
    message
  end
end

defmodule Loka.Framework.World.NpcAmbient.Scheduler do
  @moduledoc """
  GenServer that schedules and triggers NPC ambient actions.

  Periodically checks for NPCs with ambient_actions in rooms with active players,
  and broadcasts their ambient messages.

  ## Lifecycle

  - Started by application supervisor
  - Periodically scans rooms with active players
  - For each NPC with ambient_actions, rolls against their chance to emit
  """

  use GenServer

  alias Loka.Engine.Entities
  alias Loka.Framework.World.NpcAmbient
  alias Loka.Session.Registry, as: SessionRegistry

  require Logger

  # Check every 45-75 seconds (randomized)
  @tick_interval 45_000
  @random_interval 30_000

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc "Forces an NPC ambient check (for testing)."
  def tick(server \\ __MODULE__) do
    GenServer.cast(server, :tick)
  end

  @impl true
  def init(opts) do
    auto_tick = Keyword.get(opts, :auto_tick, true)
    state = %{timer_ref: nil}

    state =
      if auto_tick do
        schedule_tick(state)
      else
        state
      end

    Logger.info("NPC ambient scheduler initialized")
    {:ok, state}
  end

  @impl true
  def handle_cast(:tick, state) do
    process_npc_ambient()
    {:noreply, state}
  end

  @impl true
  def handle_info(:tick, state) do
    process_npc_ambient()
    state = schedule_tick(state)
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state) do
    {:noreply, state}
  end

  defp schedule_tick(state) do
    if state.timer_ref, do: Process.cancel_timer(state.timer_ref)
    interval = @tick_interval + :rand.uniform(@random_interval)
    ref = Process.send_after(self(), :tick, interval)
    %{state | timer_ref: ref}
  end

  defp process_npc_ambient do
    active_rooms = SessionRegistry.get_active_rooms()

    # Batch load all room contents in a single query to avoid N+1
    contents_by_room = Entities.get_contents_batch(active_rooms)

    Enum.each(active_rooms, fn room_id ->
      npcs = get_ambient_npcs(Map.get(contents_by_room, room_id, []))

      Enum.each(npcs, fn npc ->
        NpcAmbient.maybe_emit_ambient(npc)
      end)
    end)
  end

  defp get_ambient_npcs(entities) do
    Enum.filter(entities, fn entity ->
      entity.type == :npc and NpcAmbient.get_config(entity) != nil
    end)
  end
end
