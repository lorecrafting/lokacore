defmodule Loka.Framework.Social.Channel do
  @moduledoc """
  Represents a named chat channel for community communication.

  Channels allow groups of players to communicate across the game world.
  There are three types of channels:

  - **Public** - Anyone can join (trade, newbie, roleplay)
  - **Private** - Invite only (guild officers, raid planning)
  - **System** - Auto-subscribed, read-only (announcements, events)

  ## Default Channels

  The following channels are created by default:

  | Channel | Type | Description |
  |---------|------|-------------|
  | newbie | public | New player help |
  | trade | public | Trading and economy |
  | ooc | public | Out of character chat |
  | events | system | System announcements |

  ## Moderation

  - **Mute**: Player can't speak but can listen
  - **Ban**: Player removed and can't rejoin
  - Owner and moderators can mute/ban
  """

  @type channel_type :: :public | :private | :system

  @type t :: %__MODULE__{
          name: String.t(),
          type: channel_type(),
          description: String.t() | nil,
          owner: String.t() | nil,
          moderators: [String.t()],
          subscribers: MapSet.t(String.t()),
          muted: MapSet.t(String.t()),
          banned: MapSet.t(String.t()),
          created_at: DateTime.t()
        }

  defstruct [
    :name,
    :type,
    :description,
    :owner,
    moderators: [],
    subscribers: MapSet.new(),
    muted: MapSet.new(),
    banned: MapSet.new(),
    created_at: nil
  ]

  @default_channels [
    %{
      name: "newbie",
      type: :public,
      description: "Help channel for new players"
    },
    %{
      name: "trade",
      type: :public,
      description: "Trading, buying, and selling"
    },
    %{
      name: "ooc",
      type: :public,
      description: "Out of character chat"
    },
    %{
      name: "events",
      type: :system,
      description: "System announcements and events"
    }
  ]

  @doc """
  Creates a new channel.
  """
  def new(name, type, opts \\ []) do
    %__MODULE__{
      name: name,
      type: type,
      description: Keyword.get(opts, :description),
      owner: Keyword.get(opts, :owner),
      moderators: Keyword.get(opts, :moderators, []),
      subscribers: MapSet.new(Keyword.get(opts, :subscribers, [])),
      muted: MapSet.new(),
      banned: MapSet.new(),
      created_at: DateTime.utc_now()
    }
  end

  @doc """
  Returns the default channel configurations.
  """
  def default_channels, do: @default_channels

  @doc """
  Checks if a player can join a channel.
  """
  def can_join?(%__MODULE__{type: :system}, _player_id), do: {:error, :system_channel}

  def can_join?(%__MODULE__{banned: banned}, player_id) do
    if MapSet.member?(banned, player_id) do
      {:error, :banned}
    else
      :ok
    end
  end

  @doc """
  Checks if a player can speak in a channel.
  """
  def can_speak?(%__MODULE__{type: :system}, _player_id), do: {:error, :system_channel}

  def can_speak?(%__MODULE__{muted: muted}, player_id) do
    if MapSet.member?(muted, player_id) do
      {:error, :muted}
    else
      :ok
    end
  end

  @doc """
  Checks if a player is subscribed to a channel.
  """
  def subscribed?(%__MODULE__{subscribers: subscribers}, player_id) do
    MapSet.member?(subscribers, player_id)
  end

  @doc """
  Adds a subscriber to a channel.
  """
  def subscribe(%__MODULE__{} = channel, player_id) do
    case can_join?(channel, player_id) do
      :ok ->
        {:ok, %{channel | subscribers: MapSet.put(channel.subscribers, player_id)}}

      error ->
        error
    end
  end

  @doc """
  Removes a subscriber from a channel.
  """
  def unsubscribe(%__MODULE__{} = channel, player_id) do
    {:ok, %{channel | subscribers: MapSet.delete(channel.subscribers, player_id)}}
  end

  @doc """
  Mutes a player in a channel.
  """
  def mute(%__MODULE__{} = channel, player_id) do
    {:ok, %{channel | muted: MapSet.put(channel.muted, player_id)}}
  end

  @doc """
  Unmutes a player in a channel.
  """
  def unmute(%__MODULE__{} = channel, player_id) do
    {:ok, %{channel | muted: MapSet.delete(channel.muted, player_id)}}
  end

  @doc """
  Bans a player from a channel.
  """
  def ban(%__MODULE__{} = channel, player_id) do
    channel =
      channel
      |> Map.update!(:banned, &MapSet.put(&1, player_id))
      |> Map.update!(:subscribers, &MapSet.delete(&1, player_id))

    {:ok, channel}
  end

  @doc """
  Unbans a player from a channel.
  """
  def unban(%__MODULE__{} = channel, player_id) do
    {:ok, %{channel | banned: MapSet.delete(channel.banned, player_id)}}
  end

  @doc """
  Checks if a player is a moderator or owner.
  """
  def is_moderator?(%__MODULE__{owner: owner, moderators: mods}, player_id) do
    player_id == owner or player_id in mods
  end
end
