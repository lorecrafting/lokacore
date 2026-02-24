defmodule LokaWeb.Channels.GameChannel.JoinHandler do
  @moduledoc """
  Handles the :after_join message for GameChannel.

  Sends initial game state to the client, subscribes to PubSub topics,
  and delivers any timers that completed while the player was offline.
  """

  require Logger

  alias Phoenix.Socket
  alias Loka.Engine.{Entity, Entities}
  alias Loka.Framework.{Inventory, Equipment, Quest, Cutscene}
  alias Loka.Framework.World.Atmosphere
  alias Loka.Content
  alias Loka.Components.ResourcePools
  alias Loka.Session
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.Serializers
  alias LokaWeb.Channels.VersionCompatibility

  @doc """
  Handle the :after_join message. Returns `{:noreply, socket}`.
  """
  @spec handle(Socket.t()) :: {:noreply, Socket.t()}
  def handle(socket) do
    player = socket.assigns.player
    character = socket.assigns.character

    # V2: Load room using character entity's location_id
    {room, character} = RoomHelpers.load_room_for_character(character)

    # Subscribe to PubSub topics
    Phoenix.PubSub.subscribe(Loka.PubSub, "location:#{room.id}")
    Phoenix.PubSub.subscribe(Loka.PubSub, "entity:#{player.id}")
    Phoenix.PubSub.subscribe(Loka.PubSub, "world:atmosphere")
    Phoenix.PubSub.subscribe(Loka.PubSub, "debug:screenshot")

    # Initialize resource pools on character entity
    stats = Entity.get_component(character, "stats") || %{}
    resource_pools = ResourcePools.init_pools(stats)
    character = ResourcePools.put(character, resource_pools)

    # Register with session system
    {:ok, _session_pid, session_id} = Session.connect(player, :mobile, self())
    Logger.metadata(session_id: session_id, player_id: player.id)
    Session.update_room(player.id, room.id)

    # Emit login telemetry (drives active_players counter via PromEx polling)
    :telemetry.execute([:loka, :game, :player_login], %{count: 1}, %{player_id: player.id})

    # Broadcast player entered
    player_name = player.name || player.email || "Unknown"

    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "location:#{room.id}",
      {:player_entered, player.id, player_name}
    )

    # Load game data (V2: use character entity)
    inventory_items = Inventory.list_items(character)
    equipped_items = Equipment.get_equipped(character)
    active_quests = Quest.Progress.get_active_quests(character)
    other_players = RoomHelpers.load_other_players(room.id, player.id)
    atmosphere = Atmosphere.describe_for_room(room)
    resources = ResourcePools.get(character)
    active_timers = Loka.Timers.get_active(player.id)

    # Get visual state for environmental effects
    player_compat = %{equipped: Entity.get_component(character, "equipment") || %{}}
    visual_state = Serializers.serialize_visual_state(room: room, player: player_compat)

    # Get sound state for ambient audio
    sound_state = Serializers.serialize_sound_state(room: room, player: player_compat)

    # Send full game state to client (including server capabilities for version negotiation)
    Phoenix.Channel.push(socket, "game_state", %{
      room: Serializers.serialize_room(room),
      atmosphere: atmosphere,
      calendar: nil,
      visual_state: visual_state,
      sound_state: sound_state,
      other_players: Serializers.serialize_players(other_players),
      inventory: Serializers.serialize_inventory(inventory_items),
      equipped: Serializers.serialize_equipped(equipped_items),
      quests: Serializers.serialize_quests(active_quests),
      stats: stats,
      # Health from character entity resources component
      health: get_character_health(character),
      resources: Serializers.serialize_resources(resources),
      timers: Serializers.serialize_timers(active_timers),
      spark: nil,
      player: %{
        id: player.id,
        name: player_name
      },
      # Server capabilities for version negotiation
      server: VersionCompatibility.server_capabilities()
    })

    # Deliver any timers that completed while offline
    deliver_offline_timers(socket, player.id)

    # Auto-play intro cutscene for new players
    character = maybe_play_intro_cutscene(socket, character)

    socket =
      socket
      |> Phoenix.Socket.assign(:character, character)
      |> Phoenix.Socket.assign(:room, room)
      |> Phoenix.Socket.assign(:seen_ambient, MapSet.new())

    {:noreply, socket}
  end

  @doc """
  Extract health from character entity's resources component.
  """
  @spec get_character_health(Entity.t()) :: map()
  def get_character_health(character) do
    resources = Entity.get_component(character, "resources") || %{}

    case resources["health"] do
      %{"current" => current, "max" => max} -> %{"current" => current, "max" => max}
      _ -> %{"current" => 100, "max" => 100}
    end
  end

  # Play the grove_awakening cutscene on first join, then set flag so it won't replay.
  @spec maybe_play_intro_cutscene(Socket.t(), Entity.t()) :: Entity.t()
  defp maybe_play_intro_cutscene(socket, character) do
    player_component = Entity.get_component(character, "player") || %{}
    flags = Map.get(player_component, "flags", %{}) || %{}

    if flags["seen_intro_cutscene"] do
      character
    else
      case Content.Cutscene.get("grove_awakening") do
        {:ok, cutscene} ->
          name = cutscene.short_desc || "Grove Awakening"

          Phoenix.Channel.push(socket, "cutscene_start", %{
            cutscene_key: "grove_awakening",
            name: name
          })

          Cutscene.play(self(), "grove_awakening")

          # Set flag on character entity and persist
          new_flags = Map.put(flags, "seen_intro_cutscene", true)
          new_player = Map.put(player_component, "flags", new_flags)
          updated = Entity.add_component(character, "player", new_player)

          case Entities.save(updated) do
            {:ok, saved} -> saved
            {:error, _} -> updated
          end

        {:error, :not_found} ->
          Logger.warning("[JoinHandler] Intro cutscene grove_awakening not found")
          character
      end
    end
  end

  # Deliver completed timers that occurred while player was offline
  defp deliver_offline_timers(socket, player_id) do
    completed_timers = Loka.Timers.get_completed_undelivered(player_id)

    if completed_timers != [] do
      Enum.each(completed_timers, fn timer ->
        Phoenix.Channel.push(socket, "timer_completed", %{
          timer_id: timer.id,
          timer_type: timer.timer_type,
          data: timer.data,
          scheduled_at: timer.scheduled_at,
          completed_at: timer.completed_at
        })
      end)

      Loka.Timers.mark_delivered(completed_timers)
    end
  end
end
