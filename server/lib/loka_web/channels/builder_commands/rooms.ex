defmodule LokaWeb.Channels.BuilderCommands.Rooms do
  @moduledoc """
  Room CRUD commands: dig, @desc, @name, create room, link, unlink, delete room.
  """

  import Phoenix.Channel, only: [push: 3]

  alias Loka.Framework.World.Atmosphere
  alias Loka.WorldBuilder.RoomManager
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.Serializers
  alias LokaWeb.Channels.BuilderCommands.Helpers

  @valid_directions ~w(north south east west up down)

  def execute(:dig, %{direction: dir, key: key, name: name}, socket) do
    direction = Helpers.normalize_direction(dir)

    unless direction in @valid_directions do
      {:error, "Invalid direction '#{dir}'. Use: #{Enum.join(@valid_directions, ", ")}", socket}
    else
      game_state = socket.assigns.game_state
      {current_room, _} = RoomHelpers.load_player_room(game_state)

      room_params = %{
        "key" => key,
        "name" => name,
        "description" => "A newly created room.",
        "zone" => Map.get(current_room, :zone, "default")
      }

      case RoomManager.create_room(room_params) do
        {:ok, _new_room} ->
          reverse = reverse_direction(direction)

          RoomManager.add_exit(current_room.key, direction, key)
          RoomManager.add_exit(key, reverse, current_room.key)

          case Helpers.find_room_by_key(key) do
            nil ->
              {:ok, "Room '#{key}' created with exits, but could not teleport.", socket}

            room ->
              {:ok, socket} = Helpers.teleport_to_room(room, socket)
              {:ok, "Dug #{direction}: created '#{key}' with bidirectional exits.", socket}
          end

        {:error, reason} ->
          {:error, "Failed to create room '#{key}': #{inspect(reason)}", socket}
      end
    end
  end

  def execute(:set_desc, %{text: text}, socket) do
    game_state = socket.assigns.game_state
    {room, _} = RoomHelpers.load_player_room(game_state)

    case RoomManager.update_room(room.key, %{"description" => text}) do
      {:ok, _} ->
        push_room_update(socket, game_state)
        {:ok, "Description updated for '#{room.key}'.", socket}

      {:error, reason} ->
        {:error, "Failed to update description: #{inspect(reason)}", socket}
    end
  end

  def execute(:set_name, %{text: text}, socket) do
    game_state = socket.assigns.game_state
    {room, _} = RoomHelpers.load_player_room(game_state)

    case RoomManager.update_room(room.key, %{"name" => text}) do
      {:ok, _} ->
        push_room_update(socket, game_state)
        {:ok, "Name updated for '#{room.key}' -> '#{text}'.", socket}

      {:error, reason} ->
        {:error, "Failed to update name: #{inspect(reason)}", socket}
    end
  end

  def execute(:create_room, %{key: key, name: name}, socket) do
    room_params = %{
      "key" => key,
      "name" => name,
      "description" => "A newly created room."
    }

    case RoomManager.create_room(room_params) do
      {:ok, _} -> {:ok, "Room '#{key}' created.", socket}
      {:error, reason} -> {:error, "Failed to create room: #{inspect(reason)}", socket}
    end
  end

  def execute(:link, %{direction: dir, key: key}, socket) do
    direction = Helpers.normalize_direction(dir)
    game_state = socket.assigns.game_state
    {room, _} = RoomHelpers.load_player_room(game_state)

    case RoomManager.add_exit(room.key, direction, key) do
      {:ok, _} ->
        push_room_update(socket, game_state)
        {:ok, "Linked #{direction} -> #{key}.", socket}

      {:error, reason} ->
        {:error, "Failed to link: #{inspect(reason)}", socket}
    end
  end

  def execute(:unlink, %{direction: dir}, socket) do
    direction = Helpers.normalize_direction(dir)
    game_state = socket.assigns.game_state
    {room, _} = RoomHelpers.load_player_room(game_state)

    case RoomManager.remove_exit(room.key, direction) do
      {:ok, _} ->
        push_room_update(socket, game_state)
        {:ok, "Unlinked #{direction} from '#{room.key}'.", socket}

      {:error, reason} ->
        {:error, "Failed to unlink: #{inspect(reason)}", socket}
    end
  end

  def execute(:delete_room, %{key: key}, socket) do
    case RoomManager.delete_room(key) do
      {:ok, _} -> {:ok, "Room '#{key}' deleted.", socket}
      {:error, reason} -> {:error, "Failed to delete room: #{inspect(reason)}", socket}
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp push_room_update(socket, game_state) do
    {room, _} = RoomHelpers.load_player_room(game_state)
    atmosphere = Atmosphere.describe_for_room(room)

    push(socket, "room_update", %{
      room: Serializers.serialize_room(room),
      atmosphere: atmosphere
    })
  end

  defp reverse_direction("north"), do: "south"
  defp reverse_direction("south"), do: "north"
  defp reverse_direction("east"), do: "west"
  defp reverse_direction("west"), do: "east"
  defp reverse_direction("up"), do: "down"
  defp reverse_direction("down"), do: "up"
  defp reverse_direction("northeast"), do: "southwest"
  defp reverse_direction("northwest"), do: "southeast"
  defp reverse_direction("southeast"), do: "northwest"
  defp reverse_direction("southwest"), do: "northeast"
  defp reverse_direction(dir), do: dir
end
