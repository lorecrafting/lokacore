defmodule Loka.Framework.World.RoomAmbient do
  @moduledoc """
  Handles time-based ambient environmental messages for rooms.

  ## Overview

  Room ambient messages are atmospheric descriptions that broadcast periodically
  based on the current time phase (dawn, day, dusk, night). Messages come from
  two sources:

  1. **Tag-based messages** - Defined in `priv/world/config/ambient_messages.yml`,
     shared across all rooms with matching tags
  2. **Room-specific messages** - Defined in `components.ambient_messages` on
     individual rooms, for unique flavor

  ## How It Works

  1. `RoomAmbient.Scheduler` periodically checks rooms with active players
  2. For each room, it determines the current phase from DayNight
  3. It collects messages from:
     - Tag-based config (all tags the room has)
     - Room-specific config (if defined)
  4. A random message is selected and broadcast to players in the room

  ## Tag-based Configuration

  Define in `priv/world/config/ambient_messages.yml`:

      tag_messages:
        monastery:
          dawn:
            - "Temple bells ring across the monastery."
          night:
            - "The monastery settles into contemplative silence."
        outdoor:
          dawn:
            - "Birds begin their morning chorus."

  ## Room-specific Configuration

  Define in room YAML under `components.ambient_messages`:

      components:
        ambient_messages:
          day:
            - "Sandalwood incense curls toward the ceiling."
            - "A monk prostrates before the altar."
          night:
            - "A single butter lamp flickers before the Buddha."

  Rooms without any matching messages for the current phase stay silent.
  """

  alias Loka.Engine.Entity
  alias Loka.Framework.World.DayNight

  require Logger

  # Load tag-based config at compile time
  @config_path "priv/world/config/ambient_messages.yml"
  @external_resource @config_path

  @tag_messages (
                  path = Path.join(:code.priv_dir(:loka), "world/config/ambient_messages.yml")

                  if File.exists?(path) do
                    config = YamlElixir.read_from_file!(path)
                    # Convert to atom keys for phases
                    (config["tag_messages"] || %{})
                    |> Enum.map(fn {tag, phases} ->
                      phases =
                        phases
                        |> Enum.map(fn {phase, messages} ->
                          {String.to_atom(phase), messages}
                        end)
                        |> Map.new()

                      {tag, phases}
                    end)
                    |> Map.new()
                  else
                    %{}
                  end
                )

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Gets a random ambient message for the given room and current phase.

  Combines messages from:
  - Tag-based config (matching room tags)
  - Room-specific config (if defined)

  Returns `nil` if no messages match the current phase.
  """
  @spec get_message(Entity.t()) :: String.t() | nil
  def get_message(room_entity) do
    phase = get_current_phase()
    get_message_for_phase(room_entity, phase)
  end

  @doc """
  Gets a random ambient message for a specific phase.
  """
  @spec get_message_for_phase(Entity.t(), atom()) :: String.t() | nil
  def get_message_for_phase(room_entity, phase) do
    messages = collect_messages(room_entity, phase)

    case messages do
      [] -> nil
      list -> Enum.random(list)
    end
  end

  @doc """
  Gets all available messages for a room and phase.
  Useful for debugging and World Builder preview.
  """
  @spec collect_messages(Entity.t(), atom()) :: [String.t()]
  def collect_messages(room_entity, phase) do
    tag_messages = get_tag_messages(room_entity, phase)
    room_messages = get_room_messages(room_entity, phase)

    tag_messages ++ room_messages
  end

  @doc """
  Checks if a room has any ambient messages for the current phase.
  """
  @spec has_ambient_messages?(Entity.t()) :: boolean()
  def has_ambient_messages?(room_entity) do
    phase = get_current_phase()
    collect_messages(room_entity, phase) != []
  end

  @doc """
  Checks if a room has ambient messages for any phase.
  """
  @spec has_any_ambient_messages?(Entity.t()) :: boolean()
  def has_any_ambient_messages?(room_entity) do
    Enum.any?([:dawn, :day, :dusk, :night], fn phase ->
      collect_messages(room_entity, phase) != []
    end)
  end

  @doc """
  Broadcasts an ambient message to all players in a room.
  """
  @spec broadcast(String.t(), String.t()) :: :ok
  def broadcast(room_id, message) do
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "room:#{room_id}",
      {:ambient_message, message}
    )

    :ok
  end

  @doc """
  Gets the tag-based message config (for World Builder).
  """
  @spec get_tag_config() :: map()
  def get_tag_config, do: @tag_messages

  @doc """
  Reloads tag-based config from file (for runtime updates).
  Returns the new config but doesn't update the compiled module attribute.
  """
  @spec reload_tag_config() :: map()
  def reload_tag_config do
    path = Path.join(:code.priv_dir(:loka), "world/config/ambient_messages.yml")

    if File.exists?(path) do
      config = YamlElixir.read_from_file!(path)

      (config["tag_messages"] || %{})
      |> Enum.map(fn {tag, phases} ->
        phases =
          phases
          |> Enum.map(fn {phase, messages} ->
            {String.to_atom(phase), messages}
          end)
          |> Map.new()

        {tag, phases}
      end)
      |> Map.new()
    else
      %{}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_current_phase do
    if Process.whereis(DayNight) do
      DayNight.get_phase()
    else
      :day
    end
  end

  # Get messages from tag-based config for room's tags
  defp get_tag_messages(room_entity, phase) do
    tags = get_room_tags(room_entity)

    Enum.flat_map(tags, fn tag ->
      case Map.get(@tag_messages, tag) do
        nil -> []
        phases -> Map.get(phases, phase, [])
      end
    end)
  end

  # Get room-specific messages for phase
  defp get_room_messages(room_entity, phase) do
    phase_str = Atom.to_string(phase)

    case room_entity do
      %{components: %{"ambient_messages" => messages}} when is_map(messages) ->
        Map.get(messages, phase_str, []) ++ Map.get(messages, phase, [])

      %{components: %{ambient_messages: messages}} when is_map(messages) ->
        Map.get(messages, phase_str, []) ++ Map.get(messages, phase, [])

      _ ->
        []
    end
  end

  # Extract tags from room entity
  defp get_room_tags(%{tags: tags}) when is_list(tags), do: tags
  defp get_room_tags(%{"tags" => tags}) when is_list(tags), do: tags
  defp get_room_tags(_), do: []
end

defmodule Loka.Framework.World.RoomAmbient.Scheduler do
  @moduledoc """
  Schedules periodic ambient messages for active rooms.

  Broadcasts time-appropriate atmospheric messages to rooms with players.
  Messages are selected based on the current phase (dawn, day, dusk, night)
  and room tags.

  ## Configuration

  - `base_interval`: Minimum time between checks (default: 120s)
  - `random_interval`: Random additional time (default: 0-180s)
  - `message_chance`: Probability of emitting per room per tick (default: 0.3)
  """

  use GenServer

  alias Loka.Framework.World.RoomAmbient
  alias Loka.Engine.Entities
  alias Loka.Session.Registry, as: SessionRegistry

  require Logger

  @base_interval 120_000
  @random_interval 180_000
  @message_chance 0.3

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc "Forces an ambient message check (for testing)."
  def tick(server \\ __MODULE__) do
    GenServer.cast(server, :tick)
  end

  @doc "Sends an ambient message to a specific room."
  def send_to_room(room_id, server \\ __MODULE__) do
    GenServer.cast(server, {:send_to_room, room_id})
  end

  @doc "Sends ambient messages to all active rooms (triggered on phase change)."
  def broadcast_phase_change(server \\ __MODULE__) do
    GenServer.cast(server, :broadcast_phase_change)
  end

  @impl true
  def init(opts) do
    auto_tick = Keyword.get(opts, :auto_tick, true)
    message_chance = Keyword.get(opts, :message_chance, @message_chance)

    state = %{
      message_chance: message_chance,
      timer_ref: nil
    }

    state =
      if auto_tick do
        schedule_tick(state)
      else
        state
      end

    Logger.info("Room ambient scheduler initialized (phase-aware)")
    {:ok, state}
  end

  @impl true
  def handle_cast(:tick, state) do
    process_ambient_messages(state)
    {:noreply, state}
  end

  @impl true
  def handle_cast({:send_to_room, room_id}, state) do
    send_message_to_room(room_id)
    {:noreply, state}
  end

  @impl true
  def handle_cast(:broadcast_phase_change, state) do
    # On phase change, send to all active rooms with higher probability
    active_rooms = SessionRegistry.get_active_rooms()

    Enum.each(active_rooms, fn room_id ->
      # Higher chance (60%) on phase transitions
      if :rand.uniform() < 0.6 do
        send_message_to_room(room_id)
      end
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info(:tick, state) do
    process_ambient_messages(state)
    state = schedule_tick(state)
    {:noreply, state}
  end

  defp schedule_tick(state) do
    if state.timer_ref, do: Process.cancel_timer(state.timer_ref)
    interval = @base_interval + :rand.uniform(@random_interval)
    ref = Process.send_after(self(), :tick, interval)
    %{state | timer_ref: ref}
  end

  defp process_ambient_messages(state) do
    active_rooms = SessionRegistry.get_active_rooms()

    Enum.each(active_rooms, fn room_id ->
      if :rand.uniform() < state.message_chance do
        send_message_to_room(room_id)
      end
    end)
  end

  defp send_message_to_room(room_id) do
    case Entities.get_entity(room_id) do
      %{} = room_entity ->
        case RoomAmbient.get_message(room_entity) do
          nil -> :ok
          message -> RoomAmbient.broadcast(room_id, message)
        end

      nil ->
        :ok
    end
  end
end
