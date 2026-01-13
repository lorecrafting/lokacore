defmodule Loka.Framework.Commands.RetellCommand do
  @moduledoc """
  Retell command to send another message to the last person you told.

  ## Usage

      retell Actually, meet me at the temple instead.
      rt Never mind, I found it!

  ## How It Works

  Tracks the last player you sent a tell to and uses that as the target.
  If you haven't sent a tell in this session, returns an error.

  ## Integration

  Uses the ScopedMessage primitive with `:direct` scope for routing.
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  @impl true
  def key, do: "retell"

  @impl true
  def aliases, do: ["rt"]

  @impl true
  def help do
    """
    retell <message> - Send another message to the last person you told.

    Examples:
      retell Actually, meet me at the temple instead.
      rt Never mind!

    If you haven't sent a tell recently, this command will not work.
    """
  end

  @impl true
  def parse(args, _context) do
    message = String.trim(args)

    if message == "" do
      {:error, "Retell what?"}
    else
      {:ok, %{message: message}}
    end
  end

  @impl true
  def execute(%{message: message}, context) do
    actor = Map.get(context, :actor)
    game_state = Map.get(context, :game_state, %{})
    last_tell_to = Map.get(game_state, :last_tell_to)

    if last_tell_to do
      case find_player_by_id(last_tell_to) do
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
             }
           ]}

        {:error, :not_found} ->
          {:error, "That player is no longer online."}
      end
    else
      {:error, "You haven't sent a tell to anyone yet."}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp find_player_by_id(player_id) do
    Loka.Engine.EntityRegistry.get_player(player_id)
  end
end
