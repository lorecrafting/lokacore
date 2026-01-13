defmodule Loka.Framework.Commands.ReplyCommand do
  @moduledoc """
  Reply command to respond to the last person who sent you a tell.

  ## Usage

      reply Sure, I'll be right there!
      r Sounds good!

  ## How It Works

  Tracks the last player who sent you a tell and uses that as the target.
  If no one has sent you a tell in this session, returns an error.

  ## Integration

  Uses the ScopedMessage primitive with `:direct` scope for routing.
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @impl true
  def key, do: "reply"

  @impl true
  def aliases, do: ["r"]

  @impl true
  def help do
    """
    reply <message> - Reply to the last person who sent you a tell.

    Examples:
      reply Sure, I'll be right there!
      r On my way!

    If no one has sent you a tell recently, this command will not work.
    """
  end

  @impl true
  def parse(args, _context) do
    message = String.trim(args)

    if message == "" do
      {:error, "Reply with what?"}
    else
      {:ok, %{message: message}}
    end
  end

  @impl true
  def execute(%{message: message}, context) do
    actor = Map.get(context, :actor)
    game_state = Map.get(context, :game_state, %{})
    last_tell_from = Map.get(game_state, :last_tell_from)

    if last_tell_from do
      case find_player_by_id(last_tell_from) do
        {:ok, target} ->
          target_id = Map.get(target, :id) || Map.get(target, :player_id)
          target_display_name = Map.get(target, :name, "them")

          msg =
            ScopedMessage.new(:direct, message, actor,
              to: target_id,
              to_name: target_display_name,
              message_type: :tell
            )

          MessageRouter.route(msg)

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
          {:error, "That player is no longer online."}
      end
    else
      {:error, "No one has sent you a tell to reply to."}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp find_player_by_id(player_id) do
    Loka.Engine.EntityRegistry.get_player(player_id)
  end
end
