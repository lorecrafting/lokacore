defmodule Loka.Framework.Commands.ChannelCommand do
  @moduledoc """
  Channel command for managing and using chat channels.

  Channels allow cross-world communication between players.

  ## Usage

      channel list                    # List available channels
      channel join trade              # Join a channel
      channel leave trade             # Leave a channel
      channel who trade               # Who's in channel
      channel say trade Hello!        # Send message to channel
      /trade Hello, selling swords!   # Shortcut for channel message

  ## Default Channels

  - `newbie` - New player help
  - `trade` - Trading and economy
  - `ooc` - Out of character chat
  - `events` - System announcements (read-only)
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.ChannelManager
  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @impl true
  def key, do: "channel"

  @impl true
  def aliases, do: ["ch"]

  @impl true
  def help do
    """
    channel <action> [channel] [args] - Manage chat channels.

    Actions:
      list              - List all available channels
      join <channel>    - Join a channel
      leave <channel>   - Leave a channel
      who <channel>     - See who's in a channel
      say <channel> <message> - Send a message to a channel

    Shortcuts:
      /trade Hello!     - Send directly to a channel

    Examples:
      channel list
      channel join trade
      channel say trade Selling iron swords!
      channel who newbie
    """
  end

  @impl true
  def parse(args, _context) do
    args = String.trim(args)

    case String.split(args, " ", parts: 3) do
      ["list"] ->
        {:ok, %{action: :list}}

      ["list" | _rest] ->
        {:ok, %{action: :list}}

      ["join", channel] ->
        {:ok, %{action: :join, channel: String.downcase(channel)}}

      ["leave", channel] ->
        {:ok, %{action: :leave, channel: String.downcase(channel)}}

      ["who", channel] ->
        {:ok, %{action: :who, channel: String.downcase(channel)}}

      ["say", channel, message] when message != "" ->
        {:ok, %{action: :say, channel: String.downcase(channel), message: message}}

      ["say", _channel] ->
        {:error, "Say what on the channel?"}

      [action] when action in ["join", "leave", "who", "say"] ->
        {:error, "Which channel?"}

      [] ->
        {:ok, %{action: :list}}

      _ ->
        {:error, "Unknown channel action. Try: list, join, leave, who, say"}
    end
  end

  @impl true
  def execute(%{action: :list}, _context) do
    case ChannelManager.list_channels() do
      {:ok, channels} ->
        text = format_channel_list(channels)
        {:ok, [%{type: :info, text: text, recipient: :actor}]}

      {:error, reason} ->
        {:error, "Failed to list channels: #{reason}"}
    end
  end

  def execute(%{action: :join, channel: channel_name}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case ChannelManager.join(channel_name, player_id) do
      :ok ->
        {:ok,
         [
           %{
             type: :info,
             text: "You have joined the [#{channel_name}] channel.",
             recipient: :actor
           },
           %{
             type: :state_update,
             updates: %{
               social: %{
                 channels: %{
                   action: :add,
                   channel: channel_name
                 }
               }
             }
           }
         ]}

      {:error, :channel_not_found} ->
        {:error, "Channel '#{channel_name}' does not exist."}

      {:error, :banned} ->
        {:error, "You are banned from the [#{channel_name}] channel."}

      {:error, :system_channel} ->
        {:error, "You cannot join system channels."}

      {:error, reason} ->
        {:error, "Cannot join channel: #{reason}"}
    end
  end

  def execute(%{action: :leave, channel: channel_name}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case ChannelManager.leave(channel_name, player_id) do
      :ok ->
        {:ok,
         [
           %{
             type: :info,
             text: "You have left the [#{channel_name}] channel.",
             recipient: :actor
           },
           %{
             type: :state_update,
             updates: %{
               social: %{
                 channels: %{
                   action: :remove,
                   channel: channel_name
                 }
               }
             }
           }
         ]}

      {:error, :channel_not_found} ->
        {:error, "Channel '#{channel_name}' does not exist."}

      {:error, reason} ->
        {:error, "Cannot leave channel: #{reason}"}
    end
  end

  def execute(%{action: :who, channel: channel_name}, _context) do
    case ChannelManager.get_channel(channel_name) do
      {:ok, channel} ->
        subscriber_count = MapSet.size(channel.subscribers)
        text = "[#{channel_name}] has #{subscriber_count} subscriber(s)."

        {:ok, [%{type: :info, text: text, recipient: :actor}]}

      {:error, :not_found} ->
        {:error, "Channel '#{channel_name}' does not exist."}
    end
  end

  def execute(%{action: :say, channel: channel_name, message: message}, context) do
    actor = Map.get(context, :actor, %{})
    player_id = Map.get(actor, :id) || Map.get(actor, :player_id)

    case ChannelManager.can_speak?(channel_name, player_id) do
      :ok ->
        msg =
          ScopedMessage.new(:channel, message, actor,
            channel: channel_name,
            message_type: :channel
          )

        MessageRouter.route(msg)

        {:ok,
         [
           %{
             type: :channel,
             text: "[#{channel_name}] You: #{message}",
             recipient: :actor
           }
         ]}

      {:error, :channel_not_found} ->
        {:error, "Channel '#{channel_name}' does not exist."}

      {:error, :not_subscribed} ->
        {:error, "You must join the [#{channel_name}] channel first."}

      {:error, :muted} ->
        {:error, "You are muted in the [#{channel_name}] channel."}

      {:error, :system_channel} ->
        {:error, "You cannot speak in system channels."}

      {:error, reason} ->
        {:error, "Cannot speak in channel: #{reason}"}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp format_channel_list(channels) do
    if Enum.empty?(channels) do
      "No channels available."
    else
      header = "Available channels:\n"

      lines =
        Enum.map(channels, fn ch ->
          type_badge = type_badge(ch.type)
          desc = if ch.description, do: " - #{ch.description}", else: ""
          "  [#{ch.name}]#{type_badge}#{desc} (#{ch.subscriber_count} users)"
        end)

      header <> Enum.join(lines, "\n")
    end
  end

  defp type_badge(:public), do: ""
  defp type_badge(:private), do: " [Private]"
  defp type_badge(:system), do: " [System]"
  defp type_badge(_), do: ""
end
