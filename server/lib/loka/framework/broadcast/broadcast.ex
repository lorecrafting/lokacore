defmodule Loka.Framework.Broadcast do
  @moduledoc """
  System-wide broadcast capability for player announcements.

  Provides a clean API for sending messages to all players, specific zones,
  or specific players with support for different message types.

  ## Message Types

  - `:system` - Server announcements, maintenance warnings (gray/muted styling)
  - `:event` - World events, festivals, boss spawns (gold/highlight styling)
  - `:emergency` - Critical alerts, server shutdown (red/urgent styling)

  ## Examples

      # Server-wide announcement
      Broadcast.to_all("Server restart in 5 minutes!", :system)

      # Zone event
      Broadcast.to_zone("eldoria", "A dragon has been spotted!", :event)

      # Alert specific players
      Broadcast.to_players(player_ids, "Your guild has leveled up!", :event)

      # Room message
      Broadcast.to_room(room_id, "The ground shakes beneath your feet.", :event)
  """

  alias Loka.Session
  alias Loka.Content

  @type message_type :: :system | :event | :emergency
  @type player_id :: String.t()
  @type zone_key :: String.t()
  @type room_id :: String.t()

  @doc """
  Broadcasts a message to all online players.

  ## Parameters

  - `message` - The text message to send
  - `type` - Message type for styling (default: `:system`)

  ## Examples

      Broadcast.to_all("Server restarting in 5 minutes!")
      Broadcast.to_all("The Harvest Festival begins!", :event)
      Broadcast.to_all("Emergency maintenance required!", :emergency)
  """
  @spec to_all(String.t(), message_type()) :: :ok
  def to_all(message, type \\ :system) do
    formatted = format_message(message, type)
    Session.broadcast_all({:broadcast_message, formatted, type})
    :ok
  end

  @doc """
  Broadcasts a message to all players in a specific zone.

  ## Parameters

  - `zone_key` - The zone's key (e.g., "eldoria", "monastery")
  - `message` - The text message to send
  - `type` - Message type for styling (default: `:event`)

  ## Examples

      Broadcast.to_zone("eldoria", "A dragon has been spotted!", :event)
      Broadcast.to_zone("monastery", "The bells toll for evening prayer.", :system)
  """
  @spec to_zone(zone_key(), String.t(), message_type()) :: :ok
  def to_zone(zone_key, message, type \\ :event) do
    formatted = format_message(message, type)

    zone_key
    |> Content.Zone.players_in_zone()
    |> Enum.each(fn player_id ->
      Session.send_to_player(player_id, {:broadcast_message, formatted, type})
    end)

    :ok
  end

  @doc """
  Broadcasts a message to specific players.

  ## Parameters

  - `player_ids` - List of player IDs to send to
  - `message` - The text message to send
  - `type` - Message type for styling (default: `:event`)

  ## Examples

      Broadcast.to_players(["player_123", "player_456"], "Your party found treasure!", :event)
  """
  @spec to_players([player_id()], String.t(), message_type()) :: :ok
  def to_players(player_ids, message, type \\ :event) when is_list(player_ids) do
    formatted = format_message(message, type)

    Enum.each(player_ids, fn player_id ->
      Session.send_to_player(player_id, {:broadcast_message, formatted, type})
    end)

    :ok
  end

  @doc """
  Broadcasts a message to all players in a specific room.

  ## Parameters

  - `room_id` - The room's ID
  - `message` - The text message to send
  - `type` - Message type for styling (default: `:event`)

  ## Examples

      Broadcast.to_room(room_id, "The torches flicker ominously.", :event)
  """
  @spec to_room(room_id(), String.t(), message_type()) :: :ok
  def to_room(room_id, message, type \\ :event) do
    formatted = format_message(message, type)
    Session.broadcast_to_room(room_id, {:broadcast_message, formatted, type})
    :ok
  end

  # ===========================================================================
  # Private Functions
  # ===========================================================================

  @doc false
  def format_message(message, type) do
    case type do
      :system -> "[System] #{message}"
      :event -> "[Event] #{message}"
      :emergency -> "[!!! EMERGENCY !!!] #{message}"
    end
  end
end
