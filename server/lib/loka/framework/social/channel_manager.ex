defmodule Loka.Framework.Social.ChannelManager do
  @moduledoc """
  GenServer managing chat channels.

  Holds all active channels in memory and handles:
  - Channel creation/deletion
  - Subscriptions (join/leave)
  - Moderation (mute/ban)
  - Message routing to channel subscribers

  ## Usage

      # Join a channel
      ChannelManager.join("trade", player_id)

      # Leave a channel
      ChannelManager.leave("trade", player_id)

      # Send message to channel
      ChannelManager.broadcast("trade", message, sender_id)

      # List available channels
      ChannelManager.list_channels()

  ## Integration

  Works with ScopedMessage/MessageRouter for actual message delivery.
  """

  use GenServer
  require Logger

  alias Loka.Framework.Social.Channel

  @name __MODULE__

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the ChannelManager.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: @name)
  end

  @doc """
  Lists all available channels.
  """
  def list_channels do
    GenServer.call(@name, :list_channels)
  end

  @doc """
  Gets a specific channel by name.
  """
  def get_channel(name) do
    GenServer.call(@name, {:get_channel, name})
  end

  @doc """
  Joins a player to a channel.
  """
  def join(channel_name, player_id) do
    GenServer.call(@name, {:join, channel_name, player_id})
  end

  @doc """
  Removes a player from a channel.
  """
  def leave(channel_name, player_id) do
    GenServer.call(@name, {:leave, channel_name, player_id})
  end

  @doc """
  Gets a player's subscribed channels.
  """
  def get_subscriptions(player_id) do
    GenServer.call(@name, {:get_subscriptions, player_id})
  end

  @doc """
  Gets the subscriber list for a channel.
  """
  def get_subscribers(channel_name) do
    GenServer.call(@name, {:get_subscribers, channel_name})
  end

  @doc """
  Checks if a player can speak in a channel.
  """
  def can_speak?(channel_name, player_id) do
    GenServer.call(@name, {:can_speak, channel_name, player_id})
  end

  @doc """
  Creates a new channel.
  """
  def create_channel(name, type, opts \\ []) do
    GenServer.call(@name, {:create_channel, name, type, opts})
  end

  @doc """
  Mutes a player in a channel.
  """
  def mute(channel_name, player_id, by_player_id) do
    GenServer.call(@name, {:mute, channel_name, player_id, by_player_id})
  end

  @doc """
  Unmutes a player in a channel.
  """
  def unmute(channel_name, player_id, by_player_id) do
    GenServer.call(@name, {:unmute, channel_name, player_id, by_player_id})
  end

  @doc """
  Bans a player from a channel.
  """
  def ban(channel_name, player_id, by_player_id) do
    GenServer.call(@name, {:ban, channel_name, player_id, by_player_id})
  end

  @doc """
  Unbans a player from a channel.
  """
  def unban(channel_name, player_id, by_player_id) do
    GenServer.call(@name, {:unban, channel_name, player_id, by_player_id})
  end

  # =============================================================================
  # Server Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    Logger.info("[ChannelManager] Starting")

    # Initialize with default channels
    channels =
      Channel.default_channels()
      |> Enum.reduce(%{}, fn config, acc ->
        channel = Channel.new(config.name, config.type, description: config.description)
        Map.put(acc, config.name, channel)
      end)

    {:ok, %{channels: channels}}
  end

  @impl true
  def handle_call(:list_channels, _from, state) do
    channels =
      state.channels
      |> Map.values()
      |> Enum.map(fn channel ->
        %{
          name: channel.name,
          type: channel.type,
          description: channel.description,
          subscriber_count: MapSet.size(channel.subscribers)
        }
      end)
      |> Enum.sort_by(& &1.name)

    {:reply, {:ok, channels}, state}
  end

  def handle_call({:get_channel, name}, _from, state) do
    case Map.get(state.channels, name) do
      nil -> {:reply, {:error, :not_found}, state}
      channel -> {:reply, {:ok, channel}, state}
    end
  end

  def handle_call({:join, channel_name, player_id}, _from, state) do
    case Map.get(state.channels, channel_name) do
      nil ->
        {:reply, {:error, :channel_not_found}, state}

      channel ->
        case Channel.subscribe(channel, player_id) do
          {:ok, updated_channel} ->
            new_channels = Map.put(state.channels, channel_name, updated_channel)
            {:reply, :ok, %{state | channels: new_channels}}

          {:error, reason} ->
            {:reply, {:error, reason}, state}
        end
    end
  end

  def handle_call({:leave, channel_name, player_id}, _from, state) do
    case Map.get(state.channels, channel_name) do
      nil ->
        {:reply, {:error, :channel_not_found}, state}

      channel ->
        {:ok, updated_channel} = Channel.unsubscribe(channel, player_id)
        new_channels = Map.put(state.channels, channel_name, updated_channel)
        {:reply, :ok, %{state | channels: new_channels}}
    end
  end

  def handle_call({:get_subscriptions, player_id}, _from, state) do
    subscribed =
      state.channels
      |> Enum.filter(fn {_name, channel} -> Channel.subscribed?(channel, player_id) end)
      |> Enum.map(fn {name, _channel} -> name end)
      |> Enum.sort()

    {:reply, {:ok, subscribed}, state}
  end

  def handle_call({:get_subscribers, channel_name}, _from, state) do
    case Map.get(state.channels, channel_name) do
      nil ->
        {:reply, {:error, :channel_not_found}, state}

      channel ->
        subscribers = MapSet.to_list(channel.subscribers)
        {:reply, {:ok, subscribers}, state}
    end
  end

  def handle_call({:can_speak, channel_name, player_id}, _from, state) do
    case Map.get(state.channels, channel_name) do
      nil ->
        {:reply, {:error, :channel_not_found}, state}

      channel ->
        if Channel.subscribed?(channel, player_id) do
          case Channel.can_speak?(channel, player_id) do
            :ok -> {:reply, :ok, state}
            error -> {:reply, error, state}
          end
        else
          {:reply, {:error, :not_subscribed}, state}
        end
    end
  end

  def handle_call({:create_channel, name, type, opts}, _from, state) do
    if Map.has_key?(state.channels, name) do
      {:reply, {:error, :already_exists}, state}
    else
      channel = Channel.new(name, type, opts)
      new_channels = Map.put(state.channels, name, channel)
      {:reply, {:ok, channel}, %{state | channels: new_channels}}
    end
  end

  def handle_call({:mute, channel_name, player_id, by_player_id}, _from, state) do
    with {:ok, channel} <- get_channel_or_error(state, channel_name),
         :ok <- verify_moderator(channel, by_player_id) do
      {:ok, updated_channel} = Channel.mute(channel, player_id)
      new_channels = Map.put(state.channels, channel_name, updated_channel)
      {:reply, :ok, %{state | channels: new_channels}}
    else
      error -> {:reply, error, state}
    end
  end

  def handle_call({:unmute, channel_name, player_id, by_player_id}, _from, state) do
    with {:ok, channel} <- get_channel_or_error(state, channel_name),
         :ok <- verify_moderator(channel, by_player_id) do
      {:ok, updated_channel} = Channel.unmute(channel, player_id)
      new_channels = Map.put(state.channels, channel_name, updated_channel)
      {:reply, :ok, %{state | channels: new_channels}}
    else
      error -> {:reply, error, state}
    end
  end

  def handle_call({:ban, channel_name, player_id, by_player_id}, _from, state) do
    with {:ok, channel} <- get_channel_or_error(state, channel_name),
         :ok <- verify_moderator(channel, by_player_id) do
      {:ok, updated_channel} = Channel.ban(channel, player_id)
      new_channels = Map.put(state.channels, channel_name, updated_channel)
      {:reply, :ok, %{state | channels: new_channels}}
    else
      error -> {:reply, error, state}
    end
  end

  def handle_call({:unban, channel_name, player_id, by_player_id}, _from, state) do
    with {:ok, channel} <- get_channel_or_error(state, channel_name),
         :ok <- verify_moderator(channel, by_player_id) do
      {:ok, updated_channel} = Channel.unban(channel, player_id)
      new_channels = Map.put(state.channels, channel_name, updated_channel)
      {:reply, :ok, %{state | channels: new_channels}}
    else
      error -> {:reply, error, state}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp get_channel_or_error(state, name) do
    case Map.get(state.channels, name) do
      nil -> {:error, :channel_not_found}
      channel -> {:ok, channel}
    end
  end

  defp verify_moderator(channel, player_id) do
    if Channel.is_moderator?(channel, player_id) do
      :ok
    else
      {:error, :not_moderator}
    end
  end
end
