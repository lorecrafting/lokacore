defmodule LokaWeb.Channels.BuilderCommands.Navigation do
  @moduledoc """
  Builder navigation commands: goto, where, rooms.
  """

  import Phoenix.Socket, only: [assign: 3]
  import Phoenix.Channel, only: [push: 3]

  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.World.Atmosphere
  alias Loka.WorldBuilder.RoomManager
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.Serializers
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:goto, %{room_key: room_key}, socket) do
    player = socket.assigns.player
    game_state = socket.assigns.game_state

    case Helpers.find_room_by_key(room_key) do
      nil ->
        {:error, "Room '#{room_key}' not found.", socket}

      room ->
        old_room_id = game_state.current_room_id

        if old_room_id do
          Phoenix.PubSub.unsubscribe(Loka.PubSub, "room:#{old_room_id}")
        end

        {:ok, updated_state} =
          PlayerGameState.update_state(game_state, %{current_room_id: room.id})

        Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{room.id}")
        Loka.Session.update_room(player.id, room.id)

        {loaded_room, final_state} = RoomHelpers.load_player_room(updated_state)
        atmosphere = Atmosphere.describe_for_room(loaded_room)

        socket = assign(socket, :game_state, final_state)

        push(socket, "room_update", %{
          room: Serializers.serialize_room(loaded_room),
          atmosphere: atmosphere
        })

        {:ok, "Teleported to #{room_key}.", socket}
    end
  end

  def execute(:rooms, _params, socket) do
    rooms = RoomManager.list_rooms()

    lines =
      rooms
      |> Enum.sort_by(& &1.key)
      |> Enum.map(fn room ->
        coords = "(#{room[:x] || 0}, #{room[:y] || 0})"
        key_link = "{{cmd:goto #{room.key}}}#{room.key}{{/cmd}}"
        "  #{key_link} - #{room.name} #{coords}"
      end)
      |> Enum.join("\n")

    text = "Rooms (#{length(rooms)}):\n#{lines}"
    {:ok, text, socket}
  end

  def execute(:where, _params, socket) do
    game_state = socket.assigns.game_state
    room_id = game_state.current_room_id

    {room, _state} = RoomHelpers.load_player_room(game_state)
    key = Map.get(room, :key, "unknown")
    x = Map.get(room, :x, 0)
    y = Map.get(room, :y, 0)
    z = Map.get(room, :z, 0)
    {:ok, "Room: #{key} (#{x}, #{y}, #{z}) [id: #{room_id}]", socket}
  end
end
