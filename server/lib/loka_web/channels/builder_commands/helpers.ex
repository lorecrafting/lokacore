defmodule LokaWeb.Channels.BuilderCommands.Helpers do
  @moduledoc """
  Shared helpers for builder command modules.
  """

  import Phoenix.Socket, only: [assign: 3]
  import Phoenix.Channel, only: [push: 3]

  alias Loka.Framework.World.Atmosphere
  alias Loka.WorldBuilder.RoomManager
  alias LokaWeb.Channels.RoomHelpers
  alias Loka.Engine.{Entity, Entities}
  alias LokaWeb.Channels.GameChannel.Serializers

  def draft_tag(obj) do
    if Entity.draft?(obj), do: " [DRAFT]", else: ""
  end

  def push_builder(socket, text) do
    push(socket, "output", %{text: "[BUILDER] #{text}"})
  end

  def find_room_by_key(key) do
    case RoomManager.get_room(key) do
      {:ok, room} -> room
      {:error, _} -> nil
    end
  end

  @doc """
  Teleport the builder to a room by its DB record. Handles PubSub,
  game state update, session update, and room_update push.
  Returns `{:ok, socket}` or `{:error, reason}`.
  """
  def teleport_to_room(room, socket) do
    player = socket.assigns.player
    character = socket.assigns.character
    old_room_id = character.location_id

    # V2: Update character entity's location
    updated_character = %{character | location_id: room.id}

    case Entities.save_entity(updated_character) do
      {:ok, _saved} ->
        # Only change PubSub subscriptions after successful save
        if old_room_id do
          Phoenix.PubSub.unsubscribe(Loka.PubSub, "location:#{old_room_id}")
        end

        Phoenix.PubSub.subscribe(Loka.PubSub, "location:#{room.id}")
        Loka.Session.update_room(player.id, room.id)

        {loaded_room, final_character} =
          RoomHelpers.load_room_for_character(updated_character)

        atmosphere = Atmosphere.describe_for_room(loaded_room)

        socket =
          socket
          |> assign(:character, final_character)
          |> assign(:room, loaded_room)

        push(socket, "room_update", %{
          room: Serializers.serialize_room(loaded_room),
          atmosphere: atmosphere
        })

        {:ok, socket}

      {:error, reason} ->
        {:error, "Failed to teleport: #{inspect(reason)}", socket}
    end
  end

  @direction_abbreviations %{
    "n" => "north",
    "s" => "south",
    "e" => "east",
    "w" => "west",
    "u" => "up",
    "d" => "down",
    "ne" => "northeast",
    "nw" => "northwest",
    "se" => "southeast",
    "sw" => "southwest"
  }

  @doc """
  Normalize a direction abbreviation to its full form.
  """
  def normalize_direction(dir) do
    Map.get(@direction_abbreviations, dir, dir)
  end

  def format_entity_list(label, entities, socket) do
    lines =
      entities
      |> Enum.sort_by(& &1.key)
      |> Enum.map(fn e ->
        key_link = "{{cmd:info #{e.key}}}#{e.key}{{/cmd}}"
        name_link = "{{cmd:look #{e.key}}}#{e.name}{{/cmd}}"
        "  #{key_link} - #{name_link}"
      end)
      |> Enum.join("\n")

    {:ok, "#{label} (#{length(entities)}):\n#{lines}", socket}
  end

  def format_entity(obj) do
    components = Map.get(obj, :components, %{})

    [
      "  key: #{obj.key}",
      "  type: #{obj.type}",
      "  name: #{obj.short_desc || obj.key}"
    ]
    |> then(fn lines ->
      desc = obj.extra_desc

      if desc && desc != "",
        do: lines ++ ["  description: #{String.slice(desc, 0, 120)}..."],
        else: lines
    end)
    |> then(fn lines ->
      if map_size(components) > 0 do
        comp_lines =
          Enum.map(components, fn {k, _v} -> "    - #{k}" end)

        lines ++ ["  components:"] ++ comp_lines
      else
        lines
      end
    end)
    |> Enum.join("\n")
  end

  @doc """
  Coerce a string value to its appropriate Elixir type.
  Used by edit commands that receive all values as strings from the terminal.
  """
  def coerce_value("true"), do: true
  def coerce_value("false"), do: false
  def coerce_value("nil"), do: nil

  def coerce_value(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} ->
        int

      _ ->
        case Float.parse(value) do
          {float, ""} -> float
          _ -> value
        end
    end
  end

  def coerce_value(value), do: value

  def matches?(nil, _search), do: false

  def matches?(text, search) do
    String.contains?(String.downcase(to_string(text)), search)
  end
end
