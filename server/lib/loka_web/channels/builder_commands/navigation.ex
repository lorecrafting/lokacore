defmodule LokaWeb.Channels.BuilderCommands.Navigation do
  @moduledoc """
  Builder navigation commands: goto, where, rooms.
  """

  alias Loka.WorldBuilder.RoomManager
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:goto, %{room_key: room_key}, socket) do
    case Helpers.find_room_by_key(room_key) do
      nil ->
        {:error, "Room '#{room_key}' not found.", socket}

      room ->
        {:ok, socket} = Helpers.teleport_to_room(room, socket)
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
    character = socket.assigns.character
    room_id = character.location_id

    {room, _character} = RoomHelpers.load_room_for_character(character)
    key = Map.get(room, :key, "unknown")
    x = Map.get(room, :x, 0)
    y = Map.get(room, :y, 0)
    z = Map.get(room, :z, 0)
    {:ok, "Room: #{key} (#{x}, #{y}, #{z}) [id: #{room_id}]", socket}
  end
end
