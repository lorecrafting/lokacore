defmodule LokaWeb.Channels.GameChannel.PubSubEvents do
  @moduledoc """
  Handles PubSub event messages for GameChannel.

  Each function takes a socket, processes the event, and returns `{:noreply, socket}`
  (or `{:stop, :normal, socket}` for force disconnect).
  """

  require Logger

  alias Phoenix.Socket
  alias Loka.Engine.Entity
  alias Loka.Framework.World.Atmosphere
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.{Serializers, ActionBridge}
  alias LokaWeb.Channels.BuilderCommands.AI, as: BuilderAI

  @spec handle_player_entered(Socket.t(), String.t(), String.t()) :: {:noreply, Socket.t()}
  def handle_player_entered(socket, player_id, player_name) do
    if player_id != socket.assigns.player.id do
      Phoenix.Channel.push(socket, "event", %{text: "#{player_name} arrives."})
      room = socket.assigns.room
      other_players = RoomHelpers.load_other_players(room.id, socket.assigns.player.id)

      Phoenix.Channel.push(socket, "players_update", %{
        players: Serializers.serialize_players(other_players)
      })
    end

    {:noreply, socket}
  end

  @spec handle_player_left(Socket.t(), String.t(), String.t(), String.t()) ::
          {:noreply, Socket.t()}
  def handle_player_left(socket, player_id, player_name, direction) do
    if player_id != socket.assigns.player.id do
      Phoenix.Channel.push(socket, "event", %{text: "#{player_name} leaves #{direction}."})
      room = socket.assigns.room
      other_players = RoomHelpers.load_other_players(room.id, socket.assigns.player.id)

      Phoenix.Channel.push(socket, "players_update", %{
        players: Serializers.serialize_players(other_players)
      })
    end

    {:noreply, socket}
  end

  @spec handle_player_says(Socket.t(), String.t(), String.t(), String.t()) ::
          {:noreply, Socket.t()}
  def handle_player_says(socket, player_id, player_name, message) do
    if player_id != socket.assigns.player.id do
      Phoenix.Channel.push(socket, "event", %{text: "#{player_name} says, \"#{message}\""})
    end

    {:noreply, socket}
  end

  @spec handle_player_shouts(Socket.t(), String.t(), String.t(), String.t()) ::
          {:noreply, Socket.t()}
  def handle_player_shouts(socket, player_id, player_name, message) do
    if player_id != socket.assigns.player.id do
      Phoenix.Channel.push(socket, "event", %{text: "#{player_name} shouts, \"#{message}\""})
    end

    {:noreply, socket}
  end

  @spec handle_atmosphere_changed(Socket.t(), term()) :: {:noreply, Socket.t()}
  def handle_atmosphere_changed(socket, _payload) do
    room = socket.assigns.room
    character = socket.assigns.character
    atmosphere = Atmosphere.describe_for_room(room)
    player_compat = %{equipped: Entity.get_component(character, "equipment") || %{}}
    visual_state = Serializers.serialize_visual_state(room: room, player: player_compat)
    sound_state = Serializers.serialize_sound_state(room: room, player: player_compat)

    Phoenix.Channel.push(socket, "atmosphere_update", %{
      atmosphere: atmosphere,
      calendar: nil,
      visual_state: visual_state,
      sound_state: sound_state
    })

    {:noreply, socket}
  end

  @spec handle_ambient_message(Socket.t(), String.t()) :: {:noreply, Socket.t()}
  def handle_ambient_message(socket, text) do
    seen = socket.assigns[:seen_ambient] || MapSet.new()

    if MapSet.member?(seen, text) do
      # Already seen this message in current room, skip it
      {:noreply, socket}
    else
      Phoenix.Channel.push(socket, "event", %{text: text, type: "ambient"})
      {:noreply, Phoenix.Socket.assign(socket, :seen_ambient, MapSet.put(seen, text))}
    end
  end

  @spec handle_resources_updated(Socket.t(), map()) :: {:noreply, Socket.t()}
  def handle_resources_updated(socket, pools) do
    Phoenix.Channel.push(socket, "resources_update", %{
      resources: Serializers.serialize_resources(pools)
    })

    {:noreply, socket}
  end

  @spec handle_session_message(Socket.t(), term()) ::
          {:noreply, Socket.t()} | {:stop, :normal, Socket.t()}
  def handle_session_message(socket, {:room_message, text}) do
    Phoenix.Channel.push(socket, "event", %{text: text})
    {:noreply, socket}
  end

  def handle_session_message(socket, {:announcement, text}) do
    Phoenix.Channel.push(socket, "event", %{text: "[Announcement] #{text}"})
    {:noreply, socket}
  end

  def handle_session_message(socket, {:force_disconnect, reason}) do
    Phoenix.Channel.push(socket, "force_disconnect", %{reason: reason})
    {:stop, :normal, socket}
  end

  def handle_session_message(socket, {:timer_completed, data}) do
    Phoenix.Channel.push(socket, "timer_completed", data)
    {:noreply, socket}
  end

  def handle_session_message(socket, {:broadcast_message, text, type}) do
    Phoenix.Channel.push(socket, "broadcast", %{text: text, type: Atom.to_string(type)})
    {:noreply, socket}
  end

  @spec handle_combat_tick(Socket.t()) :: {:noreply, Socket.t()}
  def handle_combat_tick(socket) do
    case ActionBridge.execute(socket, :combat_tick, %{}) do
      {:ok, socket} -> {:noreply, socket}
      {:error, _reason, socket} -> {:noreply, socket}
    end
  end

  @spec handle_die(Socket.t(), String.t()) :: {:noreply, Socket.t()}
  def handle_die(socket, killer_name) do
    case ActionBridge.execute(socket, :die, %{killer_name: killer_name}) do
      {:ok, socket} -> {:noreply, socket}
      {:error, _reason, socket} -> {:noreply, socket}
    end
  end

  @spec handle_player_emotes(Socket.t(), String.t(), String.t(), String.t()) ::
          {:noreply, Socket.t()}
  def handle_player_emotes(socket, player_id, _player_name, text) do
    if player_id != socket.assigns.player.id do
      Phoenix.Channel.push(socket, "event", %{text: text})
    end

    {:noreply, socket}
  end

  @spec handle_player_emotes_at(Socket.t(), String.t(), String.t(), String.t(), String.t()) ::
          {:noreply, Socket.t()}
  def handle_player_emotes_at(socket, player_id, _target_id, _player_name, text) do
    if player_id != socket.assigns.player.id do
      Phoenix.Channel.push(socket, "event", %{text: text})
    end

    {:noreply, socket}
  end

  @spec handle_capture_screenshot(Socket.t()) :: {:noreply, Socket.t()}
  def handle_capture_screenshot(socket) do
    Logger.info("[Screenshot] Pushing capture_screenshot event to client")
    Phoenix.Channel.push(socket, "capture_screenshot", %{})
    {:noreply, socket}
  end

  @spec handle_ai_event(Socket.t(), term()) :: {:noreply, Socket.t()}
  def handle_ai_event(socket, event) do
    BuilderAI.handle_ai_event(event, socket)
  end

  @spec handle_ai_retry(Socket.t()) :: {:noreply, Socket.t()}
  def handle_ai_retry(socket) do
    BuilderAI.handle_ai_retry(socket)
  end
end
