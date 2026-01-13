defmodule Loka.Framework.Social.ScopedMessage do
  @moduledoc """
  The foundational messaging primitive for all social/communication features.

  ScopedMessage unifies all communication - say, tell, whisper, shout, party chat,
  guild chat, and channels - into a single composable primitive with different scopes.

  ## Scopes

  | Scope | Description | Required Fields |
  |-------|-------------|-----------------|
  | `:room` | Everyone in current room | `location` |
  | `:adjacent` | Current room + neighboring rooms | `location` |
  | `:zone` | Entire zone/area | `location` |
  | `:world` | All online players | - |
  | `:direct` | Single player anywhere | `to` |
  | `:party` | Party members only | `party_id` |
  | `:guild` | Guild members only | `guild_id` |
  | `:channel` | Named channel subscribers | `channel` |

  ## Message Types

  The `message_type` field indicates how to format the message:

  - `:say` - "Alice says, 'Hello!'"
  - `:tell` - "Alice tells you, 'Hello!'"
  - `:whisper` - "Alice whispers to you, 'Hello!'" (room sees: "Alice whispers to Bob.")
  - `:shout` - "Alice shouts, 'Help!'"
  - `:yell` - "From the north, you hear: 'Help!'"
  - `:ooc` - "[OOC] Alice: Hello!"
  - `:emote` - "Alice waves." (handled by existing social system)
  - `:party` - "[Party] Alice: Hello team!"
  - `:guild` - "[Guild] Alice: Hello guild!"
  - `:channel` - "[Trade] Alice: Selling swords!"
  - `:system` - System announcements

  ## Usage

      # Room-scoped say
      msg = ScopedMessage.new(:room, "Hello everyone!", actor,
        location: room_id,
        message_type: :say
      )
      MessageRouter.route(msg)

      # Direct tell
      msg = ScopedMessage.new(:direct, "Want to group?", actor,
        to: target_player_id,
        message_type: :tell
      )
      MessageRouter.route(msg)

      # Party chat
      msg = ScopedMessage.new(:party, "Ready to pull?", actor,
        party_id: party_id,
        message_type: :party
      )
      MessageRouter.route(msg)
  """

  alias Loka.Engine.SocialSubstitution

  @type scope ::
          :room
          | :adjacent
          | :zone
          | :world
          | :direct
          | :party
          | :guild
          | :channel

  @type message_type ::
          :say
          | :tell
          | :whisper
          | :shout
          | :yell
          | :ooc
          | :emote
          | :party
          | :guild
          | :channel
          | :system

  @type t :: %__MODULE__{
          id: String.t(),
          scope: scope(),
          content: String.t(),
          from: map() | nil,
          from_name: String.t() | nil,
          from_id: String.t() | nil,
          to: String.t() | nil,
          to_name: String.t() | nil,
          channel: String.t() | nil,
          party_id: String.t() | nil,
          guild_id: String.t() | nil,
          location: String.t() | nil,
          exclude: [String.t()],
          message_type: message_type(),
          timestamp: DateTime.t()
        }

  defstruct [
    :id,
    :scope,
    :content,
    :from,
    :from_name,
    :from_id,
    :to,
    :to_name,
    :channel,
    :party_id,
    :guild_id,
    :location,
    exclude: [],
    message_type: :say,
    timestamp: nil
  ]

  @doc """
  Creates a new ScopedMessage.

  ## Parameters

  - `scope` - Where the message goes (`:room`, `:direct`, `:party`, etc.)
  - `content` - The message text
  - `from` - The sender (entity map with `:id`, `:name`, etc.)
  - `opts` - Additional options

  ## Options

  - `:to` - Target player ID (required for `:direct` scope)
  - `:to_name` - Target player name (for display)
  - `:location` - Room ID (required for spatial scopes)
  - `:party_id` - Party ID (required for `:party` scope)
  - `:guild_id` - Guild ID (required for `:guild` scope)
  - `:channel` - Channel name (required for `:channel` scope)
  - `:exclude` - List of player IDs to exclude from broadcast
  - `:message_type` - How to format the message (default: `:say`)

  ## Examples

      ScopedMessage.new(:room, "Hello!", actor, location: room_id)
      ScopedMessage.new(:direct, "Hey!", actor, to: player_id, message_type: :tell)
  """
  def new(scope, content, from, opts \\ []) do
    %__MODULE__{
      id: generate_id(),
      scope: scope,
      content: content,
      from: from,
      from_name: get_name(from),
      from_id: get_id(from),
      to: Keyword.get(opts, :to),
      to_name: Keyword.get(opts, :to_name),
      channel: Keyword.get(opts, :channel),
      party_id: Keyword.get(opts, :party_id),
      guild_id: Keyword.get(opts, :guild_id),
      location: Keyword.get(opts, :location),
      exclude: Keyword.get(opts, :exclude, []),
      message_type: Keyword.get(opts, :message_type, :say),
      timestamp: DateTime.utc_now()
    }
  end

  @doc """
  Formats the message for the sender (actor perspective).

  Returns the message as it should appear to the person who sent it.
  """
  def format_for_sender(%__MODULE__{} = msg) do
    case msg.message_type do
      :say ->
        ~s(You say, "#{msg.content}")

      :tell ->
        ~s(You tell #{msg.to_name || "them"}, "#{msg.content}")

      :whisper ->
        ~s(You whisper to #{msg.to_name || "them"}, "#{msg.content}")

      :shout ->
        ~s(You shout, "#{msg.content}")

      :yell ->
        ~s(You yell, "#{msg.content}")

      :ooc ->
        "[OOC] You: #{msg.content}"

      :party ->
        "[Party] You: #{msg.content}"

      :guild ->
        "[Guild] You: #{msg.content}"

      :channel ->
        "[#{msg.channel}] You: #{msg.content}"

      :system ->
        msg.content

      _ ->
        msg.content
    end
  end

  @doc """
  Formats the message for the target (recipient of direct message).

  Returns the message as it should appear to the direct recipient.
  """
  def format_for_target(%__MODULE__{} = msg) do
    case msg.message_type do
      :tell ->
        ~s(#{msg.from_name} tells you, "#{msg.content}")

      :whisper ->
        ~s(#{msg.from_name} whispers to you, "#{msg.content}")

      _ ->
        format_for_room(msg)
    end
  end

  @doc """
  Formats the message for room observers (third-party perspective).

  Returns the message as it should appear to others in the room.
  """
  def format_for_room(%__MODULE__{} = msg) do
    case msg.message_type do
      :say ->
        ~s(#{msg.from_name} says, "#{msg.content}")

      :whisper ->
        # Room sees that whispering happened, but not the content
        "#{msg.from_name} whispers something to #{msg.to_name || "someone"}."

      :shout ->
        ~s(#{msg.from_name} shouts, "#{msg.content}")

      :yell ->
        ~s(#{msg.from_name} yells, "#{msg.content}")

      :ooc ->
        "[OOC] #{msg.from_name}: #{msg.content}"

      :party ->
        "[Party] #{msg.from_name}: #{msg.content}"

      :guild ->
        "[Guild] #{msg.from_name}: #{msg.content}"

      :channel ->
        "[#{msg.channel}] #{msg.from_name}: #{msg.content}"

      :system ->
        msg.content

      _ ->
        msg.content
    end
  end

  @doc """
  Formats the message for adjacent rooms (heard from a distance).

  Returns the message with directional context.
  """
  def format_for_adjacent(%__MODULE__{} = msg, direction) do
    case msg.message_type do
      :shout ->
        ~s(You hear shouting from #{direction}: "#{msg.content}")

      :yell ->
        ~s(From #{direction}, someone yells: "#{msg.content}")

      _ ->
        ~s(You hear something from #{direction}.)
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp generate_id do
    "msg_" <> (:crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower))
  end

  defp get_name(nil), do: "Someone"

  defp get_name(entity) when is_map(entity) do
    SocialSubstitution.get_name(entity)
  end

  defp get_name(_), do: "Someone"

  defp get_id(nil), do: nil

  defp get_id(entity) when is_map(entity) do
    Map.get(entity, :id) || Map.get(entity, :player_id)
  end

  defp get_id(_), do: nil
end
