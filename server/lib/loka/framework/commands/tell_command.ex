defmodule Loka.Framework.Commands.TellCommand do
  @moduledoc """
  Tell command for private player-to-player messaging.

  Sends a private message to another player anywhere in the game.

  ## Usage

      tell Alice Hey, want to group up?
      t Bob Meet me at the tavern!

  ## Output

  - Sender sees: `You tell Alice, "Hey, want to group up?"`
  - Recipient sees: `Bob tells you, "Hey, want to group up?"`

  ## State Tracking

  The command updates the player's state to track:
  - `last_tell_to` - for the `retell` command
  - Recipients track `last_tell_from` - for the `reply` command

  ## Integration

  Uses the ScopedMessage primitive with `:direct` scope for routing.
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @impl true
  def key, do: "tell"

  @impl true
  def aliases, do: ["t"]

  @impl true
  def help do
    """
    tell <player> <message> - Send a private message to another player.

    Examples:
      tell Alice Hey, want to group up?
      t Bob I'll meet you at the tavern.

    The message will only be seen by you and the recipient.
    Use 'reply' to respond to the last person who sent you a tell.
    Use 'retell' to send another message to the last person you told.
    """
  end

  @impl true
  def parse(args, _context) do
    args = String.trim(args)

    case String.split(args, " ", parts: 2) do
      [_target, ""] ->
        {:error, "Tell them what?"}

      [target, message] ->
        {:ok, %{target_name: target, message: message}}

      [_target] ->
        {:error, "Tell them what?"}

      [] ->
        {:error, "Tell whom?"}
    end
  end

  @impl true
  def execute(%{target_name: target_name, message: message}, context) do
    actor = Map.get(context, :actor)

    case find_online_player(target_name) do
      {:ok, target} ->
        target_id = Map.get(target, :id) || Map.get(target, :player_id)
        target_display_name = Map.get(target, :name, target_name)

        msg =
          ScopedMessage.new(:direct, message, actor,
            to: target_id,
            to_name: target_display_name,
            message_type: :tell
          )

        MessageRouter.route(msg)

        # Return events including state updates for reply/retell tracking
        {:ok,
         [
           %{
             type: :tell,
             text: ScopedMessage.format_for_sender(msg),
             recipient: :actor
           },
           %{
             type: :state_update,
             updates: %{last_tell_to: target_id}
           }
         ]}

      {:error, :not_found} ->
        {:error, "Player '#{target_name}' is not online."}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp find_online_player(name) do
    Loka.Engine.EntityRegistry.find_player_by_name(name)
  rescue
    # If EntityRegistry doesn't have this function yet, return not found
    _ -> {:error, :not_found}
  end
end
