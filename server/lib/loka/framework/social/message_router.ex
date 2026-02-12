defmodule Loka.Framework.Social.MessageRouter do
  @moduledoc """
  Routes ScopedMessages to their intended recipients via PubSub.

  The MessageRouter translates message scopes into PubSub topics and handles
  the formatting of messages for different recipients (sender, target, observers).

  ## How It Works

  1. Receives a ScopedMessage with a scope (`:room`, `:direct`, `:party`, etc.)
  2. Determines which PubSub topics to broadcast to
  3. Formats the message appropriately for each recipient type
  4. Broadcasts via Phoenix.PubSub

  ## Message Events

  Recipients receive messages as `{:social_message, payload}` where payload contains:

  - `:text` - The formatted message text
  - `:message` - The full ScopedMessage struct
  - `:perspective` - `:sender`, `:target`, or `:observer`

  ## Usage

      alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

      # Route a room message
      msg = ScopedMessage.new(:room, "Hello!", actor, location: room_id)
      MessageRouter.route(msg)

      # Route a direct tell
      msg = ScopedMessage.new(:direct, "Hey!", actor, to: player_id, message_type: :tell)
      MessageRouter.route(msg)
  """

  alias Loka.Framework.Social.ScopedMessage
  alias Loka.Engine.WorldGraph

  @pubsub Loka.PubSub

  @doc """
  Routes a message to all appropriate recipients based on its scope.

  Returns `:ok` after broadcasting.
  """
  def route(%ScopedMessage{} = msg) do
    case msg.scope do
      :room -> broadcast_to_room(msg)
      :adjacent -> broadcast_to_adjacent(msg)
      :zone -> broadcast_to_zone(msg)
      :world -> broadcast_to_world(msg)
      :direct -> send_to_player(msg)
      :party -> broadcast_to_party(msg)
      :guild -> broadcast_to_guild(msg)
      :channel -> broadcast_to_channel(msg)
    end

    :ok
  end

  # =============================================================================
  # Room Scope - Everyone in current room
  # =============================================================================

  defp broadcast_to_room(%ScopedMessage{location: nil} = _msg) do
    # No location, can't broadcast to room
    :ok
  end

  defp broadcast_to_room(%ScopedMessage{} = msg) do
    # Send to sender
    if msg.from_id do
      send_to_recipient(msg.from_id, msg, :sender)
    end

    # Send to direct target (for whispers, etc.)
    if msg.to && msg.message_type in [:whisper, :tell] do
      send_to_recipient(msg.to, msg, :target)
    end

    # Broadcast to room (everyone except sender, target, and excluded)
    excluded = build_exclude_list(msg)

    payload = %{
      text: ScopedMessage.format_for_room(msg),
      message: msg,
      perspective: :observer
    }

    broadcast_to_topic("location:#{msg.location}", {:social_message, payload}, excluded)
  end

  # =============================================================================
  # Adjacent Scope - Current room + neighboring rooms
  # =============================================================================

  defp broadcast_to_adjacent(%ScopedMessage{location: nil} = _msg), do: :ok

  defp broadcast_to_adjacent(%ScopedMessage{} = msg) do
    # First, broadcast to current room normally
    broadcast_to_room(msg)

    # Then broadcast to adjacent rooms with distance formatting
    adjacent_rooms = get_adjacent_rooms(msg.location)

    Enum.each(adjacent_rooms, fn {room_id, direction} ->
      # Invert direction - if we're north of them, they hear from the south
      from_direction = invert_direction(direction)

      payload = %{
        text: ScopedMessage.format_for_adjacent(msg, from_direction),
        message: msg,
        perspective: :distant
      }

      broadcast_to_topic("location:#{room_id}", {:social_message, payload}, [])
    end)
  end

  # =============================================================================
  # Zone Scope - Entire zone/area
  # =============================================================================

  defp broadcast_to_zone(%ScopedMessage{location: nil} = _msg), do: :ok

  defp broadcast_to_zone(%ScopedMessage{} = msg) do
    # Get zone from room location
    zone_id = get_zone_id(msg.location)

    if zone_id do
      excluded = build_exclude_list(msg)

      # Send to sender first
      if msg.from_id do
        send_to_recipient(msg.from_id, msg, :sender)
      end

      payload = %{
        text: ScopedMessage.format_for_room(msg),
        message: msg,
        perspective: :observer
      }

      broadcast_to_topic("zone:#{zone_id}", {:social_message, payload}, excluded)
    else
      # Fallback to room if no zone
      broadcast_to_room(msg)
    end
  end

  # =============================================================================
  # World Scope - All online players
  # =============================================================================

  defp broadcast_to_world(%ScopedMessage{} = msg) do
    excluded = build_exclude_list(msg)

    # Send to sender first
    if msg.from_id do
      send_to_recipient(msg.from_id, msg, :sender)
    end

    payload = %{
      text: ScopedMessage.format_for_room(msg),
      message: msg,
      perspective: :observer
    }

    broadcast_to_topic("events:global", {:social_message, payload}, excluded)
  end

  # =============================================================================
  # Direct Scope - Single player
  # =============================================================================

  defp send_to_player(%ScopedMessage{to: nil} = _msg), do: :ok

  defp send_to_player(%ScopedMessage{} = msg) do
    # Send to sender
    if msg.from_id do
      send_to_recipient(msg.from_id, msg, :sender)
    end

    # Send to target
    send_to_recipient(msg.to, msg, :target)
  end

  # =============================================================================
  # Party Scope - Party members only
  # =============================================================================

  defp broadcast_to_party(%ScopedMessage{party_id: nil} = _msg), do: :ok

  defp broadcast_to_party(%ScopedMessage{} = msg) do
    excluded = build_exclude_list(msg)

    # Send to sender first
    if msg.from_id do
      send_to_recipient(msg.from_id, msg, :sender)
    end

    payload = %{
      text: ScopedMessage.format_for_room(msg),
      message: msg,
      perspective: :observer
    }

    broadcast_to_topic("party:#{msg.party_id}", {:social_message, payload}, excluded)
  end

  # =============================================================================
  # Guild Scope - Guild members only
  # =============================================================================

  defp broadcast_to_guild(%ScopedMessage{guild_id: nil} = _msg), do: :ok

  defp broadcast_to_guild(%ScopedMessage{} = msg) do
    excluded = build_exclude_list(msg)

    # Send to sender first
    if msg.from_id do
      send_to_recipient(msg.from_id, msg, :sender)
    end

    payload = %{
      text: ScopedMessage.format_for_room(msg),
      message: msg,
      perspective: :observer
    }

    broadcast_to_topic("guild:#{msg.guild_id}", {:social_message, payload}, excluded)
  end

  # =============================================================================
  # Channel Scope - Named channel subscribers
  # =============================================================================

  defp broadcast_to_channel(%ScopedMessage{channel: nil} = _msg), do: :ok

  defp broadcast_to_channel(%ScopedMessage{} = msg) do
    excluded = build_exclude_list(msg)

    # Send to sender first
    if msg.from_id do
      send_to_recipient(msg.from_id, msg, :sender)
    end

    payload = %{
      text: ScopedMessage.format_for_room(msg),
      message: msg,
      perspective: :observer
    }

    broadcast_to_topic("channel:#{msg.channel}", {:social_message, payload}, excluded)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp send_to_recipient(player_id, msg, perspective) do
    text =
      case perspective do
        :sender -> ScopedMessage.format_for_sender(msg)
        :target -> ScopedMessage.format_for_target(msg)
        :observer -> ScopedMessage.format_for_room(msg)
      end

    payload = %{
      text: text,
      message: msg,
      perspective: perspective
    }

    Phoenix.PubSub.broadcast(@pubsub, "entity:#{player_id}", {:social_message, payload})
  end

  defp broadcast_to_topic(topic, message, _excluded) do
    # For now, broadcast to everyone on the topic
    # In the future, we could filter by excluded list at the subscriber level
    Phoenix.PubSub.broadcast(@pubsub, topic, message)

    # Store excluded list in message for subscribers to filter
    # (Subscribers should check if their player_id is in message.message.exclude)
    :ok
  end

  defp build_exclude_list(%ScopedMessage{} = msg) do
    base_exclude = msg.exclude || []

    # For whispers, don't exclude target from room broadcast
    # (they get a separate targeted message)
    case msg.message_type do
      :whisper ->
        [msg.from_id | base_exclude] |> Enum.reject(&is_nil/1) |> Enum.uniq()

      _ ->
        # Exclude sender and direct target from room broadcast
        # (they get separate messages)
        [msg.from_id, msg.to | base_exclude] |> Enum.reject(&is_nil/1) |> Enum.uniq()
    end
  end

  defp get_adjacent_rooms(room_id) do
    # Use WorldGraph to get adjacent rooms with directions
    # get_adjacent_rooms returns a list of {direction, entity} tuples
    WorldGraph.get_adjacent_rooms(room_id)
    |> Enum.map(fn {direction, room_entity} ->
      {room_entity.id, to_string(direction)}
    end)
  rescue
    # If WorldGraph isn't available, return empty
    _ -> []
  end

  defp get_zone_id(room_id) do
    case Loka.Engine.ZoneRegistry.zone_for_room(room_id) do
      {:ok, zone_key} -> zone_key
      {:error, :not_found} -> nil
    end
  end

  defp invert_direction(direction) do
    case direction do
      "north" -> "the south"
      "south" -> "the north"
      "east" -> "the west"
      "west" -> "the east"
      "up" -> "above"
      "down" -> "below"
      dir -> dir
    end
  end
end
